"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess, showInfo } from "../../../lib/toast";
import { GOLD } from "@/lib/constants";
import Image from "next/image";

const GOLD_LIGHT = "#fdf6e3";
const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg", "avif"];

type FileItem = { name: string; url: string; ext: string };
type MsgType = "question" | "answer" | "checklist" | "review" | "post_review_cad";
type RequestType = "checklist" | "review" | "post_review_cad";

const PLAN_LABELS: Record<string, string> = { basic: "BASIC", pro: "PRO", master: "MASTER" };
const PLAN_LIMITS: Record<string, { checklist: number; review: number; post_review_cad: number; mentorChanges: number; hours: number }> = {
  basic:  { checklist: 1, review: 1, post_review_cad: 1, mentorChanges: 1, hours: 48 },
  pro:    { checklist: 2, review: 2, post_review_cad: 2, mentorChanges: 2, hours: 36 },
  master: { checklist: 3, review: 3, post_review_cad: 3, mentorChanges: 3, hours: 24 },
};

const REQUEST_TYPES: RequestType[] = ["checklist", "review", "post_review_cad"];

const REQUEST_MODAL_INFO: Record<RequestType, { label: string; color: string }> = {
  checklist:       { label: "CAD수정 요청",     color: "#7c3aed" },
  review:          { label: "검수 요청",        color: "#b45309" },
  post_review_cad: { label: "검수+CAD수정 요청", color: "#0891b2" },
};

const REQUEST_BTN_COLORS: Record<RequestType, { bg: string; bgHover: string; text: string; border: string }> = {
  checklist:       { bg: "#dbeafe", bgHover: "#bfdbfe", text: "#1d4ed8", border: "#93c5fd" },
  review:          { bg: "#ffedd5", bgHover: "#fed7aa", text: "#c2410c", border: "#fdba74" },
  post_review_cad: { bg: "#ede9fe", bgHover: "#ddd6fe", text: "#7c3aed", border: "#c4b5fd" },
};

