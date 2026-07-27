"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/app/lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "@/app/lib/toast";

type RegisteredSeller = {
  id: string;
  nickname: string | null;
  business_name: string | null;
  business_number: string | null;
  business_registration_url: string | null;
  is_business_verified: boolean;
  seller_registered_at: string | null;
};

type FilterKey = "all" | "verified" | "revoked";

export default function BusinessVerificationPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [sellers, setSellers] = useState<RegisteredSeller[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
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
  }, [authorized]);

  const fetchSellers = async () => {
    setFetching(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nickname, business_name, business_number, business_registration_url, is_business_verified, seller_registered_at")
        .not("business_registration_url", "is", null)
        .order("seller_registered_at", { ascending: false });
      if (error) throw error;
      setSellers((data as RegisteredSeller[]) || []);
    } catch (e) {
      console.error(e);
      showError("목록을 불러오지 못했습니다.");
    } finally {
      setFetching(false);
    }
  };

  const handleSetVerified = async (id: string, verified: boolean) => {
    setProcessingId(id);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/admin/business-verification", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, verified }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "처리 실패"); return; }
      showSuccess(verified ? "재인증되었습니다." : "인증이 취소되었습니다.");
      fetchSellers();
    } catch {
      showError("처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSellers = sellers.filter((s) => {
    if (filter === "verified") return s.is_business_verified;
    if (filter === "revoked") return !s.is_business_verified;
    return true;
  });

  if (loading) return <main style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>확인 중...</main>;
  if (!authorized) return null;

  return (
    <main style={{ maxWidth: 900, margin: "40px auto", padding: "0 20px 80px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", margin: 0 }}>사업자 등록 기록</h1>
          <p style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
            사업자 등록은 자동 승인됩니다. 부적절한 등록은 검토 후 취소할 수 있습니다.
          </p>
        </div>
        <Link href="/admin" style={{ height: 42, padding: "0 18px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center" }}>
          ← 관리자 홈
        </Link>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {([["all", "전체"], ["verified", "인증됨"], ["revoked", "취소됨"]] as [FilterKey, string][]).map(([key, label]) => {
          const active = filter === key;
          return (
            <button key={key} type="button" onClick={() => setFilter(key)} style={{
              height: 36, padding: "0 16px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: active ? "none" : "1px solid #e5e7eb",
              background: active ? "#111827" : "white",
              color: active ? "white" : "#6b7280",
            }}>
              {label}
            </button>
          );
        })}
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", overflow: "hidden" }}>
        {fetching ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>불러오는 중...</div>
        ) : filteredSellers.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
            등록된 사업자가 없습니다.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {filteredSellers.map((s, i) => (
              <div key={s.id} style={{ padding: "18px 20px", borderBottom: i < filteredSellers.length - 1 ? "1px solid #f3f4f6" : "none", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{s.nickname || s.id.slice(0, 8)}</span>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: "2px 9px", borderRadius: 999,
                      background: s.is_business_verified ? "#dcfce7" : "#fee2e2",
                      color: s.is_business_verified ? "#16a34a" : "#b91c1c",
                    }}>
                      {s.is_business_verified ? "인증됨" : "취소됨"}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    {s.business_name || "상호명 미입력"} · {s.business_number || "사업자번호 미입력"}
                  </div>
                  {s.seller_registered_at && (
                    <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                      등록일 {new Date(s.seller_registered_at).toLocaleDateString("ko-KR")}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {s.business_registration_url && (
                    <a href={s.business_registration_url} target="_blank" rel="noopener noreferrer" style={{ height: 38, padding: "0 14px", borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", textDecoration: "none", fontWeight: 700, fontSize: 13, display: "flex", alignItems: "center" }}>
                      등록증 보기
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSetVerified(s.id, !s.is_business_verified)}
                    disabled={processingId === s.id}
                    style={{
                      height: 38, padding: "0 16px", borderRadius: 9, border: "none",
                      background: processingId === s.id ? "#d1d5db" : (s.is_business_verified ? "#dc2626" : "#16a34a"),
                      color: "white",
                      fontWeight: 800, fontSize: 13, cursor: processingId === s.id ? "not-allowed" : "pointer",
                    }}
                  >
                    {processingId === s.id ? "처리 중..." : (s.is_business_verified ? "인증취소" : "재인증")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
