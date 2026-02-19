import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_utils/responses';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const supabase = getSupabaseClient(auth.token);
    const { data: companies, error } = await supabase
      .from('companies')
      .select(`*, certificates (id, fingerprint, subject_name, valid_from, valid_to)`)
      .order('created_at', { ascending: false });

    if (error) return errorResponse(error.message, 500);
    return jsonResponse({ companies: companies || [] });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
