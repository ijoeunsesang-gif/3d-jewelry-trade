"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../../lib/toast";

type FileItem = { name: string; url: string; ext: string };

type Session = {
  id: string;
  title: string;
  description: string;
  files: FileItem[];
  price: number;
  status: string;
  result_files: FileItem[];
  created_at: string;
  mentor_id: string;
  mentee_id: string;
  mentor: { user_id: string; profiles: { nickname: string | null; avatar_url: string | null } | null } | null;
  mentee_profile: { nickname: string | null; avatar_url: string | null } | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: "대기중",  color: "#92400e", bg: "#fef3c7" },
  accepted:  { label: "진행중",  color: "#1d4ed8", bg: "#dbeafe" },
  completed: { label: "완료",    color: "#166534", bg: "#dcfce7" },
  cancelled: { label: "취소됨",  color: "#6b7280", bg: "#f3f4f6" },
};

export default function SessionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editFileInputRef = useRef<HTMLInputElement>(null);

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [resultFiles, setResultFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [acting, setActing] = useState(false);

  const [editingResult, setEditingResult] = useState(false);
  const [editResultFiles, setEditResultFiles] = useState<FileItem[]>([]);
  const [editUploading, setEditUploading] = useState(false);
  const [savingResult, setSavingResult] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      setMyUserId(payload?.sub ?? null);
    }
    loadSession();
  }, [id]);

  const loadSession = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("cad_mentoring_sessions")
      .select("id, title, description, files, price, status, result_files, created_at, mentor_id, mentee_id, mentor:cad_mentors(user_id, profiles(nickname, avatar_url)), mentee_profile:profiles!cad_mentoring_sessions_mentee_id_fkey(nickname, avatar_url)")
      .eq("id", id)
      .single();

    if (!data) { router.push("/cad-school/my"); return; }
    setSession(data as unknown as Session);
    setResultFiles((data as unknown as Session).result_files ?? []);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/results/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setResultFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
      else showError(`업로드 실패: ${d.error || file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const updateStatus = async (newStatus: string) => {
    setActing(true);
    const { error } = await supabase.from("cad_mentoring_sessions").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", id);
    if (error) showError(error.message);
    else { showSuccess("상태가 업데이트되었습니다."); loadSession(); }
    setActing(false);
  };

  const submitResult = async () => {
    if (resultFiles.length === 0) { showError("결과 파일을 첨부해주세요."); return; }
    setActing(true);
    const { error } = await supabase.from("cad_mentoring_sessions").update({ result_files: resultFiles, status: "completed", updated_at: new Date().toISOString() }).eq("id", id);
    if (error) showError(error.message);
    else { showSuccess("결과물이 제출되었습니다!"); loadSession(); }
    setActing(false);
  };

  const handleEditFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setEditUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/results/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setEditResultFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
      else showError(`업로드 실패: ${d.error || file.name}`);
    }
    setEditUploading(false);
    e.target.value = "";
  };

  const saveResult = async () => {
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSavingResult(true);
    const res = await fetch(`/api/cad-school/session/${id}/result`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ result_files: editResultFiles }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error || "저장 실패");
    else { showSuccess("결과물이 수정되었습니다."); setEditingResult(false); loadSession(); }
    setSavingResult(false);
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  if (!session) return null;

  const isMentor = session.mentor?.user_id === myUserId;
  const isMentee = session.mentee_id === myUserId;
  const statusInfo = STATUS_LABELS[session.status] ?? STATUS_LABELS.pending;

  return (
    <main style={{ maxWidth: 700, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school/my" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 내 활동</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>건별 멘토링</span>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px 28px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div>
            <span style={{ fontSize: 11, fontWeight: 800, color: statusInfo.color, background: statusInfo.bg, padding: "3px 10px", borderRadius: 6, marginBottom: 8, display: "inline-block" }}>{statusInfo.label}</span>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: "#111827" }}>{session.title}</h1>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", whiteSpace: "nowrap" }}>{session.price.toLocaleString("ko-KR")}원</div>
        </div>

        <div style={{ display: "flex", gap: 20, marginBottom: 16 }}>
          <ParticipantInfo label="멘토" nickname={session.mentor?.profiles?.nickname} avatar={session.mentor?.profiles?.avatar_url} />
          <ParticipantInfo label="멘티" nickname={session.mentee_profile?.nickname} avatar={session.mentee_profile?.avatar_url} />
        </div>

        <p style={{ margin: "0 0 16px", fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{session.description}</p>

        {session.files.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 8 }}>첨부 파일</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {session.files.map((f, i) => <FileAttachment key={i} file={f} />)}
            </div>
          </div>
        )}
      </div>

      {/* 결과물 섹션 */}
      {session.result_files.length > 0 && (
        <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "22px 28px", marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 900, color: "#166534" }}>멘토링 결과물</div>
            {isMentor && !editingResult && (
              <button
                onClick={() => { setEditResultFiles([...session.result_files]); setEditingResult(true); }}
                style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
              >
                수정
              </button>
            )}
          </div>

          {editingResult ? (
            <div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {editResultFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "white", border: "1px solid #d1fae5", borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
                    <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                    <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#374151" }}>{f.name}</span>
                    <button
                      onClick={() => setEditResultFiles((p) => p.filter((_, j) => j !== i))}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: "0 0 0 2px", fontSize: 14, lineHeight: 1 }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => editFileInputRef.current?.click()}
                  disabled={editUploading}
                  style={{ fontSize: 12, color: "#166534", background: "#dcfce7", border: "1px solid #bbf7d0", borderRadius: 8, padding: "5px 12px", cursor: editUploading ? "not-allowed" : "pointer", fontWeight: 700 }}
                >
                  {editUploading ? "업로드 중..." : "📎 파일 추가"}
                </button>
                <input
                  ref={editFileInputRef}
                  type="file"
                  multiple
                  accept=".3dm,.stl,.obj"
                  style={{ display: "none" }}
                  onChange={handleEditFileChange}
                />
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button
                  onClick={() => setEditingResult(false)}
                  disabled={savingResult}
                  style={{ fontSize: 13, color: "#6b7280", background: "white", border: "1px solid #d1d5db", borderRadius: 9, padding: "8px 16px", cursor: savingResult ? "not-allowed" : "pointer", fontWeight: 700 }}
                >
                  취소
                </button>
                <button
                  onClick={saveResult}
                  disabled={savingResult || editUploading}
                  style={{ fontSize: 13, fontWeight: 800, color: "white", background: savingResult || editUploading ? "#d1d5db" : "#166534", border: "none", borderRadius: 9, padding: "8px 22px", cursor: savingResult || editUploading ? "not-allowed" : "pointer" }}
                >
                  {savingResult ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {session.result_files.map((f, i) => <FileAttachment key={i} file={f} />)}
            </div>
          )}
        </div>
      )}

      {/* 멘토 액션 */}
      {isMentor && (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "22px 28px", marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 14 }}>멘토 액션</div>
          {session.status === "pending" && (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => updateStatus("accepted")} disabled={acting} style={{ ...actionBtn("#2563eb") }}>수락하기</button>
              <button onClick={() => updateStatus("cancelled")} disabled={acting} style={{ ...actionBtn("#dc2626") }}>거절하기</button>
            </div>
          )}
          {session.status === "accepted" && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>결과물 파일 첨부 후 제출</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                {resultFiles.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
                    <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                    <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button onClick={() => setResultFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>×</button>
                  </div>
                ))}
                <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                  {uploading ? "업로드 중..." : "📎 결과물 첨부"}
                </button>
                <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm" style={{ display: "none" }} onChange={handleFileChange} />
              </div>
              <button onClick={submitResult} disabled={acting || uploading} style={actionBtn("#111827")}>결과물 제출 및 완료</button>
            </div>
          )}
          {session.status === "completed" && (
            <p style={{ fontSize: 13, color: "#16a34a", fontWeight: 700 }}>멘토링이 완료되었습니다.</p>
          )}
        </div>
      )}

      {/* 멘티 액션 */}
      {isMentee && session.status === "pending" && (
        <div style={{ background: "white", border: "1px solid #fecaca", borderRadius: 20, padding: "20px 28px" }}>
          <button onClick={() => updateStatus("cancelled")} disabled={acting} style={actionBtn("#dc2626")}>의뢰 취소</button>
        </div>
      )}
    </main>
  );
}

function ParticipantInfo({ label, nickname, avatar }: { label: string; nickname?: string | null; avatar?: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{label}</span>
      {avatar ? <img src={avatar} alt="" style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#f3f4f6" }} />}
      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{nickname ?? "익명"}</span>
    </div>
  );
}

function FileAttachment({ file }: { file: FileItem }) {
  const isImage = ["jpg","jpeg","png","webp","gif"].includes(file.ext);
  if (isImage) {
    return <a href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt={file.name} style={{ height: 80, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "cover" }} /></a>;
  }
  return (
    <a href={file.url} download={file.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f3f4f6", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#374151", textDecoration: "none" }}>📎 {file.name}</a>
  );
}

const actionBtn = (bg: string): React.CSSProperties => ({
  padding: "11px 24px", borderRadius: 12, border: "none", background: bg, color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
});
