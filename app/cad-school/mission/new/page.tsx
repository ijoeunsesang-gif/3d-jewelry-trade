"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../../lib/toast";

const GOLD = "#c9a84c";

type UploadedFile = { name: string; url: string; ext: string };

const DIFFICULTY_OPTIONS = [
  { value: "easy",   label: "초급", color: "#16a34a", bg: "#dcfce7" },
  { value: "normal", label: "중급", color: "#ea580c", bg: "#fff7ed" },
  { value: "hard",   label: "고급", color: "#dc2626", bg: "#fef2f2" },
] as const;

export default function MissionNewPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [hint, setHint] = useState("");
  const [difficulty, setDifficulty] = useState<"easy" | "normal" | "hard">("normal");
  const [files, setFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push("/cad-school"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const uid = payload?.sub;
    if (!uid) { router.push("/cad-school"); return; }
    supabase.from("cad_mentors").select("id").eq("user_id", uid).eq("is_active", true).maybeSingle()
      .then(({ data }) => {
        if (!data) { router.push("/cad-school"); return; }
        setLoading(false);
      });
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) return;
    if (files.length + selected.length > 5) { showError("파일은 최대 5개까지 첨부할 수 있습니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/missions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.url) setFiles((prev) => [...prev, { name: file.name, url: data.url, ext }]);
      else showError(`업로드 실패: ${file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const handleSubmit = async () => {
    if (!title.trim()) { showError("제목을 입력해주세요."); return; }
    if (!description.trim()) { showError("미션 설명을 입력해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/cad-school/mission/post", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: title.trim(), description: description.trim(), hint_commands: hint.trim(), difficulty, files }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "등록 실패"); return; }
      showSuccess("미션이 등록되었습니다! (+30P)");
      router.push("/cad-school?tab=mission");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>확인 중...</main>;

  return (
    <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>미션 등록</span>
      </div>

      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px 32px" }}>
        <h1 style={{ margin: "0 0 6px", fontSize: 22, fontWeight: 900, color: "#111827" }}>미션 등록</h1>
        <p style={{ margin: "0 0 24px", fontSize: 13, color: "#6b7280" }}>수강생들이 도전할 CAD 미션을 출제하세요. 등록 시 <strong style={{ color: GOLD }}>+30P</strong>가 지급됩니다.</p>

        <label style={labelStyle}>제목 *</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="미션 제목을 입력하세요"
          maxLength={100}
          style={{ ...inputStyle, marginBottom: 16 }}
        />

        <label style={labelStyle}>미션 설명 *</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="미션 내용을 자세히 설명해주세요. 어떤 결과물을 기대하는지, 어떤 기술을 연습해야 하는지 등을 작성해주세요."
          rows={6}
          style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
        />

        <label style={labelStyle}>명령어 힌트 (선택)</label>
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder="예: FilletEdge, Shell, BooleanUnion"
          rows={3}
          style={{ ...inputStyle, resize: "vertical", marginBottom: 16 }}
        />

        <label style={labelStyle}>난이도 *</label>
        <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDifficulty(opt.value)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 10,
                border: `2px solid ${difficulty === opt.value ? opt.color : "#e5e7eb"}`,
                background: difficulty === opt.value ? opt.bg : "white",
                color: difficulty === opt.value ? opt.color : "#6b7280",
                fontWeight: difficulty === opt.value ? 800 : 600,
                fontSize: 14, cursor: "pointer",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label style={labelStyle}>참고 파일 첨부 (선택, 최대 5개)</label>
        <div
          style={{ border: "1px dashed #d1d5db", borderRadius: 12, padding: "14px 20px", marginBottom: files.length > 0 ? 12 : 20, cursor: "pointer", background: "#fafafa", textAlign: "center" }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm" style={{ display: "none" }} onChange={handleFileChange} />
          <div style={{ fontSize: 13, color: "#6b7280" }}>{uploading ? "업로드 중..." : "클릭하여 파일 첨부"}</div>
        </div>
        {files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {files.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f3f4f6", borderRadius: 8, padding: "4px 10px", fontSize: 12 }}>
                <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                <span style={{ color: "#374151", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", padding: 0 }}>×</button>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting || uploading}
          style={{ width: "100%", padding: "14px", borderRadius: 14, border: "none", background: submitting || uploading ? "#d1d5db" : "#111827", color: "white", fontSize: 15, fontWeight: 900, cursor: submitting || uploading ? "not-allowed" : "pointer" }}
        >
          {submitting ? "등록 중..." : "미션 등록 (+30P)"}
        </button>
      </div>
    </main>
  );
}

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
