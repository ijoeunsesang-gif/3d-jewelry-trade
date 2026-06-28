import { Suspense } from "react";
import OAuthCallbackClient from "./OAuthCallbackClient";
import { LoadingSpinner } from "../../../components/LoadingSpinner";

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
      <Suspense fallback={<LoadingSpinner fullPage message="로그인 처리 중..." />}>
        <OAuthCallbackClient />
      </Suspense>
    </>
  );
}
