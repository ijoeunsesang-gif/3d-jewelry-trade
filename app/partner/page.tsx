"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { EmptyState } from "../components/EmptyState";

type TabKey = "factories" | "printShops" | "원본" | "레이저" | "고무몰드" | "도금" | "주조" | "조각";

const TABS: { key: TabKey; label: string }[] = [
  { key: "factories", label: "생산 공장" },
  { key: "printShops", label: "출력소" },
  { key: "원본",     label: "원본" },
  { key: "레이저",   label: "레이저(각인)" },
  { key: "고무몰드", label: "고무몰드" },
  { key: "도금",     label: "도금" },
  { key: "주조",     label: "주조" },
  { key: "조각",     label: "조각" },
];

const PARTNER_CATEGORY_MAP: Partial<Record<TabKey, string>> = {
  레이저: "레이저 각인",
  고무몰드: "고무몰드",
  도금: "도금",
  주조: "주조",
  조각: "조각",
};

function isPartnerTab(key: TabKey): boolean {
  return key in PARTNER_CATEGORY_MAP;
}

export default function PartnerPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("factories");

  const [factories, setFactories] = useState<{
    id: string; name: string; phone: string | null; address: string | null; description: string | null;
  }[]>([]);
  const [factoriesLoading, setFactoriesLoading] = useState(false);
  const [factoriesLoaded, setFactoriesLoaded] = useState(false);

  const [printShops, setPrintShops] = useState<{
    id: string; name: string; address: string; phone: string;
    hours: string | null; naver_map_url: string | null;
  }[]>([]);
  const [printShopsLoading, setPrintShopsLoading] = useState(false);
  const [printShopsLoaded, setPrintShopsLoaded] = useState(false);

  const [partners, setPartners] = useState<{
    id: string; name: string; phone: string | null; address: string | null; description: string | null; category: string;
  }[]>([]);
  const [partnersLoading, setPartnersLoading] = useState(false);
  const [partnersLoaded, setPartnersLoaded] = useState(false);

  const [finishingWorkers, setFinishingWorkers] = useState<{
    id: string; name: string; phone: string; location: string | null; work_scope: string[];
  }[]>([]);
  const [finishingWorkersLoading, setFinishingWorkersLoading] = useState(false);
  const [finishingWorkersLoaded, setFinishingWorkersLoaded] = useState(false);

  useEffect(() => {
    if (activeTab === "factories" && !factoriesLoaded) fetchFactories();
    if (activeTab === "printShops" && !printShopsLoaded) fetchPrintShops();
    if (activeTab === "원본" && !finishingWorkersLoaded) fetchFinishingWorkers();
    if (isPartnerTab(activeTab) && !partnersLoaded) fetchPartners();
  }, [activeTab]);

  // 초기 탭 데이터 로드
  useEffect(() => { fetchFactories(); }, []);

  const fetchFactories = async () => {
    setFactoriesLoading(true);
    try {
      const { data, error } = await supabase
        .from("factories").select("id, name, phone, address, description")
        .eq("is_active", true).order("created_at", { ascending: true });
      if (!error && data) setFactories(data);
    } catch {}
    finally { setFactoriesLoading(false); setFactoriesLoaded(true); }
  };

  const fetchPrintShops = async () => {
    setPrintShopsLoading(true);
    try {
      const { data, error } = await supabase
        .from("print_shops").select("id, name, address, phone, hours, naver_map_url")
        .eq("is_active", true).order("created_at", { ascending: true });
      if (!error && data) setPrintShops(data);
    } catch {}
    finally { setPrintShopsLoading(false); setPrintShopsLoaded(true); }
  };

  const fetchPartners = async () => {
    setPartnersLoading(true);
    try {
      const { data, error } = await supabase
        .from("partners").select("id, name, phone, address, description, category")
        .eq("is_active", true).order("created_at", { ascending: true });
      if (!error && data) setPartners(data);
    } catch {}
    finally { setPartnersLoading(false); setPartnersLoaded(true); }
  };

  const fetchFinishingWorkers = async () => {
    setFinishingWorkersLoading(true);
    try {
      const { data, error } = await supabase
        .from("finishing_workers").select("id, name, phone, location, work_scope")
        .eq("is_active", true).order("created_at", { ascending: true });
      if (!error && data) setFinishingWorkers(data);
    } catch {}
    finally { setFinishingWorkersLoading(false); setFinishingWorkersLoaded(true); }
  };

  const renderContent = () => {
    if (activeTab === "factories") {
      if (factoriesLoading) return <p style={{ color: "#6b7280" }}>불러오는 중...</p>;
      if (factories.length === 0) return <EmptyState message="등록된 공장 정보가 없습니다." />;
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {factories.map((f) => (
            <InfoCard key={f.id} name={f.name} address={f.address} phone={f.phone} description={f.description} />
          ))}
        </div>
      );
    }

    if (activeTab === "printShops") {
      if (printShopsLoading) return <p style={{ color: "#6b7280" }}>불러오는 중...</p>;
      if (printShops.length === 0) return <EmptyState message="등록된 출력소가 없습니다." />;
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
          {printShops.map((ps) => (
            <div key={ps.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: "20px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>{ps.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <div style={{ fontSize: 13, color: "#374151" }}>📍 {ps.address}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>📞 {ps.phone}</div>
                {ps.hours && <div style={{ fontSize: 12, color: "#6b7280" }}>🕐 {ps.hours}</div>}
              </div>
              {ps.naver_map_url && (
                <a href={ps.naver_map_url} target="_blank" rel="noopener noreferrer"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", textDecoration: "none", fontWeight: 700, fontSize: 13 }}>
                  네이버 지도
                </a>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (activeTab === "원본") {
      if (finishingWorkersLoading) return <p style={{ color: "#6b7280" }}>불러오는 중...</p>;
      if (finishingWorkers.length === 0) return <EmptyState message="등록된 원본 작업자가 없습니다." />;
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {finishingWorkers.map((w) => (
            <div key={w.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: "20px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>{w.name}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {w.location && <div style={{ fontSize: 13, color: "#374151" }}>📍 {w.location}</div>}
                <div style={{ fontSize: 13, color: "#374151" }}>📞 {w.phone}</div>
              </div>
              {(w.work_scope || []).length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
                  {(w.work_scope || []).map((s) => (
                    <span key={s} style={{ fontSize: 12, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "#f3f4f6", color: "#374151" }}>{s}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }

    if (isPartnerTab(activeTab)) {
      if (partnersLoading) return <p style={{ color: "#6b7280" }}>불러오는 중...</p>;
      const category = PARTNER_CATEGORY_MAP[activeTab]!;
      const filtered = partners.filter((p) => p.category === category);
      if (filtered.length === 0) return <EmptyState message="등록된 업체정보가 없습니다." />;
      return (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {filtered.map((p) => (
            <InfoCard key={p.id} name={p.name} address={p.address} phone={p.phone} description={p.description} />
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <style>{`
        .partner-tab-wrap {
          display: flex;
          border-bottom: 2px solid #e5e7eb;
          margin-bottom: 24px;
        }
        .partner-tab-btn {
          padding: 10px 18px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          border: none;
          background: none;
          white-space: nowrap;
        }
        @media (max-width: 640px) {
          .partner-tab-wrap {
            flex-wrap: wrap;
            border-bottom: none;
            gap: 6px;
            justify-content: center;
            margin-bottom: 20px;
          }
          .partner-tab-btn {
            border: 1px solid #e5e7eb !important;
            border-radius: 8px !important;
            padding: 8px 10px !important;
            font-size: 13px !important;
            box-sizing: border-box;
          }
          .partner-tab-btn.tab-active {
            background: #111827 !important;
            color: white !important;
            border-color: #111827 !important;
          }
          .partner-tab-btn-1,
          .partner-tab-btn-2,
          .partner-tab-btn-3 { width: calc(33.33% - 4px); }
          .partner-tab-btn-4,
          .partner-tab-btn-5 { width: calc(50% - 4px); }
          .partner-tab-btn-6,
          .partner-tab-btn-7,
          .partner-tab-btn-8 { width: calc(33.33% - 4px); }
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111827", margin: "0 0 6px" }}>업체정보</h1>
        <p style={{ color: "#6b7280", fontSize: 14, margin: 0 }}>주얼리 제작에 필요한 업체정보를 확인하세요.</p>
      </div>

      <div className="partner-tab-wrap">
        {TABS.map(({ key, label }, idx) => {
          const active = activeTab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveTab(key)}
              className={`partner-tab-btn partner-tab-btn-${idx + 1}${active ? " tab-active" : ""}`}
              style={{
                color: active ? "#111827" : "#9ca3af",
                borderBottom: active ? "2px solid #111827" : "2px solid transparent",
                marginBottom: -2,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {renderContent()}
    </main>
  );
}

function InfoCard({ name, address, phone, description }: {
  name: string; address: string | null; phone: string | null; description: string | null;
}) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: "20px", boxShadow: "0 2px 12px rgba(15,23,42,0.06)", display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontSize: 17, fontWeight: 900, color: "#111827" }}>{name}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {address && <div style={{ fontSize: 13, color: "#374151" }}>📍 {address}</div>}
        {phone && <div style={{ fontSize: 13, color: "#374151" }}>📞 {phone}</div>}
        {description && <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>{description}</div>}
      </div>
    </div>
  );
}
