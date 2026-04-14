"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase-browser";

type PurchaseRow = {
  id: string;
  model_id: string;
  price: number;
  created_at: string;
};

type ModelRow = {
  id: string;
  title: string;
  thumbnail: string;
  thumbnail_path?: string | null;
  seller_id: string;
};

type PeriodType = "7days" | "30days" | "all" | "monthly";

export default function SalesPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelRow[]>([]);
  const [purchases, setPurchases] = useState<PurchaseRow[]>([]);
  const [period, setPeriod] = useState<PeriodType>("7days");

  useEffect(() => {
    fetchSalesData();
  }, []);

  const fetchSalesData = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      const { data: myModels, error: modelError } = await supabase
        .from("models")
        .select("id, title, thumbnail, thumbnail_path, seller_id")
        .eq("seller_id", session.user.id);

      if (modelError) {
        console.error("?êÎß§ Î™®Îç∏ Î∂àÎü¨?§Í∏∞ ?§Ìå®:", modelError);
        setLoading(false);
        return;
      }

      setModels(myModels || []);

      const modelIds = (myModels || []).map((m) => m.id);

      if (modelIds.length === 0) {
        setPurchases([]);
        setLoading(false);
        return;
      }

      const { data: purchaseData, error: purchaseError } = await supabase
        .from("purchases")
        .select("id, model_id, price, created_at")
        .in("model_id", modelIds)
        .order("created_at", { ascending: false });

      if (purchaseError) {
        console.error("?êÎß§ ?¥Ïó≠ Î∂àÎü¨?§Í∏∞ ?§Ìå®:", purchaseError);
        setLoading(false);
        return;
      }

      setPurchases(purchaseData || []);
    } catch (error) {
      console.error("?êÎß§ ?µÍ≥Ñ Î∂àÎü¨?§Í∏∞ ?§Î•ò:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPurchases = useMemo(() => {
    if (period === "all" || period === "monthly") return purchases;

    const days = period === "7days" ? 7 : 30;
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - days);

    return purchases.filter((row) => new Date(row.created_at) >= cutoff);
  }, [purchases, period]);

  const modelMap = useMemo(() => {
    const map = new Map<string, ModelRow>();
    models.forEach((m) => map.set(m.id, m));
    return map;
  }, [models]);

  const totalSalesCount = filteredPurchases.length;
  const totalRevenue = filteredPurchases.reduce(
    (sum, row) => sum + (row.price || 0),
    0
  );
  const averagePrice =
    totalSalesCount > 0 ? Math.round(totalRevenue / totalSalesCount) : 0;

  const topModels = useMemo(() => {
    const grouped = new Map<
      string,
      { modelId: string; title: string; count: number; revenue: number }
    >();

    filteredPurchases.forEach((purchase) => {
      const model = modelMap.get(purchase.model_id);
      const current = grouped.get(purchase.model_id);

      if (current) {
        current.count += 1;
        current.revenue += purchase.price || 0;
      } else {
        grouped.set(purchase.model_id, {
          modelId: purchase.model_id,
          title: model?.title || "?????ÜÎäî Î™®Îç∏",
          count: 1,
          revenue: purchase.price || 0,
        });
      }
    });

    return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredPurchases, modelMap]);

  const chartData = useMemo(() => {
    if (period === "monthly") {
      const monthMap = new Map<string, { label: string; revenue: number; count: number }>();

      purchases.forEach((row) => {
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

      const filtered = filteredPurchases.filter(
        (row) => row.created_at.slice(0, 10) === key
      );

      result.push({
        label: `${mm}/${dd}`,
        revenue: filtered.reduce((sum, row) => sum + (row.price || 0), 0),
        count: filtered.length,
      });
    }

    return result;
  }, [filteredPurchases, purchases, period]);

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  const getThumbUrl = (model?: ModelRow) => {
    if (!model) return "";
    if (model.thumbnail_path) {
      return supabase.storage
        .from("thumbnails")
        .getPublicUrl(model.thumbnail_path).data.publicUrl;
    }
    return model.thumbnail || "";
  };

  if (loading) {
    return (
      <main style={pageWrap}>
        <p style={{ color: "#6b7280" }}>?êÎß§ ?µÍ≥Ñ Î∂àÎü¨?§Îäî Ï§?..</p>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={headerWrap}>
        <div>
          <h1 style={pageTitle}>?êÎß§ ?µÍ≥Ñ</h1>
          <p style={pageDesc}>
            ?¥Í? ?ÖÎ°ú?úÌïú Î™®Îç∏???êÎß§ ?òÏ? Îß§Ï∂ú ?êÎ¶Ñ????Î≤àÏóê ?ïÏù∏?????àÏäµ?àÎã§.
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
          <option value="7days">ÏµúÍ∑º 7??/option>
          <option value="30days">ÏµúÍ∑º 30??/option>
          <option value="all">?ÑÏ≤¥ Í∏∞Í∞Ñ</option>
          <option value="monthly">?îÎ≥Ñ Î≥¥Í∏∞</option>
        </select>
      </div>

      <section style={summaryGrid} className="stats-summary-grid">
        <StatCard title="Ï¥??êÎß§ ?? value={`${totalSalesCount}Í±?} sub="?†ÌÉù??Í∏∞Í∞Ñ Í∏∞Ï? ?êÎß§ Í±¥Ïàò" />
        <StatCard title="Ï¥?Îß§Ï∂ú" value={`${totalRevenue.toLocaleString("ko-KR")}??} sub="?†ÌÉù??Í∏∞Í∞Ñ Í∏∞Ï? Îß§Ï∂ú ?©Í≥Ñ" />
        <StatCard title="?âÍ∑† ?êÎß§Í∞Ä" value={`${averagePrice.toLocaleString("ko-KR")}??} sub="?êÎß§ 1Í±¥Îãπ ?âÍ∑†" />
        <StatCard title="?±Î°ù Î™®Îç∏ ?? value={`${models.length}Í∞?} sub="?ÑÏû¨ ?±Î°ù????Î™®Îç∏ ?? />
      </section>

      <section style={sectionBox}>
        <div style={sectionHead}>
          <h2 style={sectionTitle}>
            {period === "monthly" ? "?îÎ≥Ñ Îß§Ï∂ú ?êÎ¶Ñ" : "Îß§Ï∂ú ?êÎ¶Ñ"}
          </h2>
          <span style={sectionHint}>
            {period === "monthly" ? "???®ÏúÑ ÏßëÍ≥Ñ" : "?†ÌÉù??Í∏∞Í∞Ñ Í∏∞Ï? ?úÍ∞Å??}
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
                {day.revenue > 0 ? `${day.revenue.toLocaleString("ko-KR")}?? : "-"}
              </div>
              <div
                style={{
                  ...chartBar,
                  height: `${Math.max((day.revenue / maxRevenue) * 180, day.revenue > 0 ? 14 : 8)}px`,
                }}
              />
              <div style={chartLabel}>{idx % 2 === 0 ? day.label : ""}</div>
              <div style={chartSub}>{day.count}Í±?/div>
            </div>
          ))}
        </div>
      </section>

      <section style={twoColGrid} className="stats-two-col">
        <div style={sectionBox}>
          <div style={sectionHead}>
            <h2 style={sectionTitle}>Î≤†Ïä§?∏Ï???Î™®Îç∏</h2>
            <span style={sectionHint}>Îß§Ï∂ú Í∏∞Ï? ?ÅÏúÑ Î™®Îç∏</span>
          </div>

          {topModels.length === 0 ? (
            <p style={emptyText}>?ÑÏßÅ ?êÎß§??Î™®Îç∏???ÜÏäµ?àÎã§.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {topModels.slice(0, 8).map((item, idx) => (
                <div key={item.modelId} style={topRow}>
                  <div style={rankBadge}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={topTitle}>{item.title}</div>
                    <div style={topSub}>?êÎß§ {item.count}Í±?/div>
                  </div>
                  <div style={topValue}>{item.revenue.toLocaleString("ko-KR")}??/div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={sectionBox}>
          <div style={sectionHead}>
            <h2 style={sectionTitle}>ÏµúÍ∑º ?êÎß§ ?¥Ïó≠</h2>
            <span style={sectionHint}>Í∞Ä??ÏµúÍ∑º Í≤∞Ï†ú ??/span>
          </div>

          {filteredPurchases.length === 0 ? (
            <p style={emptyText}>?úÏãú???êÎß§ ?¥Ïó≠???ÜÏäµ?àÎã§.</p>
          ) : (
            <div style={{ display: "grid", gap: 14 }}>
              {filteredPurchases.slice(0, 8).map((row) => {
                const model = modelMap.get(row.model_id);
                const thumb = getThumbUrl(model);

                return (
                  <div key={row.id} style={saleRow}>
                    {thumb ? (
                      <img src={thumb} alt={model?.title || "thumb"} style={saleThumb} />
                    ) : (
                      <div style={saleThumbFallback}>3D</div>
                    )}

                    <div style={{ flex: 1 }}>
                      <div style={saleTitle}>{model?.title || "?????ÜÎäî Î™®Îç∏"}</div>
                      <div style={saleSub}>
                        ?êÎß§?? {new Date(row.created_at).toLocaleString("ko-KR")}
                      </div>
                    </div>

                    <div style={salePrice}>{row.price.toLocaleString("ko-KR")}??/div>
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

const saleThumb: React.CSSProperties = {
  width: 74,
  height: 74,
  borderRadius: 16,
  objectFit: "cover",
  flexShrink: 0,
  border: "1px solid #e5e7eb",
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