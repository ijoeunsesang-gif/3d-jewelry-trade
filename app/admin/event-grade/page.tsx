"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/app/lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "@/app/lib/toast";
import { GOLD } from "@/lib/constants";
import { GRADE_CONFIG, Grade } from "@/lib/grades";
import { LoadingSpinner } from "@/app/components/LoadingSpinner";
import { EmptyState } from "@/app/components/EmptyState";

type ModelRow = { id: string; title: string; thumbnailUrl: string; createdAt: string; invalid: boolean };

type Participant = {
  sellerId: string;
  nickname: string;
  grade: Grade;
  total: number;
  invalidCount: number;
  validCount: number;
  eligibleGrades: ("skilled" | "pro")[];
  models: ModelRow[];
};

type EventSettings = { id: string; start_date: string | null; end_date: string | null; is_active: boolean } | null;

type GradeLog = {
  id: string;
  user_id: string;
  from_grade: string;
  to_grade: string;
  reason: string;
  changed_by: string | null;
  created_at: string;
  user_nickname: string;
  changed_by_nickname: string | null;
};

type ManualUser = { id: string; nickname: string | null; email: string | null; grade: Grade | null };

const EVENT_THRESHOLDS: { grade: "skilled" | "pro"; count: number }[] = [
  { grade: "skilled", count: 30 },
  { grade: "pro", count: 50 },
];

const ALL_GRADES: Grade[] = ["sprout", "skilled", "pro", "master"];

function recalcEligible(validCount: number) {
  return EVENT_THRESHOLDS.filter((t) => validCount >= t.count).map((t) => t.grade);
}

