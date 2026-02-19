const NUVEM_FISCAL_AUTH_URL = 'https://auth.nuvemfiscal.com.br/oauth/token';
const NUVEM_FISCAL_API_URL = 'https://api.nuvemfiscal.com.br';
const SCOPES = 'empresa distribuicao-nfe nfe nfse cte conta';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken;
  }
  const clientId = process.env.NUVEM_FISCAL_CLIENT_ID;
  const clientSecret = process.env.NUVEM_FISCAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Credenciais da Nuvem Fiscal não configuradas.');
  }
  const response = await fetch(NUVEM_FISCAL_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: SCOPES,
    }),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Falha na autenticação com a Nuvem Fiscal: ${detail}`);
  }
  const data = await response.json();
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60000,
  };
  return cachedToken.accessToken;
}

export async function nuvemFiscalFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken();
  const url = `${NUVEM_FISCAL_API_URL}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
}

export function handleNuvemFiscalError(error: any): { status: number; message: string } {
  return { status: error.status || 500, message: error.message || 'Erro na API Nuvem Fiscal' };
}
