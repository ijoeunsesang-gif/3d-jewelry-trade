"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess, showInfo } from "../../../lib/toast";
import GradeBadge from "../../../components/GradeBadge";
import { Grade } from "@/lib/grades";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";

type FileItem = { name: string; url: string; ext: string };
type MsgType = "question" | "answer" | "checklist" | "review";

const PLAN_LABELS: Record<string, string> = { basic: "BASIC", pro: "PRO", master: "MASTER" };
const PLAN_LIMITS: Record<string, { stl: number; checklist: number; review: number; mentorChanges: number; hours: number }> = {
  basic:  { stl: 3,    checklist: 2,  review: 2,  mentorChanges: 1, hours: 48 },
  pro:    { stl: 10,   checklist: 5,  review: 5,  mentorChanges: 2, hours: 36 },
  master: { stl: 9999, checklist: 10, review: 10, mentorChanges: 3, hours: 24 },
};

type Subscription = {
  id: string;
  subscriber_id: string;
  mentor_id: string;
  plan_type: string;
  status: string;
  mentor_change_count: number;
  checklist_count: number;
  review_count: number;
  stl_upload_count: number;
  expires_at: string;
  mentor: {
    id: string;
    user_id: string;
    avg_rating: number;
    total_ratings: number;
    is_suspended: boolean;
    grade?: string;
    profiles: { nickname: string | null; avatar_url: string | null } | null;
  } | null;
  subscriber_profile: { nickname: string | null; avatar_url: string | null } | null;
};

type ChatMessage = {
  id: string;
  subscription_id: string;
  sender_id: string;
  content: string;
  files: FileItem[];
  message_type: MsgType;
  is_answered: boolean;
  answered_at: string | null;
  created_at: string;
};

type AvailableMentor = {
  id: string;
  user_id: string;
  avg_rating: number;
  total_ratings: number;
  is_suspended: boolean;
  grade?: string;
  profiles: { nickname: string | null; avatar_url: string | null } | null;
};

const MSG_TYPE_LABELS: Record<MsgType, { label: string; color: string; bg: string }> = {
  question:  { label: "질문",   color: "#1d4ed8", bg: "#dbeafe" },
  answer:    { label: "답변",   color: "#166534", bg: "#dcfce7" },
  checklist: { label: "첨삭",   color: "#7c3aed", bg: "#ede9fe" },
  review:    { label: "검수",   color: "#b45309", bg: "#fef3c7" },
};

