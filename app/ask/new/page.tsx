"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

const GOLD = "#c9a84c";
const MAX_IMAGES = 5;

export default function AskNewPage() {
  const router = useRouter();
  const [myId, setMyId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setMyRole("guest"); return; }
    const uid = (decodeJwt(token) as any)?.sub as string;
    setMyId(uid);
    supabase.from("profiles").select("role").eq("id", uid).single()
      .then(({ data }) => setMyRole(data?.role || "user"));
  }, []);

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

  const uploadImage = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", "thumbnails");
    form.append("path", `ask-posts/${myId}/${Date.now()}-${file.name}`);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || images.length >= MAX_IMAGES) return;
    const toUpload = Array.from(files).slice(0, MAX_IMAGES - images.length);
    setUploading(true);
    const urls: string[] = [];
    for (const f of toUpload) {
      const url = await uploadImage(f);
      if (url) urls.push(url);
    }
    setImages((prev) => [...prev, ...urls]);
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!myId || !title.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    const { error } = await supabase.from("ask_posts").insert({
      user_id: myId,
      title: title.trim(),
      content: content.trim(),
      images,
    });
    if (!error) {
      router.push("/ask");
    } else {
      alert("등록에 실패했습니다.");
      setSubmitting(false);
    }
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

  const canSubmit = !!title.trim() && !!content.trim() && !submitting;

  return (
    <main style={{
      maxWidth: 720, margin: "0 auto", padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 상단 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => router.back()}
          style={{ border: "none", background: "none", cursor: "pointer", fontSize: 22, color: "#111827", padding: 0, lineHeight: 1 }}
        >←</button>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>질문 등록</h1>
      </div>

      <div style={{
        background: "white", borderRadius: 20,
        border: "1px solid #e5e7eb", padding: "28px 24px",
        display: "flex", flexDirection: "column", gap: 22,
      }}>
        {/* 제목 */}
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            제목 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="질문 제목을 입력하세요"
            maxLength={100}
            style={{
              width: "100%", height: 48, borderRadius: 12,
              border: "1.5px solid #e5e7eb", padding: "0 14px",
              fontSize: 15, outline: "none", boxSizing: "border-box",
            }}
          />
        </div>

        {/* 내용 */}
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            내용 <span style={{ color: "#ef4444" }}>*</span>
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="질문 내용을 자세히 작성해주세요"
            rows={8}
            style={{
              width: "100%", borderRadius: 12, border: "1.5px solid #e5e7eb",
              padding: "12px 14px", fontSize: 15, outline: "none",
              resize: "vertical", boxSizing: "border-box", lineHeight: 1.7,
            }}
          />
        </div>

        {/* 이미지 첨부 */}
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            이미지 첨부{" "}
            <span style={{ color: "#9ca3af", fontWeight: 500 }}>(최대 {MAX_IMAGES}장)</span>
          </label>
          <div
            onClick={() => !uploading && images.length < MAX_IMAGES && fileRef.current?.click()}
            onDragOver={(e) => { e.stopPropagation(); e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.stopPropagation(); e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            style={{
              border: `2px dashed ${dragOver ? GOLD : "#d1d5db"}`,
              borderRadius: 14, padding: "28px 20px", textAlign: "center",
              cursor: images.length >= MAX_IMAGES ? "default" : "pointer",
              background: dragOver ? "#fdf8ec" : "#f9fafb",
              transition: "all 0.15s",
              marginBottom: images.length > 0 ? 12 : 0,
            }}
          >
            <div style={{ fontSize: 30, marginBottom: 6 }}>📎</div>
            <div style={{ fontSize: 14, color: "#6b7280" }}>
              {uploading
                ? "업로드 중..."
                : images.length >= MAX_IMAGES
                ? `최대 ${MAX_IMAGES}장까지 첨부 가능합니다`
                : "클릭하거나 이미지를 여기에 드래그하세요"}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          {images.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {images.map((url, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <img
                    src={url} alt=""
                    style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb" }}
                  />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    style={{
                      position: "absolute", top: -7, right: -7,
                      width: 22, height: 22, borderRadius: "50%",
                      border: "none", background: "#ef4444", color: "white",
                      cursor: "pointer", fontSize: 14, fontWeight: 900,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      lineHeight: 1,
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 등록 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          style={{
            height: 52, borderRadius: 14, border: "none",
            background: canSubmit ? "#111827" : "#e5e7eb",
            color: canSubmit ? GOLD : "#9ca3af",
            fontSize: 16, fontWeight: 800,
            cursor: canSubmit ? "pointer" : "not-allowed",
            transition: "all 0.15s",
          }}
        >
          {submitting ? "등록 중..." : "질문 등록"}
        </button>
      </div>
    </main>
  );
}
