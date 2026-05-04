"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

const GOLD = "#c9a84c";
const MAX_IMAGES = 5;

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
  created_at: string;
  nickname: string;
  liked: boolean;
};

const addPoints = async (userId: string, amount: number, reason: string, referenceId?: string) => {
  await supabase.from("points").insert({ user_id: userId, amount, reason, reference_id: referenceId || null });
  await supabase.rpc("increment_profile_points", { uid: userId, delta: amount });
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

  // 드롭존 밖 드래그 시 새창 방지
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

    // 조회수 증가
    await supabase.rpc("increment_ask_view", { post_id: id });

    const { data: postData } = await supabase
      .from("ask_posts")
      .select("*, profiles(nickname)")
      .eq("id", id)
      .single();

    if (!postData) { setLoading(false); return; }
    setPost({
      ...postData,
      nickname: (postData.profiles as any)?.nickname || "익명",
    });

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

    // 내가 좋아요한 답변 목록
    let likedSet = new Set<string>();
    if (myId) {
      const { data: likes } = await supabase
        .from("ask_answer_likes")
        .select("answer_id")
        .eq("user_id", myId);
      likedSet = new Set((likes || []).map((l: any) => l.answer_id));
    }

    setAnswers(
      (answersData as any[]).map((a) => ({
        ...a,
        nickname: (a.profiles as any)?.nickname || "익명",
        liked: likedSet.has(a.id),
      }))
    );
  };

  const uploadImage = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", "thumbnails");
    form.append("path", `ask-answers/${myId}/${Date.now()}-${file.name}`);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  };

  const handleAnswerFiles = async (files: FileList | null) => {
    if (!files || answerImages.length >= MAX_IMAGES) return;
    const toUpload = Array.from(files).slice(0, MAX_IMAGES - answerImages.length);
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
      .insert({
        post_id: id,
        user_id: myId,
        content: answerContent.trim(),
        images: answerImages,
      })
      .select()
      .single();

    if (!error && data) {
      // +5 포인트 (답변 등록)
      await addPoints(myId, 5, "답변 등록", data.id);
      setAnswerContent("");
      setAnswerImages([]);
      await fetchAnswers();
    }
    setAnswerSubmitting(false);
  };

  const handleLike = async (answer: AskAnswer) => {
    if (!myId || answer.user_id === myId) return;

    if (answer.liked) {
      // 좋아요 취소
      await supabase.from("ask_answer_likes").delete()
        .eq("answer_id", answer.id).eq("user_id", myId);
      await supabase.from("ask_answers")
        .update({ likes: Math.max(0, answer.likes - 1) })
        .eq("id", answer.id);
    } else {
      // 좋아요
      const { error } = await supabase.from("ask_answer_likes")
        .insert({ answer_id: answer.id, user_id: myId });
      if (!error) {
        await supabase.from("ask_answers")
          .update({ likes: answer.likes + 1 })
          .eq("id", answer.id);
        // +2 포인트 (답변 좋아요)
        await addPoints(answer.user_id, 2, "답변 좋아요", answer.id);
      }
    }
    await fetchAnswers();
  };

  const handleAccept = async (answer: AskAnswer) => {
    if (!post || post.user_id !== myId || post.is_solved) return;

    // 답변 채택
    await supabase.from("ask_answers").update({ is_accepted: true }).eq("id", answer.id);
    await supabase.from("ask_posts").update({
      is_solved: true,
      accepted_answer_id: answer.id,
      updated_at: new Date().toISOString(),
    }).eq("id", post.id);

    // +20 포인트 (답변 채택)
    await addPoints(answer.user_id, 20, "답변 채택", answer.id);
    await fetchPost();
  };

  if (myRole !== null && myRole !== "seller" && myRole !== "admin") {
    return (
      <main style={{
        maxWidth: 640, margin: "0 auto", padding: "80px 20px",
        fontFamily: "system-ui, sans-serif", textAlign: "center",
      }}>
        <div style={{ fontSize: 52 }}>🔒</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginTop: 16 }}>
          판매자만 이용 가능한 메뉴입니다
        </h2>
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
                <img src={url} alt="" style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 12, border: "1px solid #e5e7eb" }} />
              </a>
            ))}
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
            {answers.map((answer) => (
              <div key={answer.id} style={{
                background: answer.is_accepted ? "#f0fdf4" : "white",
                borderRadius: 16, padding: "20px 22px",
                border: answer.is_accepted ? "2px solid #86efac" : "1px solid #e5e7eb",
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
                        <img src={url} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb" }} />
                      </a>
                    ))}
                  </div>
                )}

                {/* 좋아요 + 채택 */}
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
                      fontSize: 14, fontWeight: 700, cursor: answer.user_id === myId ? "default" : "pointer",
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
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 답변 작성폼 */}
      {myId && (
        <div style={{
          background: "white", borderRadius: 20, border: "1px solid #e5e7eb",
          padding: "24px 22px",
        }}>
          <h3 style={{ margin: "0 0 16px", fontSize: 16, fontWeight: 800, color: "#111827" }}>
            답변 작성
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 600, color: GOLD }}>
              등록 시 +5 포인트
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
              marginBottom: 14,
            }}
          />

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
                  <img src={url} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb" }} />
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
