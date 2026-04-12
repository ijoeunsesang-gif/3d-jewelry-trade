"use client";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  useEffect(() => {
    const handlePageShow = (e: PageTransitionEvent) => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) { window.location.href = "/auth?error=no_code"; return; }
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) window.location.href = "/auth?error=" + error.message;
          else window.location.href = "/";
        });
    };

    window.addEventListener("pageshow", handlePageShow);

    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .then(({ error }) => {
          if (error) window.location.href = "/auth?error=" + error.message;
          else window.location.href = "/";
        });
    }

    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontSize:16}}>로그인 처리 중...</div>;
}
