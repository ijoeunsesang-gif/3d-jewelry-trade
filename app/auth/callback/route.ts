import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // implicit flow (카카오 등): 서버는 URL hash를 읽지 못하므로 클라이언트로 위임
  if (!code) {
    return NextResponse.redirect(
      `${origin}/auth/callback/client?next=${encodeURIComponent(next)}`
    );
  }

  // PKCE flow (Google 등): 서버에서 직접 code → session 교환
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("[OAuth] exchangeCodeForSession failed:", error.message);
    return NextResponse.redirect(`${origin}/auth?error=oauth_failed`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
