import { NextRequest, NextResponse } from "next/server";

// 점검 모드 ON/OFF
// 점검은 true 종료는 false. 삭제하면 점검종료처리.
const MAINTENANCE_MODE = false;

export function middleware(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next();

  const { pathname } = request.nextUrl;

  // 점검 페이지 자체와 정적 파일은 통과
  if (
    pathname.startsWith("/maintenance") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  // 나머지 모든 요청을 점검 페이지로 리다이렉트
  return NextResponse.redirect(new URL("/maintenance", request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
