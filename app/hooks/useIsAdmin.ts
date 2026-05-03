"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const uid = (decodeJwt(token) as any)?.sub as string;
    if (!uid) return;
    supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single()
      .then(({ data }) => setIsAdmin(data?.role === "admin"));
  }, []);

  return isAdmin;
}
