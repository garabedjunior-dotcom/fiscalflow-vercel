import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { nuvemFiscalFetch } from '../_utils/nuvemFiscal';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_utils/responses';

const MANIFESTATION_MAP: Record<string, { tipo_evento: string; status_db: string; descricao: string }> = {
  ciencia: { tipo_evento: 'ciencia', status_db: 'acknowledged', descricao: 'Ciência da Operação' },
  confirmacao: { tipo_evento: 'confirmacao', status_db: 'confirmed', descricao: 'Confirmação da Operação' },
  desconhecimento: { tipo_evento: 'desconhecimento', status_db: 'unknown', descricao: 'Desconhecimento da Operação' },
  nao_realizada: { tipo_evento: 'nao_realizada', status_db: 'unrealized', descricao: 'Operação Não Realizada' },
};

export async function POST(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const { document_id, manifestation_type, justification } = await req.json();
    if (!document_id || !manifestation_type) return errorResponse('document_id e manifestation_type são obrigatórios');

    const manifestation = MANIFESTATION_MAP[manifestation_type];
    if (!manifestation) return errorResponse(`Tipo inválido. Use: ${Object.keys(MANIFESTATION_MAP).join(', ')}`);
    if (['desconhecimento', 'nao_realizada'].includes(manifestation_type) && !justification) return errorResponse('Justificativa é obrigatória');

    const supabase = getSupabaseClient(auth.token);
    const { data: doc, error: docError } = await supabase.from('documents').select('id, access_key, document_type, company_id').eq('id', document_id).single();
    if (docError || !doc) return errorResponse('Documento não encontrado', 404);
    if (doc.document_type !== 'NFE') return errorResponse('Manifestação só é permitida para NFe', 422);

    const { data: company } = await supabase.from('companies').select('cnpj').eq('id', doc.company_id).single();
    if (!company) return errorResponse('Empresa não encontrada', 404);

    const nfPayload: any = { cpf_cnpj: company.cnpj, chave_nfe: doc.access_key, tipo_evento: manifestation.tipo_evento };
    if (justification) nfPayload.justificativa = justification;

    const nfResponse = await nuvemFiscalFetch('/distribuicao/nfe/manifestacoes', { method: 'POST', body: JSON.stringify(nfPayload) });
    const nfData = await nfResponse.json();

    await supabase.from('documents').update({ manifestation_status: manifestation.status_db }).eq('id', document_id);
    await supabase.from('document_events').insert({ document_id, event_type: 'manifestation', event_description: `${manifestation.descricao}${justification ? ` - ${justification}` : ''}`, event_date: new Date().toISOString() });

    return jsonResponse({ message: `Manifestação "${manifestation.descricao}" realizada com sucesso`, manifestation_status: manifestation.status_db, nuvem_fiscal_response: nfData });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
