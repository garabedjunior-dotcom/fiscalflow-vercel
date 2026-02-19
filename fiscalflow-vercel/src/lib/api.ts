/**
 * Cliente REST para chamadas às Vercel API Routes.
 */
import { supabase } from './supabase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  return headers;
}

export async function apiPost<T = any>(path: string, body?: Record<string, any>): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) window.location.href = '/login';
    throw new Error(data?.error || `Erro ${res.status}`);
  }
  return data as T;
}

export async function apiGet<T = any>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(path, { method: 'GET', headers });
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401) window.location.href = '/login';
    throw new Error(data?.error || `Erro ${res.status}`);
  }
  return data as T;
}
