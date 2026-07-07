"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import Image from "next/image";
import { GOLD } from "@/lib/constants";

const MAX_IMAGES = 5;
const DAILY_POINT_LIMIT = 100;
const MIN_ANSWER_LENGTH = 20;
const REPORT_THRESHOLD = 3;

const REPORT_REASONS = [
  "복사/붙여넣기 의심",
  "질문과 관련 없는 답변",
  "욕설/비방",
  "기타",
];

type AskPost = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  images: string[];
  is_solved: boolean;
  accepted_answer_id: string | null;
  view_count: number;
  created_at: string;
  nickname: string;
};

type AskAnswer = {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  images: string[];
  likes: number;
  is_accepted: boolean;
  report_count: number;
  created_at: string;
  nickname: string;
  liked: boolean;
  reported: boolean;
};

// 포인트 지급 가능 여부를 확인 후 지급하는 내부 헬퍼
const tryAddAskPoints = async (
  userId: string,
  amount: number,
  reason: string,
  referenceId?: string
): Promise<boolean> => {
  // 1. is_point_blocked 확인
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_point_blocked")
    .eq("id", userId)
    .single();
  if (profile?.is_point_blocked) return false;

  // 2. 일일 한도 확인
  const { data: todayRows } = await supabase
    .from("points")
    .select("amount")
    .eq("user_id", userId)
    .in("reason", ["답변 등록", "답변 좋아요", "답변 채택"])
    .gte("created_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString());
  const todayTotal = (todayRows || []).reduce((s: number, r: any) => s + (r.amount > 0 ? r.amount : 0), 0);
  if (todayTotal >= DAILY_POINT_LIMIT) return false;

  await supabase.from("points").insert({ user_id: userId, amount, reason, reference_id: referenceId || null });
  await supabase.rpc("increment_profile_points", { uid: userId, delta: amount });
  return true;
};

export default function AskDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [post, setPost] = useState<AskPost | null>(null);
  const [answers, setAnswers] = useState<AskAnswer[]>([]);
  const [loading, setLoading] = useState(true);



  // 답변 작성
  const [answerContent, setAnswerContent] = useState("");
  const [answerImages, setAnswerImages] = useState<string[]>([]);
  const [answerUploading, setAnswerUploading] = useState(false);
  const [answerSubmitting, setAnswerSubmitting] = useState(false);
  const [answerDragOver, setAnswerDragOver] = useState(false);
  const answerFileRef = useRef<HTMLInputElement>(null);

  // 삭제 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // 신고 모달
  const [reportTarget, setReportTarget] = useState<AskAnswer | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // 신고 누적 답변 펼치기
  const [expandedReported, setExpandedReported] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setMyRole("guest"); return; }
    const uid = (decodeJwt(token) as any)?.sub as string;
    setMyId(uid);
    supabase.from("profiles").select("role").eq("id", uid).single()
      .then(({ data }) => setMyRole(data?.role || "user"));
  }, []);

  useEffect(() => {
    if (myRole === null) return;
    if (myRole !== "seller" && myRole !== "admin") return;
    fetchPost();
  }, [myRole, id]);

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  const fetchPost = async () => {
    setLoading(true);
    await supabase.rpc("increment_ask_view", { post_id: id });

    const { data: postData } = await supabase
      .from("ask_posts")
      .select("*, profiles(nickname)")
      .eq("id", id)
      .single();

    if (!postData) { setLoading(false); return; }
    setPost({ ...postData, nickname: (postData.profiles as any)?.nickname || "익명" });

    await fetchAnswers();
    setLoading(false);
  };

  const fetchAnswers = async () => {
    const { data: answersData } = await supabase
      .from("ask_answers")
      .select("*, profiles(nickname)")
      .eq("post_id", id)
      .order("is_accepted", { ascending: false })
      .order("likes", { ascending: false })
      .order("created_at", { ascending: true });

    if (!answersData) return;

    let likedSet = new Set<string>();
    let reportedSet = new Set<string>();
    if (myId) {
      const [{ data: likes }, { data: reports }] = await Promise.all([
        supabase.from("ask_answer_likes").select("answer_id").eq("user_id", myId),
        supabase.from("ask_reports").select("answer_id").eq("reporter_id", myId),
      ]);
      likedSet = new Set((likes || []).map((l: any) => l.answer_id));
      reportedSet = new Set((reports || []).map((r: any) => r.answer_id));
    }

    setAnswers(
      (answersData as any[]).map((a) => ({
        ...a,
        nickname: (a.profiles as any)?.nickname || "익명",
        liked: likedSet.has(a.id),
        reported: reportedSet.has(a.id),
        report_count: a.report_count ?? 0,
      }))
    );
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", "thumbnails");
    form.append("path", `ask-answers/${myId}/${Date.now()}-${file.name}`);
    const token = getAccessToken();
    const res = await fetch("/api/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  };

  const handleAnswerFiles = async (files: FileList | null) => {
    if (!files || answerImages.length >= MAX_IMAGES) return;
    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter(f => f.type.startsWith("image/"));
    if (allFiles.length > 0 && imageFiles.length === 0) {
      alert("이미지 파일만 업로드 가능합니다.");
      return;
    }
    const toUpload = imageFiles.slice(0, MAX_IMAGES - answerImages.length);
    setAnswerUploading(true);
    const urls: string[] = [];
    for (const f of toUpload) {
      const url = await uploadImage(f);
      if (url) urls.push(url);
    }
    setAnswerImages((prev) => [...prev, ...urls]);
    setAnswerUploading(false);
  };

  const handleAnswerSubmit = async () => {
    if (!myId || !answerContent.trim() || answerSubmitting) return;
    setAnswerSubmitting(true);

    const { data, error } = await supabase
      .from("ask_answers")
      .insert({ post_id: id, user_id: myId, content: answerContent.trim(), images: answerImages })
      .select()
      .single();

    if (!error && data) {
      // 포인트 지급 조건 검사
      const meetsLength = answerContent.trim().length >= MIN_ANSWER_LENGTH;
      const isSolved = post?.is_solved ?? false;

      const isSelfAnswer = post?.user_id === myId;

      if (meetsLength && !isSolved && !isSelfAnswer) {
        // 이 post_id에 이미 포인트를 받은 적 있는지 확인
        await supabase
          .from("points")
          .select("id")
          .eq("user_id", myId)
          .eq("reason", "답변 등록")
          .like("reference_id", `%`) // reference_id는 answer.id — post_id와 맞춰 조회
          .limit(1);

        // answer.id 기반이므로 post 내 기존 답변 id들로 확인
        const myPrevAnswers = answers.filter((a) => a.user_id === myId);
        const alreadyEarned = myPrevAnswers.length > 0
          ? (await supabase
              .from("points")
              .select("id")
              .eq("user_id", myId)
              .eq("reason", "답변 등록")
              .in("reference_id", myPrevAnswers.map((a) => a.id))
              .limit(1)
            ).data?.length ?? 0
          : 0;

        if (alreadyEarned === 0) {
          await tryAddAskPoints(myId, 5, "답변 등록", data.id);
        }
      }

      setAnswerContent("");
      setAnswerImages([]);
      await fetchAnswers();
    }
    setAnswerSubmitting(false);
  };

  const handleLike = async (answer: AskAnswer) => {
    if (!myId || answer.user_id === myId) return;

    if (answer.liked) {
      await supabase.from("ask_answer_likes").delete().eq("answer_id", answer.id).eq("user_id", myId);
      await supabase.from("ask_answers").update({ likes: Math.max(0, answer.likes - 1) }).eq("id", answer.id);
    } else {
      const { error } = await supabase.from("ask_answer_likes").insert({ answer_id: answer.id, user_id: myId });
      if (!error) {
        await supabase.from("ask_answers").update({ likes: answer.likes + 1 }).eq("id", answer.id);
        await tryAddAskPoints(answer.user_id, 2, "답변 좋아요", answer.id);
      }
    }
    await fetchAnswers();
  };

  const handleAccept = async (answer: AskAnswer) => {
    if (!post || post.user_id !== myId || post.is_solved) return;

    await supabase.from("ask_answers").update({ is_accepted: true }).eq("id", answer.id);
    await supabase.from("ask_posts").update({
      is_solved: true,
      accepted_answer_id: answer.id,
      updated_at: new Date().toISOString(),
    }).eq("id", post.id);

    await tryAddAskPoints(answer.user_id, 20, "답변 채택", answer.id);
    await fetchPost();
  };

  const handleDeletePost = async () => {
    if (!myId || deleteSubmitting) return;
    setDeleteSubmitting(true);

    const token = (await supabase.auth.getSession()).data.session?.access_token;
    const res = await fetch(`/api/ask/delete?id=${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) {
      router.push("/ask");
    } else {
      const { error } = await res.json();
      alert(error || "삭제에 실패했습니다.");
      setDeleteSubmitting(false);
      setShowDeleteModal(false);
    }
  };

  const handleReport = async () => {
    if (!myId || !reportTarget || !reportReason || reportSubmitting) return;
    setReportSubmitting(true);

    const { error } = await supabase.from("ask_reports").insert({
      answer_id: reportTarget.id,
      reporter_id: myId,
      reason: reportReason,
    });

    if (!error) {
      // 신고 3회 이상이면 포인트 회수 + is_point_blocked 설정
      const newCount = (reportTarget.report_count ?? 0) + 1;
      if (newCount >= REPORT_THRESHOLD) {
        // 이 답변으로 받은 포인트 회수 (답변 등록 +5)
        const { data: earnedRows } = await supabase
          .from("points")
          .select("amount")
          .eq("user_id", reportTarget.user_id)
          .eq("reference_id", reportTarget.id)
          .gt("amount", 0);
        const earnedTotal = (earnedRows || []).reduce((s: number, r: any) => s + r.amount, 0);
        if (earnedTotal > 0) {
          await supabase.from("points").insert({
            user_id: reportTarget.user_id,
            amount: -earnedTotal,
            reason: "신고 누적 포인트 회수",
            reference_id: reportTarget.id,
          });
          await supabase.rpc("increment_profile_points", { uid: reportTarget.user_id, delta: -earnedTotal });
        }
        // 포인트 차단
        await supabase.from("profiles").update({ is_point_blocked: true }).eq("id", reportTarget.user_id);
      }

      await fetchAnswers();
    }

    setReportTarget(null);
    setReportReason("");
    setReportSubmitting(false);
  };

  // 현재 답변 내용의 포인트 지급 여부 미리보기
  const contentLen = answerContent.trim().length;
  const willEarnPoints = contentLen >= MIN_ANSWER_LENGTH && !post?.is_solved && myId !== post?.user_id;

  if (myRole !== null && myRole !== "seller" && myRole !== "admin") {
    return (
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 20px", fontFamily: "system-ui, sans-serif", textAlign: "center" }}>
        <div style={{ fontSize: 52 }}>🔒</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginTop: 16 }}>판매자만 이용 가능한 메뉴입니다</h2>
      </main>
    );
  }

  if (loading) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "60px 20px", textAlign: "center", color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>
        불러오는 중...
      </main>
    );
  }

  if (!post) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "60px 20px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ color: "#6b7280" }}>게시글을 찾을 수 없습니다.</p>
        <Link href="/ask" style={{ color: GOLD, fontWeight: 700 }}>목록으로</Link>
      </main>
    );
  }

  const isAuthor = myId === post.user_id;

  return (
    <main style={{
      maxWidth: 760, margin: "0 auto", padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 신고 모달 */}
      {reportTarget && (
        <div
          onClick={() => { setReportTarget(null); setReportReason(""); }}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 20, padding: "28px 24px",
              width: "100%", maxWidth: 420,
            }}
          >
            <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 900, color: "#111827" }}>
              답변 신고
            </h3>
            <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
              신고 사유를 선택해주세요. 허위 신고 시 제재를 받을 수 있습니다.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
              {REPORT_REASONS.map((r) => (
                <label key={r} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                  border: `1.5px solid ${reportReason === r ? GOLD : "#e5e7eb"}`,
                  background: reportReason === r ? "#fdf8ec" : "white",
                }}>
                  <input
                    type="radio"
                    name="report-reason"
                    value={r}
                    checked={reportReason === r}
                    onChange={() => setReportReason(r)}
                    style={{ accentColor: GOLD }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>{r}</span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => { setReportTarget(null); setReportReason(""); }}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: "1px solid #d1d5db",
                  background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151",
                }}
              >
                취소
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason || reportSubmitting}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: "none",
                  background: !reportReason || reportSubmitting ? "#e5e7eb" : "#ef4444",
                  color: !reportReason || reportSubmitting ? "#9ca3af" : "white",
                  fontSize: 14, fontWeight: 800,
                  cursor: !reportReason || reportSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {reportSubmitting ? "신고 중..." : "신고하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div
          onClick={() => !deleteSubmitting && setShowDeleteModal(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
            zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center",
            padding: "0 16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 20, padding: "28px 24px",
              width: "100%", maxWidth: 380,
            }}
          >
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 900, color: "#111827" }}>
              게시물 삭제
            </h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
              게시물을 삭제하면 답변도 모두 삭제됩니다.<br />정말 삭제하시겠습니까?
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleteSubmitting}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: "1px solid #d1d5db",
                  background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151",
                }}
              >
                취소
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deleteSubmitting}
                style={{
                  flex: 1, height: 44, borderRadius: 12, border: "none",
                  background: deleteSubmitting ? "#e5e7eb" : "#ef4444",
                  color: deleteSubmitting ? "#9ca3af" : "white",
                  fontSize: 14, fontWeight: 800,
                  cursor: deleteSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {deleteSubmitting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 뒤로가기 */}
      <Link href="/ask" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 15, fontWeight: 700, color: "#374151",
        textDecoration: "none", marginBottom: 20,
      }}>
        ← 목록으로
      </Link>

      {/* 질문 카드 */}
      <div style={{
        background: "white", borderRadius: 20, border: "1px solid #e5e7eb",
        padding: "28px 24px", marginBottom: 24,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
          <span style={{
            padding: "4px 12px", borderRadius: 999, fontSize: 13, fontWeight: 800,
            background: post.is_solved ? "#dcfce7" : "#fefce8",
            color: post.is_solved ? "#16a34a" : "#92400e",
            border: `1px solid ${post.is_solved ? "#86efac" : "#fcd34d"}`,
          }}>
            {post.is_solved ? "✅ 해결됨" : "💬 미해결"}
          </span>
          <span style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{post.title}</span>
        </div>

        <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 18, display: "flex", gap: 14, flexWrap: "wrap" }}>
          <span>🙋 {post.nickname}</span>
          <span>👁 {post.view_count}</span>
          <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
        </div>

        <p style={{ margin: 0, fontSize: 16, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-line" }}>
          {post.content}
        </p>

        {post.images.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
            {post.images.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                <Image src={url} alt="" width={120} height={120} style={{ objectFit: "cover", borderRadius: 12, border: "1px solid #e5e7eb" }} />
              </a>
            ))}
          </div>
        )}

        {(isAuthor || myRole === "admin") && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 18 }}>
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                padding: "7px 16px", borderRadius: 10,
                border: "1px solid #fecaca", background: "white",
                color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer",
              }}
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {/* 답변 목록 */}
      <div style={{ marginBottom: 32 }}>
        <h2 style={{ fontSize: 17, fontWeight: 800, color: "#111827", margin: "0 0 14px" }}>
          답변 {answers.length}개
        </h2>

        {answers.length === 0 ? (
          <div style={{ padding: "32px 20px", textAlign: "center", background: "#f9fafb", borderRadius: 14, color: "#9ca3af", fontSize: 15 }}>
            아직 답변이 없습니다. 첫 답변을 등록해보세요!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {answers.map((answer) => {
              const isReportedBlocked = answer.report_count >= REPORT_THRESHOLD;
              const isExpanded = expandedReported.has(answer.id);

              return (
                <div key={answer.id} style={{
                  background: answer.is_accepted ? "#f0fdf4" : "white",
                  borderRadius: 16, padding: "20px 22px",
                  border: answer.is_accepted ? "2px solid #86efac" : "1px solid #e5e7eb",
                  opacity: isReportedBlocked && !isExpanded ? 0.45 : 1,
                  position: "relative",
                  transition: "opacity 0.2s",
                }}>
                  {answer.is_accepted && (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "4px 12px", borderRadius: 999, marginBottom: 12,
                      background: "#dcfce7", color: "#16a34a", fontSize: 13, fontWeight: 800,
                      border: "1px solid #86efac",
                    }}>
                      ✅ 채택된 답변
                    </div>
                  )}

                  {/* 신고 누적 안내 */}
                  {isReportedBlocked && !isExpanded && (
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      gap: 10, flexWrap: "wrap",
                    }}>
                      <span style={{ fontSize: 13, color: "#ef4444", fontWeight: 700 }}>
                        ⚠️ 신고가 누적된 답변입니다
                      </span>
                      <button
                        onClick={() => setExpandedReported((prev) => new Set([...prev, answer.id]))}
                        style={{
                          fontSize: 12, fontWeight: 700, color: "#6b7280",
                          background: "none", border: "1px solid #d1d5db",
                          borderRadius: 8, padding: "4px 10px", cursor: "pointer",
                        }}
                      >
                        내용 보기
                      </button>
                    </div>
                  )}

                  {(!isReportedBlocked || isExpanded) && (
                    <>
                      {isReportedBlocked && (
                        <div style={{ marginBottom: 10, fontSize: 12, color: "#ef4444", fontWeight: 700 }}>
                          ⚠️ 신고가 누적된 답변입니다
                        </div>
                      )}

                      <div style={{ fontSize: 14, color: "#9ca3af", marginBottom: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                        <span>🙋 {answer.nickname}</span>
                        <span>{new Date(answer.created_at).toLocaleDateString("ko-KR")}</span>
                      </div>

                      <p style={{ margin: "0 0 16px", fontSize: 15, color: "#1f2937", lineHeight: 1.8, whiteSpace: "pre-line" }}>
                        {answer.content}
                      </p>

                      {answer.images.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                          {answer.images.map((url, i) => (
                            <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                              <Image src={url} alt="" width={100} height={100} style={{ objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb" }} />
                            </a>
                          ))}
                        </div>
                      )}

                      {/* 좋아요 + 채택 + 신고 */}
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          onClick={() => handleLike(answer)}
                          disabled={!myId || answer.user_id === myId}
                          style={{
                            display: "inline-flex", alignItems: "center", gap: 6,
                            padding: "7px 14px", borderRadius: 10,
                            border: answer.liked ? "none" : "1.5px solid #e5e7eb",
                            background: answer.liked ? "#fef9ec" : "white",
                            color: answer.liked ? GOLD : "#6b7280",
                            fontSize: 14, fontWeight: 700,
                            cursor: answer.user_id === myId ? "default" : "pointer",
                          }}
                        >
                          👍 {answer.likes}
                        </button>

                        {isAuthor && !post.is_solved && (
                          <button
                            onClick={() => handleAccept(answer)}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 6,
                              padding: "7px 14px", borderRadius: 10,
                              border: "none", background: "#111827",
                              color: GOLD, fontSize: 14, fontWeight: 800, cursor: "pointer",
                            }}
                          >
                            ✅ 채택하기
                          </button>
                        )}

                        {/* 신고 버튼 (본인 답변 제외) */}
                        {myId && answer.user_id !== myId && (
                          <button
                            onClick={() => { setReportTarget(answer); setReportReason(""); }}
                            disabled={answer.reported}
                            title={answer.reported ? "이미 신고한 답변입니다" : "답변 신고"}
                            style={{
                              marginLeft: "auto",
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "7px 12px", borderRadius: 10,
                              border: "1px solid #fecaca",
                              background: answer.reported ? "#f9fafb" : "white",
                              color: answer.reported ? "#9ca3af" : "#ef4444",
                              fontSize: 12, fontWeight: 700,
                              cursor: answer.reported ? "not-allowed" : "pointer",
                              opacity: answer.reported ? 0.6 : 1,
                            }}
                          >
                            🚩 {answer.reported ? "신고됨" : "신고"}
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 답변 작성폼 */}
      {myId && (
        <div style={{ background: "white", borderRadius: 20, border: "1px solid #e5e7eb", padding: "24px 22px" }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "#111827" }}>
            답변 작성
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: GOLD }}>
              {willEarnPoints ? "등록 시 +5 포인트" : ""}
            </span>
          </h3>

          <textarea
            value={answerContent}
            onChange={(e) => setAnswerContent(e.target.value)}
            placeholder="답변을 작성해주세요"
            rows={5}
            style={{
              width: "100%", borderRadius: 12, border: "1.5px solid #e5e7eb",
              padding: "12px 14px", fontSize: 15, outline: "none",
              resize: "vertical", boxSizing: "border-box", lineHeight: 1.7,
              marginBottom: 6,
            }}
          />

          {/* 20자 미만 안내 */}
          {contentLen > 0 && contentLen < MIN_ANSWER_LENGTH && (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: GOLD, fontWeight: 700 }}>
              20자 이상 작성 시 포인트가 지급됩니다 ({contentLen}/{MIN_ANSWER_LENGTH}자)
            </p>
          )}
          {post.is_solved && contentLen > 0 && (
            <p style={{ margin: "0 0 10px", fontSize: 12, color: "#9ca3af", fontWeight: 700 }}>
              이미 해결된 질문에는 포인트가 지급되지 않습니다.
            </p>
          )}

          {/* 이미지 첨부 */}
          <div
            onClick={() => !answerUploading && answerImages.length < MAX_IMAGES && answerFileRef.current?.click()}
            onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); setAnswerDragOver(true); }}
            onDragLeave={() => setAnswerDragOver(false)}
            onDrop={(e) => { e.stopPropagation(); e.preventDefault(); setAnswerDragOver(false); handleAnswerFiles(e.dataTransfer.files); }}
            style={{
              border: `2px dashed ${answerDragOver ? GOLD : "#d1d5db"}`,
              borderRadius: 12, padding: "16px", textAlign: "center",
              cursor: answerImages.length >= MAX_IMAGES ? "default" : "pointer",
              background: answerDragOver ? "#fdf8ec" : "#f9fafb",
              marginBottom: answerImages.length > 0 ? 12 : 16,
              fontSize: 13, color: "#9ca3af",
            }}
          >
            📎 {answerUploading ? "업로드 중..." : "이미지 첨부 (선택)"}
          </div>
          <input
            ref={answerFileRef}
            type="file" accept="image/*" multiple
            style={{ display: "none" }}
            onChange={(e) => handleAnswerFiles(e.target.files)}
          />

          {answerImages.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              {answerImages.map((url, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <Image src={url} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb" }} />
                  <button
                    onClick={() => setAnswerImages((prev) => prev.filter((_, j) => j !== i))}
                    style={{
                      position: "absolute", top: -7, right: -7,
                      width: 20, height: 20, borderRadius: "50%",
                      border: "none", background: "#ef4444", color: "white",
                      cursor: "pointer", fontSize: 13, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleAnswerSubmit}
            disabled={!answerContent.trim() || answerSubmitting}
            style={{
              width: "100%", height: 50, borderRadius: 13, border: "none",
              background: answerContent.trim() && !answerSubmitting ? "#111827" : "#e5e7eb",
              color: answerContent.trim() && !answerSubmitting ? GOLD : "#9ca3af",
              fontSize: 15, fontWeight: 800,
              cursor: answerContent.trim() && !answerSubmitting ? "pointer" : "not-allowed",
            }}
          >
            {answerSubmitting ? "등록 중..." : "답변 등록"}
          </button>
        </div>
      )}
    </main>
  );
}
