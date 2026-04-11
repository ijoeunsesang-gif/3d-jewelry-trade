import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// 카카오 implicit flow: 클라이언트에서 받은 토큰을 서버가 HTTP 쿠키로 저장
// createBrowserClient의 document.cookie는 새로고침 시 SSR에서 못 읽는 경우가 있어
// 서버에서 직접 Set-Cookie 헤더로 쿠키를 설정해야 신뢰성 있게 유지됨
export async function POST(request: NextRequest) {
  const { access_token, refresh_token } = await request.json();

  if (!access_token) {
    return NextResponse.json({ error: "access_token required" }, { status: 400 });
  }

  const response = NextResponse.json({ ok: true });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { error } = await supabase.auth.setSession({
    access_token,
    refresh_token: refresh_token || "",
  });

  if (error) {
    console.error("[session API] setSession failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return response;
}
