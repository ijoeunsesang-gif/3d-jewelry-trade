"use client";

import { useEffect, useState } from "react";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import SalesStatsPanel from "@/app/components/SalesStatsPanel";

export default function SalesPage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    setUserId(token ? ((decodeJwt(token) as any)?.sub as string) ?? null : null);
    setReady(true);
  }, []);

  return (
    <main style={pageWrap}>
      <div style={headerWrap}>
        <h1 style={pageTitle}>판매 통계</h1>
        <p style={pageDesc}>
          내가 업로드한 모델의 판매, 담당한 의뢰, (멘토라면) 캐드스쿨 수익을 한 곳에서 확인할 수 있습니다.
        </p>
      </div>

      {ready && <SalesStatsPanel userId={userId} />}
    </main>
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
  marginBottom: 24,
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
