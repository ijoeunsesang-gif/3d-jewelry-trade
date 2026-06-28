"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { GRADE_CONFIG, Grade, MentorGrade, MENTOR_GRADE_CONFIG } from "@/lib/grades";
import GradeBadge from "@/app/components/GradeBadge";
import { GOLD } from "@/lib/constants";


const RATE_COMMISSION = 0.2;  // 의뢰 수수료율 20% (고정)
// 캐드스쿨(수강패키지/이용권추가/건별멘토링)은 멘토 등급별 수수료율 동적 적용

type PaymentType = "model" | "commission" | "subscription" | "addon" | "session";

const TYPE_LABELS: Record<PaymentType, string> = {
  model:        "모델판매",
  commission:   "의뢰",
  subscription: "수강패키지",
  addon:        "이용권추가",
  session:      "건별멘토링",
};

const TYPE_COLOR: Record<PaymentType, string> = {
  model:        "#2563eb",
  commission:   "#7c3aed",
  subscription: GOLD,
  addon:        "#d97706",
  session:      "#16a34a",
};

interface PaymentRecord {
  id: string;
  type: PaymentType;
  recipientId: string;
  buyerId: string;
  amount: number;
  commissionRate: number;
  commissionAmount: number;
  settlementAmount: number;
  createdAt: string;
  detail: string;
}

interface RecipientInfo {
  nickname: string;
  grade: Grade;
}

const TYPE_TABS: { key: PaymentType | "all"; label: string }[] = [
  { key: "all",          label: "전체" },
  { key: "model",        label: "모델판매" },
  { key: "commission",   label: "의뢰" },
  { key: "subscription", label: "수강패키지" },
  { key: "addon",        label: "이용권추가" },
  { key: "session",      label: "건별멘토링" },
];

