"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import MentorNickname from "../../../components/MentorNickname";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../../lib/toast";
import { GOLD } from "@/lib/constants";


type FileItem = { name: string; url: string; ext: string };

type Mission = {
  id: string;
  title: string;
  description: string;
  hint_commands: string | null;
  difficulty: "easy" | "normal" | "hard";
  files: FileItem[];
  created_at: string;
  mentor: {
    id: string;
    user_id: string;
    profiles: { nickname: string | null; avatar_url: string | null } | null;
  } | null;
};

type Submission = {
  id: string;
  mission_id: string;
  user_id: string;
  files: FileItem[];
  comment: string | null;
  is_best: boolean;
  point_given: boolean;
  created_at: string;
  profiles: { nickname: string | null; avatar_url: string | null } | null;
};

const DIFF_MAP: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: "초급", color: "#16a34a", bg: "#dcfce7" },
  normal: { label: "중급", color: "#ea580c", bg: "#fff7ed" },
  hard:   { label: "고급", color: "#dc2626", bg: "#fef2f2" },
};

const isImageExt = (ext: string) => ["jpg","jpeg","png","webp","gif"].includes(ext);

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mission, setMission] = useState<Mission | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isMentor, setIsMentor] = useState(false);

  const [submitFiles, setSubmitFiles] = useState<FileItem[]>([]);
  const [comment, setComment] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pickingBest, setPickingBest] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deletingSubmission, setDeletingSubmission] = useState<string | null>(null);

  // 삭제 요청
  const [deleteRequestStatus, setDeleteRequestStatus] = useState<"none" | "pending" | "approved" | "rejected">("none");
  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [submittingDeleteRequest, setSubmittingDeleteRequest] = useState(false);

  const loadData = async () => {
    const { data: missionData } = await supabase
      .from("cad_missions")
      .select("id, title, description, hint_commands, difficulty, files, created_at, mentor:cad_mentors(id, user_id, profiles(nickname, avatar_url))")
      .eq("id", id)
      .single();

    if (!missionData) { router.push("/cad-school"); return; }
    setMission(missionData as unknown as Mission);

    const { data: subData } = await supabase
      .from("cad_mission_submissions")
      .select("id, mission_id, user_id, files, comment, is_best, point_given, created_at, profiles(nickname, avatar_url)")
      .eq("mission_id", id)
      .order("is_best", { ascending: false })
      .order("created_at", { ascending: false });

    setSubmissions((subData ?? []) as unknown as Submission[]);
  };

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      const uid = payload?.sub ?? null;
      setMyUserId(uid);
      if (uid) {
        supabase.from("cad_mentors").select("id").eq("user_id", uid).eq("is_active", true).maybeSingle()
          .then(({ data }) => { if (data) setIsMentor(true); });
      }
    }
    loadData().then(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!myUserId || !id) return;
    const token = getAccessToken();
    if (!token) return;
    fetch(`/api/cad-school/mission/delete-request?mission_id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then(({ request }) => {
        if (request?.status) setDeleteRequestStatus(request.status);
      })
      .catch(() => {});
  }, [myUserId, id]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (submitFiles.length + selected.length > 5) { showError("파일은 최대 5개까지 첨부할 수 있습니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/submissions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setSubmitFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
      else showError(`업로드 실패: ${file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (submitFiles.length === 0) { showError("결과물 파일을 첨부해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSubmitting(true);
    const res = await fetch("/api/cad-school/mission/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mission_id: id, files: submitFiles, comment: comment.trim() || null }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "제출 실패"); }
    else {
      const awarded = d.pointAwarded ?? 0;
      showSuccess(awarded > 0 ? `제출 완료! (+${awarded}P)` : "재제출 완료!");
      setSubmitFiles([]);
      setComment("");
      setIsFormOpen(false);
      loadData();
    }
    setSubmitting(false);
  };

  const handlePickBest = async (submissionId: string) => {
    if (!confirm("이 결과물을 우수 제출물로 채택하시겠습니까? (+200P 지급)")) return;
    const token = getAccessToken();
    if (!token) return;
    setPickingBest(submissionId);
    const res = await fetch("/api/cad-school/mission/best", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ submission_id: submissionId }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "채택 실패");
    else { showSuccess("채택 완료! 해당 수강생에게 +200P가 지급되었습니다."); loadData(); }
    setPickingBest(null);
  };

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!confirm("제출물을 삭제하시겠습니까?")) return;
    const token = getAccessToken();
    if (!token) return;
    setDeletingSubmission(submissionId);
    const res = await fetch("/api/cad-school/mission/submit", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ submission_id: submissionId }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "삭제 실패");
    else { showSuccess("제출물이 삭제되었습니다."); loadData(); }
    setDeletingSubmission(null);
  };

  const handleDeleteRequest = async () => {
    if (!deleteReason.trim()) { showError("삭제 요청 사유를 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSubmittingDeleteRequest(true);
    const res = await fetch("/api/cad-school/mission/delete-request", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ mission_id: id, reason: deleteReason.trim() }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "요청 실패"); }
    else {
      showSuccess("삭제 요청이 접수되었습니다.");
      setDeleteRequestStatus("pending");
      setShowDeleteRequestModal(false);
      setDeleteReason("");
    }
    setSubmittingDeleteRequest(false);
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  if (!mission) return null;

  const diff = DIFF_MAP[mission.difficulty] ?? DIFF_MAP.normal;
  const mentorUserId = (mission.mentor as unknown as { user_id: string } | null)?.user_id;
  const isMentorOfMission = isMentor && mentorUserId === myUserId;
  const mySubmission = submissions.find((s) => s.user_id === myUserId);

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school?tab=mission" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 미션 게시판</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mission.title}</span>
      </div>

      {/* 미션 정보 카드 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px 24px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: diff.color, background: diff.bg, padding: "2px 8px", borderRadius: 6 }}>{diff.label}</span>
          {isMentorOfMission && (
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={() => router.push(`/cad-school/mission/${id}/edit`)}
                style={{ fontSize: 12, fontWeight: 700, color: "#2563eb", background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}
              >
                수정
              </button>
              {deleteRequestStatus === "none" && (
                <button
                  type="button"
                  onClick={() => setShowDeleteRequestModal(true)}
                  style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}
                >
                  삭제 요청
                </button>
              )}
              {deleteRequestStatus === "pending" && (
                <button
                  disabled
                  style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "4px 12px", cursor: "not-allowed" }}
                >
                  삭제 요청 중
                </button>
              )}
              {deleteRequestStatus === "rejected" && (
                <button
                  type="button"
                  onClick={() => setShowDeleteRequestModal(true)}
                  style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "4px 12px", cursor: "pointer" }}
                >
                  삭제 재요청
                </button>
              )}
            </div>
          )}
        </div>
        <h1 style={{ margin: "0 0 16px", fontSize: 22, fontWeight: 900, color: "#111827" }}>{mission.title}</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          {mission.mentor?.profiles?.avatar_url
            ? <img src={mission.mentor.profiles.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
            : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f3f4f6", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
          }
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
            <MentorNickname
              mentorId={mission.mentor?.id ?? ""}
              nickname={mission.mentor?.profiles?.nickname ?? "멘토"}
              isMentor={!!mission.mentor?.id}
            />
          </span>
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{timeAgo(mission.created_at)}</span>
        </div>

        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, marginBottom: mission.hint_commands || mission.files.length > 0 ? 16 : 0 }}>
          <p style={{ margin: 0, fontSize: 15, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap" }}>{mission.description}</p>
        </div>

        {mission.hint_commands && (
          <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "12px 16px", marginBottom: mission.files.length > 0 ? 16 : 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#0369a1", marginBottom: 4 }}>💡 명령어 힌트</div>
            <div style={{ fontSize: 13, color: "#0c4a6e", whiteSpace: "pre-wrap" }}>{mission.hint_commands}</div>
          </div>
        )}

        {mission.files.length > 0 && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>📎 참고 파일</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {mission.files.map((f, i) => (
                isImageExt(f.ext)
                  ? <a key={i} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.name} style={{ height: 72, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "cover" }} /></a>
                  : <a key={i} href={f.url} download={f.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f3f4f6", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#374151", textDecoration: "none" }}>📎 {f.name}</a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 결과물 제출 섹션 */}
      {myUserId && !isMentorOfMission && (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "22px 24px", marginBottom: 20 }}>
          <button
            type="button"
            onClick={() => setIsFormOpen((prev) => !prev)}
            style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>
                {mySubmission ? "제출물 수정하기" : "결과물 제출하기"}
              </span>
              {!mySubmission && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>+50P (최초 1회)</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#6b7280" }}>{isFormOpen ? "▲" : "▼"}</span>
          </button>
          {isFormOpen && (
            <>
              <div style={{ margin: "14px 0", borderTop: "1px solid #f3f4f6" }} />
              {mySubmission
                ? <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>이미 제출한 결과물이 있습니다. 파일을 교체하여 재제출할 수 있습니다. (추가 포인트 없음)</p>
                : <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>결과 파일을 첨부하여 제출하세요.</p>
              }
              <div
                style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: "14px 20px", marginBottom: submitFiles.length > 0 ? 10 : 14, cursor: "pointer", background: "#fafafa", textAlign: "center" }}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const files = Array.from(e.dataTransfer.files);
                  if (files.length > 0) {
                    const dt = new DataTransfer();
                    files.forEach((f) => dt.items.add(f));
                    const input = fileInputRef.current;
                    if (input) {
                      Object.defineProperty(input, "files", { value: dt.files, writable: true });
                      input.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                    handleFileChange({ target: { files: dt.files } } as React.ChangeEvent<HTMLInputElement>);
                  }
                }}
              >
                <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm,.pdf" style={{ display: "none" }} onChange={handleFileChange} />
                <div style={{ fontSize: 13, color: "#6b7280" }}>{uploading ? "업로드 중..." : "클릭하거나 파일을 여기에 놓으세요 (필수)"}</div>
              </div>
              {submitFiles.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {submitFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "4px 8px", fontSize: 11 }}>
                      <span>{isImageExt(f.ext) ? "🖼" : "📎"}</span>
                      <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button onClick={() => setSubmitFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>×</button>
                    </div>
                  ))}
                </div>
              )}
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="코멘트 (선택) — 작업 방식, 어려웠던 점 등"
                rows={3}
                style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", marginBottom: 12 }}
              />
              <button
                onClick={handleSubmit}
                disabled={submitting || uploading}
                style={{ width: "100%", padding: "12px", borderRadius: 12, border: "none", background: submitting || uploading ? "#d1d5db" : "#111827", color: "white", fontWeight: 900, fontSize: 14, cursor: submitting || uploading ? "not-allowed" : "pointer" }}
              >
                {submitting ? "제출 중..." : mySubmission ? "재제출" : "제출하기"}
              </button>
            </>
          )}
        </div>
      )}

      {!myUserId && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px", textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 12 }}>결과물을 제출하려면 로그인이 필요합니다.</div>
          <Link href="/auth" style={{ display: "inline-flex", padding: "10px 24px", borderRadius: 10, background: "#111827", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>로그인</Link>
        </div>
      )}

      {/* 제출물 목록 */}
      <div>
        <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111827", margin: "0 0 14px" }}>제출물 {submissions.length}개</h2>
        {submissions.length === 0 ? (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, padding: "30px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            아직 제출된 결과물이 없습니다.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {submissions.map((sub) => (
              <div
                key={sub.id}
                style={{
                  background: sub.is_best ? "#fffbeb" : "white",
                  border: `1px solid ${sub.is_best ? GOLD + "66" : "#e5e7eb"}`,
                  borderRadius: 16, padding: "18px 20px",
                }}
              >
                {sub.is_best && (
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: GOLD, color: "white", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
                    ⭐ 우수 결과물
                  </div>
                )}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                  {sub.profiles?.avatar_url
                    ? <img src={sub.profiles.avatar_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }} />
                    : <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#f3f4f6", fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>👤</div>
                  }
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{sub.profiles?.nickname ?? "익명"}</span>
                  <span style={{ fontSize: 12, color: "#9ca3af" }}>{timeAgo(sub.created_at)}</span>
                </div>

                {sub.comment && (
                  <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{sub.comment}</p>
                )}

                {sub.files.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: (isMentorOfMission && !sub.is_best) || (sub.user_id === myUserId && !sub.is_best) ? 12 : 0 }}>
                    {sub.files.map((f, i) => (
                      isImageExt(f.ext)
                        ? <a key={i} href={f.url} target="_blank" rel="noreferrer"><img src={f.url} alt={f.name} style={{ height: 72, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "cover" }} /></a>
                        : <a key={i} href={f.url} download={f.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#f3f4f6", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#374151", textDecoration: "none" }}>📎 {f.name}</a>
                    ))}
                  </div>
                )}

                {((isMentorOfMission && !sub.is_best) || (sub.user_id === myUserId && !sub.is_best)) && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {isMentorOfMission && !sub.is_best && (
                      <button
                        onClick={() => handlePickBest(sub.id)}
                        disabled={pickingBest === sub.id}
                        style={{ fontSize: 12, fontWeight: 800, color: GOLD, background: GOLD + "15", border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "5px 12px", cursor: pickingBest === sub.id ? "not-allowed" : "pointer" }}
                      >
                        {pickingBest === sub.id ? "채택 중..." : "⭐ 우수 결과물 채택 (+200P)"}
                      </button>
                    )}
                    {sub.user_id === myUserId && !sub.is_best && (
                      <button
                        onClick={() => handleDeleteSubmission(sub.id)}
                        disabled={deletingSubmission === sub.id}
                        style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: "5px 12px", cursor: deletingSubmission === sub.id ? "not-allowed" : "pointer" }}
                      >
                        {deletingSubmission === sub.id ? "삭제 중..." : "삭제"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* 삭제 요청 모달 */}
      {showDeleteRequestModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteRequestModal(false); }}
        >
          <div style={{ background: "white", borderRadius: 20, padding: "28px", width: "100%", maxWidth: 480 }}>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, fontWeight: 900, color: "#111827" }}>미션 삭제 요청</h3>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: "#6b7280" }}>
              삭제 요청 후 관리자 검토를 거쳐 삭제됩니다.
            </p>
            <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>삭제 요청 사유 *</label>
            <textarea
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="삭제 요청 사유를 입력해주세요"
              rows={4}
              style={{ width: "100%", padding: "10px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => { setShowDeleteRequestModal(false); setDeleteReason(""); }}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteRequest}
                disabled={submittingDeleteRequest}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: submittingDeleteRequest ? "#d1d5db" : "#dc2626", color: "white", fontWeight: 800, fontSize: 14, cursor: submittingDeleteRequest ? "not-allowed" : "pointer" }}
              >
                {submittingDeleteRequest ? "요청 중..." : "삭제 요청"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}
