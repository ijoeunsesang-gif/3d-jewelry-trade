"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { getAccessToken, sbAuthFetch, decodeJwt } from "@/lib/supabase-fetch";
import { getModelThumbnailUrl } from "@/lib/imageUrl";

const RATE_COMMISSION = 0.2; // 의뢰 수수료율 20% (관리자 정산관리와 동일)

type ModelRow = {
  id: string;
  title: string;
  thumbnail: string;
  thumbnail_path?: string | null;
  seller_id: string;
};

type SaleEntry = {
  id: string;
  type: "model" | "commission";
  model_id: string | null;
  title: string;
  price: number;            // 판매액(공급가, 세전) — 매출 집계 기준. 모델은 sale_records.amount, 의뢰는 final_price
  settlementAmount: number; // 정산액(수수료 차감 + 부가세 가산)
  vatAmount: number;
  taxInvoice: boolean;
  created_at: string;
};

type PeriodType = "7days" | "30days" | "all" | "monthly";

export default function SalesPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [entries, setEntries] = useState<SaleEntry[]>([]);
  const [period, setPeriod] = useState<PeriodType>("7days");

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);

      const token = getAccessToken();
      if (!token) { setLoading(false); return; }
      const userId = (decodeJwt(token) as any)?.sub as string;

      const { data: myModels, error: modelError } = await sbAuthFetch("models", `?select=id,title,thumbnail,thumbnail_path,seller_id&seller_id=eq.${userId}`);

      if (modelError) {
        console.error("판매 모델 불러오기 실패:", modelError);
        setLoading(false);
        return;
      }

      setModels((myModels as ModelRow[]) || []);

      // purchases는 구매자 본인만 조회 가능한 RLS라 판매자 관점에서는 항상 0건으로 보임.
      // 정산관리와 동일하게 seller_id로 직접 조회 가능한 sale_records를 사용한다.
      const { data: saleData, error: saleError } = await sbAuthFetch(
        "sale_records",
        `?select=id,model_id,amount,created_at&seller_id=eq.${userId}&order=created_at.desc`
      );

      if (saleError) {
        console.error("판매 내역 불러오기 실패:", saleError);
        setLoading(false);
        return;
      }

      const modelMap = new Map<string, ModelRow>((myModels as ModelRow[] ?? []).map((m) => [m.id, m]));
      const modelEntries: SaleEntry[] = ((saleData as any[]) ?? []).map((r) => ({
        id: r.id, type: "model", model_id: r.model_id,
        title: modelMap.get(r.model_id)?.title || "알 수 없는 모델",
        price: r.amount ?? 0, settlementAmount: r.amount ?? 0,
        vatAmount: 0, taxInvoice: false, created_at: r.created_at,
      }));

      // ── 의뢰 정산 (commissions) — 관리자 정산관리와 동일한 계산/부가세 매칭 방식 ──
      const { data: commData, error: commError } = await sbAuthFetch(
        "commissions",
        `?select=id,title,final_price,created_at,paid_at&target_seller_id=eq.${userId}&payment_key=not.is.null&final_price=not.is.null&status=in.(working,completed,downloaded)&order=created_at.desc`
      );
      if (commError) console.error("의뢰 정산 불러오기 실패:", commError);

      const comms = (commData as any[]) ?? [];
      const vatByCommission: Record<string, number> = {};
      const orderCreatedAtByCommission: Record<string, string> = {};

      if (comms.length > 0) {
        const commissionIds = comms.map((c) => c.id);
        // orders는 orders_select_seller 정책으로 "본인 order_items가 포함된 주문"만 조회 가능
        const { data: sellerOrders } = await sbAuthFetch("orders", `?select=id,order_code,created_at&order_code=like.commission-*`);
        const orderIdToCommissionId: Record<string, string> = {};
        ((sellerOrders as any[]) ?? []).forEach((o) => {
          const matchedId = commissionIds.find((cid) => o.order_code.startsWith(`commission-${cid}-`));
          if (matchedId) {
            orderIdToCommissionId[o.id] = matchedId;
            orderCreatedAtByCommission[matchedId] = o.created_at;
          }
        });

        const matchedOrderIds = Object.keys(orderIdToCommissionId);
        if (matchedOrderIds.length > 0) {
          const { data: commOrderItems } = await sbAuthFetch(
            "order_items",
            `?select=order_id,vat_amount&order_id=in.(${matchedOrderIds.join(",")})&model_id=is.null`
          );
          ((commOrderItems as any[]) ?? []).forEach((oi) => {
            const cid = orderIdToCommissionId[oi.order_id];
            if (cid) vatByCommission[cid] = oi.vat_amount ?? 0;
          });
        }
      }

      const commissionEntries: SaleEntry[] = comms
        .filter((c) => c.final_price)
        .map((c) => {
          const amt = c.final_price as number;
          const comm = Math.round(amt * RATE_COMMISSION);
          const vat = vatByCommission[c.id] ?? 0;
          const paidAt = c.paid_at ?? orderCreatedAtByCommission[c.id] ?? c.created_at;
          return {
            id: c.id, type: "commission", model_id: null,
            title: c.title || "개인 의뢰",
            price: amt, settlementAmount: (amt - comm) + vat,
            vatAmount: vat, taxInvoice: vat > 0, created_at: paidAt,
          };
        });

      const combined = [...modelEntries, ...commissionEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setEntries(combined);
    } catch (error) {
      console.error("판매 통계 불러오기 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEntries = useMemo(() => {
    if (period === "all" || period === "monthly") return entries;

    const days = period === "7days" ? 7 : 30;
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - days);

    return entries.filter((row) => new Date(row.created_at) >= cutoff);
  }, [entries, period]);

  const totalSalesCount = filteredEntries.length;
  const totalRevenue = filteredEntries.reduce((sum, row) => sum + (row.price || 0), 0);
  const averagePrice =
    totalSalesCount > 0 ? Math.round(totalRevenue / totalSalesCount) : 0;

  const topModels = useMemo(() => {
    const grouped = new Map<
      string,
      { modelId: string; title: string; count: number; revenue: number }
    >();

    filteredEntries.filter((e) => e.type === "model").forEach((row) => {
      const current = grouped.get(row.model_id as string);

      if (current) {
        current.count += 1;
        current.revenue += row.price || 0;
      } else {
        grouped.set(row.model_id as string, {
          modelId: row.model_id as string,
          title: row.title,
          count: 1,
          revenue: row.price || 0,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredEntries]);

  const chartData = useMemo(() => {
    if (period === "monthly") {
      const monthMap = new Map<string, { label: string; revenue: number; count: number }>();

      entries.forEach((row) => {
        const date = new Date(row.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

        const current = monthMap.get(key);
        if (current) {
          current.revenue += row.price || 0;
          current.count += 1;
        } else {
          monthMap.set(key, {
            label: key,
            revenue: row.price || 0,
            count: 1,
          });
        }
      });

      return Array.from(monthMap.values()).sort((a, b) =>
        a.label.localeCompare(b.label)
      );
    }

    const chartDays = period === "30days" ? 10 : 7;
    const today = new Date();
    const result: { label: string; revenue: number; count: number }[] = [];

    for (let i = chartDays - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);

      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const key = `${yyyy}-${mm}-${dd}`;

      const filtered = filteredEntries.filter(
        (row) => row.created_at.slice(0, 10) === key
      );

      result.push({
        label: `${mm}/${dd}`,
        revenue: filtered.reduce((sum, row) => sum + (row.price || 0), 0),
        count: filtered.length,
      });
    }

    return result;
  }, [filteredEntries, entries, period]);

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  const getThumbUrl = (modelId: string | null) => {
    const model = modelId ? models.find((m) => m.id === modelId) : undefined;
    return model ? getModelThumbnailUrl(model) : "";
  };

  if (loading) {
    return (
      <main style={pageWrap}>
        <p style={{ color: "#6b7280" }}>판매 통계 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={headerWrap}>
        <div>
          <h1 style={pageTitle}>판매 통계</h1>
          <p style={pageDesc}>
            내가 업로드한 모델의 판매와 담당한 의뢰 결제를 한 번에 확인할 수 있습니다.
          </p>
        </div>

        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodType)}
          style={{
            height: 44,
            borderRadius: 14,
            border: "1px solid #d1d5db",
            padding: "0 14px",
            background: "white",
            fontWeight: 700,
            color: "#111827",
            outline: "none",
          }}
        >
          <option value="7days">최근 7일</option>
          <option value="30days">최근 30일</option>
          <option value="all">전체 기간</option>
          <option value="monthly">월별 보기</option>
        </select>
      </div>

      <section style={summaryGrid} className="stats-summary-grid">
        <StatCard title="총 판매 수" value={`${totalSalesCount}건`} sub="모델판매 + 의뢰, 선택한 기간 기준" />
        <StatCard title="총 매출" value={`${totalRevenue.toLocaleString("ko-KR")}원`} sub="선택한 기간 기준 매출 합계" />
        <StatCard title="평균 판매가" value={`${averagePrice.toLocaleString("ko-KR")}원`} sub="판매 1건당 평균" />
        <StatCard title="등록 모델 수" value={`${models.length}개`} sub="현재 등록된 내 모델 수" />
      </section>

      <section style={sectionBox}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>
            {period === "monthly" ? "월별 매출 흐름" : "매출 흐름"}
          </h2>
          <span style={sectionHint}>
            {period === "monthly" ? "월 단위 집계" : "선택한 기간 기준 시각화"}
          </span>
        </div>

        <div
          style={{
            ...chartWrap,
            gridTemplateColumns:
              period === "monthly"
                ? `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))`
                : chartWrap.gridTemplateColumns,
          }}
        >
          {chartData.map((day, idx) => (
            <div key={day.label} style={chartItem}>
              <div style={chartValue}>
                {day.revenue > 0 ? `${day.revenue.toLocaleString("ko-KR")}원` : "-"}
              </div>
              <div
                style={{
                  ...chartBar,
                  height: `${Math.max((day.revenue / maxRevenue) * 180, day.revenue > 0 ? 14 : 8)}px`,
                }}
              />
              <div style={chartLabel}>{idx % 2 === 0 ? day.label : ""}</div>
              <div style={chartSub}>{day.count}건</div>
            </div>
          ))}
        </div>
      </section>

      <section style={twoColGrid} className="stats-two-col">
        <div style={sectionBox}>
          <div style={sectionHead}>
            <h2 style={sectionTitle}>베스트셀러 모델</h2>
            <span style={sectionHint}>매출 기준 상위 모델</span>
          </div>

          {topModels.length === 0 ? (
            <p style={emptyText}>아직 판매된 모델이 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {topModels.slice(0, 8).map((item, idx) => (
                <div key={item.modelId} style={topRow}>
                  <div style={rankBadge}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={topTitle}>{item.title}</div>
                    <div style={topSub}>판매 {item.count}건</div>
                  </div>
                  <div style={topValue}>{item.revenue.toLocaleString("ko-KR")}원</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={sectionBox}>
          <div style={sectionHead}>
            <h2 style={sectionTitle}>최근 판매/의뢰 내역</h2>
            <span style={sectionHint}>가장 최근 결제 순</span>
          </div>

          {filteredEntries.length === 0 ? (
            <p style={emptyText}>표시할 판매 내역이 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {filteredEntries.slice(0, 8).map((row) => {
                const thumb = getThumbUrl(row.model_id);

                return (
                  <div key={`${row.type}-${row.id}`} style={saleRow}>
                    {thumb ? (
                      <Image src={thumb} alt={row.title} width={74} height={74} style={{ borderRadius: 16, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <div style={saleThumbFallback}>{row.type === "commission" ? "의뢰" : "3D"}</div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={saleTitle}>
                        {row.title}
                        <span style={typeBadge(row.type)}>{row.type === "commission" ? "의뢰" : "모델판매"}</span>
                      </div>
                      <div style={saleSub}>
                        판매일: {new Date(row.created_at).toLocaleString("ko-KR")}
                      </div>
                      {row.taxInvoice && (
                        <div style={vatNote}>
                          세금계산서 · 부가세 {row.vatAmount.toLocaleString("ko-KR")}원 포함 · 정산액 {row.settlementAmount.toLocaleString("ko-KR")}원
                        </div>
                      )}
                    </div>

                    <div style={salePrice}>{row.price.toLocaleString("ko-KR")}원</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  sub,
}: {
  title: string;
  value: string;
  sub: string;
}) {
  return (
    <div style={statCard}>
      <div style={statTitle}>{title}</div>
      <div style={statValue} className="stats-stat-value">{value}</div>
      <div style={statSub}>{sub}</div>
    </div>
  );
}

const typeBadge = (type: "model" | "commission"): React.CSSProperties => ({
  marginLeft: 8,
  display: "inline-block",
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 700,
  color: type === "commission" ? "#7c3aed" : "#2563eb",
  background: type === "commission" ? "#7c3aed18" : "#2563eb18",
  border: `1px solid ${type === "commission" ? "#7c3aed40" : "#2563eb40"}`,
});

const vatNote: React.CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  fontWeight: 700,
  color: "#0f766e",
};

const pageWrap: React.CSSProperties = {
  maxWidth: 1240,
  margin: "0 auto",
  padding: "28px 20px 60px",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};

const headerWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "start",
  gap: 14,
  marginBottom: 24,
  flexWrap: "wrap",
};

const pageTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 40,
  fontWeight: 900,
  color: "#111827",
};

const pageDesc: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#6b7280",
  fontSize: 15,
  lineHeight: 1.7,
};

const summaryGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 24,
};

const statCard: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 24,
  background: "white",
  padding: 22,
};

const statTitle: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 14,
  fontWeight: 700,
};

const statValue: React.CSSProperties = {
  marginTop: 12,
  fontSize: 32,
  lineHeight: 1.1,
  fontWeight: 900,
  color: "#111827",
};

const statSub: React.CSSProperties = {
  marginTop: 8,
  color: "#9ca3af",
  fontSize: 13,
};

const sectionBox: React.CSSProperties = {
  border: "1px solid #e5e7eb",
  borderRadius: 28,
  background: "white",
  padding: 24,
};

const sectionHead: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "end",
  gap: 14,
  marginBottom: 18,
  flexWrap: "wrap",
};

const sectionTitle: React.CSSProperties = {
  margin: 0,
  fontSize: 28,
  fontWeight: 900,
  color: "#111827",
};

const sectionHint: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 13,
  fontWeight: 700,
};

const chartWrap: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(10, minmax(0, 1fr))",
  gap: 6,
  alignItems: "end",
  minHeight: 260,
};

const chartItem: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "end",
  gap: 8,
};

const chartBar: React.CSSProperties = {
  width: "100%",
  maxWidth: 80,
  borderRadius: 18,
  background: "linear-gradient(180deg, #22c55e 0%, #16a34a 100%)",
  minHeight: 8,
};

const chartLabel: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 800,
  color: "#111827",
  whiteSpace: "nowrap",
};

const chartSub: React.CSSProperties = {
  fontSize: 12,
  color: "#6b7280",
};

const chartValue: React.CSSProperties = {
  fontSize: 12,
  color: "#111827",
  fontWeight: 800,
  textAlign: "center",
  wordBreak: "keep-all",
};

const twoColGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 18,
  marginTop: 24,
};

const emptyText: React.CSSProperties = {
  color: "#6b7280",
  fontSize: 15,
};

const topRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "14px 0",
  borderBottom: "1px solid #eef2f7",
};

const rankBadge: React.CSSProperties = {
  width: 34,
  height: 34,
  borderRadius: 999,
  background: "#111827",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 900,
  fontSize: 13,
  flexShrink: 0,
};

const topTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: "#111827",
};

const topSub: React.CSSProperties = {
  marginTop: 4,
  fontSize: 13,
  color: "#6b7280",
};

const topValue: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#16a34a",
};

const saleRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  padding: "12px 0",
  borderBottom: "1px solid #eef2f7",
};

const saleThumbFallback: React.CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: 16,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "#f3f4f6",
  color: "#111827",
  fontWeight: 900,
  flexShrink: 0,
};

const saleTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  fontSize: 16,
  fontWeight: 800,
  color: "#111827",
};

const saleSub: React.CSSProperties = {
  marginTop: 6,
  color: "#6b7280",
  fontSize: 13,
};

const salePrice: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 900,
  color: "#111827",
};
