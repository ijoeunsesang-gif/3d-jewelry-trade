"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";

const GOLD = "#c9a84c";

export default function PaymentFailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const message = searchParams.get("message") || "결제가 취소되었거나 실패했습니다.";
  const code = searchParams.get("code");

  return (
    <main style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: 'system-ui, -apple-system, sans-serif', background: "#f9fafb",
    }}>
      <div style={{
        background: "white", borderRadius: 20, padding: "48px 40px", maxWidth: 400, width: "100%",
        textAlign: "center", boxShadow: "0 4px 24px rgba(0,0,0,0.08)",
      }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: "#111827", marginBottom: 8 }}>결제 실패</div>
        {code && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 6 }}>오류 코드: {code}</div>
        )}
        <div style={{ fontSize: 14, color: "#6b7280", wordBreak: "break-all" }}>{message}</div>
        <button
          type="button"
          onClick={() => router.replace(`/commission/${id}`)}
          style={{
            marginTop: 28, height: 44, padding: "0 28px", borderRadius: 10,
            border: "none", background: GOLD, color: "white",
            fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}
        >
          의뢰로 돌아가기
        </button>
      </div>
    </main>
  );
}
