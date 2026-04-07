"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { showError, showSuccess } from "../../../lib/toast";

function OAuthCallbackClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const code = searchParams.get("code");
    const next = searchParams.get("next") ?? "/";

    const handleSession = async (session: any) => {
      const user = session?.user;
      if (!user) return;

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
      await supabase.auth.getSession();
      setTimeout(() => { window.location.href = next; }, 500);
    };

    if (code) {
      // PKCE flow (Google 등): code → session 교환
      supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
        if (error) {
          console.error("[OAuth] exchangeCodeForSession failed:", error.message);
          showError("소셜 로그인에 실패했습니다. 다시 시도해주세요.");
          setTimeout(() => { window.location.href = "/auth"; }, 2000);
          return;
        }
        await handleSession(data.session);
      });
    } else {
      // implicit flow (카카오 등): URL hash에서 세션 파싱
      let handled = false;
      let subscription: { unsubscribe: () => void } | null = null;
      let timeout: ReturnType<typeof setTimeout> | null = null;

      const startImplicitFlow = async () => {
        // 1. URL hash에서 access_token 직접 파싱 (카카오 implicit flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const access_token = hashParams.get("access_token");
        const refresh_token = hashParams.get("refresh_token") || "";

        if (access_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (!error) {
            handled = true;
            const { data: { session } } = await supabase.auth.getSession();
            await handleSession(session!);
            return;
          }
          console.error("[OAuth] setSession failed");
        }

        // 2. hash 없으면 이미 파싱된 세션 확인
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession && !handled) {
          handled = true;
          await handleSession(existingSession);
          return;
        }

        // 3. 아직 세션 없으면 onAuthStateChange로 대기
        const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            if (session && !handled) {
              handled = true;
              await handleSession(session);
              sub.unsubscribe();
            }
          }
        );
        subscription = sub;

        // 10초 후에도 세션 없으면 로그인 페이지로
        timeout = setTimeout(() => {
          sub.unsubscribe();
          router.push("/auth");
        }, 10000);
      };

      startImplicitFlow();

      return () => {
        handled = true;
        subscription?.unsubscribe();
        if (timeout) clearTimeout(timeout);
      };
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
      fontFamily: 'system-ui, -apple-system, sans-serif',
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
