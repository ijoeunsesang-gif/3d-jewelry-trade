"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";
import GradeBadge from "../../components/GradeBadge";
import { Grade } from "@/lib/grades";

const GOLD = "#c9a84c";

type AdminTab = "mentors" | "warnings" | "delete-requests" | "point-configs";

type PointConfig = {
  key: string;
  value: number;
  description: string;
  updated_at: string;
};

type Mentor = {
  id: string;
  user_id: string;
  is_active: boolean;
  is_suspended: boolean;
  suspended_until: string | null;
  warning_count: number;
  avg_rating: number;
  total_ratings: number;
  response_rate: number;
  grade?: string;
  profiles: { nickname: string | null; email: string | null; avatar_url: string | null } | null;
  subscriber_count?: number;
};

type Warning = {
  id: string;
  mentor_id: string;
  reason: string;
  warning_type: string;
  admin_confirmed: boolean;
  created_at: string;
  mentor_name?: string;
};

type DeleteRequest = {
  id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  mission: { id: string; title: string } | null;
  requester: { nickname: string | null; email: string | null } | null;
};

export default function AdminCadSchoolPage() {
  const router = useRouter();
  const [tab, setTab] = useState<AdminTab>("mentors");
  const [loading, setLoading] = useState(true);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [pointConfigs, setPointConfigs] = useState<PointConfig[]>([]);
  const [editingConfig, setEditingConfig] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    if (!payload?.sub) { router.push("/auth"); return; }
    checkAdmin(payload.sub);
  }, []);

  const checkAdmin = async (uid: string) => {
    const { data } = await supabase.from("profiles").select("role").eq("id", uid).single();
    if (data?.role !== "admin") { router.push("/"); return; }
    loadAll();
  };

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadMentors(), loadWarnings(), loadDeleteRequests(), loadPointConfigs()]);
    setLoading(false);
  };

  const loadPointConfigs = async () => {
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch("/api/admin/cad-school/point-configs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const d = await res.json();
    const configs: PointConfig[] = d.configs ?? [];
    setPointConfigs(configs);
    setEditingConfig(Object.fromEntries(configs.map((c) => [c.key, String(c.value)])));
  };

  const savePointConfig = async (key: string) => {
    const token = getAccessToken();
    if (!token) return;
    const value = parseInt(editingConfig[key] ?? "0", 10);
    if (isNaN(value) || value < 0) { showError("올바른 포인트 값을 입력해주세요."); return; }
    setSavingConfig(key);
    const res = await fetch("/api/admin/cad-school/point-configs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ key, value }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "저장 실패");
    else { showSuccess("저장되었습니다."); await loadPointConfigs(); }
    setSavingConfig(null);
  };

  const loadMentors = async () => {
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, user_id, is_active, is_suspended, suspended_until, warning_count, avg_rating, total_ratings, response_rate, grade, profiles(nickname, email, avatar_url)")
      .order("created_at", { ascending: false });

    if (!data) return;
    const mentorsWithCount = await Promise.all(
      (data as unknown as Mentor[]).map(async (m) => {
        const { count } = await supabase
          .from("cad_subscriptions")
          .select("*", { count: "exact", head: true })
          .eq("mentor_id", m.id)
          .eq("status", "active");
        return { ...m, subscriber_count: count ?? 0 };
      })
    );
    setMentors(mentorsWithCount);
  };

  const loadWarnings = async () => {
    const { data } = await supabase
      .from("cad_mentor_warnings")
      .select("id, mentor_id, reason, warning_type, admin_confirmed, created_at, mentor:cad_mentors(profiles(nickname))")
      .order("created_at", { ascending: false });

    if (!data) return;
    setWarnings(
      (data as unknown as (Warning & { mentor: { profiles: { nickname: string | null } | null } | null })[]).map((w) => ({
        ...w,
        mentor_name: w.mentor?.profiles?.nickname ?? "멘토",
      }))
    );
  };

  const loadDeleteRequests = async () => {
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch("/api/admin/cad-school/mission-delete-requests", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const d = await res.json();
    setDeleteRequests(d.requests ?? []);
  };

  const handleDeleteRequestAction = async (requestId: string, action: "approve" | "reject") => {
    const token = getAccessToken();
    if (!token) return;
    const confirmMsg = action === "approve" ? "삭제를 승인하시겠습니까? 미션이 즉시 삭제됩니다." : "요청을 거절하시겠습니까?";
    if (!confirm(confirmMsg)) return;
    setActing(requestId);
    const res = await fetch("/api/admin/cad-school/mission-delete-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ request_id: requestId, action }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "오류 발생");
    else { showSuccess("처리 완료"); loadAll(); }
    setActing(null);
  };

  const doAction = async (mentorId: string, action: string, warningId?: string) => {
    const token = getAccessToken();
    if (!token) return;
    const confirmMsg: Record<string, string> = {
      suspend: "이 멘토를 1개월 정지하시겠습니까?",
      unsuspend: "정지를 해제하시겠습니까?",
      revoke: "멘토 자격을 영구 박탈하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
      "cancel-warning": "이 경고를 취소하시겠습니까?",
    };
    if (!confirm(confirmMsg[action] ?? "진행하시겠습니까?")) return;

    setActing(warningId ?? mentorId);
    const res = await fetch("/api/admin/cad-school/mentor/action", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mentor_id: mentorId, action, warning_id: warningId }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "오류 발생");
    else { showSuccess("처리 완료"); loadAll(); }
    setActing(null);
  };

  const filteredMentors = mentors.filter((m) => {
    const name = m.profiles?.nickname ?? "";
    const email = m.profiles?.email ?? "";
    return name.toLowerCase().includes(search.toLowerCase()) || email.toLowerCase().includes(search.toLowerCase());
  });

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;

  return (
    <main style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/admin" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 관리자</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>캐드스쿨 관리</span>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "white", borderRadius: 14, padding: 5, border: "1px solid #e5e7eb", width: "fit-content" }}>
        {([["mentors", "멘토 목록"], ["warnings", "경고 내역"], ["delete-requests", "삭제 요청"], ["point-configs", "포인트 설정"]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: "9px 20px", borderRadius: 10, border: "none",
            background: tab === key ? "#111827" : "transparent",
            color: tab === key ? "white" : "#6b7280",
            fontWeight: 800, fontSize: 13, cursor: "pointer",
          }}>{label}</button>
        ))}
      </div>

      {tab === "mentors" && (
        <div>
          <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="닉네임 또는 이메일 검색..."
              style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "9px 14px", fontSize: 13, outline: "none", width: 260 }}
            />
            <span style={{ fontSize: 13, color: "#6b7280" }}>총 {filteredMentors.length}명</span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "2px solid #e5e7eb" }}>
                  {["닉네임", "등급", "수강생", "평점", "답변률", "경고", "상태", "액션"].map((h) => (
                    <th key={h} style={{ padding: "12px 14px", textAlign: "left", fontWeight: 700, color: "#374151", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredMentors.map((m) => (
                  <tr key={m.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {m.profiles?.avatar_url
                          ? <img src={m.profiles.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                          : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#f3f4f6" }} />}
                        <div>
                          <div style={{ fontWeight: 700, color: "#111827" }}>{m.profiles?.nickname ?? "—"}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{m.profiles?.email ?? "—"}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "12px 14px" }}>{m.grade ? <GradeBadge grade={m.grade as Grade} /> : "—"}</td>
                    <td style={{ padding: "12px 14px", fontWeight: 700 }}>{m.subscriber_count ?? 0}명</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ color: GOLD }}>★</span> {m.avg_rating.toFixed(1)}
                      <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>({m.total_ratings})</span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>{m.response_rate?.toFixed(0) ?? 0}%</td>
                    <td style={{ padding: "12px 14px" }}>
                      <span style={{ fontWeight: 800, color: m.warning_count >= 3 ? "#dc2626" : m.warning_count >= 1 ? "#d97706" : "#6b7280" }}>
                        {m.warning_count}회
                      </span>
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      {!m.is_active
                        ? <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "2px 8px", borderRadius: 5 }}>자격박탈</span>
                        : m.is_suspended
                          ? <span style={{ fontSize: 11, fontWeight: 800, color: "#d97706", background: "#fef3c7", padding: "2px 8px", borderRadius: 5 }}>정지중</span>
                          : <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 5 }}>활동중</span>}
                    </td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {m.is_active && !m.is_suspended && (
                          <ActionBtn label="정지" color="#d97706" disabled={acting === m.id} onClick={() => doAction(m.id, "suspend")} />
                        )}
                        {m.is_active && m.is_suspended && (
                          <ActionBtn label="정지해제" color="#2563eb" disabled={acting === m.id} onClick={() => doAction(m.id, "unsuspend")} />
                        )}
                        {m.is_active && (
                          <ActionBtn label="자격박탈" color="#dc2626" disabled={acting === m.id} onClick={() => doAction(m.id, "revoke")} />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMentors.length === 0 && (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af" }}>멘토가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "warnings" && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>총 {warnings.length}건</div>
          <div style={{ display: "grid", gap: 10 }}>
            {warnings.length === 0 && (
              <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "40px 20px", textAlign: "center", color: "#9ca3af" }}>
                경고 내역이 없습니다.
              </div>
            )}
            {warnings.map((w) => (
              <div key={w.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>{w.mentor_name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#d97706", background: "#fef3c7", padding: "1px 7px", borderRadius: 4 }}>
                      {w.warning_type === "late_response" ? "답변지연" : w.warning_type}
                    </span>
                    {w.admin_confirmed && <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "1px 7px", borderRadius: 4 }}>관리자 확인</span>}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>{w.reason}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>{new Date(w.created_at).toLocaleString("ko-KR")}</div>
                </div>
                <ActionBtn
                  label="경고 취소"
                  color="#6b7280"
                  disabled={acting === w.id}
                  onClick={() => doAction(w.mentor_id, "cancel-warning", w.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
      {tab === "delete-requests" && (
        <div>
          <div style={{ marginBottom: 16, fontSize: 13, color: "#6b7280" }}>
            총 {deleteRequests.length}건
            <span style={{ marginLeft: 12, color: "#d97706", fontWeight: 700 }}>
              대기 {deleteRequests.filter((r) => r.status === "pending").length}건
            </span>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {deleteRequests.length === 0 && (
              <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "40px 20px", textAlign: "center", color: "#9ca3af" }}>
                삭제 요청이 없습니다.
              </div>
            )}
            {deleteRequests.map((r) => (
              <div key={r.id} style={{ background: "white", border: `1px solid ${r.status === "pending" ? "#fde68a" : "#e5e7eb"}`, borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 800, fontSize: 14, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }}>
                        {r.mission?.title ?? "(삭제된 미션)"}
                      </span>
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: "1px 7px", borderRadius: 4,
                        color: r.status === "pending" ? "#d97706" : r.status === "approved" ? "#16a34a" : "#dc2626",
                        background: r.status === "pending" ? "#fef3c7" : r.status === "approved" ? "#dcfce7" : "#fee2e2",
                      }}>
                        {r.status === "pending" ? "대기중" : r.status === "approved" ? "승인됨" : "거절됨"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>
                      요청자: <strong>{r.requester?.nickname ?? "—"}</strong>
                      {r.requester?.email && <span style={{ marginLeft: 6 }}>({r.requester.email})</span>}
                    </div>
                    <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>사유: {r.reason}</div>
                    {r.admin_note && <div style={{ fontSize: 12, color: "#6b7280" }}>관리자 메모: {r.admin_note}</div>}
                    <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{new Date(r.created_at).toLocaleString("ko-KR")}</div>
                  </div>
                  {r.status === "pending" && (
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      <ActionBtn label="삭제 승인" color="#dc2626" disabled={acting === r.id} onClick={() => handleDeleteRequestAction(r.id, "approve")} />
                      <ActionBtn label="요청 거절" color="#6b7280" disabled={acting === r.id} onClick={() => handleDeleteRequestAction(r.id, "reject")} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "point-configs" && (
        <div>
          <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", marginBottom: 16 }}>포인트 지급 설정</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>
            멘토 활동에 따른 자동 포인트 지급량을 설정합니다. 0으로 설정하면 포인트가 지급되지 않습니다.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 500 }}>
            {pointConfigs.map((config) => (
              <div key={config.key} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 20px" }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{config.description || config.key}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 10 }}>
                  키: {config.key} · 마지막 수정: {new Date(config.updated_at).toLocaleString("ko-KR")}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input
                    type="number"
                    min="0"
                    value={editingConfig[config.key] ?? String(config.value)}
                    onChange={(e) => setEditingConfig((prev) => ({ ...prev, [config.key]: e.target.value }))}
                    style={{ width: 120, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 14, fontWeight: 700, outline: "none" }}
                  />
                  <span style={{ fontSize: 13, color: "#6b7280" }}>P</span>
                  <button
                    onClick={() => savePointConfig(config.key)}
                    disabled={savingConfig === config.key}
                    style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: savingConfig === config.key ? "#d1d5db" : "#111827", color: "white", fontWeight: 700, fontSize: 13, cursor: savingConfig === config.key ? "not-allowed" : "pointer" }}
                  >
                    {savingConfig === config.key ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            ))}
            {pointConfigs.length === 0 && (
              <div style={{ padding: "30px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>설정 항목이 없습니다. 마이그레이션을 먼저 실행해주세요.</div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function ActionBtn({ label, color, disabled, onClick }: { label: string; color: string; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ fontSize: 11, fontWeight: 800, color: "white", background: color, border: "none", borderRadius: 7, padding: "5px 12px", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.6 : 1 }}>
      {label}
    </button>
  );
}
