import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // implicit flow: code가 없으면 hash(#access_token=...)로 토큰이 전달된 경우
  // 서버는 hash를 받지 못하므로 클라이언트 페이지로 넘겨 detectSessionInUrl이 처리하게 함
  if (!code) {
    return NextResponse.redirect(`${origin}/auth/callback/client?next=${encodeURIComponent(next)}`);
  }

  // PKCE flow(Google 등): code를 클라이언트 페이지로 넘겨 exchangeCodeForSession 처리
  return NextResponse.redirect(
    `${origin}/auth/callback/client?code=${code}&next=${encodeURIComponent(next)}`
  );
}
