"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { getModelThumbnailUrl } from "@/lib/imageUrl";
import { useSellerSalesStats, SaleEntry, SaleType } from "@/app/lib/useSellerSalesStats";

type PeriodType = "7days" | "30days" | "all" | "monthly";

const TYPE_LABELS: Record<SaleType, string> = {
  model: "모델판매",
  commission: "의뢰",
  cadschool: "캐드스쿨",
};

const TYPE_COLORS: Record<SaleType, string> = {
  model: "#2563eb",
  commission: "#7c3aed",
  cadschool: "#d97706",
};

const TABS: { key: SaleType | "all"; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "model", label: "모델" },
  { key: "commission", label: "의뢰" },
  { key: "cadschool", label: "캐드스쿨" },
];

export default function SalesStatsPanel({ userId }: { userId: string | null }) {
  const { loading, entries, models, isMentor } = useSellerSalesStats(userId);
  const [period, setPeriod] = useState<PeriodType>("7days");
  const [activeType, setActiveType] = useState<SaleType | "all">("all");

  const periodFiltered = useMemo(() => {
    if (period === "all" || period === "monthly") return entries;
    const days = period === "7days" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return entries.filter((row) => new Date(row.created_at) >= cutoff);
  }, [entries, period]);

  const filtered = useMemo(
    () => (activeType === "all" ? periodFiltered : periodFiltered.filter((r) => r.type === activeType)),
    [periodFiltered, activeType]
  );

  const totalCount = filtered.length;
  const totalRevenue = filtered.reduce((sum, r) => sum + (r.price || 0), 0);
  const totalSettlement = filtered.reduce((sum, r) => sum + (r.settlementAmount || 0), 0);
  const avgSettlement = totalCount > 0 ? Math.round(totalSettlement / totalCount) : 0;

  const topModels = useMemo(() => {
    const grouped = new Map<string, { modelId: string; title: string; count: number; revenue: number }>();
    filtered.filter((r) => r.type === "model").forEach((row) => {
      const modelId = row.model_id as string;
      const current = grouped.get(modelId);
      if (current) { current.count += 1; current.revenue += row.price || 0; }
      else { grouped.set(modelId, { modelId, title: row.title, count: 1, revenue: row.price || 0 }); }
    });
    return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filtered]);

  const chartData = useMemo(() => {
    if (period === "monthly") {
      const monthMap = new Map<string, { label: string; revenue: number; count: number }>();
      (activeType === "all" ? entries : entries.filter((r) => r.type === activeType)).forEach((row) => {
        const date = new Date(row.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const current = monthMap.get(key);
        if (current) { current.revenue += row.price || 0; current.count += 1; }
        else { monthMap.set(key, { label: key, revenue: row.price || 0, count: 1 }); }
      });
      return Array.from(monthMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }
    const chartDays = period === "30days" ? 10 : 7;
    const today = new Date();
    const result: { label: string; revenue: number; count: number }[] = [];
    for (let i = chartDays - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const key = `${date.getFullYear()}-${mm}-${dd}`;
      const dayRows = filtered.filter((row) => row.created_at.slice(0, 10) === key);
      result.push({ label: `${mm}/${dd}`, revenue: dayRows.reduce((sum, row) => sum + (row.price || 0), 0), count: dayRows.length });
    }
    return result;
  }, [filtered, entries, period, activeType]);

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  const getThumbUrl = (modelId: string | null) => {
    const model = modelId ? models.find((m) => m.id === modelId) : undefined;
    return model ? getModelThumbnailUrl(model) : "";
  };

  if (loading) {
    return <div style={{ padding: "20px 0" }}><p style={{ color: "#6b7280" }}>판매 통계 불러오는 중...</p></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <p style={{ margin: 0, color: "#6b7280", fontSize: 13 }}>
          모델판매 · 의뢰{isMentor ? " · 캐드스쿨" : ""} 결제를 한 곳에서 확인할 수 있습니다.
        </p>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodType)}
          style={{ height: 38, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 10px", background: "white", fontWeight: 700, color: "#111827", outline: "none", fontSize: 13 }}
        >
          <option value="7days">최근 7일</option>
          <option value="30days">최근 30일</option>
          <option value="all">전체 기간</option>
          <option value="monthly">월별 보기</option>
        </select>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {TABS.map((t) => {
          const cnt = t.key === "all" ? periodFiltered.length : periodFiltered.filter((r) => r.type === t.key).length;
          const active = activeType === t.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveType(t.key)}
              style={{
                height: 34, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
                border: active ? "none" : "1px solid #e5e7eb",
                background: active ? "#111827" : "white",
                color: active ? "white" : "#6b7280",
              }}
            >
              {t.label} <span style={{ opacity: 0.65, fontWeight: 400 }}>({cnt})</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }} className="ssp-summary-grid">
        <StatCard title="총 건수" value={`${totalCount.toLocaleString("ko-KR")}건`} sub="선택한 유형·기간 기준" />
        <StatCard title="총 매출" value={`${totalRevenue.toLocaleString("ko-KR")}원`} sub="수수료 차감 전 판매액" />
        <StatCard title="총 정산액" value={`${totalSettlement.toLocaleString("ko-KR")}원`} sub="수수료 차감 + 부가세 반영" />
        <StatCard title="평균 정산액" value={`${avgSettlement.toLocaleString("ko-KR")}원`} sub="건당 평균" />
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{period === "monthly" ? "월별 매출 흐름" : "매출 흐름"}</div>
          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{period === "monthly" ? "월 단위 집계" : "선택 기간 기준"}</span>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: period === "monthly" ? `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))` : "repeat(10, minmax(0, 1fr))",
          gap: 4,
          alignItems: "end",
          minHeight: 180,
        }}>
          {chartData.map((day, idx) => (
            <div key={day.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "end", gap: 5 }}>
              <div style={{ fontSize: 10, color: "#111827", fontWeight: 800, textAlign: "center", wordBreak: "keep-all" }}>
                {day.revenue > 0 ? `${day.revenue.toLocaleString("ko-KR")}원` : "-"}
              </div>
              <div style={{ width: "100%", maxWidth: 80, borderRadius: 12, background: "linear-gradient(180deg,#22c55e 0%,#16a34a 100%)", minHeight: 5, height: `${Math.max((day.revenue / maxRevenue) * 140, day.revenue > 0 ? 10 : 5)}px` }} />
              <div style={{ fontSize: 10, fontWeight: 800, color: "#111827", whiteSpace: "nowrap" }}>{idx % 2 === 0 ? day.label : ""}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{day.count}건</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: activeType === "model" ? "1fr 1fr" : "1fr", gap: 14 }} className="ssp-two-col">
        {activeType === "model" && (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white", padding: 18 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>베스트셀러 모델</div>
            {topModels.length === 0 ? (
              <p style={{ color: "#6b7280", fontSize: 13 }}>아직 판매된 모델이 없습니다.</p>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {topModels.slice(0, 5).map((item, idx) => (
                  <div key={item.modelId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #eef2f7" }}>
                    <div style={{ width: 28, height: 28, borderRadius: 999, background: "#111827", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>{idx + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{item.title}</div>
                      <div style={{ marginTop: 2, fontSize: 11, color: "#6b7280" }}>판매 {item.count}건</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#16a34a" }}>{item.revenue.toLocaleString("ko-KR")}원</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white", padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>
            {activeType === "all" ? "최근 판매/의뢰/캐드스쿨 내역" : `최근 ${TYPE_LABELS[activeType as SaleType]} 내역`}
          </div>
          {filtered.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>표시할 내역이 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gap: 10, maxHeight: 560, overflowY: "auto" }}>
              {filtered.slice(0, 30).map((row) => {
                const thumb = getThumbUrl(row.model_id);
                const color = TYPE_COLORS[row.type];
                return (
                  <div key={`${row.type}-${row.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #eef2f7" }}>
                    {thumb
                      ? <Image src={thumb} alt={row.title} width={48} height={48} style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", color: "#111827", fontWeight: 900, flexShrink: 0, fontSize: 11 }}>
                          {row.type === "model" ? "3D" : row.type === "commission" ? "의뢰" : "CAD"}
                        </div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 800, color: "#111827" }}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.title}</span>
                        <span style={{
                          flexShrink: 0, display: "inline-block", padding: "1px 7px", borderRadius: 999,
                          fontSize: 10, fontWeight: 700,
                          color, background: `${color}18`, border: `1px solid ${color}40`,
                        }}>
                          {TYPE_LABELS[row.type]}
                        </span>
                      </div>
                      <div style={{ marginTop: 3, color: "#6b7280", fontSize: 11 }}>{new Date(row.created_at).toLocaleDateString("ko-KR")}</div>
                      {row.taxInvoice && (
                        <div style={{ marginTop: 3, fontSize: 10, fontWeight: 700, color: "#0f766e" }}>
                          세금계산서 · 부가세 {row.vatAmount.toLocaleString("ko-KR")}원 포함 · 정산액 {row.settlementAmount.toLocaleString("ko-KR")}원
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{row.price.toLocaleString("ko-KR")}원</div>
                      <div style={{ marginTop: 2, fontSize: 11, fontWeight: 700, color: "#16a34a" }}>정산 {row.settlementAmount.toLocaleString("ko-KR")}원</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 500px) {
          .ssp-two-col { grid-template-columns: 1fr !important; }
          .ssp-summary-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}

function StatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "white", padding: "14px 16px" }}>
      <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 22, lineHeight: 1.1, fontWeight: 900, color: "#111827" }}>{value}</div>
      <div style={{ marginTop: 5, color: "#9ca3af", fontSize: 11 }}>{sub}</div>
    </div>
  );
}
