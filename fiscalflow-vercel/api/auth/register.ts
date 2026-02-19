import { createClient } from '@supabase/supabase-js';
import { jsonResponse, errorResponse } from '../_utils/responses';

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password) return errorResponse('Nome, email e senha são obrigatórios');
    if (password.length < 6) return errorResponse('A senha deve ter pelo menos 6 caracteres');

    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: { name } },
    });
    if (error) return errorResponse(error.message, 422);

    return jsonResponse({ message: 'Cadastro realizado com sucesso', user: { id: data.user?.id, email: data.user?.email }, session: data.session }, 201);
  } catch (err: any) {
    return errorResponse(err.message || 'Erro interno', 500);
  }
}
