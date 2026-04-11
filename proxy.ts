import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from "next/server";

// 점검 모드 ON/OFF
// 점검은 true 종료는 false. 삭제하면 점검종료처리.
const MAINTENANCE_MODE = false;

export async function proxy(request: NextRequest) {
  // 점검 모드 처리
  if (MAINTENANCE_MODE) {
    const { pathname } = request.nextUrl;
    if (
      !pathname.startsWith("/maintenance") &&
      !pathname.startsWith("/_next/") &&
      !pathname.startsWith("/favicon")
    ) {
      return NextResponse.redirect(new URL("/maintenance", request.url));
    }
  }

  let supabaseResponse = NextResponse.next({ request })

  // Supabase 세션 쿠키 갱신 (getUser()로 토큰 만료 시 자동 갱신)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 반드시 getUser() 호출해야 세션이 갱신됨
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
