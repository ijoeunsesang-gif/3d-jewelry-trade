"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess, showInfo } from "../../../../lib/toast";
import Image from "next/image";

export default function TipEditPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [tipId, setTipId]       = useState<string | null>(null);
  const [title, setTitle]       = useState("");
  const [content, setContent]   = useState("");
  const [images, setImages]     = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    params.then(({ id }) => setTipId(id));
  }, [params]);

  useEffect(() => {
    if (!tipId) return;
    loadTip(tipId);
  }, [tipId]);

  const loadTip = async (id: string) => {
    const res = await fetch(`/api/cad-school/tips/${id}`);
    if (!res.ok) { router.push("/cad-school/tips"); return; }
    const { tip } = await res.json();

    // 권한 확인
    const token = getAccessToken();
    const payload = token ? (decodeJwt(token) as { sub?: string } | null) : null;
    const uid = payload?.sub;
    if (!uid || tip.mentor?.user_id !== uid) {
      showInfo("수정 권한이 없습니다.");
      router.push(`/cad-school/tips/${id}`);
      return;
    }

    setTitle(tip.title);
    setContent(tip.content);
    setImages(tip.images ?? []);
    setLoading(false);
  };

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
    if (!tipId) return;
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    setSubmitting(true);
    const res = await fetch(`/api/cad-school/tips/${tipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: title.trim(), content: content.trim(), images }),
    });
    const d = await res.json();
    if (!res.ok) { showError(d.error ?? "오류 발생"); setSubmitting(false); return; }
    showSuccess("수정되었습니다.");
    router.push(`/cad-school/tips/${tipId}`);
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af", fontFamily: "system-ui, sans-serif" }}>불러오는 중...</main>;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href={`/cad-school/tips/${tipId}`} style={{ fontSize: 14, color: "#6b7280", textDecoration: "none" }}>← 돌아가기</Link>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>팁 수정</h1>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px 24px" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>제목</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 15, fontWeight: 700, outline: "none", fontFamily: "inherit", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 3 }}>{title.length}/100</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>내용</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            style={{ width: "100%", padding: "12px 14px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, resize: "vertical", outline: "none", fontFamily: "inherit", lineHeight: 1.7, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 13, fontWeight: 700, color: "#374151", display: "block", marginBottom: 6 }}>이미지 <span style={{ fontSize: 12, fontWeight: 400, color: "#9ca3af" }}>(최대 5장)</span></label>
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

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Link href={`/cad-school/tips/${tipId}`} style={{ padding: "12px 24px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
            취소
          </Link>
          <button
            onClick={submit}
            disabled={submitting || uploading}
            style={{ padding: "12px 28px", borderRadius: 12, border: "none", background: submitting || uploading ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: submitting || uploading ? "not-allowed" : "pointer" }}
          >
            {submitting ? "저장 중..." : "저장"}
          </button>
        </div>
      </div>
    </main>
  );
}
