"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

const GOLD = "#c9a84c";

type JobPost = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_recruiting: boolean;
  contact: string | null;
  is_closed: boolean;
  created_at: string;
  nickname: string;
};

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [post, setPost] = useState<JobPost | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 편집 모드
  const [editMode, setEditMode] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editSubmitting, setEditSubmitting] = useState(false);

  // 삭제 모달
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  // 마감 모달
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closeSubmitting, setCloseSubmitting] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const uid = (decodeJwt(token) as any)?.sub as string;
      setMyId(uid);
      supabase.from("profiles").select("role").eq("id", uid).single()
        .then(({ data }) => setMyRole(data?.role || "user"));
    }
    fetchPost();
  }, []);

  const fetchPost = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_posts")
      .select("*, profiles(nickname)")
      .eq("id", id)
      .single();

    if (!error && data) {
      setPost({ ...data, nickname: (data.profiles as any)?.nickname || "익명" });
    }
    setLoading(false);
  };

  const handleEditSave = async () => {
    if (!editTitle.trim() || !editContent.trim() || editSubmitting) return;
    setEditSubmitting(true);

    const { error } = await supabase
      .from("job_posts")
      .update({
        title: editTitle.trim(),
        content: editContent.trim(),
        contact: editContact.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (!error) {
      await fetchPost();
      setEditMode(false);
    } else {
      alert("수정에 실패했습니다.");
    }
    setEditSubmitting(false);
  };

  const handleDelete = async () => {
    if (deleteSubmitting) return;
    setDeleteSubmitting(true);

    const { error } = await supabase.from("job_posts").delete().eq("id", id);
    if (!error) {
      router.push("/jobs");
    } else {
      alert("삭제에 실패했습니다.");
      setDeleteSubmitting(false);
      setShowDeleteModal(false);
    }
  };

  const handleClose = async () => {
    if (closeSubmitting) return;
    setCloseSubmitting(true);

    const { error } = await supabase
      .from("job_posts")
      .update({ is_closed: true, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      await fetchPost();
      setShowCloseModal(false);
    } else {
      alert("마감 처리에 실패했습니다.");
    }
    setCloseSubmitting(false);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  if (loading) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "60px 20px", textAlign: "center", color: "#9ca3af" }}>
        불러오는 중...
      </main>
    );
  }

  if (!post) {
    return (
      <main style={{ maxWidth: 760, margin: "0 auto", padding: "60px 20px", textAlign: "center" }}>
        <p style={{ color: "#6b7280" }}>게시글을 찾을 수 없습니다.</p>
        <Link href="/jobs" style={{ color: GOLD, fontWeight: 700 }}>목록으로</Link>
      </main>
    );
  }

  const canEdit = myId === post.user_id || myRole === "admin";

  return (
    <main style={{
      maxWidth: 760, margin: "0 auto", padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 삭제 확인 모달 */}
      {showDeleteModal && (
        <div
          onClick={() => !deleteSubmitting && setShowDeleteModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 380 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 900, color: "#111827" }}>게시글 삭제</h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
              정말 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowDeleteModal(false)} disabled={deleteSubmitting} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #d1d5db", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151" }}>취소</button>
              <button onClick={handleDelete} disabled={deleteSubmitting} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: deleteSubmitting ? "#e5e7eb" : "#ef4444", color: deleteSubmitting ? "#9ca3af" : "white", fontSize: 14, fontWeight: 800, cursor: deleteSubmitting ? "not-allowed" : "pointer" }}>
                {deleteSubmitting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 마감 확인 모달 */}
      {showCloseModal && (
        <div
          onClick={() => !closeSubmitting && setShowCloseModal(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 16px" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: "28px 24px", width: "100%", maxWidth: 380 }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 900, color: "#111827" }}>마감 처리</h3>
            <p style={{ margin: "0 0 24px", fontSize: 14, color: "#6b7280", lineHeight: 1.6 }}>
              이 글을 마감하시겠습니까?<br />마감 후에는 목록에서 흐리게 표시됩니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowCloseModal(false)} disabled={closeSubmitting} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #d1d5db", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151" }}>취소</button>
              <button onClick={handleClose} disabled={closeSubmitting} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: closeSubmitting ? "#e5e7eb" : "#111827", color: closeSubmitting ? "#9ca3af" : GOLD, fontSize: 14, fontWeight: 800, cursor: closeSubmitting ? "not-allowed" : "pointer" }}>
                {closeSubmitting ? "처리 중..." : "마감"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/jobs" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 15, fontWeight: 700, color: "#374151", textDecoration: "none", marginBottom: 20 }}>
        ← 목록으로
      </Link>

      <div style={{ background: "white", borderRadius: 20, border: "1px solid #e5e7eb", padding: "28px 24px" }}>
        {/* 뱃지 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {post.is_closed && (
            <span style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", background: "#f3f4f6", border: "1px solid #d1d5db", padding: "3px 10px", borderRadius: 999 }}>마감</span>
          )}
          <span style={{
            fontSize: 12, fontWeight: 800,
            color: post.is_recruiting ? "#1d4ed8" : "#92400e",
            background: post.is_recruiting ? "#dbeafe" : "#fef3c7",
            padding: "3px 10px", borderRadius: 999,
          }}>{post.is_recruiting ? "구인" : "구직"}</span>
        </div>

        {editMode ? (
          /* 편집 모드 */
          <div>
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              maxLength={100}
              style={{ width: "100%", height: 48, borderRadius: 12, border: "1.5px solid #e5e7eb", padding: "0 14px", fontSize: 18, fontWeight: 700, outline: "none", boxSizing: "border-box", marginBottom: 14 }}
            />
            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={10}
              style={{ width: "100%", borderRadius: 12, border: "1.5px solid #e5e7eb", padding: "12px 14px", fontSize: 15, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7, marginBottom: 14 }}
            />
            <input
              value={editContact}
              onChange={(e) => setEditContact(e.target.value)}
              placeholder="연락처 (선택)"
              style={{ width: "100%", height: 44, borderRadius: 12, border: "1.5px solid #e5e7eb", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setEditMode(false)} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #d1d5db", background: "white", fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151" }}>취소</button>
              <button onClick={handleEditSave} disabled={!editTitle.trim() || !editContent.trim() || editSubmitting} style={{ flex: 2, height: 44, borderRadius: 12, border: "none", background: "#111827", color: GOLD, fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
                {editSubmitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        ) : (
          /* 읽기 모드 */
          <>
            <h1 style={{ margin: "0 0 14px", fontSize: 20, fontWeight: 900, color: "#111827" }}>{post.title}</h1>

            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20, display: "flex", gap: 14, flexWrap: "wrap" }}>
              <span>🙋 {post.nickname}</span>
              <span>{formatDate(post.created_at)}</span>
            </div>

            <p style={{ margin: "0 0 20px", fontSize: 15, color: "#374151", lineHeight: 1.9, whiteSpace: "pre-line" }}>{post.content}</p>

            {post.contact && (
              <div style={{ background: "#f9fafb", borderRadius: 12, padding: "12px 16px", marginBottom: 20, border: "1px solid #e5e7eb" }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>📞 연락처: </span>
                <span style={{ fontSize: 13, color: "#374151" }}>{post.contact}</span>
              </div>
            )}

            {canEdit && (
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => { setEditTitle(post.title); setEditContent(post.content); setEditContact(post.contact || ""); setEditMode(true); }}
                  style={{ padding: "7px 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
                >
                  수정
                </button>
                {!post.is_closed && (
                  <button onClick={() => setShowCloseModal(true)} style={{ padding: "7px 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#6b7280", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>마감</button>
                )}
                <button onClick={() => setShowDeleteModal(true)} style={{ padding: "7px 16px", borderRadius: 10, border: "1px solid #fecaca", background: "white", color: "#ef4444", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>삭제</button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
