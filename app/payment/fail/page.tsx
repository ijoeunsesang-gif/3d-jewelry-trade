"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function PaymentFailContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? "";
  const message = searchParams.get("message") ?? "결제에 실패했습니다.";

  return (
    <main
      style={{
        maxWidth: 600,
        margin: "80px auto",
        padding: "0 20px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div
        style={{
          border: "1px solid #fecaca",
          borderRadius: 24,
          padding: 40,
          background: "white",
          textAlign: "center",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 999,
            background: "#fee2e2",
            color: "#dc2626",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 32,
            margin: "0 auto 20px",
          }}
        >
          ✕
        </div>

        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", marginBottom: 12 }}>
          결제에 실패했습니다.
        </h1>

        <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 8 }}>
          {message}
        </p>

        {code && (
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 28 }}>
            오류 코드: {code}
          </p>
        )}

        <div style={{ display: "grid", gap: 12, maxWidth: 320, margin: "0 auto" }}>
          <Link
            href="/checkout"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 52,
              borderRadius: 16,
              background: "#111827",
              color: "white",
              textDecoration: "none",
              fontWeight: 900,
              fontSize: 15,
            }}
          >
            다시 시도하기
          </Link>

          <Link
            href="/cart"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 50,
              borderRadius: 16,
              border: "1px solid #d1d5db",
              background: "white",
              color: "#111827",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            장바구니로 돌아가기
          </Link>
        </div>
      </div>
    </main>
  );
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <PaymentFailContent />
    </Suspense>
  );
}
