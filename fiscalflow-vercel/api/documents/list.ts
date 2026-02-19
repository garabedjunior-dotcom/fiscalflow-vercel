import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_utils/responses';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const url = new URL(req.url);
    const companyId = url.searchParams.get('company_id');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const perPage = Math.min(100, Math.max(1, parseInt(url.searchParams.get('per_page') || '20')));
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status');
    const manifestation = url.searchParams.get('manifestation');
    const supplier = url.searchParams.get('supplier');
    const dateFrom = url.searchParams.get('date_from');
    const dateTo = url.searchParams.get('date_to');
    const sortBy = url.searchParams.get('sort_by') || 'issue_date';
    const sortOrder = url.searchParams.get('sort_order') === 'asc';

    if (!companyId) return errorResponse('company_id é obrigatório');

    const supabase = getSupabaseClient(auth.token);
    const offset = (page - 1) * perPage;

    let query = supabase.from('documents').select(`*, suppliers (id, cnpj_cpf, name)`, { count: 'exact' }).eq('company_id', companyId);

    if (type) query = query.eq('document_type', type.toUpperCase());
    if (status) query = query.eq('status', status);
    if (manifestation) query = query.eq('manifestation_status', manifestation);
    if (dateFrom) query = query.gte('issue_date', dateFrom);
    if (dateTo) query = query.lte('issue_date', dateTo);

    if (supplier) {
      const { data: supplierIds } = await supabase.from('suppliers').select('id').or(`name.ilike.%${supplier}%,cnpj_cpf.ilike.%${supplier}%`);
      if (supplierIds && supplierIds.length > 0) {
        query = query.in('supplier_id', supplierIds.map(s => s.id));
      } else {
        return jsonResponse({ documents: [], total: 0, page, per_page: perPage, total_pages: 0 });
      }
    }

    query = query.order(sortBy, { ascending: sortOrder }).range(offset, offset + perPage - 1);
    const { data: documents, error, count } = await query;
    if (error) return errorResponse(error.message, 500);

    const total = count || 0;
    return jsonResponse({ documents: documents || [], total, page, per_page: perPage, total_pages: Math.ceil(total / perPage) });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
