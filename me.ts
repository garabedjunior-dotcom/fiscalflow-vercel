import { getUserFromRequest, getSupabaseClient } from '../_utils/supabase';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_utils/responses';

export async function GET(req: Request) {
  const auth = await getUserFromRequest(req);
  if (!auth) return unauthorizedResponse();

  try {
    const supabase = getSupabaseClient(auth.token);
    const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', auth.user.id).single();
    if (error || !profile) return errorResponse('Perfil não encontrado', 404);

    return jsonResponse({ id: auth.user.id, email: auth.user.email, name: profile.name, created_at: profile.created_at });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
