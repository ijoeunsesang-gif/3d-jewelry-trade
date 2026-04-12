"use client";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  useEffect(() => {
    let attempts = 0;
    const check = async () => {
      attempts++;
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        window.location.href = "/";
        return;
      }
      if (attempts < 20) {
        setTimeout(check, 500);
      } else {
        window.location.href = "/auth?error=timeout";
      }
    };
    setTimeout(check, 1000);
  }, []);

  return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontSize:16}}>로그인 처리 중...</div>;
}
