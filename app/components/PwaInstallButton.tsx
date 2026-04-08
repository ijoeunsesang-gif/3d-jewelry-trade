"use client";

import { useEffect, useState } from "react";

export default function PwaInstallButton() {
  const [prompt, setPrompt] = useState<Event | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setPrompt(e);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // 이미 설치된 경우 숨김
    const mq = window.matchMedia("(display-mode: standalone)");
    if (mq.matches) setVisible(false);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!prompt) return;
    (prompt as any).prompt();
    const { outcome } = await (prompt as any).userChoice;
    if (outcome === "accepted") setVisible(false);
  };

  if (!visible) return null;

  return (
    <button
      onClick={handleInstall}
      style={{
        position: "fixed",
        bottom: 28,
        right: 28,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "12px 20px",
        borderRadius: 999,
        border: "1.5px solid #C9A84C",
        background: "#111827",
        color: "#C9A84C",
        fontSize: 14,
        fontWeight: 800,
        cursor: "pointer",
        boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
        whiteSpace: "nowrap",

        // 모바일 숨김
        // CSS media query는 인라인 불가 → className으로 처리
      }}
      className="pwa-install-btn"
      aria-label="앱으로 설치하기"
    >
      <span style={{ fontSize: 18 }}>📲</span>
      앱으로 설치하기
    </button>
  );
}
