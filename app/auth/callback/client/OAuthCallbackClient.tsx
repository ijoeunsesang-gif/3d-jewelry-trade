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

    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    const navigateTo = (path: string) => {
      window.location.replace(path);
    };

    const handleSession = async (session: any) => {
      const user = session?.user;
      if (!user) {
        showError("세션 정보를 가져올 수 없습니다.");
        navigateTo("/auth");
        return;
      }

      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", user.id)
        .single();

      if (!existing) {
        const { error: profileError } = await supabase.from("profiles").insert({
          id: user.id,
          nickname:
            user.user_metadata?.full_name ||
            user.user_metadata?.name ||
            user.email?.split("@")[0] ||
            "user",
          email: user.email ?? null,
          avatar_url: user.user_metadata?.avatar_url ?? null,
        });
        if (profileError) {
          console.error("[OAuth] Profile creation failed:", profileError);
        }
      }

      showSuccess("로그인되었습니다.");
      navigateTo(next);
    };

    if (code) {
      // PKCE flow (Google 등)
      handled.current = true;
      supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
        if (error) {
          console.error("[OAuth] exchangeCodeForSession failed:", error.message);
          showError("소셜 로그인에 실패했습니다. 다시 시도해주세요.");
          setTimeout(() => navigateTo("/auth"), 2000);
          return;
        }
        await handleSession(data.session);
      });
    } else {
      // Implicit flow (카카오): inline script로 사전 캡처한 hash 사용
      const startImplicitFlow = async () => {
        handled.current = true;

        // window.__INITIAL_HASH__는 <script> 인라인 태그로 번들 실행 전에 캡처됨
        const hash = window.__INITIAL_HASH__ || "";
        const hashParams = new URLSearchParams(hash.substring(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token") ?? "";

        console.log("[Kakao] __INITIAL_HASH__:", hash.substring(0, 40) || "(없음)");

        if (access_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            console.error("[Kakao] setSession failed:", error.message);
            showError("카카오 로그인에 실패했습니다. 다시 시도해주세요.");
            setTimeout(() => navigateTo("/auth"), 2000);
            return;
          }

          // 서버 쿠키에도 세션 동기화 — 새로고침 시 SSR이 세션을 읽을 수 있도록
          try {
            await fetch("/api/auth/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ access_token, refresh_token }),
            });
          } catch (e) {
            console.error("[Kakao] 서버 세션 동기화 실패:", e);
          }

          await handleSession(data.session);
          return;
        }

        // hash 없을 때: 기존 세션 확인
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          await handleSession(existingSession);
          return;
        }

        // onAuthStateChange 대기 (최대 8초)
        let done = false;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (session && !done) {
              done = true;
              subscription.unsubscribe();
              await handleSession(session);
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
    }
  }, [searchParams]);

  return null;
}