function toYYYYMM(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthRange(yyyymm: string): [string, string] {
  const [y, m] = yyyymm.split("-").map(Number);
  return [new Date(y, m - 1, 1).toISOString(), new Date(y, m, 1).toISOString()];
}

export default function SettlementPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [month, setMonth]           = useState(() => toYYYYMM(new Date()));
  const [records, setRecords]       = useState<PaymentRecord[]>([]);
  const [recipientMap, setRecipientMap] = useState<Record<string, RecipientInfo>>({});
  const [fetching, setFetching]     = useState(false);
  const [activeType, setActiveType] = useState<PaymentType | "all">("all");

  /* ── 관리자 인증 ── */
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
    if (authorized) fetchAll();
  }, [authorized, month]);

  /* ── 전체 결제 데이터 통합 조회 ── */
  const fetchAll = async () => {
    setFetching(true);
    try {
      const [start, end] = monthRange(month);
      const all: PaymentRecord[] = [];
      const recipientIds = new Set<string>();

      /* ── 0. cad_mentors id→user_id / mentor_grade 매핑 ── */
      const { data: mentors } = await supabase.from("cad_mentors").select("id, user_id, mentor_grade");
      const mentorToUser: Record<string, string> = {};
      const mentorToGrade: Record<string, MentorGrade> = {};
      (mentors ?? []).forEach((m: any) => {
        mentorToUser[m.id] = m.user_id;
        mentorToGrade[m.id] = (m.mentor_grade ?? "normal") as MentorGrade;
      });

      /* ── 1. 모델판매 (sale_records) ── */
      const { data: sales } = await supabase
        .from("sale_records")
        .select("id, seller_id, buyer_id, amount, commission_rate, settlement_amount, created_at")
        .gte("created_at", start)
        .lt("created_at", end);

      for (const r of sales ?? []) {
        recipientIds.add(r.seller_id);
        all.push({
          id: r.id, type: "model",
          recipientId: r.seller_id, buyerId: r.buyer_id ?? "",
          amount: r.amount,
          commissionRate: r.commission_rate,
          commissionAmount: Math.round(r.amount * r.commission_rate),
          settlementAmount: r.settlement_amount,
          createdAt: r.created_at, detail: "",
        });
      }

      /* ── 2. 의뢰 결제 (commissions) — 수수료율 20%
         주의: created_at은 의뢰 생성일이며 실제 결제일이 아닙니다.
               결제 타임스탬프 컬럼이 없어 생성일로 근사 필터링합니다. */
      const { data: comms } = await supabase
        .from("commissions")
        .select("id, user_id, target_seller_id, final_price, created_at")
        .not("payment_key", "is", null)
        .not("target_seller_id", "is", null)
        .not("final_price", "is", null)
        .in("status", ["working", "completed", "downloaded"])
        .gte("created_at", start)
        .lt("created_at", end);

      for (const c of comms ?? []) {
        if (!c.target_seller_id || !c.final_price) continue;
        recipientIds.add(c.target_seller_id);
        const amt  = c.final_price;
        const comm = Math.round(amt * RATE_COMMISSION);
        all.push({
          id: c.id, type: "commission",
          recipientId: c.target_seller_id, buyerId: c.user_id,
          amount: amt, commissionRate: RATE_COMMISSION,
          commissionAmount: comm, settlementAmount: amt - comm,
          createdAt: c.created_at, detail: "",
        });
      }

      /* ── 3. 수강패키지 결제 (cad_subscriptions) — 수수료율 20% */
      const { data: subs } = await supabase
        .from("cad_subscriptions")
        .select("id, subscriber_id, mentor_id, plan_type, price, created_at")
        .not("payment_key", "is", null)
        .gte("created_at", start)
        .lt("created_at", end);

      for (const s of subs ?? []) {
        const uid = mentorToUser[s.mentor_id];
        if (!uid) continue;
        recipientIds.add(uid);
        const amt  = s.price ?? 0;
        const rate = MENTOR_GRADE_CONFIG[mentorToGrade[s.mentor_id] ?? "normal"].commission;
        const comm = Math.round(amt * rate);
        all.push({
          id: s.id, type: "subscription",
          recipientId: uid, buyerId: s.subscriber_id,
          amount: amt, commissionRate: rate,
          commissionAmount: comm, settlementAmount: amt - comm,
          createdAt: s.created_at, detail: (s.plan_type ?? "").toUpperCase(),
        });
      }

      /* ── 4. 이용권 추가구매 (cad_addon_purchases) — 수수료율 20% */
      const { data: addons } = await supabase
        .from("cad_addon_purchases")
        .select("id, subscription_id, user_id, addon_type, price, created_at")
        .eq("status", "completed")
        .gte("created_at", start)
        .lt("created_at", end);

      // addon의 수령인: subscription → cad_mentors.user_id / mentor_grade
      const addonSubIds = [...new Set((addons ?? []).map((a: any) => a.subscription_id))];
      const subMentorMap: Record<string, string> = {};
      const subMentorGradeMap: Record<string, MentorGrade> = {};
      if (addonSubIds.length > 0) {
        const { data: subForAddon } = await supabase
          .from("cad_subscriptions")
          .select("id, mentor_id")
          .in("id", addonSubIds);
        (subForAddon ?? []).forEach((s: any) => {
          subMentorMap[s.id] = mentorToUser[s.mentor_id] ?? "";
          subMentorGradeMap[s.id] = mentorToGrade[s.mentor_id] ?? "normal";
        });
      }

      for (const a of addons ?? []) {
        const uid = subMentorMap[a.subscription_id];
        if (!uid) continue;
        recipientIds.add(uid);
        const amt  = a.price ?? 0;
        const rate = MENTOR_GRADE_CONFIG[subMentorGradeMap[a.subscription_id] ?? "normal"].commission;
        const comm = Math.round(amt * rate);
        all.push({
          id: a.id, type: "addon",
          recipientId: uid, buyerId: a.user_id,
          amount: amt, commissionRate: rate,
          commissionAmount: comm, settlementAmount: amt - comm,
          createdAt: a.created_at, detail: a.addon_type ?? "",
        });
      }

      /* ── 5. 건별 멘토링 (cad_mentoring_sessions) — 수수료율 20% */
      const { data: sessions } = await supabase
        .from("cad_mentoring_sessions")
        .select("id, mentor_id, mentee_id, price, session_type, created_at")
        .not("payment_key", "is", null)
        .in("status", ["accepted", "completed"])
        .gte("created_at", start)
        .lt("created_at", end);

      for (const s of sessions ?? []) {
        const uid = mentorToUser[s.mentor_id];
        if (!uid) continue;
        recipientIds.add(uid);
        const amt  = s.price ?? 0;
        const rate = MENTOR_GRADE_CONFIG[mentorToGrade[s.mentor_id] ?? "normal"].commission;
        const comm = Math.round(amt * rate);
        all.push({
          id: s.id, type: "session",
          recipientId: uid, buyerId: s.mentee_id,
          amount: amt, commissionRate: rate,
          commissionAmount: comm, settlementAmount: amt - comm,
          createdAt: s.created_at, detail: s.session_type ?? "",
        });
      }

      /* ── 프로필 일괄 조회 ── */
      const idArr = [...recipientIds];
      const pMap: Record<string, RecipientInfo> = {};
      if (idArr.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, nickname, grade")
          .in("id", idArr);
        (profiles ?? []).forEach((p: any) => {
          pMap[p.id] = { nickname: p.nickname || p.id.slice(0, 8), grade: (p.grade || "sprout") as Grade };
        });
      }

      all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setRecords(all);
      setRecipientMap(pMap);
    } finally {
      setFetching(false);
    }
  };

  /* ── 필터 ── */
  const filtered = useMemo(
    () => activeType === "all" ? records : records.filter((r) => r.type === activeType),
    [records, activeType],
  );

  const totalAmount     = filtered.reduce((s, r) => s + r.amount, 0);
  const totalCommission = filtered.reduce((s, r) => s + r.commissionAmount, 0);
  const totalSettlement = filtered.reduce((s, r) => s + r.settlementAmount, 0);

  /* ── CSV 내보내기 ── */
  const downloadCsv = () => {
    const header = ["결제일", "수령인", "등급", "결제유형", "상세", "판매액", "수수료율", "수수료", "정산액"];
    const body = filtered.map((r) => {
      const info = recipientMap[r.recipientId];
      return [
        new Date(r.createdAt).toLocaleDateString("ko-KR"),
        info?.nickname ?? r.recipientId.slice(0, 8),
        info ? GRADE_CONFIG[info.grade].label : "-",
        TYPE_LABELS[r.type],
        r.detail,
        r.amount,
        `${(r.commissionRate * 100).toFixed(0)}%`,
        r.commissionAmount,
        r.settlementAmount,
      ];
    });
    const csv = [header, ...body]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `정산_${month}_${activeType === "all" ? "전체" : TYPE_LABELS[activeType]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ── Render ── */
  if (loading)      return <main style={{ padding: 60, textAlign: "center", color: "#6b7280" }}>확인 중...</main>;
  if (!authorized)  return null;

  return (
    <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 20px 80px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", margin: 0 }}>정산 관리</h1>
        <p style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
          모델판매 · 의뢰 · 캐드스쿨 전체 결제 통합 집계 —{" "}
          <span style={{ color: "#6b7280" }}>모델판매 셀러등급별 / 의뢰 20% / 캐드스쿨 멘토등급별 수수료 적용</span>
        </p>
      </div>

      {/* 컨트롤 */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <input
          type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          style={{ height: 42, padding: "0 14px", borderRadius: 12, border: "1px solid #d1d5db", fontSize: 15, fontWeight: 700, outline: "none" }}
        />
        <button
          onClick={downloadCsv} disabled={!filtered.length}
          style={{ height: 42, padding: "0 18px", borderRadius: 12, border: "none", background: filtered.length ? "#111827" : "#d1d5db", color: "white", fontWeight: 800, cursor: filtered.length ? "pointer" : "not-allowed", fontSize: 13 }}
        >
          CSV 내보내기
        </button>
        <button
          onClick={fetchAll} disabled={fetching}
          style={{ height: 42, padding: "0 14px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
        >
          {fetching ? "..." : "↻ 새로고침"}
        </button>
        <button
          onClick={() => router.push("/admin")}
          style={{ height: 42, padding: "0 18px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer", fontSize: 13 }}
        >
          ← 관리자 홈
        </button>
      </div>

      {/* 유형 탭 */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
        {TYPE_TABS.map((t) => {
          const cnt = t.key === "all" ? records.length : records.filter((r) => r.type === t.key).length;
          const active = activeType === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setActiveType(t.key)} style={{
              height: 36, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
              border: active ? "none" : "1px solid #e5e7eb",
              background: active ? "#111827" : "white",
              color: active ? "white" : "#6b7280",
            }}>
              {t.label} <span style={{ opacity: 0.65, fontWeight: 400 }}>({cnt})</span>
            </button>
          );
        })}
      </div>

      {/* 요약 카드 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "결제 건수",  value: `${filtered.length.toLocaleString("ko-KR")}건` },
          { label: "총 판매액",  value: `${totalAmount.toLocaleString("ko-KR")}원` },
          { label: "총 수수료",  value: `${totalCommission.toLocaleString("ko-KR")}원` },
          { label: "총 정산액",  value: `${totalSettlement.toLocaleString("ko-KR")}원` },
        ].map(({ label, value }) => (
          <div key={label} style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px 20px", background: "white" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>{label}</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* 테이블 */}
      <div style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", overflow: "hidden" }}>
        {fetching ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "#6b7280" }}>
            {month} {activeType !== "all" ? `· ${TYPE_LABELS[activeType]}` : ""} 정산 데이터가 없습니다.
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  {["결제일", "수령인", "등급", "결제유형", "상세", "판매액", "수수료율", "수수료", "정산액"].map((h) => (
                    <th key={h} style={{
                      padding: "12px 16px", fontWeight: 800, color: "#374151", whiteSpace: "nowrap",
                      textAlign: ["결제일", "수령인", "등급", "결제유형", "상세"].includes(h) ? "left" : "right",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => {
                  const info  = recipientMap[r.recipientId];
                  const color = TYPE_COLOR[r.type];
                  return (
                    <tr key={r.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                      <td style={{ padding: "11px 16px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                        {new Date(r.createdAt).toLocaleDateString("ko-KR")}
                      </td>
                      <td style={{ padding: "11px 16px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                        {info?.nickname ?? r.recipientId.slice(0, 8)}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        {info && <GradeBadge grade={info.grade} size="sm" />}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <span style={{
                          display: "inline-block", padding: "2px 8px", borderRadius: 999,
                          fontSize: 11, fontWeight: 700,
                          color, background: `${color}18`, border: `1px solid ${color}40`,
                        }}>
                          {TYPE_LABELS[r.type]}
                        </span>
                      </td>
                      <td style={{ padding: "11px 16px", color: "#6b7280" }}>{r.detail}</td>
                      <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 700, color: "#374151" }}>
                        {r.amount.toLocaleString("ko-KR")}원
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right", color: "#9ca3af" }}>
                        {`${(r.commissionRate * 100).toFixed(0)}%`}
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>
                        {r.commissionAmount.toLocaleString("ko-KR")}원
                      </td>
                      <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 900, color: "#111827" }}>
                        {r.settlementAmount.toLocaleString("ko-KR")}원
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: "2px solid #e5e7eb", background: "#f9fafb" }}>
                  <td colSpan={4} style={{ padding: "12px 16px", fontWeight: 900, color: "#111827" }}>
                    합계 ({filtered.length}건)
                  </td>
                  <td />
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: "#111827" }}>
                    {totalAmount.toLocaleString("ko-KR")}원
                  </td>
                  <td />
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: "#dc2626" }}>
                    {totalCommission.toLocaleString("ko-KR")}원
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 900, color: "#111827" }}>
                    {totalSettlement.toLocaleString("ko-KR")}원
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
