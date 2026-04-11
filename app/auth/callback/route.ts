import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

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

  // PKCE flow (Google 등): 리다이렉트 응답을 먼저 생성하고 Set-Cookie를 직접 설정
  // ※ cookies()로 set한 뒤 NextResponse.redirect()를 새로 만들면 Set-Cookie가 누락됨
  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          // request와 response 양쪽에 쿠키 설정
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
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

  // Set-Cookie 헤더가 포함된 redirect 응답 반환
  return response;
}
