"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type PopupNotice = {
  id: string;
  title: string | null;
  content: string | null;
  image_url: string | null;
  link_url: string | null;
};

const DISMISS_MS = 24 * 60 * 60 * 1000;

function isDismissed(id: string): boolean {
  if (typeof window === "undefined") return false;
  const raw = window.localStorage.getItem(`popup_dismissed_${id}`);
  if (!raw) return false;
  const ts = Number(raw);
  if (Number.isNaN(ts)) return false;
  return Date.now() - ts < DISMISS_MS;
}

export default function PopupNoticeModal() {
  const [popups, setPopups] = useState<PopupNotice[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/popup-notices/active");
        if (!res.ok) return;
        const { popups: fetched } = await res.json();
        setPopups(((fetched || []) as PopupNotice[]).filter((p) => !isDismissed(p.id)));
      } catch {
        // 팝업 로딩 실패는 홈페이지 이용에 영향 없어야 하므로 조용히 무시
      }
    })();
  }, []);

  const closeOnly = (id: string) => {
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };

  const dismissForToday = (id: string) => {
    window.localStorage.setItem(`popup_dismissed_${id}`, String(Date.now()));
    setPopups((prev) => prev.filter((p) => p.id !== id));
  };

  if (popups.length === 0) return null;

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => {
        // 오버레이 자체를 클릭했을 때만 닫기 (카드 내부 클릭은 버블링돼도 target이 카드라 무시됨)
        if (e.target === e.currentTarget) setPopups([]);
      }}
    >
      {popups.map((p, i) => (
        <div
          key={p.id}
          style={{
            position: "fixed",
            top: `calc(50% + ${i * 14}px)`,
            left: `calc(50% + ${i * 14}px)`,
            transform: "translate(-50%, -50%)",
            zIndex: 2000 + (popups.length - i),
            width: "calc(100% - 32px)",
            maxWidth: 420,
            maxHeight: "85vh",
            display: "flex",
            flexDirection: "column",
            background: "white",
            borderRadius: 16,
            boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
            overflow: "hidden",
          }}
        >
          {/* 상단: 제목 (고정) */}
          {p.title && (
            <div style={{ flexShrink: 0, padding: "16px 20px 12px", borderBottom: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{p.title}</div>
            </div>
          )}

          {/* 중앙: 이미지 + 본문 (스크롤) */}
          {(p.image_url || p.content || (p.link_url && !p.image_url)) && (
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
              {p.image_url && (
                p.link_url ? (
                  <a href={p.link_url} target="_blank" rel="noopener noreferrer">
                    <Image src={p.image_url} alt={p.title || "공지"} width={420} height={300} style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }} />
                  </a>
                ) : (
                  <Image src={p.image_url} alt={p.title || "공지"} width={420} height={300} style={{ width: "100%", height: "auto", display: "block", objectFit: "cover" }} />
                )
              )}

              {(p.content || (p.link_url && !p.image_url)) && (
                <div style={{ padding: "16px 20px" }}>
                  {p.content && (
                    <div style={{ fontSize: 14, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", lineHeight: 1.6 }}>{p.content}</div>
                  )}
                  {p.link_url && !p.image_url && (
                    <a
                      href={p.link_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "inline-flex", alignItems: "center", justifyContent: "center",
                        height: 40, padding: "0 18px", marginTop: 12, borderRadius: 10,
                        background: "#111827", color: "white", fontSize: 13, fontWeight: 700,
                        textDecoration: "none",
                      }}
                    >
                      자세히 보기
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 하단: 버튼 (고정) */}
          <div style={{ flexShrink: 0, display: "flex", borderTop: "1px solid #f3f4f6" }}>
            <button
              type="button"
              onClick={() => dismissForToday(p.id)}
              style={{
                flex: 1, height: 46, border: "none", background: "white", cursor: "pointer",
                fontSize: 13, fontWeight: 700, color: "#6b7280", borderRight: "1px solid #f3f4f6",
              }}
            >
              오늘 그만 보기
            </button>
            <button
              type="button"
              onClick={() => closeOnly(p.id)}
              style={{
                flex: 1, height: 46, border: "none", background: "white", cursor: "pointer",
                fontSize: 13, fontWeight: 700, color: "#111827",
              }}
            >
              닫기
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
