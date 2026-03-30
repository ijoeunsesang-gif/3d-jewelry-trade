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

    if (!code) {
      console.error("[OAuth] Missing auth code in callback URL", {
        url: window.location.href,
        searchParams: Object.fromEntries(searchParams.entries()),
      });
      showError("인증 코드가 없습니다. 다시 시도해주세요.");
      setTimeout(() => { window.location.href = "/auth"; }, 2000);
      return;
    }

    console.log("[OAuth] Exchanging code for session...", {
      codeLength: code.length,
      next,
      userAgent: navigator.userAgent,
      cookies: document.cookie ? "exists" : "empty",
    });

    supabase.auth
      .exchangeCodeForSession(code)
      .then(async ({ data, error }) => {
        if (error) {
          console.error("[OAuth] exchangeCodeForSession failed:", {
            message: error.message,
            status: (error as any).status,
            name: error.name,
            stack: (error as any).stack,
            cause: (error as any).cause,
            // code_verifier 디버깅용: 현재 cookie 키 확인
            cookieKeys: document.cookie
              .split(";")
              .map((c) => c.trim().split("=")[0])
              .filter((k) => k.includes("supabase") || k.includes("code")),
          });
          showError("소셜 로그인에 실패했습니다. 다시 시도해주세요.");
          setTimeout(() => { window.location.href = "/auth"; }, 2000);
          return;
        }

        const user = data.session?.user;
        console.log("[OAuth] Session obtained:", { userId: user?.id, email: user?.email });

        if (user) {
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
        }

        console.log("[OAuth] Login successful, redirecting to:", next);
        showSuccess("로그인되었습니다.");
        setTimeout(() => { window.location.href = next; }, 1500);
      });
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
