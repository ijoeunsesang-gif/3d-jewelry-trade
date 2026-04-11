"use client";

import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { showError, showSuccess } from "../../../lib/toast";

declare global {
  interface Window { __INITIAL_HASH__: string; }
}

export default function OAuthCallbackClient() {
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const next = searchParams.get("next") ?? "/";
    const navigateTo = (path: string) => window.location.replace(path);

    const upsertProfile = async (user: any) => {
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existing) {
        const { error } = await supabase.from("profiles").insert({
          id: user.id,
          nickname:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "user",
          email: user.email ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        });
        if (error) console.error("[OAuth] Profile creation failed:", error);
      }
    };

    // Implicit flow (카카오): page.tsx의 인라인 <script>로 번들 실행 전에 캡처한 hash 사용
    // window.__INITIAL_HASH__가 없으면 현재 hash 직접 읽기 (방어 코드)
    const startImplicitFlow = async () => {
      const hash = (typeof window !== "undefined" && window.__INITIAL_HASH__) || window.location.hash || "";
      const hashParams = new URLSearchParams(hash.substring(1));
      const access_token = hashParams.get("access_token");
      const refresh_token = hashParams.get("refresh_token") ?? "";

      console.log("[Kakao] hash prefix:", hash.substring(0, 30) || "(없음)");

      if (access_token) {
        // 1. 클라이언트 세션 설정
        const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error || !data.session) {
          console.error("[Kakao] setSession failed:", error?.message);
          showError("카카오 로그인에 실패했습니다. 다시 시도해주세요.");
          setTimeout(() => navigateTo("/auth"), 2000);
          return;
        }

        // 2. 서버에 세션 동기화 — HTTP 쿠키로 저장하여 SSR/새로고침 시 세션 유지
        try {
          const res = await fetch("/api/auth/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ access_token, refresh_token }),
          });
          if (!res.ok) {
            console.error("[Kakao] 서버 세션 동기화 실패:", await res.text());
          }
        } catch (e) {
          console.error("[Kakao] 서버 세션 동기화 네트워크 오류:", e);
        }

        await upsertProfile(data.session.user);
        showSuccess("로그인되었습니다.");
        navigateTo(next);
        return;
      }

      // hash 없을 때: 이미 세션이 있는지 확인 (뒤로가기 등)
      const { data: { session: existingSession } } = await supabase.auth.getSession();
      if (existingSession) {
        await upsertProfile(existingSession.user);
        showSuccess("로그인되었습니다.");
        navigateTo(next);
        return;
      }

      // 세션도 없으면 onAuthStateChange로 최대 8초 대기
      let done = false;
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (session && !done) {
            done = true;
            subscription.unsubscribe();
            await upsertProfile(session.user);
            showSuccess("로그인되었습니다.");
            navigateTo(next);
          }
        }
      );

      setTimeout(() => {
        if (!done) {
          done = true;
          subscription.unsubscribe();
          showError("로그인 시간이 초과되었습니다. 다시 시도해주세요.");
          navigateTo("/auth");
        }
      }, 8000);
    };

    startImplicitFlow();
  }, [searchParams]);

  return null;
}
