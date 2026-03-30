import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// PKCE code_verifier를 cookie에 저장 (모바일 크로스오리진 리다이렉트 후 localStorage 유실 문제 해결)
function setCookie(name: string, value: string, minutes = 10) {
  const expires = new Date(Date.now() + minutes * 60 * 1000).toUTCString();
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`;
}

function getCookie(name: string): string | null {
  const encodedName = encodeURIComponent(name);
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${encodedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function deleteCookie(name: string) {
  document.cookie = `${encodeURIComponent(name)}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
}

/**
 * code-verifier 키는 cookie로 저장 (모바일 크로스오리진 리다이렉트 시에도 유지됨)
 * 나머지 세션 데이터는 localStorage로 저장
 */
const hybridStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    if (key.includes("code-verifier")) {
      const val = getCookie(key);
      console.debug("[supabase storage] getItem (cookie)", key, val ? "found" : "null");
      return val;
    }
    return localStorage.getItem(key);
  },
  setItem(key: string, value: string): void {
    if (typeof window === "undefined") return;
    if (key.includes("code-verifier")) {
      console.debug("[supabase storage] setItem (cookie)", key);
      setCookie(key, value, 10);
      return;
    }
    localStorage.setItem(key, value);
  },
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    if (key.includes("code-verifier")) {
      console.debug("[supabase storage] removeItem (cookie)", key);
      deleteCookie(key);
      return;
    }
    localStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: "pkce",
    detectSessionInUrl: false, // client 페이지에서 명시적으로 exchangeCodeForSession 호출 → 자동 exchange 비활성화
    storage: typeof window !== "undefined" ? hybridStorage : undefined,
  },
});
