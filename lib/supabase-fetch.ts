export function decodeJwt(token: string) {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch { return null }
}

export async function sbFetch(table: string, query: string = '') {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
      'Content-Type': 'application/json'
    }
  });
  if (!res.ok) return { data: null, error: await res.json() };
  return { data: await res.json(), error: null };
}

export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('sb-fvhotaxjdacfulxjahon-auth-token');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = parsed?.access_token ?? parsed?.[0]?.access_token ?? null;
    if (token) console.log('토큰 sub:', decodeJwt(token)?.sub);
    return token;
  } catch { return null; }
}

export async function sbAuthFetch(table: string, query: string = '') {
  const token = getAccessToken();
  const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${table}${query}`, {
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      Authorization: `Bearer ${token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`
    }
  });
  if (!res.ok) return { data: null, error: await res.json() };
  return { data: await res.json(), error: null };
}
