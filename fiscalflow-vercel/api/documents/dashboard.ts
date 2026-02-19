import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_utils/responses';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('company_id');
    const period = url.searchParams.get('period') || 'month';
    if (!companyId) return errorResponse('company_id é obrigatório');

    const supabase = getSupabaseClient(auth.token);
    const now = new Date();
    let dateFrom: Date;
    if (period === 'week') dateFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
    else if (period === 'year') dateFrom = new Date(now.getFullYear(), 0, 1);
    else dateFrom = new Date(now.getFullYear(), now.getMonth(), 1);

    const { count: totalDocuments } = await supabase.from('documents').select('*', { count: 'exact', head: true }).eq('company_id', companyId).gte('issue_date', dateFrom.toISOString());
    const { data: valueSum } = await supabase.from('documents').select('total_value').eq('company_id', companyId).gte('issue_date', dateFrom.toISOString());
    const totalValue = (valueSum || []).reduce((sum, doc) => sum + parseFloat(doc.total_value || '0'), 0);

    const { data: manifestationCounts } = await supabase.from('documents').select('manifestation_status').eq('company_id', companyId).eq('document_type', 'NFE').gte('issue_date', dateFrom.toISOString());
    const manifestationSummary = (manifestationCounts || []).reduce((acc: Record<string, number>, doc) => { acc[doc.manifestation_status] = (acc[doc.manifestation_status] || 0) + 1; return acc; }, {});

    const { data: typeCounts } = await supabase.from('documents').select('document_type').eq('company_id', companyId).gte('issue_date', dateFrom.toISOString());
    const typeSummary = (typeCounts || []).reduce((acc: Record<string, number>, doc) => { acc[doc.document_type] = (acc[doc.document_type] || 0) + 1; return acc; }, {});

    const { data: recentDocuments } = await supabase.from('documents')
      .select(`id, access_key, document_type, document_number, series, issue_date, total_value, status, manifestation_status, suppliers (name, cnpj_cpf)`)
      .eq('company_id', companyId).order('issue_date', { ascending: false }).limit(10);

    const { data: dailyDocs } = await supabase.from('documents').select('issue_date, total_value').eq('company_id', companyId).gte('issue_date', dateFrom.toISOString()).order('issue_date', { ascending: true });
    const dailyChart = (dailyDocs || []).reduce((acc: Record<string, { count: number; value: number }>, doc) => {
      const day = doc.issue_date.split('T')[0];
      if (!acc[day]) acc[day] = { count: 0, value: 0 };
      acc[day].count++; acc[day].value += parseFloat(doc.total_value || '0');
      return acc;
    }, {});

    const { data: topSuppliers } = await supabase.from('documents').select(`total_value, suppliers (name, cnpj_cpf)`).eq('company_id', companyId).gte('issue_date', dateFrom.toISOString()).not('supplier_id', 'is', null);
    const supplierTotals = (topSuppliers || []).reduce((acc: Record<string, { name: string; value: number }>, doc: any) => {
      const key = doc.suppliers?.cnpj_cpf || 'unknown';
      if (!acc[key]) acc[key] = { name: doc.suppliers?.name || 'Desconhecido', value: 0 };
      acc[key].value += parseFloat(doc.total_value || '0');
      return acc;
    }, {});

    return jsonResponse({
      kpis: { total_documents: totalDocuments || 0, total_value: totalValue, manifestation_summary: manifestationSummary, type_summary: typeSummary },
      recent_documents: recentDocuments || [],
      charts: { daily: Object.entries(dailyChart).map(([date, data]) => ({ date, count: data.count, value: data.value })), top_suppliers: Object.values(supplierTotals).sort((a, b) => b.value - a.value).slice(0, 5) },
    });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
