import { Suspense } from "react";
import OAuthCallbackClient from "./OAuthCallbackClient";

// Server Component: <script> 인라인 태그가 Next.js 번들보다 먼저 실행되어
// window.__INITIAL_HASH__에 hash를 안전하게 캡처함
export default function OAuthCallbackPage() {
  return (
    <>
      {/* Next.js 번들 실행 전 hash 캡처 — 카카오 implicit flow 타이밍 문제 수정 */}
      <script
        dangerouslySetInnerHTML={{
          __html: "window.__INITIAL_HASH__ = window.location.hash || '';",
        }}
      />
      <Suspense fallback={<LoadingSpinner />}>
        <OAuthCallbackClient />
      </Suspense>
    </>
  );
}

function LoadingSpinner() {
  return (
    <main
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "60vh",
        fontFamily: "system-ui, -apple-system, sans-serif",
        flexDirection: "column",
        gap: 16,
        color: "#6b7280",
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          border: "3px solid #e5e7eb",
          borderTopColor: "#111827",
          borderRadius: "50%",
          animation: "spin 0.7s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p style={{ fontSize: 15, fontWeight: 600 }}>로그인 처리 중...</p>
    </main>
  );
}
