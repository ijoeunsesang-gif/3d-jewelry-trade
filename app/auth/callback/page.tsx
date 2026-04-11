"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (!code) { router.replace("/auth?error=no_code"); return; }
    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) router.replace("/auth?error=oauth_failed");
      else router.replace("/");
    });
  }, []);
  return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh"}}>로그인 처리 중...</div>;
}
