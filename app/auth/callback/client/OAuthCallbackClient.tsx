"use client";

// PKCE flow 전환 후 이 페이지는 더 이상 카카오 implicit hash 처리를 하지 않음.
// 구글·카카오 모두 /auth/callback (route.ts) 서버에서 code exchange 처리.
// 이 페이지는 만약 code 없이 /auth/callback/client에 직접 접근했을 때 fallback.

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OAuthCallbackClient() {
  const router = useRouter();

  useEffect(() => {
    // 정상적인 PKCE flow라면 이 페이지에 도달하지 않음.
    // 비정상 접근 시 로그인 페이지로 리다이렉트.
    router.replace("/auth");
  }, [router]);

  return null;
}
