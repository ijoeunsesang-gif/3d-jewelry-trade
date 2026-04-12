"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  const [status, setStatus] = useState("처리 중...");

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    console.log("[callback] code:", code);
    if (!code) {
      setStatus("코드 없음");
      setTimeout(() => { window.location.href = "/auth?error=no_code"; }, 2000);
      return;
    }
    supabase.auth.exchangeCodeForSession(code)
      .then(({ data, error }) => {
        console.log("[callback] data:", JSON.stringify(data?.session?.user?.id));
        console.log("[callback] error:", error?.message);
        if (error) {
          setStatus("오류: " + error.message);
          setTimeout(() => { window.location.href = "/auth?error=" + error.message; }, 3000);
        } else {
          setStatus("성공! 이동 중...");
          window.location.href = "/";
        }
      })
      .catch(e => {
        console.error("[callback] catch:", e);
        setStatus("예외: " + e.message);
      });
  }, []);

  return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",flexDirection:"column",gap:16}}>
    <div style={{fontSize:18}}>{status}</div>
  </div>;
}
