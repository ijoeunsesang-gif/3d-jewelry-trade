"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import GradeBadge from "../../components/GradeBadge";
import { Grade } from "@/lib/grades";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";

const GOLD = "#c9a84c";

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
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

export default function CadPostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [commentContent, setCommentContent] = useState("");
  const [commentFiles, setCommentFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [picking, setPicking] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      setMyUserId(payload?.sub ?? null);
    }
    loadPost();
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
      .select("id, content, files, is_best_answer, point_reward, created_at, user_id, profiles(nickname, avatar_url, grade)")
      .eq("post_id", id)
      .order("is_best_answer", { ascending: false })
      .order("created_at", { ascending: true });

    setComments((commentData ?? []) as unknown as Comment[]);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
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
      showSuccess("답변이 등록되었습니다! (+5P)");
      setCommentContent("");
      setCommentFiles([]);
      loadPost();
    }
    setSubmitting(false);
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
    else { showSuccess("채택되었습니다! 답변자에게 +20P가 지급되었습니다."); loadPost(); }
    setPicking(false);
  };

  if (loading) {
    return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  }
  if (!post) return null;

  const isOwner = myUserId === post.user_id;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</span>
      </div>

      {/* 질문 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px 24px 20px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              {post.status === "closed"
                ? <StatusBadge color="#6b7280" bg="#f3f4f6" label="마감" />
                : <StatusBadge color="#16a34a" bg="#dcfce7" label="진행중" />
              }
            </div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827", lineHeight: 1.3 }}>{post.title}</h1>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Avatar url={post.profiles?.avatar_url} size={28} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{post.profiles?.nickname ?? "익명"}</span>
          {post.profiles?.grade && <GradeBadge grade={post.profiles.grade as Grade} size="sm" />}
          <span style={{ fontSize: 12, color: "#9ca3af" }}>{timeAgo(post.created_at)}</span>
        </div>

        <p style={{ margin: "0 0 16px", fontSize: 15, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{post.content}</p>

        {post.files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {post.files.map((f, i) => <FileAttachment key={i} file={f} />)}
          </div>
        )}
      </div>

      {/* 답변 목록 */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 17, fontWeight: 900, color: "#111827", margin: "0 0 14px" }}>
          답변 {comments.length}개
        </h2>
        {comments.map((c) => (
          <CommentCard
            key={c.id}
            comment={c}
            isOwner={isOwner}
            postClosed={post.status === "closed"}
            onPickBest={() => handlePickBest(c.id)}
            picking={picking}
          />
        ))}
        {comments.length === 0 && (
          <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 16, padding: "30px 20px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
            아직 답변이 없습니다. 첫 번째로 답변해보세요!
          </div>
        )}
      </div>

      {/* 답변 작성 */}
      {post.status === "open" && (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "22px 24px" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 900, color: "#111827" }}>
            답변 작성 <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 700 }}>+5P</span>
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
                style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}
              >
                {uploading ? "업로드 중..." : "📎 파일 첨부"}
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm" style={{ display: "none" }} onChange={handleFileChange} />
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

function CommentCard({ comment, isOwner, postClosed, onPickBest, picking }: {
  comment: Comment; isOwner: boolean; postClosed: boolean; onPickBest: () => void; picking: boolean;
}) {
  return (
    <div style={{
      background: comment.is_best_answer ? "#fffbeb" : "white",
      border: `1px solid ${comment.is_best_answer ? GOLD + "66" : "#e5e7eb"}`,
      borderRadius: 16, padding: "18px 20px", marginBottom: 12,
    }}>
      {comment.is_best_answer && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: GOLD, color: "white", borderRadius: 8, padding: "3px 10px", fontSize: 12, fontWeight: 800, marginBottom: 10 }}>
          ⭐ 채택된 답변
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Avatar url={comment.profiles?.avatar_url} size={28} />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>{comment.profiles?.nickname ?? "익명"}</span>
        {comment.profiles?.grade && <GradeBadge grade={comment.profiles.grade as Grade} size="sm" />}
        <span style={{ fontSize: 12, color: "#9ca3af" }}>{timeAgo(comment.created_at)}</span>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{comment.content}</p>
      {comment.files.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {comment.files.map((f, i) => <FileAttachment key={i} file={f} />)}
        </div>
      )}
      {isOwner && !comment.is_best_answer && !postClosed && (
        <button
          onClick={onPickBest}
          disabled={picking}
          style={{ fontSize: 12, fontWeight: 800, color: GOLD, background: GOLD + "15", border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "5px 12px", cursor: picking ? "not-allowed" : "pointer" }}
        >
          채택하기
        </button>
      )}
    </div>
  );
}

function FileAttachment({ file }: { file: FileItem }) {
  const isImage = ["jpg","jpeg","png","webp","gif"].includes(file.ext);
  if (isImage) {
    return (
      <a href={file.url} target="_blank" rel="noreferrer">
        <img src={file.url} alt={file.name} style={{ height: 80, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "cover", cursor: "pointer" }} />
      </a>
    );
  }
  return (
    <a
      href={file.url}
      download={file.name}
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
