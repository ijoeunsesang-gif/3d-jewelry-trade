import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from "next/server";

// 점검 모드 ON/OFF
// 점검은 true 종료는 false. 삭제하면 점검종료처리.
const MAINTENANCE_MODE = false;

export async function proxy(request: NextRequest) {
  const res = NextResponse.next()

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

  // Supabase 세션을 쿠키에 유지 (SSR 세션 유실 방지)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => cookies.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        ),
      },
    }
  )
  await supabase.auth.getSession()

  return res
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