const MSG_TYPE_LABELS: Record<MsgType, { label: string; color: string; bg: string }> = {
  question:        { label: "질문",         color: "#1d4ed8", bg: "#dbeafe" },
  answer:          { label: "답변",         color: "#166534", bg: "#dcfce7" },
  checklist:       { label: "CAD수정",      color: "#7c3aed", bg: "#ede9fe" },
  review:          { label: "검수",         color: "#b45309", bg: "#fef3c7" },
  post_review_cad: { label: "검수+CAD수정", color: "#0891b2", bg: "#cffafe" },
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
  post_review_cad_count: number;
  expires_at: string;
  mentor: {
    id: string;
    user_id: string;
    avg_rating: number;
    total_ratings: number;
    is_suspended: boolean;
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
  profiles: { nickname: string | null; avatar_url: string | null } | null;
};

export default function SubscriptionChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modalFileInputRef = useRef<HTMLInputElement>(null);
  const mentorReplyFileRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);

  const [sub, setSub] = useState<Subscription | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // 자유 채팅
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);

  // 요청 팝업 모달
  const [activeModal, setActiveModal] = useState<RequestType | null>(null);
  const [modalContent, setModalContent] = useState("");
  const [modalFiles, setModalFiles] = useState<FileItem[]>([]);
  const [modalUploading, setModalUploading] = useState(false);
  const [modalSending, setModalSending] = useState(false);
  const [showModalConfirm, setShowModalConfirm] = useState(false);

  // 멘토 답변
  const [mentorReply, setMentorReply] = useState("");
  const [mentorReplyFiles, setMentorReplyFiles] = useState<FileItem[]>([]);
  const [mentorReplyUploading, setMentorReplyUploading] = useState(false);
  const [mentorReplying, setMentorReplying] = useState(false);

  // 횟수 초과 모달
  const [showAddonModal, setShowAddonModal] = useState(false);
  const [addonBlockedType, setAddonBlockedType] = useState<RequestType | null>(null);

  // 멘토 교체
  const [showChangeMentor, setShowChangeMentor] = useState(false);
  const [availableMentors, setAvailableMentors] = useState<AvailableMentor[]>([]);
  const [loadingMentors, setLoadingMentors] = useState(false);
  const [changingMentor, setChangingMentor] = useState(false);

  // 평가
  const [showRate, setShowRate] = useState(false);
  const [rateValue, setRateValue] = useState(5);
  const [rateComment, setRateComment] = useState("");
  const [rating, setRating] = useState(false);

  const [reporting, setReporting] = useState<string | null>(null);
  const [hoveredReqBtn, setHoveredReqBtn] = useState<RequestType | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    const { data: subData } = await supabase
      .from("cad_subscriptions")
      .select("id, subscriber_id, mentor_id, plan_type, status, mentor_change_count, checklist_count, review_count, post_review_cad_count, expires_at, mentor:cad_mentors(id, user_id, avg_rating, total_ratings, is_suspended, profiles(nickname, avatar_url)), subscriber_profile:profiles!cad_subscriptions_subscriber_id_fkey(nickname, avatar_url)")
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
    loadData().then(() => {
      setLoading(false);
      window.scrollTo(0, 0);
    });
  }, [id]);

  useEffect(() => {
    const el = chatContainerRef.current;
    if (!el) return;
    if (!initialScrollDone.current) {
      el.scrollTop = el.scrollHeight;
      initialScrollDone.current = true;
    } else {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    const channel = supabase
      .channel(`sub-chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "cad_subscription_chats", filter: `subscription_id=eq.${id}` }, () => { loadData(); })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "cad_subscription_chats", filter: `subscription_id=eq.${id}` }, () => { loadData(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, loadData]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    const validFiles: File[] = [];
    for (const file of droppedFiles) {
      if (!file.type.startsWith("image/")) { showError("이미지 파일만 첨부 가능합니다."); }
      else { validFiles.push(file); }
    }
    if (validFiles.length === 0) return;
    setUploading(true);
    for (const file of validFiles) {
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
  };

  // 자유 채팅 파일 (이미지만)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    const validFiles: File[] = [];
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!IMAGE_EXTS.includes(ext)) { showError("자유 채팅에서는 이미지 파일만 첨부 가능합니다."); }
      else { validFiles.push(file); }
    }
    e.target.value = "";
    if (validFiles.length === 0) return;
    setUploading(true);
    for (const file of validFiles) {
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
  };

  // 요청 모달 파일 (타입별)
  const handleModalFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: RequestType) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    const allowed = type === "review" ? ["3dm", "stl", "obj"] : ["3dm"];
    const validFiles: File[] = [];
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      if (!allowed.includes(ext)) {
        showError(type === "review" ? ".3dm, .stl, .obj 파일만 첨부 가능합니다." : ".3dm 파일만 첨부 가능합니다.");
      } else { validFiles.push(file); }
    }
    e.target.value = "";
    if (validFiles.length === 0) return;
    setModalUploading(true);
    for (const file of validFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/requests/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setModalFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
      else showError(`업로드 실패: ${file.name}`);
    }
    setModalUploading(false);
  };

  // 멘토 답변 이미지 첨부
  const handleMentorReplyFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) return;
    const validFiles = selected.filter((f) => IMAGE_EXTS.includes(f.name.split(".").pop()?.toLowerCase() ?? ""));
    e.target.value = "";
    if (validFiles.length === 0) return;
    setMentorReplyUploading(true);
    for (const file of validFiles) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/answers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setMentorReplyFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
    }
    setMentorReplyUploading(false);
  };

  // 자유 채팅 전송
  const handleSend = async () => {
    if (!content.trim() && files.length === 0) return;
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSending(true);
    const msgType: MsgType = isMentor ? "answer" : "question";
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

  // 수강생 요청 전송
  const handleModalSend = async () => {
    if (!activeModal) return;
    if (!modalContent.trim() && modalFiles.length === 0) { showError("내용을 입력하거나 파일을 첨부해주세요."); return; }
    const token = getAccessToken();
    if (!token) return;
    setModalSending(true);
    const res = await fetch("/api/cad-school/subscribe/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription_id: id, content: modalContent.trim() || " ", files: modalFiles, message_type: activeModal }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "전송 실패"); }
    else {
      showSuccess("요청이 전송되었습니다.");
      setModalContent(""); setModalFiles([]); setActiveModal(null); setShowModalConfirm(false);
      loadData();
    }
    setModalSending(false);
  };

  // 멘토 답변 완료
  const handleMentorAnswer = async () => {
    if (!activeModal) return;
    if (!mentorReply.trim() && mentorReplyFiles.length === 0) { showError("답변 내용을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) return;
    const latestReq = getLatestRequest(activeModal);
    if (!latestReq) return;
    setMentorReplying(true);
    const res = await fetch("/api/cad-school/subscribe/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription_id: id, content: mentorReply.trim() || " ", files: mentorReplyFiles, message_type: "answer" }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "전송 실패"); setMentorReplying(false); return; }
    await fetch("/api/cad-school/subscribe/answer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ message_id: latestReq.id }),
    });
    showSuccess("답변이 완료되었습니다.");
    setMentorReply(""); setMentorReplyFiles([]); setActiveModal(null);
    loadData();
    setMentorReplying(false);
  };

  const openRequestModal = (type: RequestType) => {
    if (!sub) return;
    const lim = PLAN_LIMITS[sub.plan_type] ?? PLAN_LIMITS.basic;
    const used = { checklist: sub.checklist_count, review: sub.review_count, post_review_cad: sub.post_review_cad_count };
    const max = { checklist: lim.checklist, review: lim.review, post_review_cad: lim.post_review_cad };
    if (isSubscriber && used[type] >= max[type]) {
      setAddonBlockedType(type); setShowAddonModal(true); return;
    }
    setModalContent(""); setModalFiles([]); setShowModalConfirm(false);
    setMentorReply(""); setMentorReplyFiles([]);
    setActiveModal(type);
  };

  const hasUnread = (type: RequestType): boolean =>
    messages.some((m) => m.message_type === type && !m.is_answered && m.sender_id !== myUserId);

  const getLatestRequest = (type: RequestType): ChatMessage | null => {
    const reqs = messages.filter((m) => m.message_type === type && !m.is_answered && m.sender_id !== myUserId);
    return reqs.length > 0 ? reqs[reqs.length - 1] : null;
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
    setShowChangeMentor(true); setLoadingMentors(true);
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, user_id, avg_rating, total_ratings, is_suspended, profiles(nickname, avatar_url)")
      .eq("is_active", true).eq("is_suspended", false).neq("id", sub?.mentor_id ?? "");
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
    <div style={{ height: "calc(100vh - 68px)", display: "flex", flexDirection: "column", maxWidth: 760, margin: "0 auto", padding: "0 16px", boxSizing: "border-box", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ flexShrink: 0, paddingTop: 10, paddingBottom: 6 }}>
        {/* Breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <Link href="/cad-school/my" style={{ color: "#6b7280", textDecoration: "none", fontSize: 12 }}>← 내 활동</Link>
          <span style={{ color: "#d1d5db" }}>/</span>
          <span style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>수강 채팅방</span>
        </div>

        {/* 상단 정보 카드 */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {mentor?.profiles?.avatar_url
                ? <Image src={mentor.profiles.avatar_url} alt="" width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>👤</div>}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 14, fontWeight: 900, color: "#111827" }}>{mentorName}</span>
                  {currentMentorSuspended && <span style={{ fontSize: 10, fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "1px 6px", borderRadius: 4 }}>활동정지</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6b7280" }}>
                  {mentor && <span>★ {mentor.avg_rating.toFixed(1)} ({mentor.total_ratings})</span>}
                  <span style={{ fontWeight: 700, color: GOLD, background: GOLD_LIGHT, padding: "1px 6px", borderRadius: 4 }}>{PLAN_LABELS[sub.plan_type] ?? sub.plan_type}</span>
                  <span>만료 {new Date(sub.expires_at).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {isSubscriber && isActive && (
                <>
                  <button onClick={openChangeMentor} style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 7, border: "none", background: "#374151", color: "white", cursor: "pointer" }}>멘토 교체</button>
                  <button onClick={() => setShowRate(true)} style={{ fontSize: 11, fontWeight: 800, padding: "4px 10px", borderRadius: 7, border: "none", background: GOLD, color: "white", cursor: "pointer" }}>평가하기</button>
                </>
              )}
            </div>
          </div>

          {/* 요청 버튼 */}
          <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {REQUEST_TYPES.map((type) => {
              const used = type === "checklist" ? sub.checklist_count : type === "review" ? sub.review_count : sub.post_review_cad_count;
              const max = type === "checklist" ? limits.checklist : type === "review" ? limits.review : limits.post_review_cad;
              const exceeded = used >= max;
              const unread = isMentor && hasUnread(type);
              const canClick = isActive && (isSubscriber || isMentor);
              const btnColors = REQUEST_BTN_COLORS[type];
              const isHovered = hoveredReqBtn === type && !exceeded;
              return (
                <button
                  key={type}
                  onClick={() => canClick ? openRequestModal(type) : undefined}
                  onMouseEnter={() => canClick && setHoveredReqBtn(type)}
                  onMouseLeave={() => setHoveredReqBtn(null)}
                  style={{
                    position: "relative",
                    background: exceeded ? "#fff5f5" : isHovered ? btnColors.bgHover : btnColors.bg,
                    border: `1px solid ${exceeded ? "#fecaca" : btnColors.border}`,
                    borderRadius: 8,
                    padding: "5px 8px",
                    cursor: canClick ? "pointer" : "default",
                    textAlign: "center",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    transition: "background 0.12s",
                  }}
                >
                  {unread && (
                    <span style={{ position: "absolute", top: 6, right: 6, width: 7, height: 7, borderRadius: "50%", background: "#dc2626", display: "block" }} />
                  )}
                  <div style={{ fontSize: 12, fontWeight: 700, color: exceeded ? "#dc2626" : btnColors.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {type === "checklist" ? "CAD수정 요청하기" : type === "review" ? "검수 요청하기" : "검수+CAD수정 요청하기"}{" "}
                    <span style={{ fontWeight: 800 }}>({used}/{max})</span>
                  </div>
                </button>
              );
            })}
          </div>

          {isMentor && (
            <div style={{ marginTop: 8, fontSize: 11, color: "#6b7280" }}>
              수강생: <strong>{sub.subscriber_profile?.nickname ?? "수강생"}</strong> · 패키지: <strong>{PLAN_LABELS[sub.plan_type]}</strong> · 답변 제한: <strong>{limits.hours}시간</strong>
            </div>
          )}
        </div>
      </div>

      {/* 메시지 목록 */}
      <div
        ref={chatContainerRef}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
        onDrop={handleImageDrop}
        style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 12, paddingBottom: 8, outline: isDragging ? "2px dashed #93c5fd" : "none", borderRadius: isDragging ? 12 : 0 }}
      >
        {messages.length === 0 && (
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "40px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            아직 메시지가 없습니다. 멘토에게 첫 메시지를 보내보세요!
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === myUserId;
          const typeInfo = MSG_TYPE_LABELS[msg.message_type] ?? MSG_TYPE_LABELS.question;
          const elapsedHours = (Date.now() - new Date(msg.created_at).getTime()) / (1000 * 60 * 60);
          const isOverdue = !msg.is_answered && elapsedHours >= limits.hours && msg.message_type !== "answer" && msg.message_type !== "question";
          const canReport = isSubscriber && !isMine && isOverdue && isActive;
          const canMarkAnswered = isMentor && !msg.is_answered && msg.message_type !== "answer" && msg.message_type !== "question" && isActive;
          const imageFiles = (msg.files ?? []).filter(f => IMAGE_EXTS.includes(f.ext));
          const nonImageFiles = (msg.files ?? []).filter(f => !IMAGE_EXTS.includes(f.ext));
          const textContent = msg.content.trim();
          return (
            <div key={msg.id} style={{ display: "flex", flexDirection: isMine ? "row-reverse" : "row", gap: 10, alignItems: "flex-end" }}>
              <div style={{ maxWidth: "75%", minWidth: 60 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, justifyContent: isMine ? "flex-end" : "flex-start" }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: typeInfo.color, background: typeInfo.bg, padding: "1px 6px", borderRadius: 4 }}>{typeInfo.label}</span>
                  {msg.is_answered && <span style={{ fontSize: 10, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "1px 6px", borderRadius: 4 }}>✓ 답변완료</span>}
                  {isOverdue && <span style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "1px 6px", borderRadius: 4 }}>⏰ 시간초과</span>}
                </div>
                <div style={{
                  background: isMine ? "#111827" : "white",
                  color: isMine ? "white" : "#111827",
                  border: isMine ? "none" : "1px solid #e5e7eb",
                  borderRadius: isMine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "12px 16px",
                  fontSize: 14, lineHeight: 1.6,
                }}>
                  {imageFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: textContent ? 8 : 0 }}>
                      {imageFiles.map((f, i) => (
                        <ChatImagePreview key={i} file={f} onClick={() => setLightbox({ url: f.url, name: f.name })} />
                      ))}
                    </div>
                  )}
                  {textContent && <div style={{ whiteSpace: "pre-wrap" }}>{textContent}</div>}
                  {nonImageFiles.length > 0 && (
                    <div style={{ marginTop: textContent || imageFiles.length > 0 ? 8 : 0, display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {nonImageFiles.map((f, i) => <FileAttachment key={i} file={f} dark={isMine} />)}
                    </div>
                  )}
                </div>
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
      </div>

      {/* 자유 채팅 입력 */}
      {isActive && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
          onDrop={handleImageDrop}
          style={{ flexShrink: 0, borderTop: `1px solid ${isDragging ? "#93c5fd" : "#e5e7eb"}`, paddingTop: 10, paddingBottom: 16, background: isDragging ? "#eff6ff" : "white", transition: "background 0.12s, border-color 0.12s" }}
        >
          {files.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {files.map((f, i) => (
                <div key={i} style={{ position: "relative", flexShrink: 0 }}>
                  <img
                    src={f.url}
                    alt={f.name}
                    style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", display: "block", border: "1px solid #e5e7eb" }}
                  />
                  <button
                    onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: -5, right: -5, width: 18, height: 18, borderRadius: "50%", background: "#374151", color: "white", border: "2px solid white", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", padding: 0, lineHeight: 1 }}
                  >×</button>
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
            <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
            <button onClick={handleSend} disabled={sending || uploading || (!content.trim() && files.length === 0)} style={{ ...sendBtn }}>
              {sending ? "..." : "전송"}
            </button>
          </div>
        </div>
      )}

      {!isActive && (
        <div style={{ flexShrink: 0, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 20px", textAlign: "center", color: "#6b7280", fontSize: 13, fontWeight: 700, marginBottom: 16 }}>
          수강이 종료되었습니다.
        </div>
      )}

      {/* 요청/답변 팝업 모달 */}
      {activeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 480, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{REQUEST_MODAL_INFO[activeModal].label}</div>
              <button onClick={() => { setActiveModal(null); setMentorReply(""); setMentorReplyFiles([]); }} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>

            {/* 수강생 뷰 */}
            {isSubscriber && (
              <>
                {activeModal === "review" && (
                  <div style={{ fontSize: 12, color: "#92400e", background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: "6px 12px", marginBottom: 12 }}>
                    💡 형상 검수의 경우 STL, OBJ 파일도 첨부 가능합니다
                  </div>
                )}
                <textarea
                  value={modalContent}
                  onChange={(e) => setModalContent(e.target.value)}
                  placeholder="요청 내용을 입력하세요..."
                  rows={5}
                  style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 }}
                />
                {modalFiles.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {modalFiles.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "4px 8px", fontSize: 11 }}>
                        <span>📐</span>
                        <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <button onClick={() => setModalFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>×</button>
                      </div>
                    ))}
                  </div>
                )}
                <button
                  onClick={() => modalFileInputRef.current?.click()}
                  disabled={modalUploading}
                  style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 6 }}
                >
                  {modalUploading ? "업로드 중..." : "📎 파일 첨부"}
                </button>
                <p style={{ margin: "0 0 12px", fontSize: 12, color: "#9ca3af" }}>
                  {activeModal === "review"
                    ? "※ 3DM 파일 첨부 가능 | 형상 검수의 경우 STL, OBJ 파일도 가능합니다"
                    : "※ 3DM 파일만 첨부 가능합니다"}
                </p>
                <input
                  ref={modalFileInputRef}
                  type="file"
                  multiple
                  accept={activeModal === "review" ? ".3dm,.stl,.obj" : ".3dm"}
                  style={{ display: "none" }}
                  onChange={(e) => handleModalFileChange(e, activeModal)}
                />
                <button
                  onClick={() => {
                    if (!modalContent.trim() && modalFiles.length === 0) { showError("내용을 입력하거나 파일을 첨부해주세요."); return; }
                    setShowModalConfirm(true);
                  }}
                  disabled={modalSending || modalUploading}
                  style={{ width: "100%", height: 48, borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer" }}
                >
                  전송하기
                </button>
              </>
            )}

            {/* 멘토 뷰 */}
            {isMentor && (() => {
              const req = getLatestRequest(activeModal);
              if (!req) {
                return (
                  <div style={{ textAlign: "center", padding: "32px 0", color: "#9ca3af", fontSize: 14 }}>
                    아직 요청이 없습니다.
                  </div>
                );
              }
              return (
                <>
                  <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
                    <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>{timeAgo(req.created_at)}</div>
                    <div style={{ fontSize: 14, color: "#111827", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{req.content.trim()}</div>
                    {req.files && req.files.length > 0 && (
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {req.files.map((f, i) => <FileAttachment key={i} file={f} dark={false} />)}
                      </div>
                    )}
                  </div>
                  <textarea
                    value={mentorReply}
                    onChange={(e) => setMentorReply(e.target.value)}
                    placeholder="답변을 입력하세요..."
                    rows={4}
                    style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 12, padding: "10px 14px", fontSize: 14, resize: "none", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }}
                  />
                  {mentorReplyFiles.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                      {mentorReplyFiles.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "4px 8px", fontSize: 11 }}>
                          <span>🖼</span>
                          <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <button onClick={() => setMentorReplyFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>×</button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => mentorReplyFileRef.current?.click()}
                      disabled={mentorReplyUploading}
                      style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb", color: "#374151", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                    >
                      {mentorReplyUploading ? "업로드 중..." : "📎 이미지 첨부"}
                    </button>
                    <input ref={mentorReplyFileRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleMentorReplyFileChange} />
                    <button
                      onClick={handleMentorAnswer}
                      disabled={mentorReplying || mentorReplyUploading}
                      style={{ flex: 2, height: 44, borderRadius: 12, border: "none", background: "#111827", color: "white", fontWeight: 900, fontSize: 14, cursor: "pointer" }}
                    >
                      {mentorReplying ? "답변 중..." : "답변 완료"}
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* 전송 확인 모달 (팝업 위, zIndex 110) */}
      {showModalConfirm && activeModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 110, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 400 }}>
            <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", marginBottom: 16 }}>전송 확인</div>
            <div style={{ background: "#fff8e1", border: "1px solid #fde68a", borderRadius: 12, padding: "14px 16px", fontSize: 14, color: "#92400e", lineHeight: 1.8, marginBottom: 20 }}>
              <div>⚠️ <strong>{REQUEST_MODAL_INFO[activeModal].label}</strong> 횟수가 차감됩니다.</div>
              <div style={{ marginTop: 4, fontSize: 13, color: "#78350f" }}>
                남은 횟수:{" "}
                <strong>
                  {activeModal === "checklist"
                    ? Math.max(0, limits.checklist - sub.checklist_count)
                    : activeModal === "review"
                    ? Math.max(0, limits.review - sub.review_count)
                    : Math.max(0, limits.post_review_cad - sub.post_review_cad_count)}
                </strong>회
              </div>
              <div style={{ marginTop: 8, fontWeight: 700 }}>전송하시겠습니까?</div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button
                onClick={() => setShowModalConfirm(false)}
                style={{ height: 46, borderRadius: 12, border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
              >
                취소
              </button>
              <button
                onClick={() => { setShowModalConfirm(false); handleModalSend(); }}
                disabled={modalSending}
                style={{ height: 46, borderRadius: 12, border: "none", background: "#111827", color: "white", fontWeight: 900, fontSize: 14, cursor: "pointer" }}
              >
                {modalSending ? "전송 중..." : "확인"}
              </button>
            </div>
          </div>
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
                        ? <Image src={m.profiles.avatar_url} alt="" width={36} height={36} style={{ borderRadius: "50%", objectFit: "cover" }} />
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

      {/* 횟수 초과 → 추가 구매 모달 */}
      {showAddonModal && addonBlockedType && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 24, padding: "28px 24px", width: "100%", maxWidth: 400 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>횟수 초과</div>
              <button onClick={() => setShowAddonModal(false)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#6b7280" }}>×</button>
            </div>
            <div style={{ background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#dc2626", marginBottom: 18, lineHeight: 1.7 }}>
              {addonBlockedType === "checklist"       && "이번 수강 기간 CAD수정 횟수를 모두 사용했습니다."}
              {addonBlockedType === "review"          && "이번 수강 기간 실무검수 횟수를 모두 사용했습니다."}
              {addonBlockedType === "post_review_cad" && "이번 수강 기간 검수+CAD수정 횟수를 모두 사용했습니다."}
              <br />추가 구매하시겠습니까?
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              <Link
                href={`/cad-school/addon?sub=${id}&type=${addonBlockedType}`}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 48, borderRadius: 14, background: "#111827", color: "white", fontWeight: 900, fontSize: 14, textDecoration: "none" }}
                onClick={() => setShowAddonModal(false)}
              >
                이용권 추가 구매
              </Link>
              <button onClick={() => setShowAddonModal(false)} style={{ height: 44, borderRadius: 14, border: "1px solid #e5e7eb", background: "white", color: "#6b7280", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                닫기
              </button>
            </div>
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

      {/* 라이트박스 */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.88)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{ position: "absolute", top: 16, right: 16, background: "rgba(255,255,255,0.15)", border: "none", color: "white", fontSize: 22, cursor: "pointer", borderRadius: 8, padding: "4px 12px", lineHeight: 1 }}
          >×</button>
          <img
            src={lightbox.url}
            alt={lightbox.name}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: "90vw", maxHeight: "78vh", borderRadius: 12, objectFit: "contain", display: "block" }}
          />
          <div onClick={(e) => e.stopPropagation()} style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <a
              href={lightbox.url}
              download={lightbox.name}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, background: "white", color: "#111827", fontWeight: 700, fontSize: 13, textDecoration: "none" }}
            >⬇ 다운로드</a>
            <button
              onClick={() => setLightbox(null)}
              style={{ padding: "9px 20px", borderRadius: 10, border: "none", background: "rgba(255,255,255,0.15)", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
            >닫기</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatImagePreview({ file, onClick }: { file: FileItem; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ position: "relative", display: "inline-block", flexShrink: 0, cursor: "pointer" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <img
        src={file.url}
        alt={file.name}
        onClick={onClick}
        style={{ maxWidth: 200, maxHeight: 200, borderRadius: 10, objectFit: "cover", display: "block" }}
      />
      {hovered && (
        <a
          href={file.url}
          download={file.name}
          onClick={(e) => e.stopPropagation()}
          style={{ position: "absolute", bottom: 6, right: 6, background: "rgba(0,0,0,0.6)", color: "white", borderRadius: 6, padding: "3px 9px", fontSize: 14, textDecoration: "none", lineHeight: 1 }}
        >⬇</a>
      )}
    </div>
  );
}

function FileAttachment({ file, dark }: { file: FileItem; dark?: boolean }) {
  const isImage = ["jpg", "jpeg", "png", "webp", "gif"].includes(file.ext);
  if (isImage) {
    return <a href={file.url} target="_blank" rel="noreferrer"><Image src={file.url} alt={file.name} width={100} height={70} style={{ borderRadius: 8, objectFit: "cover" }} /></a>;
  }
  const icon = ["stl", "obj", "3dm"].includes(file.ext) ? "📐" : "📎";
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

const iconBtn: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 10, border: "1px solid #e5e7eb", background: "#f9fafb", fontSize: 18, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};

const sendBtn: React.CSSProperties = {
  padding: "0 20px", height: 40, borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
};
