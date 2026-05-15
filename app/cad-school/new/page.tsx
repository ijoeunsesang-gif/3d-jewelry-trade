"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getAccessToken } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";

const GOLD = "#c9a84c";
const MAX_FILES = 5;

type UploadedFile = { name: string; url: string; ext: string };

export default function NewCadPostPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const [todayCount, setTodayCount] = useState<number | null>(null);

  const DAILY_LIMIT = 5;
  const remaining = todayCount !== null ? Math.max(0, DAILY_LIMIT - todayCount) : null;

  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch("/api/cad-school/post", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { if (typeof d.count === "number") setTodayCount(d.count); })
      .catch(() => {});
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    if (files.length + selected.length > MAX_FILES) {
      showError(`파일은 최대 ${MAX_FILES}개까지 첨부할 수 있습니다.`);
      return;
    }
    await uploadFiles(selected);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    if (!dropped.length) return;
    if (files.length + dropped.length > MAX_FILES) {
      showError(`파일은 최대 ${MAX_FILES}개까지 첨부할 수 있습니다.`);
      return;
    }
    await uploadFiles(dropped);
  };

  const uploadFiles = async (selected: File[]) => {
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file);
      fd.append("bucket", "thumbnails");
      fd.append("path", path);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const data = await res.json();
      if (data.url) {
        setFiles((prev) => [...prev, { name: file.name, url: data.url, ext }]);
      } else {
        showError(`업로드 실패: ${data.error || file.name}`);
      }
    }
    setUploading(false);
  };

  const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!title.trim()) { showError("제목을 입력해주세요."); return; }
    if (!content.trim()) { showError("내용을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/cad-school/post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), files }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "등록 실패"); return; }
      showSuccess("질문이 등록되었습니다!");
      router.push(`/cad-school/${data.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>질문 등록</span>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px 32px", marginBottom: 16 }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#111827" }}>CAD 질문 등록</h1>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>질문 등록은 <strong style={{ color: "#111827" }}>무료</strong>입니다. 채택 시 답변자에게 <strong style={{ color: GOLD }}>+300P</strong>가 지급됩니다.</p>

        {remaining !== null && (
          <div style={{
            marginBottom: 20,
            padding: "10px 14px",
            borderRadius: 10,
            fontSize: 13,
            fontWeight: 700,
            background: remaining === 0 ? "#fef2f2" : remaining <= 2 ? "#fff7ed" : "#f0fdf4",
            color: remaining === 0 ? "#dc2626" : remaining <= 2 ? "#ea580c" : "#16a34a",
            border: `1px solid ${remaining === 0 ? "#fecaca" : remaining <= 2 ? "#fed7aa" : "#bbf7d0"}`,
          }}>
            {remaining === 0
              ? "오늘 질문 횟수를 모두 사용했습니다."
              : `오늘 남은 질문 횟수: ${remaining}/${DAILY_LIMIT}회`}
          </div>
        )}

        <label style={labelStyle}>제목</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="질문 제목을 입력하세요"
          style={{ ...inputStyle, marginBottom: 16 }}
          maxLength={100}
        />

        <label style={labelStyle}>내용</label>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="궁금한 점을 자세히 설명해주세요. CAD 파일 관련 질문이라면 어떤 작업을 하려고 하는지, 어떤 문제가 있는지 구체적으로 작성해주세요."
          rows={8}
          style={{ ...inputStyle, resize: "vertical", marginBottom: 20 }}
        />

        <label style={labelStyle}>파일 첨부 (최대 {MAX_FILES}개 · 이미지/STL/OBJ/3DM)</label>
        <div
          style={{
            position: "relative",
            border: isDragOver ? `2px dashed ${GOLD}` : "1px dashed #d1d5db",
            borderRadius: 12,
            padding: "16px 20px",
            marginBottom: 20,
            cursor: "pointer",
            background: isDragOver ? "#fdf6e3" : "#fafafa",
            transition: "border-color 0.15s, background 0.15s",
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragOver(false); }}
          onDrop={handleDrop}
        >
          <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm" style={{ display: "none" }} onChange={handleFileChange} />
          <div style={{ fontSize: 13, color: isDragOver ? GOLD : "#6b7280", textAlign: "center", fontWeight: isDragOver ? 700 : 400 }}>
            {uploading ? "업로드 중..." : isDragOver ? "여기에 놓으세요" : "클릭하거나 파일을 드래그하여 첨부"}
          </div>
        </div>

        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {files.map((f, i) => (
              <FileChip key={i} file={f} onRemove={() => removeFile(i)} />
            ))}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || uploading || remaining === 0}
          style={{
            width: "100%", padding: "14px", borderRadius: 14, border: "none",
            background: submitting || uploading || remaining === 0 ? "#d1d5db" : GOLD,
            color: "white", fontSize: 15, fontWeight: 900, cursor: submitting || uploading || remaining === 0 ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "등록 중..." : "질문 등록 (무료)"}
        </button>
      </div>
    </main>
  );
}

function FileChip({ file, onRemove }: { file: UploadedFile; onRemove: () => void }) {
  const isImage = ["jpg","jpeg","png","webp","gif"].includes(file.ext);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#f3f4f6", borderRadius: 8, padding: "4px 10px 4px 8px", fontSize: 12 }}>
      <span>{isImage ? "🖼" : "📎"}</span>
      <span style={{ color: "#374151", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{file.name}</span>
      <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0, fontSize: 14, lineHeight: 1 }}>×</button>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
