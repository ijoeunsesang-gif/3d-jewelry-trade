"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { showError, showSuccess } from "@/lib/toast";

type CommentProfile = { nickname: string | null; avatar_url: string | null };

type Comment = {
  id: string;
  model_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes: number;
  created_at: string;
  updated_at: string;
  profiles: CommentProfile | null;
};

type Props = {
  modelId: string;
  currentUserId: string | null;
  isAdmin: boolean;
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금 전";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}

export default function ModelComments({ modelId, currentUserId, isAdmin }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [myLikedIds, setMyLikedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const [newText, setNewText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  const replyRef = useRef<HTMLTextAreaElement>(null);
  const editRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadComments();
  }, [modelId]);

  useEffect(() => {
    if (replyingToId && replyRef.current) replyRef.current.focus();
  }, [replyingToId]);

  useEffect(() => {
    if (editingId && editRef.current) editRef.current.focus();
  }, [editingId]);

  async function loadComments() {
    setLoading(true);
    const { data, error } = await supabase
      .from("model_comments")
      .select("*, profiles(nickname, avatar_url)")
      .eq("model_id", modelId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("댓글 불러오기 실패:", error);
      setLoading(false);
      return;
    }

    const list = (data || []) as Comment[];
    setComments(list);

    if (currentUserId && list.length > 0) {
      const ids = list.map((c) => c.id);
      const { data: likes } = await supabase
        .from("model_comment_likes")
        .select("comment_id")
        .eq("user_id", currentUserId)
        .in("comment_id", ids);
      setMyLikedIds(new Set((likes || []).map((l: any) => l.comment_id)));
    }

    setLoading(false);
  }

  async function submitComment() {
    if (!currentUserId) { showError("로그인 후 댓글을 작성할 수 있습니다."); return; }
    const text = newText.trim();
    if (!text) return;

    setSubmitting(true);
    const { error } = await supabase.from("model_comments").insert({
      model_id: modelId,
      user_id: currentUserId,
      content: text,
    });

    if (error) {
      showError("댓글 작성에 실패했습니다.");
      console.error(error);
    } else {
      setNewText("");
      await loadComments();
      showSuccess("댓글이 등록되었습니다.");
    }
    setSubmitting(false);
  }

  async function submitReply(parentId: string) {
    if (!currentUserId) { showError("로그인 후 답글을 작성할 수 있습니다."); return; }
    const text = replyText.trim();
    if (!text) return;

    setReplySubmitting(true);
    const { error } = await supabase.from("model_comments").insert({
      model_id: modelId,
      user_id: currentUserId,
      parent_id: parentId,
      content: text,
    });

    if (error) {
      showError("답글 작성에 실패했습니다.");
      console.error(error);
    } else {
      setReplyText("");
      setReplyingToId(null);
      await loadComments();
    }
    setReplySubmitting(false);
  }

  async function submitEdit(commentId: string) {
    const text = editText.trim();
    if (!text) return;

    setEditSubmitting(true);
    const { error } = await supabase
      .from("model_comments")
      .update({ content: text, updated_at: new Date().toISOString() })
      .eq("id", commentId);

    if (error) {
      showError("댓글 수정에 실패했습니다.");
      console.error(error);
    } else {
      setEditingId(null);
      setEditText("");
      await loadComments();
    }
    setEditSubmitting(false);
  }

  async function deleteComment(commentId: string) {
    if (!confirm("댓글을 삭제하시겠습니까?")) return;

    const { error } = await supabase.from("model_comments").delete().eq("id", commentId);
    if (error) {
      showError("댓글 삭제에 실패했습니다.");
      console.error(error);
    } else {
      await loadComments();
    }
  }

  async function toggleLike(commentId: string) {
    if (!currentUserId) { showError("로그인 후 좋아요를 누를 수 있습니다."); return; }

    if (myLikedIds.has(commentId)) {
      await supabase
        .from("model_comment_likes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", currentUserId);
      await supabase.rpc("decrement_comment_likes", { cid: commentId });
      setMyLikedIds((prev) => { const s = new Set(prev); s.delete(commentId); return s; });
      setComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, likes: Math.max(0, c.likes - 1) } : c)
      );
    } else {
      await supabase
        .from("model_comment_likes")
        .insert({ comment_id: commentId, user_id: currentUserId });
      await supabase.rpc("increment_comment_likes", { cid: commentId });
      setMyLikedIds((prev) => new Set([...prev, commentId]));
      setComments((prev) =>
        prev.map((c) => c.id === commentId ? { ...c, likes: c.likes + 1 } : c)
      );
    }
  }

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap: Record<string, Comment[]> = {};
  for (const c of comments) {
    if (c.parent_id) {
      if (!repliesMap[c.parent_id]) repliesMap[c.parent_id] = [];
      repliesMap[c.parent_id].push(c);
    }
  }

  function renderComment(c: Comment, isReply = false) {
    const isOwn = currentUserId === c.user_id;
    const canDelete = isOwn || isAdmin;
    const isLiked = myLikedIds.has(c.id);
    const isEditing = editingId === c.id;
    const isReplying = replyingToId === c.id;

    return (
      <div
        key={c.id}
        style={{
          paddingLeft: isReply ? 48 : 0,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: isReply ? "#f8fafc" : "white",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: "14px 18px",
          }}
        >
          {/* 헤더 */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
            <img
              src={c.profiles?.avatar_url || "/default-avatar.png"}
              alt="avatar"
              style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb", flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>
                {c.profiles?.nickname || "익명"}
              </span>
              <span style={{ marginLeft: 8, fontSize: 12, color: "#9ca3af" }}>
                {timeAgo(c.created_at)}
                {c.updated_at !== c.created_at && " (수정됨)"}
              </span>
            </div>
            {canDelete && (
              <button
                type="button"
                onClick={() => deleteComment(c.id)}
                style={{ background: "none", border: "none", color: "#ef4444", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "2px 6px", borderRadius: 6 }}
              >
                삭제
              </button>
            )}
            {isOwn && (
              <button
                type="button"
                onClick={() => {
                  if (editingId === c.id) {
                    setEditingId(null);
                    setEditText("");
                  } else {
                    setEditingId(c.id);
                    setEditText(c.content);
                    setReplyingToId(null);
                  }
                }}
                style={{ background: "none", border: "none", color: "#6b7280", fontSize: 12, fontWeight: 700, cursor: "pointer", padding: "2px 6px", borderRadius: 6 }}
              >
                {editingId === c.id ? "취소" : "수정"}
              </button>
            )}
          </div>

          {/* 본문 */}
          {isEditing ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <textarea
                ref={editRef}
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={3}
                style={{ width: "100%", borderRadius: 10, border: "1px solid #d1d5db", padding: "10px 14px", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setEditText(""); }}
                  style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => submitEdit(c.id)}
                  disabled={editSubmitting || !editText.trim()}
                  style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: editSubmitting ? 0.6 : 1 }}
                >
                  {editSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {c.content}
            </p>
          )}

          {/* 액션 버튼 */}
          {!isEditing && (
            <div style={{ display: "flex", gap: 12, marginTop: 10, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => toggleLike(c.id)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  background: "none", border: "none",
                  color: isLiked ? "#ef4444" : "#9ca3af",
                  fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0,
                }}
              >
                {isLiked ? "❤️" : "🤍"} {c.likes}
              </button>
              {!isReply && currentUserId && (
                <button
                  type="button"
                  onClick={() => {
                    if (replyingToId === c.id) {
                      setReplyingToId(null);
                      setReplyText("");
                    } else {
                      setReplyingToId(c.id);
                      setReplyText("");
                      setEditingId(null);
                    }
                  }}
                  style={{ background: "none", border: "none", color: "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer", padding: 0 }}
                >
                  💬 답글
                </button>
              )}
            </div>
          )}
        </div>

        {/* 답글 작성폼 */}
        {isReplying && (
          <div style={{ marginTop: 8, paddingLeft: 4 }}>
            <textarea
              ref={replyRef}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="답글을 입력하세요..."
              rows={2}
              style={{ width: "100%", borderRadius: 10, border: "1px solid #d1d5db", padding: "10px 14px", fontSize: 14, resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => { setReplyingToId(null); setReplyText(""); }}
                style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => submitReply(c.id)}
                disabled={replySubmitting || !replyText.trim()}
                style={{ height: 36, padding: "0 16px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", opacity: replySubmitting ? 0.6 : 1 }}
              >
                {replySubmitting ? "등록 중..." : "답글 등록"}
              </button>
            </div>
          </div>
        )}

        {/* 대댓글 목록 */}
        {!isReply && repliesMap[c.id]?.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {repliesMap[c.id].map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section style={{ marginTop: 56 }}>
      <h2
        style={{
          fontSize: 22,
          fontWeight: 900,
          color: "#111827",
          margin: "0 0 24px",
        }}
      >
        댓글 {comments.length}개
      </h2>

      {/* 새 댓글 작성폼 */}
      {currentUserId ? (
        <div
          style={{
            background: "white",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: "16px 18px",
            marginBottom: 28,
          }}
        >
          <textarea
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="댓글을 입력하세요..."
            rows={3}
            style={{
              width: "100%",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              padding: "10px 14px",
              fontSize: 14,
              resize: "vertical",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
            <button
              type="button"
              onClick={submitComment}
              disabled={submitting || !newText.trim()}
              style={{
                height: 40,
                padding: "0 22px",
                borderRadius: 10,
                border: "none",
                background: "#111827",
                color: "white",
                fontSize: 14,
                fontWeight: 800,
                cursor: submitting || !newText.trim() ? "not-allowed" : "pointer",
                opacity: submitting || !newText.trim() ? 0.5 : 1,
              }}
            >
              {submitting ? "등록 중..." : "댓글 등록"}
            </button>
          </div>
        </div>
      ) : (
        <div
          style={{
            background: "#f8fafc",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: "18px 24px",
            marginBottom: 28,
            color: "#6b7280",
            fontSize: 14,
            fontWeight: 700,
            textAlign: "center",
          }}
        >
          로그인 후 댓글을 작성할 수 있습니다.
        </div>
      )}

      {/* 댓글 목록 */}
      {loading ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>댓글을 불러오는 중...</p>
      ) : topLevel.length === 0 ? (
        <p style={{ color: "#9ca3af", fontSize: 14 }}>아직 댓글이 없습니다. 첫 댓글을 남겨보세요!</p>
      ) : (
        <div>{topLevel.map((c) => renderComment(c))}</div>
      )}
    </section>
  );
}
