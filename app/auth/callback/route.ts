import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth?error=missing_code`);
  }

  // 서버 사이드에서 code를 세션으로 교환
  // 실제 쿠키 기반 세션은 @supabase/ssr로 처리하는 게 이상적이나,
  // 현재 프로젝트는 클라이언트 supabase를 사용하므로
  // 코드를 쿼리 파라미터로 클라이언트 페이지에 넘겨 처리
  return NextResponse.redirect(
    `${origin}/auth/callback/client?code=${code}&next=${encodeURIComponent(next)}`
  );
}
