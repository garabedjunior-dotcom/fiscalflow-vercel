import { supabaseAdmin } from '../_utils/supabase';
import { nuvemFiscalFetch } from '../_utils/nuvemFiscal';
import { jsonResponse, errorResponse } from '../_utils/responses';

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const events = Array.isArray(payload) ? payload : [payload];
    let processed = 0, errors = 0;

    for (const event of events) {
      try { await processWebhookEvent(event); processed++; } catch { errors++; }
    }

    return jsonResponse({ message: `Processados: ${processed}, Erros: ${errors}`, processed, errors });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 200);
  }
}

async function processWebhookEvent(event: any) {
  const eventType = event.tipo || event.type || event.event;
  if (!eventType?.includes('dist-nfe') && !eventType?.includes('documento')) return;

  const accessKey = event.chave_acesso || event.chave || event.data?.chave;
  const cnpj = event.cpf_cnpj || event.cnpj || event.data?.cpf_cnpj;
  if (!accessKey || !cnpj) return;

  const { data: existing } = await supabaseAdmin.from('documents').select('id').eq('access_key', accessKey).single();
  if (existing) return;

  const { data: company } = await supabaseAdmin.from('companies').select('id').eq('cnpj', cnpj.replace(/\D/g, '')).single();
  if (!company) return;

  const docResponse = await nuvemFiscalFetch(`/distribuicao/nfe/documentos/${accessKey}`);
  if (!docResponse.ok) return;
  const docData = await docResponse.json();

  let supplierId: string | null = null;
  const supplierCnpj = docData.cnpj_emitente || docData.emit_cnpj;
  if (supplierCnpj) {
    const { data: supplier } = await supabaseAdmin.from('suppliers').upsert({ cnpj_cpf: supplierCnpj.replace(/\D/g, ''), name: docData.nome_emitente || 'Não informado' }, { onConflict: 'cnpj_cpf' }).select('id').single();
    supplierId = supplier?.id || null;
  }

  await supabaseAdmin.from('documents').insert({
    company_id: company.id, supplier_id: supplierId, access_key: accessKey,
    document_type: docData.tipo_documento?.toUpperCase() || 'NFE',
    document_number: docData.numero || '0', series: docData.serie || '0',
    issue_date: docData.data_emissao || new Date().toISOString(),
    total_value: parseFloat(docData.valor || '0'), protocol: docData.protocolo || null,
    status: docData.situacao === 'cancelada' ? 'canceled' : 'authorized',
    manifestation_status: 'none', raw_data: docData,
  });
}
