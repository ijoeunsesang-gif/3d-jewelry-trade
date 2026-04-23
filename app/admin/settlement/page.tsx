"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { GRADE_CONFIG, Grade } from "@/lib/grades";
import GradeBadge from "@/app/components/GradeBadge";

const adminSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

interface SellerRow {
  sellerId: string;
  nickname: string;
  grade: Grade;
  salesCount: number;
  salesAmount: number;
  commissionAmount: number;
  settlementAmount: number;
}

function toYYYYMM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(yyyymm: string): [string, string] {
  const [y, m] = yyyymm.split("-").map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);
  return [start.toISOString(), end.toISOString()];
}

export default function SettlementPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => toYYYYMM(new Date()));
  const [rows, setRows] = useState<SellerRow[]>([]);
  const [fetching, setFetching] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push("/admin"); return; }
    const payload = decodeJwt(token) as any;
    const email = payload?.email || payload?.user_metadata?.email || "";
    if (email !== ADMIN_EMAIL) { router.push("/admin"); return; }
    setAuthorized(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    fetchSettlement();
  }, [authorized, month]);

  const fetchSettlement = async () => {
    setFetching(true);
    try {
      const [start, end] = monthRange(month);

      // Fetch sale_records for this month
      const { data: records, error } = await adminSupabase
        .from("sale_records")
        .select("seller_id, amount, commission_rate, settlement_amount")
        .gte("created_at", start)
        .lt("created_at", end);

      if (error) { console.error("sale_records 조회 실패:", error); setRows([]); return; }
      if (!records?.length) { setRows([]); return; }

      // Aggregate by seller
      const map = new Map<string, { count: number; amount: number; commission: number; settlement: number }>();
      for (const r of records) {
        const existing = map.get(r.seller_id) ?? { count: 0, amount: 0, commission: 0, settlement: 0 };
        existing.count += 1;
        existing.amount += r.amount;
        existing.commission += Math.round(r.amount * r.commission_rate);
        existing.settlement += r.settlement_amount;
        map.set(r.seller_id, existing);
      }

      // Fetch profiles for seller_ids
      const sellerIds = [...map.keys()];
      const { data: profiles } = await adminSupabase
        .from("profiles")
        .select("id, nickname, grade")
        .in("id", sellerIds);

      const profileMap: Record<string, { nickname: string; grade: Grade }> = {};
      for (const p of profiles || []) {
        profileMap[p.id] = { nickname: p.nickname || p.id.slice(0, 8), grade: (p.grade || "sprout") as Grade };
      }

      const result: SellerRow[] = sellerIds.map((id) => {
        const agg = map.get(id)!;
        const profile = profileMap[id] ?? { nickname: id.slice(0, 8), grade: "sprout" as Grade };
        return {
          sellerId: id,
          nickname: profile.nickname,
          grade: profile.grade,
          salesCount: agg.count,
          salesAmount: agg.amount,
          commissionAmount: agg.commission,
          settlementAmount: agg.settlement,
        };
      });

      result.sort((a, b) => b.settlementAmount - a.settlementAmount);
      setRows(result);
    } finally {
      setFetching(false);
    }
  };

  const downloadCsv = () => {
    const header = ["판매자", "등급", "판매 건수", "총 판매액", "수수료", "정산 금액"];
    const body = rows.map((r) => [
      r.nickname,
      GRADE_CONFIG[r.grade].label,
      r.salesCount,
      r.salesAmount,
      r.commissionAmount,
      r.settlementAmount,
    ]);
    const csv = [header, ...body]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `정산_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalSales = rows.reduce((s, r) => s + r.salesAmount, 0);
  const totalCommission = rows.reduce((s, r) => s + r.commissionAmount, 0);
  const totalSettlement = rows.reduce((s, r) => s + r.settlementAmount, 0);

  if (loading) return <main style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>확인 중...</main>;
  if (!authorized) return null;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", margin: 0 }}>정산 관리</h1>
        <p style={{ color: "#6b7280", marginTop: 6, fontSize: 14 }}>
          월별 판매자 정산 내역을 확인하고 CSV로 내보낼 수 있습니다.
        </p>
      </div>

      {/* Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 24,
          flexWrap: "wrap",
        }}
      >
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          style={{
            height: 44,
            padding: "0 14px",
            borderRadius: 14,
            border: "1px solid #d1d5db",
            fontSize: 15,
            fontWeight: 700,
            outline: "none",
          }}
        />
        <button
          onClick={downloadCsv}
          disabled={!rows.length}
          style={{
            height: 44,
            padding: "0 20px",
            borderRadius: 14,
            border: "none",
            background: rows.length ? "#111827" : "#d1d5db",
            color: "white",
            fontWeight: 800,
            cursor: rows.length ? "pointer" : "not-allowed",
          }}
        >
          CSV 내보내기
        </button>
        <button
          onClick={() => router.push("/admin")}
          style={{
            height: 44,
            padding: "0 20px",
            borderRadius: 14,
            border: "1px solid #d1d5db",
            background: "white",
            color: "#111827",
            fontWeight: 800,
            cursor: "pointer",
          }}
        >
          ← 관리자 홈
        </button>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 28 }}>
        {[
          { label: "총 판매액", value: totalSales },
          { label: "총 수수료", value: totalCommission },
          { label: "총 정산액", value: totalSettlement },
        ].map(({ label, value }) => (
          <div
            key={label}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 20,
              padding: "20px 24px",
              background: "white",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 900, color: "#111827" }}>
              {value.toLocaleString("ko-KR")}원
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 20,
          background: "white",
          overflow: "hidden",
        }}
      >
        {fetching ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>불러오는 중...</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
            {month} 정산 데이터가 없습니다.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                {["판매자", "등급", "판매 건수", "총 판매액", "수수료", "정산 금액"].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "14px 18px",
                      fontSize: 13,
                      fontWeight: 800,
                      color: "#374151",
                      textAlign: h === "판매자" || h === "등급" ? "left" : "right",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr
                  key={r.sellerId}
                  style={{
                    borderBottom: i < rows.length - 1 ? "1px solid #f3f4f6" : "none",
                  }}
                >
                  <td style={{ padding: "14px 18px", fontWeight: 800, color: "#111827" }}>
                    {r.nickname}
                  </td>
                  <td style={{ padding: "14px 18px" }}>
                    <GradeBadge grade={r.grade} size="sm" />
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right", color: "#374151", fontWeight: 700 }}>
                    {r.salesCount.toLocaleString("ko-KR")}건
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right", color: "#374151", fontWeight: 700 }}>
                    {r.salesAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>
                    {r.commissionAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td style={{ padding: "14px 18px", textAlign: "right", color: "#111827", fontWeight: 900 }}>
                    {r.settlementAmount.toLocaleString("ko-KR")}원
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                <td colSpan={2} style={{ padding: "14px 18px", fontWeight: 900, color: "#111827" }}>
                  합계 ({rows.length}명)
                </td>
                <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 900, color: "#111827" }}>
                  {rows.reduce((s, r) => s + r.salesCount, 0).toLocaleString("ko-KR")}건
                </td>
                <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 900, color: "#111827" }}>
                  {totalSales.toLocaleString("ko-KR")}원
                </td>
                <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 900, color: "#dc2626" }}>
                  {totalCommission.toLocaleString("ko-KR")}원
                </td>
                <td style={{ padding: "14px 18px", textAlign: "right", fontWeight: 900, color: "#111827" }}>
                  {totalSettlement.toLocaleString("ko-KR")}원
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </main>
  );
}
