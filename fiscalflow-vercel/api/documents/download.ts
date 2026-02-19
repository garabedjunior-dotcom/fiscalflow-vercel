import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { nuvemFiscalFetch } from '../_utils/nuvemFiscal';
import { errorResponse, unauthorizedResponse, binaryResponse } from '../_utils/responses';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const documentId = url.searchParams.get('document_id');
    const fileType = url.searchParams.get('file_type');
    if (!documentId || !fileType) return errorResponse('document_id e file_type são obrigatórios');
    if (!['xml', 'pdf'].includes(fileType)) return errorResponse('file_type deve ser "xml" ou "pdf"');

    const supabase = getSupabaseClient(auth.token);
    const { data: doc, error } = await supabase.from('documents')
      .select('access_key, document_type, document_number, series, company_id, xml_storage_path')
      .eq('id', documentId).single();
    if (error || !doc) return errorResponse('Documento não encontrado', 404);

    const { data: company } = await supabase.from('companies').select('cnpj').eq('id', doc.company_id).single();

    if (fileType === 'xml' && doc.xml_storage_path) {
      const { data: xmlData } = await supabase.storage.from('fiscal-documents').download(doc.xml_storage_path);
      if (xmlData) {
        const buffer = await xmlData.arrayBuffer();
        return binaryResponse(buffer, 'application/xml', `${doc.access_key}.xml`);
      }
    }

    const nfResponse = await nuvemFiscalFetch(`/distribuicao/nfe/documentos/${doc.access_key}/${fileType}`);
    if (!nfResponse.ok) return errorResponse('Erro ao baixar documento', nfResponse.status);

    const buffer = await nfResponse.arrayBuffer();
    if (fileType === 'xml') {
      const storagePath = `${company?.cnpj || 'unknown'}/${doc.document_type}/${doc.access_key}.xml`;
      supabase.storage.from('fiscal-documents').upload(storagePath, buffer, { contentType: 'application/xml', upsert: true })
        .then(() => supabase.from('documents').update({ xml_storage_path: storagePath }).eq('id', documentId));
      return binaryResponse(buffer, 'application/xml', `${doc.access_key}.xml`);
    }

    return binaryResponse(buffer, 'application/pdf', `DANFE_${doc.document_number}_${doc.series}.pdf`);
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
