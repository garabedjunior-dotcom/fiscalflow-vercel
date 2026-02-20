import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { nuvemFiscalFetch } from '../_utils/nuvemFiscal';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_utils/responses';

export async function POST(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { cnpj, legal_name, trade_name, email } = await req.json();
    if (!cnpj || !legal_name) return errorResponse('CNPJ e razão social são obrigatórios');

    const cleanCnpj = cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return errorResponse('CNPJ inválido');

    const supabase = getSupabaseClient(auth.token);

    const { data: company, error: dbError } = await supabase
      .from('companies')
      .insert({ owner_id: auth.user.id, cnpj: cleanCnpj, legal_name, trade_name: trade_name || null })
      .select()
      .single();

    if (dbError) {
      if (dbError.code === '23505') return errorResponse('Este CNPJ já está cadastrado', 409);
      return errorResponse(dbError.message, 422);
    }

    try {
      await nuvemFiscalFetch('/empresas', {
        method: 'POST',
        body: JSON.stringify({
          cpf_cnpj: cleanCnpj, nome_razao_social: legal_name, nome_fantasia: trade_name || legal_name,
          email: email || auth.user.email,
          endereco: { logradouro: 'A definir', numero: 'S/N', bairro: 'A definir', codigo_municipio: '3550308', cidade: 'São Paulo', uf: 'SP', cep: '01001000' },
        }),
      });
    } catch (nfError: any) {
      console.warn('Aviso: Falha ao cadastrar na Nuvem Fiscal:', nfError.message);
    }

    return jsonResponse({ company }, 201);
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
