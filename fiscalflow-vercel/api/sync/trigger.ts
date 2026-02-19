import { supabaseAdmin } from '../_utils/supabase';
import { nuvemFiscalFetch } from '../_utils/nuvemFiscal';
import { jsonResponse, errorResponse } from '../_utils/responses';

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { company_id } = await req.json();
    if (!company_id) return errorResponse('company_id é obrigatório');

    const { data: company, error: companyError } = await supabaseAdmin.from('companies').select('cnpj, legal_name').eq('id', company_id).single();
    if (companyError || !company) return errorResponse('Empresa não encontrada', 404);

    const { data: lastSync } = await supabaseAdmin.from('sync_logs').select('last_nsu').eq('company_id', company_id).eq('status', 'success').order('finished_at', { ascending: false }).limit(1).single();
    const lastNsu = lastSync?.last_nsu || 0;

    const { data: syncLog } = await supabaseAdmin.from('sync_logs').insert({ company_id, last_nsu: lastNsu, status: 'in_progress', details: 'Sincronização iniciada' }).select('id').single();
    const syncLogId = syncLog?.id;

    let currentNsu = lastNsu;
    let totalSynced = 0;
    let hasMore = true;

    while (hasMore) {
      try {
        const distResponse = await nuvemFiscalFetch('/distribuicao/nfe', {
          method: 'POST',
          body: JSON.stringify({ cpf_cnpj: company.cnpj, tipo_consulta: 'dist-nsu', ultimo_nsu: currentNsu }),
        });
        const distribution = await distResponse.json();

        if (distribution.status === 'processando') {
          await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const docsResponse = await nuvemFiscalFetch(`/distribuicao/nfe/documentos?cpf_cnpj=${company.cnpj}&$top=50&$skip=0`);
        const docsData = await docsResponse.json();
        const documents = docsData?.data || [];

        if (documents.length === 0) { hasMore = false; break; }

        for (const nfDoc of documents) {
          try {
            await processDocument(nfDoc, company_id);
            totalSynced++;
          } catch (docError: any) {
            console.warn(`Sync: Erro documento ${nfDoc.chave}:`, docError.message);
          }
        }

        if (distribution.ult_nsu) currentNsu = distribution.ult_nsu;
        hasMore = distribution.ult_nsu < distribution.max_nsu;
        if (hasMore) await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (batchError: any) {
        console.error('Sync batch error:', batchError.message);
        hasMore = false;
      }
    }

    if (syncLogId) {
      await supabaseAdmin.from('sync_logs').update({ last_nsu: currentNsu, status: 'success', documents_synced: totalSynced, details: `${totalSynced} documentos processados.`, finished_at: new Date().toISOString() }).eq('id', syncLogId);
    }

    return jsonResponse({ message: `Sincronização concluída. ${totalSynced} documentos.`, documents_synced: totalSynced });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}

async function processDocument(nfDoc: any, companyId: string) {
  const accessKey = nfDoc.chave || nfDoc.chave_acesso;
  if (!accessKey) return;

  const { data: existing } = await supabaseAdmin.from('documents').select('id').eq('access_key', accessKey).single();
  if (existing) return;

  let supplierId: string | null = null;
  const supplierCnpj = nfDoc.cnpj_emitente || nfDoc.emit_cnpj;
  if (supplierCnpj) {
    const { data: supplier } = await supabaseAdmin.from('suppliers').upsert({ cnpj_cpf: supplierCnpj.replace(/\D/g, ''), name: nfDoc.nome_emitente || 'Não informado' }, { onConflict: 'cnpj_cpf' }).select('id').single();
    supplierId = supplier?.id || null;
  }

  await supabaseAdmin.from('documents').insert({
    company_id: companyId, supplier_id: supplierId, access_key: accessKey,
    document_type: nfDoc.tipo_documento?.toUpperCase() || 'NFE',
    document_number: nfDoc.numero || '0', series: nfDoc.serie || '0',
    issue_date: nfDoc.data_emissao || new Date().toISOString(),
    total_value: parseFloat(nfDoc.valor || '0'),
    protocol: nfDoc.protocolo || null, status: nfDoc.situacao === 'cancelada' ? 'canceled' : 'authorized',
    manifestation_status: 'none', raw_data: nfDoc,
  });
}
