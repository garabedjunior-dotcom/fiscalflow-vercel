import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '../_utils/responses';

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) return errorResponse('Email e senha são obrigatórios');

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return errorResponse('Email ou senha inválidos', 401);

    return jsonResponse({
      user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || '' },
      session: { access_token: data.session.access_token, refresh_token: data.session.refresh_token, expires_at: data.session.expires_at },
    });
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
