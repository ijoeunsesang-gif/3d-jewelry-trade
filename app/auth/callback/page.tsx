"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    console.log("[callback] code:", code);
    if (!code) { router.replace("/auth?error=no_code"); return; }
    supabase.auth.exchangeCodeForSession(code)
      .then(({ data, error }) => {
        console.log("[callback] result:", { data, error });
        if (error) {
          console.error("[callback] error:", error.message);
          router.replace("/auth?error=oauth_failed");
        } else {
          console.log("[callback] success, session:", data.session);
          window.location.href = "/";
        }
      })
      .catch((e) => {
        console.error("[callback] catch:", e);
        router.replace("/auth?error=exception");
      });
  }, []);
  return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>로그인 처리 중...</div>;
}
