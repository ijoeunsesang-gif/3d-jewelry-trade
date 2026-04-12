"use client";
import { useEffect } from "react";
import { supabase } from "../../lib/supabase";

export default function CallbackPage() {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) {
        subscription.unsubscribe();
        setTimeout(() => {
          window.location.href = "/";
        }, 500);
      }
    });

    setTimeout(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          subscription.unsubscribe();
          window.location.href = "/";
        }
      });
    }, 3000);

    return () => subscription.unsubscribe();
  }, []);

  return <div style={{display:"flex",justifyContent:"center",alignItems:"center",height:"100vh",fontSize:16}}>로그인 처리 중...</div>;
}
