"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../../lib/toast";
import { GOLD } from "@/lib/constants";

const GOLD_LIGHT = "#fdf6e3";

const PROGRAM_OPTIONS = ["주얼리CAD", "Rhino 5", "Rhino 6", "Rhino 7", "Rhino 8", "ZBrush (지브러쉬)", "KeyShot (키샷)"];
const WORK_TYPE_OPTIONS = ["패션세트", "예물", "미스링", "미스팔찌", "패션팔찌", "패션반지", "귀걸이(원터치)"];
const LEVELS = ["상", "중", "하"] as const;
type Level = typeof LEVELS[number];
type SkillItem = { name: string; level: Level };

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 1989 }, (_, i) => CURRENT_YEAR - i);

export default function MentorRegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isSeller, setIsSeller] = useState(false);
  const [existing, setExisting] = useState(false);
  const [hasContact, setHasContact] = useState(true);

  const [intro, setIntro] = useState("");
  const [careerStartYear, setCareerStartYear] = useState<string>("");
  const [programs, setPrograms] = useState<SkillItem[]>([]);
  const [workTypes, setWorkTypes] = useState<SkillItem[]>([]);
  const [canCpx, setCanCpx] = useState(false);
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const uid = payload?.sub;
    if (!uid) { router.push("/auth"); return; }

    const { data: profile } = await supabase.from("profiles").select("role, opentalk_url, contact_phone").eq("id", uid).single();
    const role = profile?.role ?? "buyer";
    setIsSeller(role === "seller" || role === "admin");
    setHasContact(!!(profile?.opentalk_url?.trim() || profile?.contact_phone?.trim()));

    const { data: m } = await supabase
      .from("cad_mentors")
      .select("intro, career_start_year, programs, work_types, can_cpx")
      .eq("user_id", uid)
      .maybeSingle();

    if (m) {
      setExisting(true);
      setIntro(m.intro ?? "");
      setCareerStartYear(m.career_start_year ? String(m.career_start_year) : "");
      setPrograms((m.programs as SkillItem[]) ?? []);
      setWorkTypes((m.work_types as SkillItem[]) ?? []);
      setCanCpx(m.can_cpx ?? false);
    }
    setLoading(false);
  };

  const toggleItem = (list: SkillItem[], setList: (v: SkillItem[]) => void, name: string) => {
    const exists = list.find((p) => p.name === name);
    if (exists) setList(list.filter((p) => p.name !== name));
    else setList([...list, { name, level: "중" }]);
  };

  const setItemLevel = (list: SkillItem[], setList: (v: SkillItem[]) => void, name: string, level: Level) => {
    setList(list.map((p) => (p.name === name ? { ...p, level } : p)));
  };

  const handleSubmit = async () => {
    if (!intro.trim()) { showError("소개글을 입력해주세요."); return; }
    if (!hasContact) { showError("원활한 소통을 위해 전화번호 또는 오픈톡 URL 중 하나는 필수입니다."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSubmitting(true);
    const res = await fetch("/api/cad-school/mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intro: intro.trim(),
        career_start_year: careerStartYear ? parseInt(careerStartYear) : null,
        programs,
        work_types: workTypes,
        can_cpx: canCpx,
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
          <p style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>추후 멘토 등록 조건이 변경될 수 있습니다.</p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/profile?tab=seller" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 24px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800, fontSize: 14 }}>
              판매자 등록하러 가기
            </Link>
            <Link href="/cad-school" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 24px", borderRadius: 14, border: "1px solid #d1d5db", background: "white", color: "#374151", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
              캐드스쿨로 돌아가기
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const careerYears = careerStartYear ? CURRENT_YEAR - parseInt(careerStartYear) : null;

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
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#6b7280" }}>주얼리 CAD 멘토링을 제공하고 수익을 창출해보세요.</p>

        <div style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD}66`, borderRadius: 12, padding: "10px 14px", marginBottom: 22, fontSize: 12, color: "#92681a", lineHeight: 1.8 }}>
          💡 현재는 <strong>판매자로 등록된 회원</strong>이라면 누구나 멘토 활동이 가능합니다.<br />
          추후 멘토 등록 조건이 변경될 수 있습니다.
        </div>

        {!hasContact && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", marginBottom: 22, fontSize: 13, color: "#dc2626", lineHeight: 1.8 }}>
            ⚠️ 원활한 소통을 위해 전화번호 또는 오픈톡 URL 중 하나는 필수입니다.{" "}
            <Link href="/profile?tab=seller" style={{ color: "#dc2626", fontWeight: 800, textDecoration: "underline" }}>
              내 정보에서 연락 수단 등록하기
            </Link>
          </div>
        )}

        {/* 멘토 활동 안내 접이식 */}
        <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 22 }}>
          <div
            onClick={() => setShowGuide(!showGuide)}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>📋 멘토 활동 안내</span>
            <span style={{ fontSize: 12, color: "#6b7280" }}>{showGuide ? "접기 ▲" : "펼치기 ▼"}</span>
          </div>
          {showGuide && (
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>멘토 수익 구조</div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
                  <li>수강생 구독료의 80%가 멘토에게 지급됩니다</li>
                  <li>건별 멘토링 수익의 80%가 멘토에게 지급됩니다</li>
                </ul>
              </div>
              <div style={{ borderTop: "1px solid #e5e7eb" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>제공 서비스 설명</div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
                  <li>CAD수정: 수강생 3DM 파일을 직접 수정 후 전달 (STL/OBJ는 피드백만)</li>
                  <li>실무 검수: 제작/판매 가능 여부 컨펌</li>
                  <li>검수+CAD수정: 검수 후 직접 수정까지 진행</li>
                </ul>
              </div>
              <div style={{ borderTop: "1px solid #e5e7eb" }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>멘토 주의사항</div>
                <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
                  <li>답변 시간을 준수해주세요 (BASIC 48시간, PRO 36시간, MASTER 24시간)</li>
                  <li>불성실한 답변 시 경고가 누적될 수 있습니다</li>
                  <li>추후 멘토 등록 조건이 변경될 수 있습니다</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* 소개글 */}
        <Field label="소개글">
          <textarea
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            placeholder="CAD 경력, 전문 분야, 멘토링 방식 등을 소개해주세요."
            rows={4}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>

        {/* 경력 시작 연도 */}
        <Field label="주얼리 실무 시작 연도">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <select
              value={careerStartYear}
              onChange={(e) => setCareerStartYear(e.target.value)}
              style={{ ...inputStyle, width: "auto", minWidth: 140 }}
            >
              <option value="">연도 선택</option>
              {YEAR_OPTIONS.map((y) => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            {careerYears !== null && (
              <span style={{ fontSize: 14, fontWeight: 800, color: "#111827", background: "#f3f4f6", borderRadius: 8, padding: "6px 14px" }}>
                경력 {careerYears}년
              </span>
            )}
          </div>
        </Field>

        {/* 사용 가능 프로그램 */}
        <Field label="사용 가능 프로그램">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PROGRAM_OPTIONS.map((name) => {
              const item = programs.find((p) => p.name === name);
              const checked = !!item;
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${checked ? "#111827" : "#e5e7eb"}`, background: checked ? "#f8fafc" : "white", cursor: "pointer" }}
                  onClick={() => toggleItem(programs, setPrograms, name)}
                >
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? "#111827" : "#d1d5db"}`, background: checked ? "#111827" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {checked && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: checked ? 700 : 400, color: checked ? "#111827" : "#6b7280", flex: 1 }}>{name}</span>
                  {checked && (
                    <select
                      value={item.level}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); setItemLevel(programs, setPrograms, name, e.target.value as Level); }}
                      style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
                    >
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </Field>

        {/* 작업 분야 */}
        <Field label="작업 분야">
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {WORK_TYPE_OPTIONS.map((name) => {
              const item = workTypes.find((p) => p.name === name);
              const checked = !!item;
              return (
                <div key={name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1px solid ${checked ? "#111827" : "#e5e7eb"}`, background: checked ? "#f8fafc" : "white", cursor: "pointer" }}
                  onClick={() => toggleItem(workTypes, setWorkTypes, name)}
                >
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? "#111827" : "#d1d5db"}`, background: checked ? "#111827" : "white", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    {checked && <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: checked ? 700 : 400, color: checked ? "#111827" : "#6b7280", flex: 1 }}>{name}</span>
                  {checked && (
                    <select
                      value={item.level}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { e.stopPropagation(); setItemLevel(workTypes, setWorkTypes, name, e.target.value as Level); }}
                      style={{ fontSize: 12, fontWeight: 700, padding: "3px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", cursor: "pointer" }}
                    >
                      {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  )}
                </div>
              );
            })}
          </div>
        </Field>

        {/* CPX 금주물 모델링 */}
        <Field label="CPX (최저중량) 금주물 모델링 제작 가능">
          <button
            type="button"
            onClick={() => setCanCpx(!canCpx)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "12px 16px", borderRadius: 12, border: `1.5px solid ${canCpx ? "#111827" : "#e5e7eb"}`,
              background: canCpx ? "#111827" : "white", cursor: "pointer", width: "100%",
            }}
          >
            <div style={{ width: 44, height: 24, borderRadius: 12, background: canCpx ? GOLD : "#d1d5db", position: "relative", flexShrink: 0, transition: "background 0.2s" }}>
              <div style={{ position: "absolute", top: 3, left: canCpx ? 22 : 3, width: 18, height: 18, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: canCpx ? "white" : "#6b7280" }}>
              {canCpx ? "✅ 가능" : "불가능"}
            </span>
          </button>
        </Field>

        {/* 고정 가격 안내 */}
        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "14px 16px", marginBottom: 28, fontSize: 13, color: "#0c4a6e", lineHeight: 2 }}>
          💰 <strong>건별 멘토링 가격은 플랫폼 고정가</strong>로 운영됩니다.<br />
          <span style={{ paddingLeft: 22, display: "block" }}>
            이미지 검토 <strong>3,000원</strong> &nbsp;·&nbsp; 파일 검토 <strong>5,000원</strong> &nbsp;·&nbsp; 파일 수정 <strong>10,000원</strong>
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
    <div style={{ marginBottom: 20 }}>
      <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
