"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";
import { showError, showInfo, showSuccess } from "../lib/toast";

export default function AuthPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [loading, setLoading] = useState(false);

  const translateAuthError = (message: string): string => {
    if (message.includes("Invalid login credentials"))
      return "이메일 또는 비밀번호가 올바르지 않습니다. 이메일 인증을 완료했는지도 확인해주세요.";
    if (message.includes("Email not confirmed"))
      return "이메일 인증이 필요합니다. 받은 메일함을 확인해주세요.";
    if (message.includes("User already registered"))
      return "이미 가입된 이메일입니다. 로그인해주세요.";
    if (message.includes("Password should be at least"))
      return "비밀번호는 6자 이상이어야 합니다.";
    if (message.includes("Unable to validate email address"))
      return "유효하지 않은 이메일 주소입니다.";
    if (message.includes("Email rate limit exceeded"))
      return "이메일 전송 횟수를 초과했습니다. 잠시 후 다시 시도해주세요.";
    if (message.includes("over_email_send_rate_limit"))
      return "이메일 전송 한도를 초과했습니다. 잠시 후 다시 시도해주세요.";
    return message || "인증 중 오류가 발생했습니다.";
  };

  const handleAuth = async () => {
    if (!email.trim()) {
      showInfo("이메일을 입력해주세요.");
      return;
    }

    if (!password.trim() || password.length < 6) {
      showInfo("비밀번호는 6자 이상 입력해주세요.");
      return;
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          showError(translateAuthError(error.message));
          return;
        }

        const user = data.user;
        if (user) {
          await supabase.from("profiles").upsert({
            id: user.id,
            nickname: nickname.trim() || user.email?.split("@")[0] || "user",
          });
        }

        // 세션이 없으면 이메일 인증 필요
        if (!data.session) {
          showInfo("가입 완료! 이메일 받은 편지함에서 인증 링크를 클릭한 후 로그인해주세요.");
          setMode("login");
        } else {
          showSuccess("회원가입이 완료되었습니다.");
          window.location.href = "/";
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          showError(translateAuthError(error.message));
          return;
        }

        showSuccess("로그인되었습니다.");
        window.location.href = "/";
      }
    } catch (error: any) {
      console.error(error);
      showError(translateAuthError(error?.message));
    } finally {
      setLoading(false);
    }
  };

  const handleKakaoLogin = async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        scopes: "profile_nickname",
        queryParams: {
          scope: "profile_nickname",
        },
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) showError(translateAuthError(error.message));
  };

  const handleGoogleLogin = async () => {
    console.log("[OAuth] Starting Google login...", {
      origin: window.location.origin,
      userAgent: navigator.userAgent,
    });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        skipBrowserRedirect: true,
      },
    });
    if (error) {
      console.error("[OAuth] signInWithOAuth error:", {
        message: error.message,
        name: error.name,
        status: (error as any).status,
      });
      showError(translateAuthError(error.message));
      return;
    }
    if (data?.url) {
      console.log("[OAuth] Redirecting to Google OAuth URL...");
      window.location.href = data.url;
    } else {
      console.error("[OAuth] No redirect URL returned from Supabase");
      showError("소셜 로그인 URL을 가져오지 못했습니다. 다시 시도해주세요.");
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    showSuccess("로그아웃되었습니다.");
    window.location.href = "/";
  };

  return (
    <main
      style={{
        maxWidth: 520,
        margin: "60px auto",
        padding: "0 20px",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 24,
          padding: 28,
          background: "white",
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 900,
            marginBottom: 10,
            color: "#111827",
          }}
        >
          {mode === "login" ? "로그인" : "회원가입"}
        </h1>

        <p
          style={{
            color: "#6b7280",
            marginBottom: 20,
            fontSize: 14,
          }}
        >
          주얼리 3D 모델 마켓플레이스 계정으로 이용하세요.
        </p>

        <div style={{ display: "grid", gap: 14 }}>
          {mode === "signup" && (
            <div>
              <label
                style={{
                  display: "block",
                  marginBottom: 6,
                  fontWeight: 700,
                  fontSize: 14,
                }}
              >
                닉네임
              </label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임"
                style={{
                  width: "100%",
                  height: 48,
                  borderRadius: 14,
                  border: "1px solid #d1d5db",
                  padding: "0 14px",
                }}
              />
            </div>
          )}

          <div>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              이메일
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              type="email"
              style={{
                width: "100%",
                height: 48,
                borderRadius: 14,
                border: "1px solid #d1d5db",
                padding: "0 14px",
              }}
            />
          </div>

          <div>
            <label
              style={{
                display: "block",
                marginBottom: 6,
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              비밀번호
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상 입력"
              type="password"
              style={{
                width: "100%",
                height: 48,
                borderRadius: 14,
                border: "1px solid #d1d5db",
                padding: "0 14px",
              }}
            />
          </div>

          <button
            onClick={handleAuth}
            disabled={loading}
            style={{
              height: 52,
              borderRadius: 16,
              border: "none",
              background: loading ? "#9ca3af" : "#111827",
              color: "white",
              fontSize: 15,
              fontWeight: 900,
              cursor: loading ? "default" : "pointer",
              marginTop: 6,
            }}
          >
            {loading
              ? "처리 중..."
              : mode === "login"
              ? "로그인"
              : "회원가입"}
          </button>

          {/* 구분선 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "4px 0",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
            <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 600 }}>또는</span>
            <div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
          </div>

          {/* 구글 소셜 로그인 */}
          <button
            onClick={handleGoogleLogin}
            style={{
              height: 52,
              borderRadius: 16,
              border: "1px solid #e5e7eb",
              background: "white",
              color: "#111827",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {/* Google G 로고 SVG */}
            <svg width="20" height="20" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            Google로 {mode === "login" ? "로그인" : "가입"}
          </button>

          {/* 카카오 소셜 로그인 */}
          <button
            onClick={handleKakaoLogin}
            style={{
              height: 52,
              borderRadius: 16,
              border: "none",
              background: "#FEE500",
              color: "#3C1E1E",
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            {/* 카카오 로고 SVG */}
            <svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path
                fill="#3C1E1E"
                d="M12 3C6.477 3 2 6.477 2 10.8c0 2.7 1.7 5.08 4.27 6.48l-1.09 3.98c-.1.37.31.67.63.46L10.5 19.1A11.2 11.2 0 0 0 12 19.2c5.523 0 10-3.477 10-7.8S17.523 3 12 3Z"
              />
            </svg>
            카카오로 {mode === "login" ? "로그인" : "가입"}
          </button>

          <button
            onClick={() =>
              setMode((prev) => (prev === "login" ? "signup" : "login"))
            }
            style={{
              height: 44,
              borderRadius: 16,
              border: "none",
              background: "none",
              color: "#6b7280",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            {mode === "login"
              ? "아직 계정이 없으신가요? 회원가입"
              : "이미 계정이 있으신가요? 로그인"}
          </button>

          <button
            onClick={handleLogout}
            style={{
              height: 40,
              borderRadius: 14,
              border: "1px solid #fecaca",
              background: "#fff1f2",
              color: "#b91c1c",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    </main>
  );
}