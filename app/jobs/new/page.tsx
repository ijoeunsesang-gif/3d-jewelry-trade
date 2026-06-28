"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { GOLD } from "@/lib/constants";


export default function JobNewPage() {
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [isRecruiting, setIsRecruiting] = useState(true);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [contact, setContact] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.replace("/auth"); return; }
    const uid = (decodeJwt(token) as any)?.sub as string;
    setMyId(uid);
  }, []);

  const handleSubmit = async () => {
    if (!title.trim()) { alert("제목을 입력해주세요."); return; }
    if (!content.trim()) { alert("내용을 입력해주세요."); return; }
    if (!myId) { router.replace("/auth"); return; }
    setSubmitting(true);

    const { data, error } = await supabase
      .from("job_posts")
      .insert({
        user_id: myId,
        title: title.trim(),
        content: content.trim(),
        is_recruiting: isRecruiting,
        contact: contact.trim() || null,
      })
      .select("id")
      .single();

    if (!error && data) {
      router.push(`/jobs/${data.id}`);
    } else {
      alert("등록에 실패했습니다. 다시 시도해주세요.");
      setSubmitting(false);
    }
  };

  return (
    <main style={{
      maxWidth: 640, margin: "0 auto", padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <button
        onClick={() => router.back()}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontSize: 15, fontWeight: 700, color: "#374151", marginBottom: 24,
          padding: 0,
        }}
      >
        ← 뒤로
      </button>

      <h1 style={{ margin: "0 0 28px", fontSize: 20, fontWeight: 900, color: "#111827" }}>구인구직 글 등록</h1>

      {/* 구인 / 구직 선택 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>유형 선택</div>
        <div style={{ display: "flex", gap: 10 }}>
          {[{ label: "구인 (사람을 구해요)", value: true }, { label: "구직 (일자리를 구해요)", value: false }].map(({ label, value }) => (
            <button
              key={String(value)}
              onClick={() => setIsRecruiting(value)}
              style={{
                flex: 1, height: 44, borderRadius: 12,
                border: `2px solid ${isRecruiting === value ? GOLD : "#e5e7eb"}`,
                background: isRecruiting === value ? "#fdf8ec" : "white",
                color: isRecruiting === value ? "#92400e" : "#6b7280",
                fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 제목 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>제목 *</div>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="제목을 입력해주세요"
          maxLength={100}
          style={{
            width: "100%", height: 48, borderRadius: 12,
            border: "1.5px solid #e5e7eb", padding: "0 14px",
            fontSize: 15, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      {/* 내용 */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>내용 *</div>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="상세 내용을 입력해주세요"
          rows={8}
          style={{
            width: "100%", borderRadius: 12, border: "1.5px solid #e5e7eb",
            padding: "12px 14px", fontSize: 15, outline: "none",
            resize: "vertical", boxSizing: "border-box", lineHeight: 1.7,
          }}
        />
      </div>

      {/* 연락처 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>연락처 <span style={{ fontWeight: 400, color: "#9ca3af" }}>(선택)</span></div>
        <input
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="오픈채팅 링크, 이메일 등"
          style={{
            width: "100%", height: 48, borderRadius: 12,
            border: "1.5px solid #e5e7eb", padding: "0 14px",
            fontSize: 15, outline: "none", boxSizing: "border-box",
          }}
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!title.trim() || !content.trim() || submitting}
        style={{
          width: "100%", height: 52, borderRadius: 14, border: "none",
          background: title.trim() && content.trim() && !submitting ? "#111827" : "#e5e7eb",
          color: title.trim() && content.trim() && !submitting ? GOLD : "#9ca3af",
          fontSize: 16, fontWeight: 800, cursor: title.trim() && content.trim() && !submitting ? "pointer" : "not-allowed",
        }}
      >
        {submitting ? "등록 중..." : "등록하기"}
      </button>
    </main>
  );
}
