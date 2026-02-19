import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { nuvemFiscalFetch } from '../_utils/nuvemFiscal';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_utils/responses';

export async function POST(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const formData = await req.formData();
    const file = formData.get('certificate') as File | null;
    const password = formData.get('password') as string | null;
    const companyId = formData.get('company_id') as string | null;

    if (!file || !password || !companyId) return errorResponse('Certificado, senha e company_id são obrigatórios');

    const supabase = getSupabaseClient(auth.token);
    const { data: company, error: companyError } = await supabase.from('companies').select('cnpj').eq('id', companyId).single();
    if (companyError || !company) return errorResponse('Empresa não encontrada ou sem permissão', 403);

    const arrayBuffer = await file.arrayBuffer();
    const base64Certificate = Buffer.from(arrayBuffer).toString('base64');

    const nfResponse = await nuvemFiscalFetch(`/empresas/${company.cnpj}/certificado`, {
      method: 'PUT',
      body: JSON.stringify({ certificado: base64Certificate, password }),
    });

    if (!nfResponse.ok) {
      const errData = await nfResponse.json().catch(() => ({}));
      return errorResponse(errData.message || 'Erro ao enviar certificado', nfResponse.status);
    }

    const certData = await nfResponse.json();

    const { data: certificate } = await supabase.from('certificates')
      .upsert({
        company_id: companyId, fingerprint: certData.fingerprint || certData.serial_number || 'N/A',
        subject_name: certData.common_name || certData.subject || 'N/A', issuer_name: certData.issuer || 'N/A',
        valid_from: certData.valid_from || certData.not_before, valid_to: certData.valid_to || certData.not_after,
      }, { onConflict: 'company_id' }).select().single();

    return jsonResponse({ message: 'Certificado enviado com sucesso', certificate: certificate || certData });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