export default function EventGradePage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  const [settings, setSettings] = useState<EventSettings>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  const [expandedSeller, setExpandedSeller] = useState<string | null>(null);
  const [togglingModelId, setTogglingModelId] = useState<string | null>(null);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);

  /* ── 수동 등급 변경 ── */
  const [manualOpen, setManualOpen] = useState(false);
  const [manualUsers, setManualUsers] = useState<ManualUser[]>([]);
  const [manualLoading, setManualLoading] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [manualTarget, setManualTarget] = useState<ManualUser | null>(null);
  const [manualToGrade, setManualToGrade] = useState<Grade>("sprout");
  const [manualReason, setManualReason] = useState("");
  const [manualSaving, setManualSaving] = useState(false);

  /* ── 변경 이력 ── */
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<GradeLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

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
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${token}`,
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
    if (authorized) fetchEventData();
  }, [authorized]);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };
  const authHeader = async () => ({
    Authorization: `Bearer ${await getToken()}`,
    "Content-Type": "application/json",
  });

  const isoToDateInput = (iso: string) => iso.slice(0, 10);
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  const fetchEventData = async () => {
    setDataLoading(true);
    try {
      const res = await fetch("/api/admin/event-grade", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "조회 실패"); return; }
      setSettings(data.settings);
      setParticipants(data.participants || []);
      if (data.settings?.start_date) setStartInput(isoToDateInput(data.settings.start_date));
      if (data.settings?.end_date) setEndInput(isoToDateInput(data.settings.end_date));
    } catch {
      showError("조회 실패");
    } finally {
      setDataLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!startInput || !endInput) { showError("시작일/종료일을 입력하세요."); return; }
    if (startInput > endInput) { showError("시작일이 종료일보다 늦을 수 없습니다."); return; }
    setSavingSettings(true);
    try {
      const res = await fetch("/api/admin/event-grade", {
        method: "PATCH",
        headers: await authHeader(),
        body: JSON.stringify({
          startDate: new Date(`${startInput}T00:00:00`).toISOString(),
          endDate: new Date(`${endInput}T23:59:59`).toISOString(),
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "저장 실패"); return; }
      showSuccess("이벤트 기간이 저장되었습니다.");
      await fetchEventData();
    } catch {
      showError("저장 실패");
    } finally {
      setSavingSettings(false);
    }
  };

  const toggleInvalid = async (sellerId: string, modelId: string, nextInvalid: boolean) => {
    setTogglingModelId(modelId);
    setParticipants((prev) =>
      prev.map((p) => {
        if (p.sellerId !== sellerId) return p;
        const models = p.models.map((m) => (m.id === modelId ? { ...m, invalid: nextInvalid } : m));
        const invalidCount = models.filter((m) => m.invalid).length;
        const validCount = p.total - invalidCount;
        return { ...p, models, invalidCount, validCount, eligibleGrades: recalcEligible(validCount) };
      })
    );
    try {
      const res = await fetch("/api/admin/event-grade/invalid", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ modelId, invalid: nextInvalid }),
      });
      if (!res.ok) {
        showError("처리 실패 — 목록을 다시 불러옵니다.");
        await fetchEventData();
      }
    } catch {
      showError("처리 실패 — 목록을 다시 불러옵니다.");
      await fetchEventData();
    } finally {
      setTogglingModelId(null);
    }
  };

  const approveGrade = async (sellerId: string, toGrade: "skilled" | "pro") => {
    const label = GRADE_CONFIG[toGrade].label;
    if (!confirm(`이 판매자를 ${label}(으)로 승인하시겠습니까?`)) return;
    setApprovingKey(sellerId + toGrade);
    try {
      const res = await fetch("/api/admin/event-grade/approve", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ sellerId, toGrade }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "승인 실패"); return; }
      showSuccess(`${label}로 승인되었습니다.`);
      setParticipants((prev) => prev.map((p) => (p.sellerId === sellerId ? { ...p, grade: toGrade } : p)));
    } catch {
      showError("승인 실패");
    } finally {
      setApprovingKey(null);
    }
  };

  const openManual = async () => {
    setManualOpen((v) => !v);
    if (!manualOpen && manualUsers.length === 0) {
      setManualLoading(true);
      try {
        const res = await fetch("/api/admin/users", { headers: await authHeader() });
        const { data } = await res.json();
        setManualUsers((data || []).map((u: any) => ({ id: u.id, nickname: u.nickname, email: u.email, grade: u.grade })));
      } catch {
        showError("판매자 목록 불러오기 실패");
      } finally {
        setManualLoading(false);
      }
    }
  };

  const selectManualTarget = (u: ManualUser) => {
    setManualTarget(u);
    setManualToGrade(u.grade || "sprout");
    setManualReason("");
  };

  const selectManualFromParticipant = (p: Participant) => {
    setManualOpen(true);
    setManualTarget({ id: p.sellerId, nickname: p.nickname, email: null, grade: p.grade });
    setManualToGrade(p.grade);
    setManualReason("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitManualChange = async () => {
    if (!manualTarget) return;
    if (manualToGrade === (manualTarget.grade || "sprout")) { showError("현재와 다른 등급을 선택하세요."); return; }
    if (!manualReason.trim()) { showError("사유를 입력하세요."); return; }
    if (!confirm(`${manualTarget.nickname || manualTarget.id.slice(0, 8)}님의 등급을 ${GRADE_CONFIG[manualToGrade].label}(으)로 변경하시겠습니까?`)) return;

    setManualSaving(true);
    try {
      const res = await fetch("/api/admin/grade-manual", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ userId: manualTarget.id, toGrade: manualToGrade, reason: manualReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "변경 실패"); return; }
      showSuccess("등급이 변경되었습니다.");
      setManualUsers((prev) => prev.map((u) => (u.id === manualTarget.id ? { ...u, grade: manualToGrade } : u)));
      setParticipants((prev) => prev.map((p) => (p.sellerId === manualTarget.id ? { ...p, grade: manualToGrade } : p)));
      setManualTarget((prev) => (prev ? { ...prev, grade: manualToGrade } : prev));
      setManualReason("");
      if (logsOpen) fetchLogs();
    } catch {
      showError("변경 실패");
    } finally {
      setManualSaving(false);
    }
  };

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await fetch("/api/admin/grade-manual", { headers: await authHeader() });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "이력 조회 실패"); return; }
      setLogs(data.data || []);
    } catch {
      showError("이력 조회 실패");
    } finally {
      setLogsLoading(false);
    }
  };

  const toggleLogs = () => {
    setLogsOpen((v) => !v);
    if (!logsOpen && logs.length === 0) fetchLogs();
  };

  const filteredManualUsers = manualUsers.filter((u) => {
    if (!manualSearch.trim()) return false;
    const q = manualSearch.trim().toLowerCase();
    return (u.nickname || "").toLowerCase().includes(q) || (u.email || "").toLowerCase().includes(q);
  }).slice(0, 20);

  if (loading) return <LoadingSpinner fullPage message="확인 중..." />;
  if (!authorized) return null;

  return (
    <main style={{ maxWidth: 1000, margin: "40px auto", padding: "0 20px 80px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#111827", margin: 0 }}>등급 상향 이벤트</h1>
          <p style={{ color: "#6b7280", marginTop: 6, fontSize: 13 }}>
            자동 참가 · 자동 상향 없음 — 검수 후 관리자가 수동으로 승인합니다.
          </p>
        </div>
        <Link href="/admin" style={{ height: 42, padding: "0 18px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, fontSize: 13, textDecoration: "none", display: "flex", alignItems: "center" }}>
          ← 관리자 홈
        </Link>
      </div>

      {/* 이벤트 기간 설정 */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 14px" }}>이벤트 기간 설정</h2>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <input type="date" value={startInput} onChange={(e) => setStartInput(e.target.value)}
            style={{ height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
          <span style={{ color: "#9ca3af" }}>~</span>
          <input type="date" value={endInput} onChange={(e) => setEndInput(e.target.value)}
            style={{ height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
          <button type="button" onClick={saveSettings} disabled={savingSettings}
            style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: savingSettings ? "#d1d5db" : GOLD, color: "white", fontWeight: 800, fontSize: 13, cursor: savingSettings ? "not-allowed" : "pointer" }}>
            {savingSettings ? "저장 중..." : "저장"}
          </button>
        </div>
        {settings?.start_date && settings?.end_date && (
          <p style={{ marginTop: 12, fontSize: 13, color: "#374151" }}>
            현재 이벤트 기간: <b>{formatDate(settings.start_date)} ~ {formatDate(settings.end_date)}</b>
          </p>
        )}
      </section>

      {/* 판매자 등급 수동 변경 */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={openManual}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>판매자 등급 수동 변경</h2>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{manualOpen ? "접기 ▲" : "펼치기 ▼"}</span>
        </div>

        {manualOpen && (
          <div style={{ marginTop: 16 }}>
            {manualTarget ? (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 16, background: "#f8fafc" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div>
                    <b style={{ fontSize: 14, color: "#111827" }}>{manualTarget.nickname || manualTarget.id.slice(0, 8)}</b>
                    <span style={{ marginLeft: 8, fontSize: 12, color: "#6b7280" }}>
                      현재: {GRADE_CONFIG[manualTarget.grade || "sprout"].emoji} {GRADE_CONFIG[manualTarget.grade || "sprout"].label}
                    </span>
                  </div>
                  <button type="button" onClick={() => setManualTarget(null)} style={{ border: "none", background: "none", color: "#9ca3af", cursor: "pointer", fontSize: 13 }}>
                    다른 판매자 선택
                  </button>
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <select value={manualToGrade} onChange={(e) => setManualToGrade(e.target.value as Grade)}
                    style={{ height: 38, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13 }}>
                    {ALL_GRADES.map((g) => (
                      <option key={g} value={g}>{GRADE_CONFIG[g].emoji} {GRADE_CONFIG[g].label}</option>
                    ))}
                  </select>
                  <input value={manualReason} onChange={(e) => setManualReason(e.target.value)} placeholder="사유 (필수)"
                    style={{ flex: 1, minWidth: 200, height: 38, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
                  <button type="button" onClick={submitManualChange} disabled={manualSaving}
                    style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "none", background: manualSaving ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 13, cursor: manualSaving ? "not-allowed" : "pointer" }}>
                    {manualSaving ? "변경 중..." : "변경"}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input value={manualSearch} onChange={(e) => setManualSearch(e.target.value)} placeholder="닉네임 또는 이메일 검색"
                  style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 14px", fontSize: 13, marginBottom: 10 }} />
                {manualLoading ? (
                  <LoadingSpinner message="목록 불러오는 중..." />
                ) : manualSearch.trim() && filteredManualUsers.length === 0 ? (
                  <p style={{ color: "#9ca3af", fontSize: 13, padding: "8px 0" }}>검색 결과가 없습니다.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 240, overflowY: "auto" }}>
                    {filteredManualUsers.map((u) => (
                      <button key={u.id} type="button" onClick={() => selectManualTarget(u)}
                        style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                        <span>{u.nickname || u.id.slice(0, 8)} <span style={{ color: "#9ca3af" }}>{u.email || ""}</span></span>
                        <span style={{ color: "#6b7280" }}>{GRADE_CONFIG[u.grade || "sprout"].emoji} {GRADE_CONFIG[u.grade || "sprout"].label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </section>

      {/* 참가자 목록 */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: "0 0 14px" }}>
          참가자 목록 {participants.length > 0 && <span style={{ color: "#9ca3af", fontWeight: 600 }}>({participants.length}명)</span>}
        </h2>

        {dataLoading ? (
          <LoadingSpinner message="불러오는 중..." />
        ) : !settings?.start_date || !settings?.end_date ? (
          <EmptyState icon="🗓" title="이벤트 기간이 설정되지 않았습니다" desc="위에서 기간을 먼저 저장하세요." />
        ) : participants.length === 0 ? (
          <EmptyState icon="📭" title="이벤트 기간 내 업로드가 없습니다" />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {participants.map((p) => {
              const expanded = expandedSeller === p.sellerId;
              return (
                <div key={p.sellerId} style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                  <div
                    onClick={() => setExpandedSeller(expanded ? null : p.sellerId)}
                    style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer", gap: 12, flexWrap: "wrap", background: expanded ? "#f8fafc" : "white" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                      <b style={{ fontSize: 14, color: "#111827" }}>{p.nickname}</b>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>
                        {GRADE_CONFIG[p.grade].emoji} {GRADE_CONFIG[p.grade].label}
                      </span>
                      <span style={{ fontSize: 12, color: "#374151" }}>총 {p.total}개</span>
                      <span style={{ fontSize: 12, color: "#dc2626" }}>무효 {p.invalidCount}개</span>
                      <span style={{ fontSize: 12, fontWeight: 800, color: "#111827" }}>유효 {p.validCount}개</span>
                      {p.eligibleGrades.map((g) => (
                        <span key={g} style={{ fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 999, background: GRADE_CONFIG[g].bg, color: GRADE_CONFIG[g].color }}>
                          {GRADE_CONFIG[g].label} 가능
                        </span>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                      {(["skilled", "pro"] as const).map((g) => {
                        const eligible = p.eligibleGrades.includes(g);
                        const already = p.grade === g;
                        const key = p.sellerId + g;
                        return (
                          <button key={g} type="button" disabled={!eligible || already || approvingKey === key}
                            onClick={() => approveGrade(p.sellerId, g)}
                            style={{
                              height: 32, padding: "0 12px", borderRadius: 8, border: "none", fontSize: 12, fontWeight: 800,
                              cursor: eligible && !already ? "pointer" : "not-allowed",
                              background: already ? "#e5e7eb" : eligible ? GRADE_CONFIG[g].color : "#e5e7eb",
                              color: already ? "#9ca3af" : eligible ? "white" : "#9ca3af",
                            }}>
                            {approvingKey === key ? "처리 중..." : already ? `이미 ${GRADE_CONFIG[g].label}` : `${GRADE_CONFIG[g].label}로 승인`}
                          </button>
                        );
                      })}
                      <button type="button" onClick={() => selectManualFromParticipant(p)}
                        style={{ height: 32, padding: "0 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                        수동 변경
                      </button>
                    </div>
                  </div>

                  {expanded && (
                    <div style={{ padding: 16, borderTop: "1px solid #f3f4f6", display: "flex", flexDirection: "column", gap: 8 }}>
                      {p.models.map((m) => (
                        <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10, background: m.invalid ? "#fef2f2" : "#f8fafc" }}>
                          <input
                            type="checkbox"
                            checked={m.invalid}
                            disabled={togglingModelId === m.id}
                            onChange={(e) => toggleInvalid(p.sellerId, m.id, e.target.checked)}
                            style={{ cursor: "pointer", flexShrink: 0 }}
                          />
                          <a
                            href={`/models/${m.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0, textDecoration: "none", color: "inherit" }}
                          >
                            <Image src={m.thumbnailUrl} alt="" width={40} height={40} style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: 13, color: "#111827", textDecoration: m.invalid ? "line-through" : "none" }}>{m.title}</span>
                          </a>
                          <span style={{ fontSize: 12, color: "#9ca3af" }}>{formatDate(m.createdAt)}</span>
                          {m.invalid && <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626" }}>무효</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 변경 이력 */}
      <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={toggleLogs}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: "#111827", margin: 0 }}>등급 변경 이력</h2>
          <span style={{ fontSize: 13, color: "#6b7280" }}>{logsOpen ? "접기 ▲" : "펼치기 ▼"}</span>
        </div>
        {logsOpen && (
          logsLoading ? (
            <LoadingSpinner message="불러오는 중..." />
          ) : logs.length === 0 ? (
            <p style={{ color: "#9ca3af", fontSize: 13, padding: "16px 0" }}>변경 이력이 없습니다.</p>
          ) : (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
              {logs.map((l) => (
                <div key={l.id} style={{ padding: "10px 12px", borderRadius: 10, background: "#f8fafc", fontSize: 12, color: "#374151" }}>
                  <b>{l.user_nickname}</b>: {GRADE_CONFIG[l.from_grade as Grade]?.label || l.from_grade} → {GRADE_CONFIG[l.to_grade as Grade]?.label || l.to_grade}
                  {"  "}· {l.reason}
                  {"  "}· {formatDate(l.created_at)}
                  {l.changed_by_nickname && <span style={{ color: "#9ca3af" }}> (처리: {l.changed_by_nickname})</span>}
                </div>
              ))}
            </div>
          )
        )}
      </section>
    </main>
  );
}
