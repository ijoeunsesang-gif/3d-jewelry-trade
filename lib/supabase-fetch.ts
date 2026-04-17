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