export default function SubscriptionChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [sub, setSub] = useState<Subscription | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [msgType, setMsgType] = useState<"question" | "checklist" | "review">("question");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  const [showChangeMentor, setShowChangeMentor] = useState(false);
  const [availableMentors, setAvailableMentors] = useState<AvailableMentor[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [changingMentor, setChangingMentor] = useState(false);

  const [showRate, setShowRate] = useState(false);
  const [rateValue, setRateValue] = useState(5);
  const [rateComment, setRateComment] = useState("");
  const [rating, setRating] = useState(false);

  const [reporting, setReporting] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const { data: subData } = await supabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, mentor_id, plan_type, status, mentor_change_count, checklist_count, review_count, stl_upload_count, expires_at, mentor:cad_mentors(id, user_id, avg_rating, total_ratings, is_suspended, grade, profiles(nickname, avatar_url)), subscriber_profile:profiles!cad_subscriptions_subscriber_id_fkey(nickname, avatar_url)")
      .eq("id", id)
      .single();

    if (!subData) { router.push("/cad-school/my"); return; }
    setSub(subData as unknown as Subscription);

    const { data: msgData } = await supabase
      .from("cad_subscription_chats")
      .select("id, subscription_id, sender_id, content, files, message_type, is_answered, answered_at, created_at")
      .eq("subscription_id", id)
      .order("created_at", { ascending: true });

    setMessages((msgData ?? []) as ChatMessage[]);
  }, [id, router]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const uid = payload?.sub ?? null;
    if (!uid) { router.push("/auth"); return; }
    setMyUserId(uid);
    loadData().then(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`sub-chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cad_subscription_chats", filter: `subscription_id=eq.${id}` }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cad_subscription_chats", filter: `subscription_id=eq.${id}` }, () => {
        loadData();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadData]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/chats/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
      else showError(`업로드 실패: ${file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSend = async () => {
    if (!content.trim() && files.length === 0) return;
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSending(true);
    const res = await fetch("/api/cad-school/subscribe/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription_id: id, content: content.trim() || " ", files, message_type: msgType }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "전송 실패"); }
    else { setContent(""); setFiles([]); loadData(); }
    setSending(false);
  };

  const handleMarkAnswered = async (msgId: string) => {
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch("/api/cad-school/subscribe/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message_id: msgId }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "오류 발생");
    else { showSuccess("답변 완료 처리되었습니다."); loadData(); }
  };

  const handleReport = async (msgId: string) => {
    const token = getAccessToken();
    if (!token) return;
    setReporting(msgId);
    const res = await fetch("/api/cad-school/mentor/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription_id: id, message_id: msgId }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "신고 실패");
    else {
      if (d.suspended) showInfo("경고 3회 누적으로 멘토가 활동 정지되었습니다. 멘토를 교체할 수 있습니다.");
      else showSuccess(`신고 완료. 현재 경고 ${d.warning_count}회입니다.`);
      loadData();
    }
    setReporting(null);
  };

  const openChangeMentor = async () => {
    setShowChangeMentor(true);
    setLoadingMentors(true);
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, user_id, avg_rating, total_ratings, is_suspended, grade, profiles(nickname, avatar_url)")
      .eq("is_active", true)
      .eq("is_suspended", false)
      .neq("id", sub?.mentor_id ?? "");
    setAvailableMentors((data ?? []) as unknown as AvailableMentor[]);
    setLoadingMentors(false);
  };

  const handleChangeMentor = async (newMentorId: string) => {
    const token = getAccessToken();
    if (!token) return;
    setChangingMentor(true);
    const res = await fetch("/api/cad-school/subscribe/change-mentor", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription_id: id, new_mentor_id: newMentorId }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "멘토 교체 실패");
    else { showSuccess("멘토가 교체되었습니다."); setShowChangeMentor(false); loadData(); }
    setChangingMentor(false);
  };

  const handleRate = async () => {
    const token = getAccessToken();
    if (!token) return;
    setRating(true);
    const res = await fetch("/api/cad-school/mentor/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription_id: id, rating: rateValue, comment: rateComment }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "평가 실패");
    else { showSuccess("평가가 등록되었습니다."); setShowRate(false); setRateComment(""); setRateValue(5); loadData(); }
    setRating(false);
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  if (!sub) return null;

  const mentor = sub.mentor;
  const mentorName = mentor?.profiles?.nickname ?? "멘토";
  const isMentor = mentor?.user_id === myUserId;
  const isSubscriber = sub.subscriber_id === myUserId;
  const limits = PLAN_LIMITS[sub.plan_type] ?? PLAN_LIMITS.basic;
  const isActive = sub.status === "active";
  const currentMentorSuspended = mentor?.is_suspended ?? false;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px 120px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <Link href="/cad-school/my" style={{ color: "#6b7280", textDecoration: "none", fontSize: 13 }}>← 내 활동</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 13, color: "#111827", fontWeight: 700 }}>구독 채팅방</span>
      </div>

      {/* 상단 정보 카드 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "20px 24px", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {mentor?.profiles?.avatar_url
              ? <img src={mentor.profiles.avatar_url} alt="" style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }} />
              : <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>👤</div>}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{mentorName}</span>
                {mentor?.grade && <GradeBadge grade={mentor.grade as Grade} />}
                {currentMentorSuspended && <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "2px 7px", borderRadius: 5 }}>활동정지</span>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: "#6b7280" }}>
                {mentor && <span>★ {mentor.avg_rating.toFixed(1)} ({mentor.total_ratings})</span>}
                <span style={{ fontWeight: 700, color: GOLD, background: GOLD_LIGHT, padding: "2px 8px", borderRadius: 5 }}>{PLAN_LABELS[sub.plan_type] ?? sub.plan_type}</span>
                <span>만료 {new Date(sub.expires_at).toLocaleDateString("ko-KR")}</span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {isSubscriber && isActive && (
              <>
                <button onClick={openChangeMentor} style={{ ...smallBtn("#374151") }}>멘토 교체</button>
                <button onClick={() => setShowRate(true)} style={{ ...smallBtn(GOLD) }}>평가하기</button>
              </>
            )}
          </div>
        </div>

        {/* 쿼터 진행 바 */}
        {isSubscriber && (
          <div style={{ marginTop: 16, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            <QuotaBar label="첨삭" used={sub.checklist_count} total={limits.checklist} color="#7c3aed" />
            <QuotaBar label="검수" used={sub.review_count} total={limits.review} color="#b45309" />
            {limits.stl < 9999
              ? <QuotaBar label="STL" used={sub.stl_upload_count} total={limits.stl} color="#0369a1" />
              : <div style={{ background: "#f3f4f6", borderRadius: 10, padding: "8px 10px", fontSize: 11 }}><div style={{ fontWeight: 700, color: "#374151", marginBottom: 4 }}>STL</div><div style={{ color: "#16a34a", fontWeight: 700 }}>무제한</div></div>}
          </div>
        )}
        {isMentor && (
          <div style={{ marginTop: 12, fontSize: 12, color: "#6b7280" }}>
            구독자: <strong>{sub.subscriber_profile?.nickname ?? "구독자"}</strong> · 플랜: <strong>{PLAN_LABELS[sub.plan_type]}</strong> · 답변 제한: <strong>{limits.hours}시간</strong>
          </div>
        )}
      </div>

      {/* 메시지 목록 */}
      <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
        {messages.length === 0 && (
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            아직 메시지가 없습니다. 멘토에게 첫 메시지를 보내보세요!
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === myUserId;
          const typeInfo = MSG_TYPE_LABELS[msg.message_type] ?? MSG_TYPE_LABELS.question;
          const elapsedHours = (Date.now() - new Date(msg.created_at).getTime()) / (1000 * 60 * 60);
          const isOverdue = !msg.is_answered && elapsedHours >= limits.hours && msg.message_type !== "answer";
          const canReport = isSubscriber && !isMine && isOverdue && isActive;
          const canMarkAnswered = isMentor && !msg.is_answered && msg.message_type !== "answer" && isActive;

          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: isMine ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
              <div style={{ maxWidth: "75%", minWidth: 60 }}>
                {/* Type badge */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: typeInfo.color, background: typeInfo.bg, padding: "1px 6px", borderRadius: 4 }}>{typeInfo.label}</span>
                  {msg.is_answered && <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "1px 6px", borderRadius: 4 }}>✓ 답변완료</span>}
                  {isOverdue && <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "1px 6px", borderRadius: 4 }}>⏰ 시간초과</span>}
                </div>

                {/* Bubble */}
                <div style={{
                  background: isMine ? "#111827" : "white",
                  color: isMine ? "white" : "#111827",
                  border: isMine ? "none" : "1px solid #e5e7eb",
                  borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "12px 16px",
                  fontSize: 14, lineHeight: 1.6, whiteSpace: "pre-wrap",
                }}>
                  {msg.content.trim()}
                  {msg.files && msg.files.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {msg.files.map((f, i) => <FileAttachment key={i} file={f} dark={isMine} />)}
                    </div>
                  )}
                </div>

                {/* Time + actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(msg.created_at)}</span>
                  {canMarkAnswered && (
                    <button onClick={() => handleMarkAnswered(msg.id)} style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", border: "none", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                      답변 완료
                    </button>
                  )}
                  {canReport && (
                    <button onClick={() => handleReport(msg.id)} disabled={reporting === msg.id} style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fee2e2", border: "none", borderRadius: 5, padding: "2px 8px", cursor: "pointer" }}>
                      {reporting === msg.id ? "신고 중..." : "신고하기"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      {isActive && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "white", borderTop: "1px solid #e5e7eb", padding: "12px 16px", zIndex: 50 }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>
            {/* 타입 선택 (구독자만) */}
            {isSubscriber && (
              <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                {(["question", "checklist", "review"] as const).map((t) => (
                  <button key={t} onClick={() => setMsgType(t)} style={{
                    fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                    background: msgType === t ? "#111827" : "#f3f4f6",
                    color: msgType === t ? "white" : "#6b7280",
                  }}>
                    {t === "question" ? "질문" : t === "checklist" ? "첨삭" : "검수"}
                  </button>
                ))}
              </div>
            )}

            {/* 첨부 파일 미리보기 */}
            {files.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                {files.map((f, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "4px 8px", fontSize: 11 }}>
                    <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : f.ext === "stl" ? "📐" : "📎"}</span>
                    <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>×</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={isMentor ? "답변을 입력하세요... (Shift+Enter 줄바꿈)" : "메시지를 입력하세요... (Shift+Enter 줄바꿈)"}
                rows={2}
                style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit" }}
              />
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} style={{ ...iconBtn }}>
                {uploading ? "⏳" : "📎"}
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm,.pdf" style={{ display: "none" }} onChange={handleFileChange} />
              <button onClick={handleSend} disabled={sending || uploading} style={{ ...sendBtn }}>
                {sending ? "..." : "전송"}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isActive && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", textAlign: "center", color: "#6b7280", fontSize: 13, fontWeight: 700 }}>
          구독이 종료되었습니다.
        </div>
      )}

      {/* 멘토 교체 모달 */}
      {showChangeMentor && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>멘토 교체</div>
              <button onClick={() => setShowChangeMentor(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            {currentMentorSuspended && (
              <div style={{ background: "#fee2e2", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#dc2626", fontWeight: 700, marginBottom: 14 }}>
                현재 멘토가 활동 정지 상태입니다. 교체 횟수 차감 없이 교체 가능합니다.
              </div>
            )}
            {!currentMentorSuspended && (
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 14 }}>
                남은 교체 횟수: {Math.max(0, limits.mentorChanges - sub.mentor_change_count)}/{limits.mentorChanges}회
              </div>
            )}
            {loadingMentors ? (
              <div style={{ textAlign: "center", padding: "24px 0", color: "#6b7280" }}>불러오는 중...</div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {availableMentors.length === 0 && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13 }}>선택 가능한 멘토가 없습니다.</div>}
                {availableMentors.map((m) => (
                  <div key={m.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {m.profiles?.avatar_url
                        ? <img src={m.profiles.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f3f4f6" }} />}
                      <div>
                        <div style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>{m.profiles?.nickname ?? "멘토"}</div>
                        <div style={{ fontSize: 12, color: "#6b7280" }}>★ {m.avg_rating.toFixed(1)} ({m.total_ratings})</div>
                      </div>
                    </div>
                    <button onClick={() => handleChangeMentor(m.id)} disabled={changingMentor} style={{ fontSize: 13, fontWeight: 800, color: "white", background: "#111827", border: "none", borderRadius: 10, padding: "8px 16px", cursor: "pointer" }}>
                      선택
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 평가 모달 */}
      {showRate && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 400 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>멘토 평가</div>
              <button onClick={() => setShowRate(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>월 1회 평가 가능합니다.</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} onClick={() => setRateValue(v)} style={{ fontSize: 28, background: "none", border: "none", cursor: "pointer", opacity: v <= rateValue ? 1 : 0.3 }}>★</button>
              ))}
            </div>
            <textarea
              value={rateComment}
              onChange={(e) => setRateComment(e.target.value)}
              placeholder="리뷰를 남겨주세요 (선택)"
              rows={3}
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", fontSize: 13, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 16 }}
            />
            <button onClick={handleRate} disabled={rating} style={{ width: "100%", padding: "13px 0", borderRadius: 14, border: "none", background: GOLD, color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
              {rating ? "등록 중..." : "평가 등록"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function QuotaBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "8px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color: used >= total ? "#dc2626" : "#374151" }}>{used}/{total}</span>
      </div>
      <div style={{ background: "#e5e7eb", borderRadius: 99, height: 5 }}>
        <div style={{ height: "100%", background: pct >= 100 ? "#dc2626" : color, width: `${pct}%`, borderRadius: 99, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function FileAttachment({ file, dark }: { file: FileItem; dark?: boolean }) {
  const isImage = ["jpg","jpeg","png","webp","gif"].includes(file.ext);
  if (isImage) {
    return <a href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt={file.name} style={{ height: 70, borderRadius: 8, objectFit: "cover" }} /></a>;
  }
  const icon = file.ext === "stl" || file.ext === "obj" || file.ext === "3dm" ? "📐" : "📎";
  return (
    <a href={file.url} download={file.name} style={{ display: "inline-flex", alignItems: "center", gap: 5, background: dark ? "rgba(255,255,255,0.15)" : "#f3f4f6", borderRadius: 8, padding: "5px 10px", fontSize: 11, color: dark ? "white" : "#374151", textDecoration: "none" }}>
      {icon} {file.name}
    </a>
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

const smallBtn = (bg: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 800, padding: "7px 14px", borderRadius: 9, border: "none", background: bg, color: "white", cursor: "pointer",
});

const iconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const sendBtn: React.CSSProperties = {
  padding: "0 20px", height: 40, borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
};
