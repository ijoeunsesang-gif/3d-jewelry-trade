"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "pwa-install-dismissed";

export default function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (!dismissed) setVisible(true);
  }, []);

  const dismiss = () => {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 9999,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        padding: "0 0 24px",
      }}
      onClick={dismiss}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: 24,
          padding: "28px 24px 24px",
          maxWidth: 360,
          width: "calc(100% - 32px)",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          position: "relative",
        }}
      >
        {/* 닫기 버튼 */}
        <button
          onClick={dismiss}
          style={{
            position: "absolute",
            top: 14,
            right: 16,
            background: "#f3f4f6",
            border: "none",
            borderRadius: 999,
            width: 28,
            height: 28,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 14,
            color: "#6b7280",
            cursor: "pointer",
          }}
          aria-label="닫기"
        >
          ✕
        </button>

        <p style={{ fontSize: 18, fontWeight: 900, color: "#111827", margin: "0 0 6px" }}>
          📱 앱처럼 편하게 사용하세요!
        </p>
        <p style={{ fontSize: 13, color: "#6b7280", margin: "0 0 20px" }}>
          홈 화면에 추가하면 앱처럼 빠르게 접속할 수 있어요.
        </p>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 10,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>🍎</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#111827", margin: "0 0 2px" }}>
              아이폰
            </p>
            <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
              하단 공유버튼(□↑) →{" "}
              <strong style={{ color: "#111827" }}>"홈 화면에 추가"</strong>
            </p>
          </div>
        </div>

        <div
          style={{
            background: "#f8fafc",
            borderRadius: 14,
            padding: "14px 16px",
            marginBottom: 20,
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>🤖</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: "#111827", margin: "0 0 2px" }}>
              안드로이드
            </p>
            <p style={{ fontSize: 13, color: "#374151", margin: 0 }}>
              우측 상단 메뉴(⋮) →{" "}
              <strong style={{ color: "#111827" }}>"홈 화면에 추가"</strong>
            </p>
          </div>
        </div>

        <button
          onClick={dismiss}
          style={{
            width: "100%",
            height: 48,
            borderRadius: 14,
            border: "none",
            background: "#111827",
            color: "white",
            fontSize: 15,
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          확인했어요
        </button>
      </div>
    </div>
  );
}
