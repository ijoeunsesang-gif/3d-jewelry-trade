"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError } from "../../lib/toast";

const GOLD = "#c9a84c";
const MAX_IMAGES = 5;

const inputStyle: React.CSSProperties = {
  height: 48, borderRadius: 12, border: "1px solid #d1d5db",
  padding: "0 14px", fontSize: 14, width: "100%",
  boxSizing: "border-box", outline: "none",
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

export default function CommissionNewPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.replace("/auth"); return; }
    const payload = decodeJwt(token) as any;
    setUserId(payload?.sub || null);
  }, []);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    setImageFiles((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { showError("제목을 입력해주세요."); return; }
    if (!userId) { router.replace("/auth"); return; }

    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      const now = Date.now();

      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `commissions/${userId}/${now}-${i}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("thumbnails")
          .upload(path, file, { upsert: true });
        if (upErr) throw new Error("이미지 업로드 실패");
        const { data: urlData } = supabase.storage.from("thumbnails").getPublicUrl(path);
        imageUrls.push(urlData.publicUrl);
      }

      const { data, error } = await supabase
        .from("commissions")
        .insert({
          user_id: userId,
          title: title.trim(),
          description: description.trim(),
          images: imageUrls,
          status: "open",
        })
        .select("id")
        .single();

      if (error) throw error;
      router.push(`/commission/${data.id}`);
    } catch (e: any) {
      showError(e.message || "의뢰 등록 실패. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) return null;

  return (
    <div style={{
      maxWidth: 640, margin: "0 auto",
      padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 800, color: "#111827" }}>의뢰 등록</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* 제목 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            제목 <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="의뢰 제목을 입력하세요"
            style={inputStyle}
            maxLength={100}
          />
        </div>

        {/* 설명 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="의뢰 내용을 자세히 설명해주세요&#10;(원하는 스타일, 사이즈, 참고 자료 등)"
            style={{ ...inputStyle, height: 160, padding: "12px 14px", resize: "vertical" }}
            maxLength={2000}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>
            {description.length} / 2000
          </div>
        </div>

        {/* 이미지 업로드 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            참고 이미지 (최대 {MAX_IMAGES}장)
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {previews.map((src, i) => (
              <div key={i} style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
                <img
                  src={src}
                  alt=""
                  style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb" }}
                />
                <button
                  type="button"
                  onClick={() => removeImage(i)}
                  style={{
                    position: "absolute", top: -7, right: -7,
                    width: 22, height: 22, borderRadius: "50%",
                    background: "#dc2626", color: "white", border: "none",
                    cursor: "pointer", fontSize: 11, fontWeight: 700,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
            {imageFiles.length < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: 100, height: 100, borderRadius: 10,
                  border: "1px dashed #d1d5db", background: "#f8fafc",
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: "#9ca3af", fontSize: 11, gap: 4,
                }}
              >
                <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
                <span>이미지 추가</span>
              </button>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: "none" }}
            onChange={handleImageChange}
          />
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              flex: 1, height: 48, borderRadius: 12,
              border: "1px solid #d1d5db", background: "white",
              color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              flex: 2, height: 48, borderRadius: 12, border: "none",
              background: submitting ? "#d1d5db" : GOLD,
              color: "white", fontSize: 14, fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
            }}
          >
            {submitting ? "등록 중..." : "의뢰 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}
