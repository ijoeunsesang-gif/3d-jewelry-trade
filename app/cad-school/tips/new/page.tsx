"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess, showInfo } from "../../../lib/toast";
import Image from "next/image";

const GOLD = "#c9a84c";

export default function TipNewPage() {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [images, setImages]     = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checked, setChecked]   = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const uid = payload?.sub;
    if (!uid) { router.push("/auth"); return; }

    supabase.from("cad_mentors").select("id").eq("user_id", uid).eq("is_active", true).maybeSingle()
      .then(({ data }) => {
        if (!data) { showInfo("멘토 계정만 팁을 작성할 수 있습니다."); router.push("/cad-school/tips"); }
        else setChecked(true);
      });
  }, []);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (images.length + files.length > 5) { showError("이미지는 최대 5장까지 첨부 가능합니다."); return; }
    const token = getAccessToken();
    if (!token) return;
    setUploading(true);
    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
      const path = `cad-school/tips/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setImages((prev) => [...prev, d.url]);
      else showError(`업로드 실패: ${file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const submit = async () => {
    if (!title.trim()) { showError("제목을 입력해주세요."); return; }
    if (!content.trim()) { showError("내용을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    setSubmitting(true);
    const res = await fetch("/api/cad-school/tips", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.trim(), content: content.trim(), images }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "오류 발생"); setSubmitting(false); return; }
    showSuccess("팁이 등록되었습니다!");
    router.push(`/cad-school/tips/${d.id}`);
  };

  if (!checked) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>확인 중...</main>;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school/tips" style={{ fontSize: 14, color: "#6b7280", textDecoration: "none" }}>← 목록으로</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>팁 작성</h1>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px 24px" }}>
        {/* 제목 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="팁 제목을 입력해주세요"
            maxLength={100}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 15, fontWeight: 700, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 3 }}>{title.length}/100</div>
        </div>

        {/* 본문 */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="유용한 캐드 팁을 공유해주세요. 구체적인 명령어, 작업 노하우, 실무 경험 등을 자유롭게 작성해주세요."
            rows={12}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box" }}
          />
        </div>

        {/* 이미지 첨부 */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>이미지 첨부 <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>(최대 5장)</span></label>
          {images.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
              {images.map((url, i) => (
                <div key={i} style={{ position: "relative" }}>
                  <Image src={url} alt="" width={90} height={90} style={{ borderRadius: 10, objectFit: "cover", border: "1px solid #e5e7eb" }} />
                  <button
                    onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                    style={{ position: "absolute", top: -6, right: -6, background: "#374151", color: "white", border: "none", borderRadius: "50%", width: 20, height: 20, fontSize: 12, cursor: "pointer", lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          {images.length < 5 && (
            <button
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading}
              style={{ padding: "10px 18px", borderRadius: 10, border: "1.5px dashed #d1d5db", background: "#f9fafb", color: "#6b7280", fontSize: 13, cursor: uploading ? "not-allowed" : "pointer" }}
            >
              {uploading ? "업로드 중..." : "🖼 이미지 추가"}
            </button>
          )}
          <input ref={imageInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageUpload} />
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Link href="/cad-school/tips" style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            취소
          </Link>
          <button
            onClick={submit}
            disabled={submitting || uploading}
            style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: submitting || uploading ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: submitting || uploading ? "not-allowed" : "pointer" }}
          >
            {submitting ? "등록 중..." : "팁 등록"}
          </button>
        </div>
      </div>
    </main>
  );
}
