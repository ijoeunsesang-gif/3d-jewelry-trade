"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function FailContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제가 취소되었습니다.";
  return (
    <main style={{ maxWidth: 500, margin: "80px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ background: "white", border: "1px solid #fecaca", borderRadius: 24, padding: 36, textAlign: "center" }}>
        <div style={{ width: 64, height: 64, borderRadius: 999, background: "#fee2e2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, margin: "0 auto 18px" }}>✕</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", marginBottom: 10 }}>결제 실패</h1>
        <p style={{ color: "#6b7280", marginBottom: 28 }}>{message}</p>
        <Link href="/cad-school" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, padding: "0 28px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800 }}>
          캐드스쿨로 돌아가기
        </Link>
      </div>
    </main>
  );
}

export default function CadPaymentFailPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <FailContent />
    </Suspense>
  );
}
