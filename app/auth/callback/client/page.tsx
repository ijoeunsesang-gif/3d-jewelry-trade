"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { showError, showSuccess } from "../../../lib/toast";

function OAuthCallbackClient() {
  const searchParams = useSearchParams();

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
          avatar_url: user.user_metadata?.avatar_url ?? null,
        });
        if (profileError) {
          console.error("[OAuth] Profile creation failed:", profileError);
        }
      }

      showSuccess("로그인되었습니다.");
      setTimeout(() => { window.location.href = next; }, 1500);
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
      // implicit flow (카카오 등): detectSessionInUrl: true가 hash를 자동 파싱
      // getSession() 호출로 파싱된 세션을 가져옴
      supabase.auth.getSession().then(async ({ data, error }) => {
        if (error || !data.session) {
          console.error("[OAuth] getSession failed:", error?.message ?? "no session");
          showError("소셜 로그인에 실패했습니다. 다시 시도해주세요.");
          setTimeout(() => { window.location.href = "/auth"; }, 2000);
          return;
        }
        await handleSession(data.session);
      });
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
