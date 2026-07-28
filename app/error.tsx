"use client";

import { useEffect } from "react";

// app/page.tsx(서버 컴포넌트)의 데이터 조회 등에서 처리되지 않은 예외가 발생했을 때
// Next.js가 자동으로 이 화면을 보여준다. error.tsx는 반드시 클라이언트 컴포넌트여야 한다.
export default function HomeError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Home] 렌더링 중 오류:", error);
  }, [error]);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <p style={{ fontSize: 40, lineHeight: 1 }}>⚠️</p>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" }}>
        페이지를 불러오는 중 문제가 발생했습니다
      </h2>
      <p style={{ margin: 0, fontSize: 14, color: "#6b7280" }}>
        잠시 후 다시 시도해 주세요.
      </p>
      <button
        type="button"
        onClick={reset}
        style={{
          marginTop: 8,
          height: 46,
          padding: "0 24px",
          borderRadius: 12,
          border: "none",
          background: "#111827",
          color: "white",
          fontWeight: 800,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        다시 시도
      </button>
    </main>
  );
}
