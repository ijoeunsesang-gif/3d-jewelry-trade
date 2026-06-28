"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import GradeBadge from "../../components/GradeBadge";
import MentorNickname from "../../components/MentorNickname";
import { Grade } from "@/lib/grades";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";
import { GOLD } from "@/lib/constants";


type FileItem = { name: string; url: string; ext: string };

type Post = {
  id: string;
  title: string;
  content: string;
  status: string;
  files: FileItem[];
  created_at: string;
  user_id: string;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

type Comment = {
  id: string;
  content: string;
  files: FileItem[];
  is_best_answer: boolean;
  point_reward: number;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

export default function CadPostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mentorUserIdMap, setMentorUserIdMap] = useState<Record<string, string>>({});

  const [commentContent, setCommentContent] = useState("");
  const [commentFiles, setCommentFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);

  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  // 게시물 수정
  const [editingPost, setEditingPost] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [savingPost, setSavingPost] = useState(false);

  // 게시물 삭제
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // 댓글 수정
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editCommentContent, setEditCommentContent] = useState("");
  const [savingComment, setSavingComment] = useState(false);

  // 댓글 삭제
  const [commentDeleteModal, setCommentDeleteModal] = useState<string | null>(null);
  const [deletingComment, setDeletingComment] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      const uid = payload?.sub ?? null;
      setMyUserId(uid);
      if (uid) {
        supabase.from("profiles").select("role").eq("id", uid).maybeSingle()
          .then(({ data }) => { if (data?.role === "admin") setIsAdmin(true); });
      }
    }
    loadPost();
    supabase.from("cad_mentors").select("id, user_id").eq("is_active", true)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((m: { id: string; user_id: string }) => { map[m.user_id] = m.id; });
          setMentorUserIdMap(map);
        }
      });
  }, [id]);

  const loadPost = async () => {
    setLoading(true);
    const { data: postData } = await supabase
      .from("cad_posts")
      .select("id, title, content, status, files, created_at, user_id, profiles(nickname, avatar_url, grade)")
      .eq("id", id)
      .single();

    if (!postData) { router.push("/cad-school"); return; }
    setPost(postData as unknown as Post);

    const { data: commentData } = await supabase
      .from("cad_post_comments")
      .select("id, content, files, is_best_answer, point_reward, created_at, user_id, parent_id, profiles(nickname, avatar_url, grade)")
      .eq("post_id", id)
      .order("created_at", { ascending: true });

    setAllComments((commentData ?? []) as unknown as Comment[]);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const IMAGE_EXTS = ["jpg", "jpeg", "png", "webp", "gif"];
    const nonImages = selected.filter((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
      return !IMAGE_EXTS.includes(ext) && !f.type.startsWith("image/");
    });
    if (nonImages.length > 0) {
      showError("답변에는 이미지만 첨부 가능합니다.");
      e.target.value = "";
      return;
    }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (commentFiles.length + selected.length > 3) { showError("파일은 최대 3개까지 첨부할 수 있습니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/comments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.url) setCommentFiles((prev) => [...prev, { name: file.name, url: data.url, ext }]);
      else showError(`업로드 실패: ${data.error || file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSubmitComment = async () => {
    if (!commentContent.trim()) { showError("답변 내용을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); router.push("/auth"); return; }
    setSubmitting(true);
    const res = await fetch("/api/cad-school/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ post_id: id, content: commentContent.trim(), files: commentFiles }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "답변 등록 실패"); }
    else {
      const awarded = data.pointAwarded ?? 0;
      showSuccess(awarded > 0 ? `답변이 등록되었습니다! (+${awarded}P)` : "답변이 등록되었습니다!");
      setCommentContent(""); setCommentFiles([]); loadPost();
    }
    setSubmitting(false);
  };

  const handleSubmitReply = async (parentCommentId: string) => {
    if (!replyContent.trim()) { showError("댓글 내용을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setReplySubmitting(true);
    const res = await fetch("/api/cad-school/comment", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ post_id: id, content: replyContent.trim(), files: [], parent_id: parentCommentId }),
    });
    const data = await res.json();
    if (!res.ok) showError(data.error || "댓글 등록 실패");
    else { showSuccess("댓글이 등록되었습니다."); setReplyContent(""); setReplyToId(null); loadPost(); }
    setReplySubmitting(false);
  };

  const handleEditPost = async () => {
    if (!editTitle.trim() || !editContent.trim()) { showError("제목과 내용을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) return;
    setSavingPost(true);
    const res = await fetch(`/api/cad-school/post/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "수정 실패"); }
    else { showSuccess("게시물이 수정되었습니다."); setEditingPost(false); loadPost(); }
    setSavingPost(false);
  };

  const handleDeletePost = async () => {
    const token = getAccessToken();
    if (!token) return;
    setDeleting(true);
    const res = await fetch(`/api/cad-school/post/${id}/delete`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "삭제 실패"); setDeleting(false); setShowDeleteModal(false); return; }
    showSuccess("게시물이 삭제되었습니다.");
    router.push("/cad-school");
  };

  const handlePickBest = async (commentId: string) => {
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (!confirm("이 답변을 채택하시겠습니까? 질문이 마감됩니다.")) return;
    setPicking(true);
    const res = await fetch("/api/cad-school/best-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ comment_id: commentId }),
    });
    const data = await res.json();
    if (!res.ok) showError(data.error || "채택 실패");
    else { showSuccess(`채택되었습니다! 답변자에게 +${data.pointAwarded ?? 300}P가 지급되었습니다.`); loadPost(); }
    setPicking(false);
  };

  const handleEditComment = async (commentId: string) => {
    if (!editCommentContent.trim()) { showError("내용을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) return;
    setSavingComment(true);
    const res = await fetch(`/api/cad-school/comment/${commentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: editCommentContent.trim() }),
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "수정 실패"); }
    else { showSuccess("댓글이 수정되었습니다."); setEditingCommentId(null); loadPost(); }
    setSavingComment(false);
  };

  const handleDeleteComment = async () => {
    if (!commentDeleteModal) return;
    const token = getAccessToken();
    if (!token) return;
    setDeletingComment(true);
    const res = await fetch(`/api/cad-school/comment/${commentDeleteModal}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "삭제 실패"); }
    else { showSuccess("댓글이 삭제되었습니다."); setCommentDeleteModal(null); loadPost(); }
    setDeletingComment(false);
  };

  if (loading) {
    return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  }
  if (!post) return null;

  const isOwner = myUserId === post.user_id;
  const topComments = allComments
    .filter((c) => !c.parent_id)
    .sort((a, b) => (b.is_best_answer ? 1 : 0) - (a.is_best_answer ? 1 : 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  const canDeletePost = (isOwner && topComments.length === 0) || isAdmin;
  const canEditPost = isOwner || isAdmin;
  const subCommentMap: Record<string, Comment[]> = {};
  for (const c of allComments) {
    if (c.parent_id) {
      if (!subCommentMap[c.parent_id]) subCommentMap[c.parent_id] = [];
      subCommentMap[c.parent_id].push(c);
    }
  }

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</span>
      </div>

      {/* 질문 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px 24px 20px", marginBottom: 20, overflow: "hidden", maxWidth: "100%", wordBreak: "break-all", overflowWrap: "break-word" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div style={{ flex: 1, minWidth: 0, overflow: "hidden", maxWidth: "100%", wordBreak: "break-all", overflowWrap: "break-word" }}>
            {!editingPost && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                {post.status === "closed"
                  ? <StatusBadge color="#6b7280" bg="#f3f4f6" label="마감" />
                  : <StatusBadge color="#16a34a" bg="#dcfce7" label="진행중" />
                }
              </div>
            )}
            {editingPost ? (
              <div>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  style={{ width: "100%", fontSize: 18, fontWeight: 800, color: "#111827", border: "1px solid #d1d5db", borderRadius: 10, padding: "8px 12px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 }}
                  maxLength={100}
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={6}
                  style={{ width: "100%", fontSize: 14, color: "#374151", border: "1px solid #d1d5db", borderRadius: 10, padding: "10px 12px", outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", lineHeight: 1.7, marginBottom: 12 }}
                />
                <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => setEditingPost(false)}
                    style={{ fontSize: 13, color: "#6b7280", background: "white", border: "1px solid #d1d5db", borderRadius: 9, padding: "7px 16px", cursor: "pointer", fontWeight: 700 }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleEditPost}
                    disabled={savingPost}
                    style={{ fontSize: 13, fontWeight: 800, color: "white", background: savingPost ? "#d1d5db" : "#111827", border: "none", borderRadius: 9, padding: "7px 16px", cursor: savingPost ? "not-allowed" : "pointer" }}
                  >
                    {savingPost ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            ) : (
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827", lineHeight: 1.3, wordBreak: "break-all", overflowWrap: "break-word", overflow: "hidden", maxWidth: "100%" }}>{post.title}</h1>
            )}
          </div>
          {!editingPost && (canEditPost || canDeletePost) && (
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {canEditPost && (
                <button
                  onClick={() => { setEditTitle(post.title); setEditContent(post.content); setEditingPost(true); }}
                  style={{ fontSize: 12, fontWeight: 700, color: "#374151", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
                >
                  수정
                </button>
              )}
              {canDeletePost && (
                <button
                  onClick={() => setShowDeleteModal(true)}
                  style={{ fontSize: 12, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 12px", cursor: "pointer" }}
                >
                  삭제
                </button>
              )}
            </div>
          )}
        </div>

        {!editingPost && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Avatar url={post.profiles?.avatar_url} size={28} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                <MentorNickname
                  mentorId={mentorUserIdMap[post.user_id] ?? ""}
                  nickname={post.profiles?.nickname ?? "익명"}
                  isMentor={!!mentorUserIdMap[post.user_id]}
                />
              </span>
              {post.profiles?.grade && <GradeBadge grade={post.profiles.grade as Grade} size="sm" />}
              <span style={{ fontSize: 12, color: "#9ca3af" }}>{timeAgo(post.created_at)}</span>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 15, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all", overflowWrap: "break-word", overflow: "hidden", maxWidth: "100%" }}>{post.content}</p>
            {post.files.length > 0 && <FilesBlock files={post.files} />}
          </>
        )}
      </div>

      {/* 답변 목록 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111827", margin: "0 0 14px" }}>
          답변 {topComments.length}개
        </h2>
        {topComments.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            subComments={subCommentMap[c.id] ?? []}
            isOwner={isOwner}
            myUserId={myUserId}
            isAdmin={isAdmin}
            postClosed={post.status === "closed"}
            onPickBest={() => handlePickBest(c.id)}
            picking={picking}
            replyToId={replyToId}
            onReplyToggle={(cid) => { setReplyToId(cid); setReplyContent(""); }}
            replyContent={replyContent}
            onReplyChange={setReplyContent}
            onReplySubmit={handleSubmitReply}
            replySubmitting={replySubmitting}
            editingCommentId={editingCommentId}
            editCommentContent={editCommentContent}
            onEditStart={(cid, content) => { setEditingCommentId(cid); setEditCommentContent(content); }}
            onEditSave={handleEditComment}
            onEditCancel={() => setEditingCommentId(null)}
            onEditChange={setEditCommentContent}
            onDeleteRequest={(cid) => setCommentDeleteModal(cid)}
            savingComment={savingComment}
            mentorUserIdMap={mentorUserIdMap}
          />
        ))}
        {topComments.length === 0 && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, padding: "30px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            아직 답변이 없습니다. 첫 번째로 답변해보세요!
          </div>
        )}
      </div>

      {/* 게시물 삭제 확인 모달 */}
      {showDeleteModal && (
        <div
          onClick={() => { if (!deleting) setShowDeleteModal(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, padding: "28px 28px 24px", maxWidth: 380, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
          >
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 14 }}>🗑️</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900, color: "#111827", textAlign: "center" }}>게시물 삭제</h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 1.6 }}>
              정말 삭제하시겠습니까?<br />삭제 후 복구할 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: deleting ? "not-allowed" : "pointer" }}
              >
                취소
              </button>
              <button
                onClick={handleDeletePost}
                disabled={deleting}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: deleting ? "#d1d5db" : "#dc2626", color: "white", fontWeight: 800, fontSize: 14, cursor: deleting ? "not-allowed" : "pointer" }}
              >
                {deleting ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 댓글 삭제 확인 모달 */}
      {commentDeleteModal && (
        <div
          onClick={() => { if (!deletingComment) setCommentDeleteModal(null); }}
          style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "white", borderRadius: 20, padding: "28px 28px 24px", maxWidth: 360, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}
          >
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 14 }}>🗑️</div>
            <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 900, color: "#111827", textAlign: "center" }}>댓글 삭제</h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 1.6 }}>
              댓글을 삭제하시겠습니까?<br />삭제 후 복구할 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setCommentDeleteModal(null)}
                disabled={deletingComment}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: deletingComment ? "not-allowed" : "pointer" }}
              >
                취소
              </button>
              <button
                onClick={handleDeleteComment}
                disabled={deletingComment}
                style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: deletingComment ? "#d1d5db" : "#dc2626", color: "white", fontWeight: 800, fontSize: 14, cursor: deletingComment ? "not-allowed" : "pointer" }}
              >
                {deletingComment ? "삭제 중..." : "삭제하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 답변 작성 (본인 질문에는 표시 안 함) */}
      {!isOwner && (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "22px 24px" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 900, color: "#111827" }}>
            답변 작성{post.status === "open" && <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}> +50P</span>}
            {post.status !== "open" && <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 600 }}> (채택 완료 — 포인트 미지급)</span>}
          </h3>
          <textarea
            value={commentContent}
            onChange={(e) => setCommentContent(e.target.value)}
            placeholder="CAD 질문에 대한 답변을 작성해주세요..."
            rows={5}
            style={{ width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", marginBottom: 12 }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1 }}>
              {commentFiles.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "3px 8px", fontSize: 12 }}>
                  <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                  <span style={{ color: "#374151", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <button onClick={() => setCommentFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>×</button>
                </div>
              ))}
              <button
                onClick={() => fileInputRef.current?.click()}
                title="이미지만 첨부 가능합니다 (jpg, png, webp, gif)"
                style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}
              >
                {uploading ? "업로드 중..." : "🖼 이미지 첨부"}
              </button>
              <input ref={fileInputRef} type="file" multiple accept="image/*" style={{ display: "none" }} onChange={handleFileChange} />
            </div>
            <button
              onClick={handleSubmitComment}
              disabled={submitting || uploading}
              style={{ padding: "10px 24px", borderRadius: 12, border: "none", background: submitting ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: submitting ? "not-allowed" : "pointer" }}
            >
              {submitting ? "등록 중..." : "답변 등록"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function CommentCard({
  comment, subComments, isOwner, myUserId, isAdmin,
  postClosed, onPickBest, picking,
  replyToId, onReplyToggle, replyContent, onReplyChange, onReplySubmit, replySubmitting,
  editingCommentId, editCommentContent,
  onEditStart, onEditSave, onEditCancel, onEditChange,
  onDeleteRequest, savingComment, mentorUserIdMap,
}: {
  comment: Comment;
  subComments: Comment[];
  isOwner: boolean;
  myUserId: string | null;
  isAdmin: boolean;
  postClosed: boolean;
  onPickBest: () => void;
  picking: boolean;
  replyToId: string | null;
  onReplyToggle: (id: string | null) => void;
  replyContent: string;
  onReplyChange: (v: string) => void;
  onReplySubmit: (parentId: string) => void;
  replySubmitting: boolean;
  editingCommentId: string | null;
  editCommentContent: string;
  onEditStart: (id: string, content: string) => void;
  onEditSave: (id: string) => void;
  onEditCancel: () => void;
  onEditChange: (v: string) => void;
  onDeleteRequest: (id: string) => void;
  savingComment: boolean;
  mentorUserIdMap: Record<string, string>;
}) {
  const isReplying = replyToId === comment.id;
  const isMyComment = myUserId === comment.user_id;
  const canManage = isMyComment || isAdmin;
  const isEditing = editingCommentId === comment.id;

  return (
    <div style={{
      background: comment.is_best_answer ? "#fffbeb" : "white",
      border: `1px solid ${comment.is_best_answer ? GOLD + "66" : "#e5e7eb"}`,
      borderRadius: 16, padding: "18px 20px", marginBottom: 12,
      overflow: "hidden", maxWidth: "100%",
    }}>
      {comment.is_best_answer && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: GOLD, color: "white", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
          ⭐ 채택된 답변
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Avatar url={comment.profiles?.avatar_url} size={28} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
            <MentorNickname
              mentorId={mentorUserIdMap[comment.user_id] ?? ""}
              nickname={comment.profiles?.nickname ?? "익명"}
              isMentor={!!mentorUserIdMap[comment.user_id]}
            />
          </span>
          {comment.profiles?.grade && <GradeBadge grade={comment.profiles.grade as Grade} size="sm" />}
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{timeAgo(comment.created_at)}</span>
        </div>
        {/* 수정/삭제 버튼 */}
        {canManage && !isEditing && (
          <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => onEditStart(comment.id, comment.content)}
              style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}
            >
              수정
            </button>
            <button
              onClick={() => onDeleteRequest(comment.id)}
              style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "none", borderRadius: 6, padding: "3px 9px", cursor: "pointer" }}
            >
              삭제
            </button>
          </div>
        )}
      </div>

      {isEditing ? (
        <div style={{ marginBottom: 12 }}>
          <textarea
            value={editCommentContent}
            onChange={(e) => onEditChange(e.target.value)}
            autoFocus
            rows={4}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", lineHeight: 1.6, marginBottom: 8 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button
              onClick={onEditCancel}
              style={{ fontSize: 12, color: "#6b7280", background: "white", border: "1px solid #d1d5db", borderRadius: 8, padding: "5px 12px", cursor: "pointer", fontWeight: 700 }}
            >
              취소
            </button>
            <button
              onClick={() => onEditSave(comment.id)}
              disabled={savingComment}
              style={{ fontSize: 12, fontWeight: 800, color: "white", background: savingComment ? "#d1d5db" : "#111827", border: "none", borderRadius: 8, padding: "5px 16px", cursor: savingComment ? "not-allowed" : "pointer" }}
            >
              {savingComment ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>
      ) : (
        <>
          <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all", overflowWrap: "break-word", overflow: "hidden", maxWidth: "100%" }}>{comment.content}</p>
          {comment.files.length > 0 && <FilesBlock files={comment.files} marginBottom={12} />}
        </>
      )}

      {/* 대댓글 목록 */}
      {subComments.length > 0 && (
        <div style={{ marginTop: 12, borderLeft: "2px solid #e5e7eb", paddingLeft: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {subComments.map((sc) => {
            const isMySubComment = myUserId === sc.user_id;
            const canManageSub = isMySubComment || isAdmin;
            const isEditingSub = editingCommentId === sc.id;
            return (
              <div key={sc.id}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Avatar url={sc.profiles?.avatar_url} size={22} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                      <MentorNickname
                        mentorId={mentorUserIdMap[sc.user_id] ?? ""}
                        nickname={sc.profiles?.nickname ?? "익명"}
                        isMentor={!!mentorUserIdMap[sc.user_id]}
                      />
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(sc.created_at)}</span>
                  </div>
                  {canManageSub && !isEditingSub && (
                    <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                      <button
                        onClick={() => onEditStart(sc.id, sc.content)}
                        style={{ fontSize: 10, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 5, padding: "2px 7px", cursor: "pointer" }}
                      >
                        수정
                      </button>
                      <button
                        onClick={() => onDeleteRequest(sc.id)}
                        style={{ fontSize: 10, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "none", borderRadius: 5, padding: "2px 7px", cursor: "pointer" }}
                      >
                        삭제
                      </button>
                    </div>
                  )}
                </div>
                {isEditingSub ? (
                  <div style={{ paddingLeft: 28, marginBottom: 4 }}>
                    <textarea
                      value={editCommentContent}
                      onChange={(e) => onEditChange(e.target.value)}
                      autoFocus
                      rows={3}
                      style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", marginBottom: 6 }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                      <button
                        onClick={onEditCancel}
                        style={{ fontSize: 11, color: "#6b7280", background: "white", border: "1px solid #d1d5db", borderRadius: 7, padding: "4px 10px", cursor: "pointer", fontWeight: 700 }}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => onEditSave(sc.id)}
                        disabled={savingComment}
                        style={{ fontSize: 11, fontWeight: 800, color: "white", background: savingComment ? "#d1d5db" : "#111827", border: "none", borderRadius: 7, padding: "4px 12px", cursor: savingComment ? "not-allowed" : "pointer" }}
                      >
                        {savingComment ? "저장 중..." : "저장"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-all", overflowWrap: "break-word", overflow: "hidden", maxWidth: "100%", paddingLeft: 28 }}>{sc.content}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 액션 버튼 */}
      {!isEditing && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          {isOwner && !isMyComment && !comment.is_best_answer && !postClosed && (
            <button
              onClick={onPickBest}
              disabled={picking}
              style={{ fontSize: 12, fontWeight: 800, color: GOLD, background: GOLD + "15", border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "5px 12px", cursor: picking ? "not-allowed" : "pointer" }}
            >
              채택하기
            </button>
          )}
          {isOwner && (
            <button
              onClick={() => onReplyToggle(isReplying ? null : comment.id)}
              style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
            >
              💬 {isReplying ? "취소" : "댓글 달기"}
            </button>
          )}
        </div>
      )}

      {/* 대댓글 입력창 */}
      {isReplying && (
        <div style={{ marginTop: 10, borderLeft: "2px solid #e5e7eb", paddingLeft: 16 }}>
          <textarea
            value={replyContent}
            onChange={(e) => onReplyChange(e.target.value)}
            placeholder="답변자에게 추가 질문을 작성하세요..."
            rows={3}
            autoFocus
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical", marginBottom: 8 }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={() => onReplyToggle(null)}
              style={{ fontSize: 12, color: "#6b7280", background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}
            >
              취소
            </button>
            <button
              onClick={() => onReplySubmit(comment.id)}
              disabled={replySubmitting}
              style={{ fontSize: 12, fontWeight: 800, color: "white", background: replySubmitting ? "#d1d5db" : "#111827", border: "none", borderRadius: 8, padding: "5px 16px", cursor: replySubmitting ? "not-allowed" : "pointer" }}
            >
              {replySubmitting ? "등록 중..." : "댓글 등록"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FilesBlock({ files, marginBottom }: { files: FileItem[]; marginBottom?: number }) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const handleDownloadAll = async () => {
    for (const file of files) {
      try {
        const response = await fetch(file.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.url.split("/").pop() || "file";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error("다운로드 실패:", e);
      }
    }
  };

  return (
    <div style={{ marginBottom, overflow: "hidden", maxWidth: "100%", wordBreak: "break-all", overflowWrap: "break-word" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10, maxWidth: "100%", overflow: "hidden", wordBreak: "break-all", overflowWrap: "break-word" }}>
        {files.map((f, i) => <FileAttachment key={i} file={f} onImageClick={setSelectedImage} />)}
      </div>
      <button
        onClick={(e) => { e.preventDefault(); handleDownloadAll(); }}
        style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, background: "white", cursor: "pointer", color: "#374151" }}
      >
        ⬇ 전체 다운로드 ({files.length}개)
      </button>
      {selectedImage && (
        <div
          onClick={() => setSelectedImage(null)}
          style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <button
            onClick={() => setSelectedImage(null)}
            style={{ position: "absolute", top: 20, right: 20, background: "none", border: "none", color: "white", fontSize: 32, cursor: "pointer", lineHeight: 1 }}
          >
            ×
          </button>
          <img
            src={selectedImage}
            onClick={(e) => e.stopPropagation()}
            alt="preview"
            style={{ maxWidth: "90vw", maxHeight: "90vh", borderRadius: 8, objectFit: "contain" }}
          />
        </div>
      )}
    </div>
  );
}

function FileAttachment({ file, onImageClick }: { file: FileItem; onImageClick?: (url: string) => void }) {
  const IMAGE_EXTS = ["jpg","jpeg","png","webp","gif"];
  const urlExt = file.url.split("?")[0].split(".").pop()?.toLowerCase() ?? "";
  const isImage = IMAGE_EXTS.includes(file.ext) || IMAGE_EXTS.includes(urlExt);
  if (isImage) {
    return (
      <img
        src={file.url}
        alt={file.name}
        onClick={() => onImageClick?.(file.url)}
        style={{ height: 80, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "cover", cursor: "pointer" }}
      />
    );
  }
  return (
    <a
      href={file.url}
      download={file.url.split("/").pop() ?? file.name}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f3f4f6", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#374151", textDecoration: "none" }}
    >
      📎 {file.name}
    </a>
  );
}

function StatusBadge({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color, background: bg, padding: "2px 8px", borderRadius: 6 }}>{label}</span>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <img src={url} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
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
