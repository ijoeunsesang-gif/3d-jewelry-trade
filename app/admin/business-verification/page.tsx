"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "@/app/lib/toast";

type PendingSeller = {
  id: string;
  nickname: string | null;
  business_name: string | null;
  business_number: string | null;
  business_registration_url: string | null;
  is_business_verified: boolean;
};

export default function BusinessVerificationPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [sellers, setSellers] = useState<PendingSeller[]>([]);
  const [showVerified, setShowVerified] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const token = getAccessToken();
      if (!token) { router.replace("/"); return; }
      const uid = (decodeJwt(token) as any)?.sub as string;
      if (!uid) { router.replace("/"); return; }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=role&limit=1`,
        {
          headers: {
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Authorization": `Bearer ${token}`,
          },
        }
      );
      const profileArr = await res.json();
      if (profileArr?.[0]?.role !== "admin") { router.replace("/"); return; }

      setAuthorized(true);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (authorized) fetchSellers();
  }, [authorized, showVerified]);

  const fetchSellers = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, business_name, business_number, business_registration_url, is_business_verified")
        .not("business_registration_url", "is", null)
        .eq("is_business_verified", showVerified)
        .order("seller_registered_at", { ascending: false });
      if (error) throw error;
      setSellers((data as PendingSeller[]) || []);
    } catch (e) {
      console.error(e);
      showError("목록을 불러오지 못했습니다.");
    } finally {
      setFetching(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/admin/business-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "승인 처리 실패"); return; }
      showSuccess("승인되었습니다.");
      fetchSellers();
    } catch {
      showError("처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) return <main style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>확인 중...</main>;
  if (!authorized) return null;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px 80px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", margin: 0 }}>사업자 등록 승인</h1>
          <p style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
            사업자등록증을 등록한 판매자를 확인 후 승인하면 세금계산서 발행이 가능해집니다.
          </p>
        </div>
        <Link href="/admin" style={{ height: 42, padding: "0 18px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center" }}>
          ← 관리자 홈
        </Link>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[["pending", "승인 대기", false], ["verified", "승인 완료", true]].map(([key, label, val]) => {
          const active = showVerified === val;
          return (
            <button key={key as string} type="button" onClick={() => setShowVerified(val as boolean)} style={{
              height: 36, padding: "0 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: active ? "none" : "1px solid #e5e7eb",
              background: active ? "#111827" : "white",
              color: active ? "white" : "#6b7280",
            }}>
              {label as string}
            </button>
          );
        })}
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", overflow: "hidden" }}>
        {fetching ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>불러오는 중...</div>
        ) : sellers.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
            {showVerified ? "승인 완료된 판매자가 없습니다." : "승인 대기 중인 신청이 없습니다."}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {sellers.map((s, i) => (
              <div key={s.id} style={{ padding: "18px 20px", borderBottom: i < sellers.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{s.nickname || s.id.slice(0, 8)}</div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                    {s.business_name || "상호명 미입력"} · {s.business_number || "사업자번호 미입력"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {s.business_registration_url && (
                    <a href={s.business_registration_url} target="_blank" rel="noopener noreferrer" style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", textDecoration: "none", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center" }}>
                      등록증 보기
                    </a>
                  )}
                  {!showVerified && (
                    <button
                      type="button"
                      onClick={() => handleApprove(s.id)}
                      disabled={processingId === s.id}
                      style={{
                        height: 38, padding: "0 16px", borderRadius: 9, border: "none",
                        background: processingId === s.id ? "#d1d5db" : "#16a34a", color: "white",
                        fontWeight: 800, fontSize: 13, cursor: processingId === s.id ? "not-allowed" : "pointer",
                      }}
                    >
                      {processingId === s.id ? "처리 중..." : "승인"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
