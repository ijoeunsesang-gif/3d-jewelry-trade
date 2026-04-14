"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getSupabase } from "../../lib/supabase-browser";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [msg, setMsg] = useState("인증 처리 중...");

  useEffect(() => {
    const handleCallback = async () => {
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/";

      if (code) {
        const supabase = getSupabase();
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          // code 파라미터 없이 리다이렉트
          window.location.replace(next);
        } else {
          console.error("[Callback] exchangeCodeForSession 실패:", error.message);
          setMsg("인증에 실패했습니다. 다시 시도해주세요.");
          setTimeout(() => {
            window.location.replace("/auth?error=callback_failed");
          }, 2000);
        }
      } else {
        // code가 없으면 이미 세션이 있는지 확인
        const supabase = getSupabase();
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.replace("/");
        } else {
          window.location.replace("/auth?error=no_code");
        }
      }
    };

    handleCallback();
  }, [searchParams]);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        flexDirection: "column",
        gap: 16,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        color: "#374151",
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          border: "3px solid #e5e7eb",
          borderTop: "3px solid #111827",
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
        }}
      />
      <div style={{ fontSize: 15 }}>{msg}</div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function CallbackPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100vh",
            color: "#374151",
            fontFamily: "system-ui, sans-serif",
          }}
        >
          인증 처리 중...
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
