"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../../lib/toast";

const GOLD = "#c9a84c";

export default function MentorRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [existing, setExisting] = useState(false);

  const [intro, setIntro] = useState("");
  const [perSession, setPerSession] = useState("");
  const [pkg5, setPkg5] = useState("");
  const [pkg10, setPkg10] = useState("");
  const [dailyLimit, setDailyLimit] = useState("2");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const uid = payload?.sub;
    if (!uid) { router.push("/auth"); return; }

    const { data: mentorData } = await supabase
      .from("cad_mentors")
      .select("intro, per_session_price, package_5_price, package_10_price, daily_limit")
      .eq("user_id", uid)
      .maybeSingle();

    if (mentorData) {
      setExisting(true);
      setIntro(mentorData.intro ?? "");
      setPerSession(String(mentorData.per_session_price ?? 0));
      setPkg5(String(mentorData.package_5_price ?? 0));
      setPkg10(String(mentorData.package_10_price ?? 0));
      setDailyLimit(String(mentorData.daily_limit ?? 2));
    }
    setLoading(false);
  };

  const handleSubmit = async () => {
    if (!intro.trim()) { showError("소개글을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSubmitting(true);
    const res = await fetch("/api/cad-school/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intro: intro.trim(),
        per_session_price: parseInt(perSession) || 0,
        package_5_price: parseInt(pkg5) || 0,
        package_10_price: parseInt(pkg10) || 0,
        daily_limit: parseInt(dailyLimit) || 2,
      }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "등록 실패"); }
    else {
      showSuccess(existing ? "멘토 정보가 수정되었습니다." : "멘토로 등록되었습니다!");
      router.push("/cad-school");
    }
    setSubmitting(false);
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>{existing ? "멘토 정보 수정" : "멘토 등록"}</span>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#111827" }}>
          {existing ? "멘토 정보 수정" : "멘토 등록"}
        </h1>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>
          주얼리 CAD 멘토링을 제공하고 수익을 창출해보세요.
        </p>

        <Field label="소개글">
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="CAD 경력, 전문 분야, 멘토링 방식 등을 소개해주세요."
            rows={5}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
          <Field label="건별 멘토링 가격 (원)">
            <input
              type="number"
              value={perSession}
              onChange={(e) => setPerSession(e.target.value)}
              placeholder="30000"
              min={0}
              style={inputStyle}
            />
          </Field>
          <Field label="1일 최대 수락 건수">
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              placeholder="2"
              min={1}
              max={10}
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          <Field label="5회 패키지 가격 (원)">
            <input
              type="number"
              value={pkg5}
              onChange={(e) => setPkg5(e.target.value)}
              placeholder="120000"
              min={0}
              style={inputStyle}
            />
          </Field>
          <Field label="10회 패키지 가격 (원)">
            <input
              type="number"
              value={pkg10}
              onChange={(e) => setPkg10(e.target.value)}
              placeholder="200000"
              min={0}
              style={inputStyle}
            />
          </Field>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", marginBottom: 24, fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
          💡 가격을 0으로 설정하면 해당 서비스는 목록에 표시되지 않습니다.
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: submitting ? "#d1d5db" : "#111827", color: "white", fontSize: 15, fontWeight: 900, cursor: submitting ? "not-allowed" : "pointer" }}
        >
          {submitting ? "처리 중..." : existing ? "정보 수정하기" : "멘토 등록하기"}
        </button>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
