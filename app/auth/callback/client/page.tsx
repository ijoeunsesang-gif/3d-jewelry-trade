"use client";

import { Suspense, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { showError, showSuccess } from "../../../lib/toast";

// Next.js 라우터가 hash를 strip하기 전에 모듈 로드 시점에 즉시 캡처
// useEffect 안에서 읽으면 빠른 환경에서 이미 사라져 있음
const INITIAL_HASH = typeof window !== "undefined" ? window.location.hash : "";

function OAuthCallbackClient() {
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

      // 처음 소셜 로그인 시 프로필 생성
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
      // PKCE flow (Google 등): code → session 교환
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
      // Implicit flow (카카오): 모듈 로드 시 캡처한 hash 사용
      const startImplicitFlow = async () => {
        handled.current = true;
        const hashParams = new URLSearchParams(INITIAL_HASH.substring(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token") ?? "";

        console.log("[Kakao] INITIAL_HASH:", INITIAL_HASH.substring(0, 40) || "(없음)");

        if (access_token) {
          const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) {
            console.error("[Kakao] setSession failed:", error.message);
            showError("카카오 로그인에 실패했습니다. 다시 시도해주세요.");
            setTimeout(() => navigateTo("/auth"), 2000);
            return;
          }
          await handleSession(data.session);
          return;
        }

        // hash 없을 때: 이미 세션이 있는지 확인
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          await handleSession(existingSession);
          return;
        }

        // onAuthStateChange로 대기 (최대 8초)
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

const Spinner = (
  <main
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "60vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      flexDirection: "column",
      gap: 16,
      color: "#6b7280",
    }}
  >
    <div
      style={{
        width: 40,
        height: 40,
        border: "3px solid #e5e7eb",
        borderTopColor: "#111827",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <p style={{ fontSize: 15, fontWeight: 600 }}>로그인 처리 중...</p>
  </main>
);

export default function OAuthCallbackPage() {
  return (
    <Suspense fallback={Spinner}>
      {Spinner}
      <OAuthCallbackClient />
    </Suspense>
  );
}
