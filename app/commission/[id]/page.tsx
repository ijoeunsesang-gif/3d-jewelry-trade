"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";

const GOLD = "#c9a84c";

const STATUS_LABEL: Record<string, string> = {
  open: "의뢰중",
  in_progress: "작업중",
  completed: "완료",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#2563eb", in_progress: "#d97706", completed: "#16a34a",
};
const STATUS_BG: Record<string, string> = {
  open: "#dbeafe", in_progress: "#fef3c7", completed: "#dcfce7",
};

type Commission = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  images: string[];
  status: string;
  result_link: string | null;
  created_at: string;
  nickname: string;
};

type Comment = {
  id: string;
  commission_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { nickname: string | null } | { nickname: string | null }[] | null;
};

export default function CommissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [editResultLink, setEditResultLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);

  // 댓글
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const uid = (decodeJwt(token) as any)?.sub as string;
      setMyId(uid);
      supabase
        .from("profiles")
        .select("role")
        .eq("id", uid)
        .single()
        .then(({ data }) => { setIsSeller(data?.role === "seller"); });
    }
    fetchCommission();
    fetchComments();
  }, [id]);

  const fetchCommission = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commissions")
        .select("id, user_id, title, description, images, status, result_link, created_at")
        .eq("id", id)
        .single();

      if (error || !data) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("nickname")
        .eq("id", data.user_id)
        .single();

      const c: Commission = { ...data, nickname: profile?.nickname || "익명" };
      setCommission(c);
      setEditResultLink(c.result_link || "");
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const { data } = await supabase
        .from("commission_comments")
        .select("id, commission_id, user_id, content, created_at, profiles(nickname)")
        .eq("commission_id", id)
        .order("created_at", { ascending: false });
      setComments((data as Comment[]) || []);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!commission) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("commissions")
        .update({
          result_link: editResultLink.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", commission.id);

      if (error) throw error;
      setCommission((prev) =>
        prev ? { ...prev, result_link: editResultLink.trim() || null } : prev
      );
      setLinkPanelOpen(false);
      showSuccess("저장되었습니다.");
    } catch (e: any) {
      showError(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!commission || !confirm("정말 삭제하시겠습니까?")) return;
    setDeleting(true);
    const { error } = await supabase.from("commissions").delete().eq("id", commission.id);
    if (error) { showError("삭제 실패"); setDeleting(false); return; }
    router.push("/commission");
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !myId) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase.from("commission_comments").insert({
        commission_id: id,
        user_id: myId,
        content: commentText.trim(),
      });
      if (error) throw error;
      setCommentText("");
      await fetchComments();
    } catch (e: any) {
      showError(e.message || "댓글 등록 실패");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from("commission_comments").delete().eq("id", commentId);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ height: 28, background: "#f3f4f6", borderRadius: 8, marginBottom: 20, width: "55%" }} />
        <div style={{ height: 360, background: "#f3f4f6", borderRadius: 14, marginBottom: 16 }} />
        <div style={{ height: 120, background: "#f3f4f6", borderRadius: 14 }} />
      </div>
    );
  }

  if (!commission) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 20px", textAlign: "center", fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😢</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>의뢰를 찾을 수 없습니다</div>
        <Link href="/commission" style={{ display: "inline-block", marginTop: 20, color: GOLD, textDecoration: "none", fontWeight: 700 }}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const isAuthor = myId === commission.user_id;

  return (
    <div style={{
      maxWidth: 800, margin: "0 auto",
      padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 뒤로가기 */}
      <Link href="/commission" style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        color: "#6b7280", textDecoration: "none", fontSize: 14, marginBottom: 24,
      }}>
        ← 목록으로
      </Link>

      {/* 헤더: 제목+작성자 (왼쪽) | 판매자 버튼 (오른쪽) */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.35, flex: 1 }}>
              {commission.title}
            </h1>
            <span style={{
              flexShrink: 0, fontSize: 12, fontWeight: 700,
              color: STATUS_COLOR[commission.status] || "#374151",
              background: STATUS_BG[commission.status] || "#f3f4f6",
              padding: "4px 12px", borderRadius: 999,
            }}>
              {STATUS_LABEL[commission.status] || commission.status}
            </span>
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 13, color: "#6b7280" }}>
            <span>{commission.nickname}</span>
            <span>·</span>
            <span>{formatDate(commission.created_at)}</span>
          </div>
        </div>
        {isSeller && (
          <button
            type="button"
            onClick={() => setLinkPanelOpen((p) => !p)}
            style={{
              flexShrink: 0, border: "1px solid #d1d5db", borderRadius: 10,
              padding: "8px 16px", background: "white",
              fontSize: 13, fontWeight: 700, cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            🔗 결과물 링크 등록
          </button>
        )}
      </div>

      {/* 판매자 링크 입력 패널 (토글) */}
      {isSeller && linkPanelOpen && (
        <div style={{
          border: "1px solid #e5e7eb", borderRadius: 12,
          padding: "16px", marginBottom: 20, background: "#fafafa",
        }}>
          <input
            type="url"
            value={editResultLink}
            onChange={(e) => setEditResultLink(e.target.value)}
            placeholder="https://..."
            style={{
              height: 44, borderRadius: 10, border: "1px solid #d1d5db",
              padding: "0 12px", fontSize: 14, width: "100%",
              boxSizing: "border-box", outline: "none",
            }}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              style={{
                height: 38, padding: "0 20px", borderRadius: 10, border: "none",
                background: saving ? "#d1d5db" : GOLD,
                color: "white", fontSize: 13, fontWeight: 700,
                cursor: saving ? "not-allowed" : "pointer",
              }}
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => setLinkPanelOpen(false)}
              style={{
                height: 38, padding: "0 16px", borderRadius: 10,
                border: "1px solid #d1d5db", background: "white",
                fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#374151",
              }}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 이미지 갤러리 */}
      {commission.images && commission.images.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{
            width: "100%", aspectRatio: "16/9", borderRadius: 14,
            overflow: "hidden", background: "#f8fafc", marginBottom: 10,
          }}>
            <img
              src={commission.images[selectedImage]}
              alt={commission.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          </div>
          {commission.images.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {commission.images.map((img, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  style={{
                    width: 64, height: 64, borderRadius: 8, overflow: "hidden",
                    cursor: "pointer", flexShrink: 0,
                    border: selectedImage === i ? `2px solid ${GOLD}` : "2px solid transparent",
                    transition: "border-color 0.15s",
                  }}
                >
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          width: "100%", aspectRatio: "16/9", borderRadius: 14,
          background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center",
          color: "#d1d5db", fontSize: 48, marginBottom: 28,
        }}>
          📋
        </div>
      )}

      {/* 설명 */}
      {commission.description && (
        <div style={{
          background: "#f8fafc", borderRadius: 14, padding: "18px 20px",
          fontSize: 14, color: "#374151", lineHeight: 1.8,
          marginBottom: 28, whiteSpace: "pre-wrap",
        }}>
          {commission.description}
        </div>
      )}

      {/* 결과물 링크 (모든 유저에게 표시) */}
      {commission.result_link && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>결과물</div>
          <a
            href={commission.result_link}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              padding: "10px 18px", borderRadius: 10,
              background: "#111827", color: "white",
              textDecoration: "none", fontSize: 13, fontWeight: 700,
            }}
          >
            결과물 보기 →
          </a>
        </div>
      )}

      {/* 작성자 삭제 버튼 */}
      {isAuthor && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 36 }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            style={{
              padding: "8px 18px", borderRadius: 8,
              border: "1px solid #fca5a5", background: "white",
              color: "#dc2626", fontSize: 13, fontWeight: 700,
              cursor: deleting ? "not-allowed" : "pointer",
            }}
          >
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      )}

      {/* 댓글 섹션 */}
      <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>
          댓글 {comments.length}개
        </div>

        {/* 댓글 입력 */}
        {myId ? (
          <div style={{ marginBottom: 24 }}>
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="댓글을 입력하세요"
              rows={3}
              style={{
                width: "100%", borderRadius: 12, border: "1px solid #d1d5db",
                padding: "12px", fontSize: 14, resize: "vertical",
                boxSizing: "border-box", outline: "none",
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button
                type="button"
                onClick={handleAddComment}
                disabled={submittingComment || !commentText.trim()}
                style={{
                  height: 38, padding: "0 20px", borderRadius: 10, border: "none",
                  background: submittingComment || !commentText.trim() ? "#d1d5db" : "#111827",
                  color: "white", fontSize: 13, fontWeight: 700,
                  cursor: submittingComment || !commentText.trim() ? "not-allowed" : "pointer",
                }}
              >
                {submittingComment ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            padding: "14px 16px", borderRadius: 12, background: "#f8fafc",
            fontSize: 13, color: "#6b7280", marginBottom: 24,
          }}>
            댓글을 작성하려면 로그인이 필요합니다.
          </div>
        )}

        {/* 댓글 목록 */}
        {commentsLoading ? (
          <div style={{ color: "#6b7280", fontSize: 14 }}>불러오는 중...</div>
        ) : comments.length === 0 ? (
          <div style={{ color: "#9ca3af", fontSize: 14 }}>아직 댓글이 없습니다.</div>
        ) : (
          <div>
            {comments.map((comment) => (
              <div
                key={comment.id}
                style={{ borderBottom: "1px solid #f3f4f6", padding: "12px 0" }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                    {(Array.isArray(comment.profiles)
                      ? comment.profiles[0]?.nickname
                      : comment.profiles?.nickname) || "익명"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>
                      {formatDate(comment.created_at)}
                    </span>
                    {myId === comment.user_id && (
                      <button
                        type="button"
                        onClick={() => handleDeleteComment(comment.id)}
                        style={{
                          background: "none", border: "none", padding: 0,
                          color: "#d1d5db", fontSize: 11, cursor: "pointer",
                          fontWeight: 700,
                        }}
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 14, color: "#374151", marginTop: 4, whiteSpace: "pre-wrap" }}>
                  {comment.content}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
