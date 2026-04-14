"use client";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase-browser";

export default function CallbackPage() {
  const [msg, setMsg] = useState("처리 중...");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setMsg("이벤트: " + event);
      if (event === "INITIAL_SESSION") {
        if (session) {
          window.location.href = "/";
        } else {
          setMsg("세션없음 - " + event);
          window.location.href = "/auth?error=no_session";
        }
      }
      if (event === "SIGNED_IN") {
        window.location.href = "/";
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  return (
    <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",flexDirection:"column",gap:16}}>
      <div>{msg}</div>
    </div>
  );
}
