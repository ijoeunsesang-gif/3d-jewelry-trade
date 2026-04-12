"use client";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { window.location.href = "/auth?error=no_code"; return; }
    supabase.auth.exchangeCodeForSession(code)
      .then(({ error }) => {
        if (error) { window.location.href = "/auth?error=oauth_failed"; }
        else { window.location.href = "/"; }
      });
  }, []);
  return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontSize:16}}>로그인 처리 중...</div>;
}
