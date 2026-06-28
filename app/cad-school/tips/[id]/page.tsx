"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase-browser";
import MentorNickname from "../../../components/MentorNickname";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess, showInfo } from "../../../lib/toast";
import { GOLD } from "@/lib/constants";
import Image from "next/image";

const GOLD_LIGHT = "#fdf6e3";
const CURRENT_YEAR = new Date().getFullYear();

type Tip = {
  id: string;
  title: string;
  content: string;
  images: string[];
  like_count: number;
  bookmark_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  mentor: {
    id: string;
    avg_rating: number;
    career_start_year: number | null;
    intro: string;
    user_id: string;
    profiles: { nickname: string | null; avatar_url: string | null } | null;
  } | null;
};

type Comment = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

export default function TipDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const commentImgRef = useRef<HTMLInputElement>(null);

  const [tipId, setTipId] = useState<string | null>(null);
  const [tip, setTip]       = useState<Tip | null>(null);
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentImageUrl, setCommentImageUrl] = useState<string | null>(null);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [isMentorOwner, setIsMentorOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [liked, setLiked]         = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [likeCount, setLikeCount]         = useState(0);
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setTipId(id));
  }, [params]);

  useEffect(() => {
    if (!tipId) return;

    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      const uid = payload?.sub ?? null;
      if (uid) {
        supabase.from("profiles").select("role").eq("id", uid).single()
          .then(({ data }) => { if (data?.role === "admin") setIsAdmin(true); });
      }
    }

    loadTip(tipId);
    loadComments(tipId);
  }, [tipId]);

  const loadTip = async (id: string) => {
    setLoading(true);
    const res = await fetch(`/api/cad-school/tips/${id}`);
    if (!res.ok) { router.push("/cad-school/tips"); return; }
    const { tip: data } = await res.json();
    setTip(data);
    setLikeCount(data.like_count);
    setBookmarkCount(data.bookmark_count);

    const token = getAccessToken();
    const payload = token ? (decodeJwt(token) as { sub?: string } | null) : null;
    const uid = payload?.sub ?? null;

    if (uid) {
      setIsMentorOwner(data.mentor?.user_id === uid);
      const [likeRes, bkRes] = await Promise.all([
        supabase.from("cad_tip_likes").select("id").eq("tip_id", id).eq("user_id", uid).maybeSingle(),
        supabase.from("cad_tip_bookmarks").select("id").eq("tip_id", id).eq("user_id", uid).maybeSingle(),
      ]);
      setLiked(!!likeRes.data);
      setBookmarked(!!bkRes.data);
    }

    setLoading(false);
  };

  const loadComments = async (id: string) => {
    const res = await fetch(`/api/cad-school/tips/${id}/comment`);
    const { comments: data } = await res.json();
    setComments(data ?? []);
  };

  const toggleLike = async () => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (actionLoading || !tipId) return;
    setActionLoading(true);
    const res = await fetch(`/api/cad-school/tips/${tipId}/like`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    if (res.ok) { setLiked(d.liked); setLikeCount(d.like_count); }
    setActionLoading(false);
  };

  const toggleBookmark = async () => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (actionLoading || !tipId) return;
    setActionLoading(true);
    const res = await fetch(`/api/cad-school/tips/${tipId}/bookmark`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` },
    });
    const d = await res.json();
    if (res.ok) { setBookmarked(d.bookmarked); setBookmarkCount(d.bookmark_count); }
    setActionLoading(false);
  };

  const handleCommentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setUploadingImg(true);
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const path = `cad-school/tip-comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const fd = new FormData();
    fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
    const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
    const d = await res.json();
    if (d.url) setCommentImageUrl(d.url);
    else showError("이미지 업로드 실패");
    setUploadingImg(false);
    e.target.value = "";
  };

  const submitComment = async () => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (!commentText.trim()) { showError("내용을 입력해주세요."); return; }
    if (submitting || !tipId) return;
    setSubmitting(true);
    const res = await fetch(`/api/cad-school/tips/${tipId}/comment`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: commentText.trim(), image_url: commentImageUrl }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "오류 발생"); }
    else {
      setCommentText("");
      setCommentImageUrl(null);
      await loadComments(tipId);
      if (tip) setTip({ ...tip, comment_count: tip.comment_count + 1 });
    }
    setSubmitting(false);
  };

  const deleteComment = async (cid: string) => {
    if (!confirm("댓글을 삭제하시겠습니까?") || !tipId) return;
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/cad-school/tips/${tipId}/comment/${cid}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setComments((prev) => prev.filter((c) => c.id !== cid));
      if (tip) setTip({ ...tip, comment_count: Math.max(0, tip.comment_count - 1) });
    } else {
      const d = await res.json();
      showError(d.error ?? "삭제 실패");
    }
  };

  const deleteTip = async () => {
    if (!confirm("팁을 삭제하시겠습니까?") || !tipId) return;
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/cad-school/tips/${tipId}`, {
      method: "DELETE", headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) { showSuccess("삭제되었습니다."); router.push("/cad-school/tips"); }
    else { const d = await res.json(); showError(d.error ?? "삭제 실패"); }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "60px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14, fontFamily: 'system-ui, sans-serif' }}>
        불러오는 중...
      </main>
    );
  }

  if (!tip) return null;

  const mentor = tip.mentor;
  const careerYrs = mentor?.career_start_year ? CURRENT_YEAR - mentor.career_start_year : null;
  const canEdit = isMentorOwner || isAdmin;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 뒤로 + 관리 버튼 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <Link href="/cad-school/tips" style={{ fontSize: 14, color: "#6b7280", textDecoration: "none", display: "flex", alignItems: "center", gap: 4 }}>
          ← 멘토 팁 목록
        </Link>
        {canEdit && (
          <div style={{ display: "flex", gap: 8 }}>
            <Link href={`/cad-school/tips/${tip.id}/edit`} style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
              수정
            </Link>
            <button onClick={deleteTip} style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "#fef2f2", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
              삭제
            </button>
          </div>
        )}
      </div>

      {/* 팁 헤더 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px 24px", marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 20px", fontSize: 24, fontWeight: 900, color: "#111827", lineHeight: 1.35 }}>{tip.title}</h1>

        {/* 멘토 프로필 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid #f3f4f6" }}>
          <Avatar url={mentor?.profiles?.avatar_url} size={44} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                <MentorNickname
                  mentorId={mentor?.id ?? ""}
                  nickname={mentor?.profiles?.nickname ?? "멘토"}
                  isMentor={!!mentor?.id}
                />
              </span>
              {careerYrs !== null && <span style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", borderRadius: 5, padding: "2px 7px" }}>경력 {careerYrs}년</span>}
              {mentor && mentor.avg_rating > 0 && (
                <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>★ {mentor.avg_rating.toFixed(1)}</span>
              )}
            </div>
            {mentor?.intro && (
              <div style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5 }}>{mentor.intro}</div>
            )}
          </div>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af" }}>{timeAgo(tip.created_at)}</span>
        </div>

        {/* 본문 */}
        <div style={{ fontSize: 15, color: "#374151", lineHeight: 1.8, whiteSpace: "pre-wrap", marginBottom: tip.images.length > 0 ? 20 : 0 }}>
          {tip.content}
        </div>

        {/* 이미지 */}
        {tip.images.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {tip.images.map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: "100%", borderRadius: 12, border: "1px solid #e5e7eb", maxHeight: 500, objectFit: "contain", background: "#f8fafc" }} />
            ))}
          </div>
        )}
      </div>

      {/* 좋아요 / 북마크 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button
          onClick={toggleLike}
          disabled={actionLoading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, border: `1.5px solid ${liked ? "#ef4444" : "#e5e7eb"}`, background: liked ? "#fef2f2" : "white", color: liked ? "#dc2626" : "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          {liked ? "❤️" : "🤍"} 좋아요 {likeCount}
        </button>
        <button
          onClick={toggleBookmark}
          disabled={actionLoading}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, border: `1.5px solid ${bookmarked ? GOLD : "#e5e7eb"}`, background: bookmarked ? GOLD_LIGHT : "white", color: bookmarked ? "#92681a" : "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
        >
          {bookmarked ? "🔖" : "📑"} 북마크 {bookmarkCount}
        </button>
      </div>

      {/* 멘토 액션 카드 */}
      {mentor && (
        <div style={{ background: GOLD_LIGHT, border: `1.5px solid ${GOLD}66`, borderRadius: 20, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <Avatar url={mentor.profiles?.avatar_url} size={36} />
            <div style={{ fontSize: 15, fontWeight: 800, color: "#92681a" }}>{mentor.profiles?.nickname ?? "멘토"} 멘토와 함께하기</div>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link
              href={`/cad-school/mentor/${mentor.id}`}
              style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: "#111827", color: "white", fontWeight: 800, fontSize: 14, textDecoration: "none", textAlign: "center", minWidth: 140 }}
            >
              💬 이 멘토에게 질문하기
            </Link>
            <Link
              href="/cad-school?tab=subscription"
              style={{ flex: 1, padding: "12px 16px", borderRadius: 12, background: GOLD, color: "white", fontWeight: 800, fontSize: 14, textDecoration: "none", textAlign: "center", minWidth: 140 }}
            >
              📦 수강 패키지 보기
            </Link>
          </div>
        </div>
      )}

      {/* 댓글 섹션 */}
      <div>
        <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 16 }}>
          댓글 <span style={{ color: "#6b7280", fontWeight: 600 }}>{comments.length}</span>
        </div>

        {/* 댓글 작성 */}
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px 18px", marginBottom: 16 }}>
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="댓글을 입력해주세요..."
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #e5e7eb", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 }}
          />
          {commentImageUrl && (
            <div style={{ position: "relative", display: "inline-block", marginBottom: 8 }}>
              <Image src={commentImageUrl} alt="" width={120} height={80} style={{ borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "cover" }} />
              <button onClick={() => setCommentImageUrl(null)} style={{ position: "absolute", top: -6, right: -6, background: "#374151", color: "white", border: "none", borderRadius: "50%", width: 18, height: 18, fontSize: 11, cursor: "pointer", lineHeight: 1 }}>×</button>
            </div>
          )}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <button
              onClick={() => commentImgRef.current?.click()}
              disabled={uploadingImg}
              style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
            >
              {uploadingImg ? "업로드 중..." : "🖼 이미지 첨부"}
            </button>
            <input ref={commentImgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleCommentImageUpload} />
            <button
              onClick={submitComment}
              disabled={submitting || !commentText.trim()}
              style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: submitting || !commentText.trim() ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 13, cursor: submitting || !commentText.trim() ? "not-allowed" : "pointer" }}
            >
              {submitting ? "등록 중..." : "등록"}
            </button>
          </div>
        </div>

        {/* 댓글 목록 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {comments.length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>아직 댓글이 없습니다. 첫 번째 댓글을 남겨보세요!</div>
          ) : (
            comments.map((c) => (
              <CommentCard
                key={c.id}
                comment={c}
                isMentorOwner={isMentorOwner}
                isAdmin={isAdmin}
                onDelete={() => deleteComment(c.id)}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function CommentCard({
  comment, isMentorOwner, isAdmin, onDelete,
}: {
  comment: Comment;
  isMentorOwner: boolean;
  isAdmin: boolean;
  onDelete: () => void;
}) {
  return (
    <div style={{ background: "white", border: "1px solid #f0f0f0", borderRadius: 14, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar url={comment.profiles?.avatar_url} size={28} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{comment.profiles?.nickname ?? "익명"}</span>
          <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(comment.created_at)}</span>
        </div>
        {(isMentorOwner || isAdmin) && (
          <button onClick={onDelete} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer" }}>삭제</button>
        )}
      </div>
      <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{comment.content}</div>
      {comment.image_url && (
        <img src={comment.image_url} alt="" style={{ marginTop: 10, maxWidth: "100%", maxHeight: 300, borderRadius: 10, border: "1px solid #e5e7eb", objectFit: "contain" }} />
      )}
    </div>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <Image src={url} alt="avatar" width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, color: "#9ca3af" }}>👤</div>
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
