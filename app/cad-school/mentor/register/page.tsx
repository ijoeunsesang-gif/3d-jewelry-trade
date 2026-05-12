"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../../lib/toast";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";

export default function MentorRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [existing, setExisting] = useState(false);

  const [intro, setIntro] = useState("");

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const uid = payload?.sub;
    if (!uid) { router.push("/auth"); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", uid)
      .single();

    const role = profile?.role ?? "buyer";
    setIsSeller(role === "seller" || role === "admin");

    const { data: mentorData } = await supabase
      .from("cad_mentors")
      .select("intro")
      .eq("user_id", uid)
      .maybeSingle();

    if (mentorData) {
      setExisting(true);
      setIntro(mentorData.intro ?? "");
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

  if (!isSeller) {
    return (
      <main style={{ maxWidth: 600, margin: "0 auto", padding: "60px 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', textAlign: "center" }}>
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "40px 32px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎓</div>
          <h1 style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 10 }}>멘토 등록 불가</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 6, lineHeight: 1.7 }}>
            현재는 <strong style={{ color: "#111827" }}>판매자로 등록된 회원</strong>이라면 누구나 멘토 활동이 가능합니다.
          </p>
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>
            추후 멘토 등록 조건이 변경될 수 있습니다.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link
              href="/profile?tab=seller"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 24px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800, fontSize: 14 }}
            >
              판매자 등록하러 가기
            </Link>
            <Link
              href="/cad-school"
              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 24px", borderRadius: 14, border: "1px solid #d1d5db", background: "white", color: "#374151", textDecoration: "none", fontWeight: 700, fontSize: 14 }}
            >
              캐드스쿨로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

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
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>
          주얼리 CAD 멘토링을 제공하고 수익을 창출해보세요.
        </p>

        {/* 조건 안내 */}
        <div style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD}66`, borderRadius: 12, padding: "10px 14px", marginBottom: 22, fontSize: 12, color: "#92681a", lineHeight: 1.8 }}>
          💡 현재는 <strong>판매자로 등록된 회원</strong>이라면 누구나 멘토 활동이 가능합니다.<br />
          추후 멘토 등록 조건이 변경될 수 있습니다.
        </div>

        <Field label="소개글">
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="CAD 경력, 전문 분야, 멘토링 방식 등을 소개해주세요."
            rows={5}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>

        {/* 고정 가격 안내 */}
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", marginBottom: 28, fontSize: 13, color: "#0c4a6e", lineHeight: 2 }}>
          💰 <strong>건별 멘토링 가격은 플랫폼 고정가</strong>로 운영됩니다.<br />
          <span style={{ paddingLeft: 22, display: "block" }}>
            이미지 검토 <strong>3,000원</strong> &nbsp;·&nbsp; 파일 검토 <strong>5,000원</strong> &nbsp;·&nbsp; 파일 수정 <strong>15,000원</strong>
          </span>
          <span style={{ paddingLeft: 22, display: "block", fontSize: 11, color: "#0369a1", marginTop: 2 }}>
            멘토 수익의 80%가 멘토에게 지급됩니다.
          </span>
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
