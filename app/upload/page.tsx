"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo, showSuccess } from "../lib/toast";
import DescriptionTemplateSelector from "../components/DescriptionTemplateSelector";
import { uploadToR2 } from "@/lib/uploadToR2";
import { DEFAULT_BANNED_WORDS, detectBannedWords } from "@/lib/banned-words";

export default function UploadPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("RING");
  const [price, setPrice] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const priceInputRef = useRef<HTMLInputElement>(null);
  const [description, setDescription] = useState("");

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [detailImageFiles, setDetailImageFiles] = useState<File[]>([]);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);

  const [uploading, setUploading] = useState(false);
  const [sellerCheck, setSellerCheck] = useState<"loading" | "ok" | "blocked">("loading");

  // 금지어 필터
  const [bannedWordsList, setBannedWordsList] = useState<string[]>(DEFAULT_BANNED_WORDS);
  const detectedWords = detectBannedWords(`${title} ${description}`, bannedWordsList);

  useEffect(() => {
    const check = async () => {
      const token = getAccessToken();
      if (!token) { router.replace("/auth"); return; }
      const uid = (decodeJwt(token) as any)?.sub as string;
      const { data } = await supabase.from("profiles").select("role").eq("id", uid).maybeSingle();
      setSellerCheck(data?.role === "seller" || data?.role === "admin" ? "ok" : "blocked");
    };
    check();
  }, []);

  // 서버에서 최신 금지어 목록 로드 (기본값 위에 덮어씀)
  useEffect(() => {
    fetch("/api/admin/banned-words")
      .then((r) => r.json())
      .then(({ words }) => {
        if (Array.isArray(words) && words.length > 0) {
          setBannedWordsList(words.map((w: { word: string }) => w.word));
        }
      })
      .catch(() => { /* 실패 시 DEFAULT_BANNED_WORDS 유지 */ });
  }, []);

  // 드롭존 밖에서 드래그 시 새탭 열림 방지
  // 드롭존 내부에서는 React onDrop 핸들러가 stopPropagation하므로 여기까지 안 올라옴
  useEffect(() => {
    const prevent = (e: DragEvent) => { e.preventDefault(); };
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  const uploadBoxStyle: React.CSSProperties = {
    border: "1px dashed #cbd5e1",
    borderRadius: 18,
    padding: 18,
    background: "#f8fafc",
    display: "grid",
    gap: 10,
  };

  const helperTextStyle: React.CSSProperties = {
    fontSize: 13,
    color: "#64748b",
    lineHeight: 1.5,
  };

  const fileListStyle: React.CSSProperties = {
    display: "grid",
    gap: 6,
    fontSize: 13,
    color: "#111827",
  };

  useEffect(() => {
    const el = priceInputRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1000 : -1000;
      const newVal = Math.max(5000, (price || 0) + delta);
      setPrice(newVal);
      setPriceInput(newVal.toLocaleString('ko-KR'));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [price]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || (!isNaN(Number(raw)) && Number(raw) >= 0)) {
      const num = raw === '' ? null : Number(raw);
      setPrice(num);
      setPriceInput(num !== null ? num.toLocaleString('ko-KR') : '');
    }
  };

  const handleDetailImages = (files: FileList | null) => {
    if (!files) return;
    setDetailImageFiles(Array.from(files).slice(0, 10));
  };

  const handleExtraFiles = (files: FileList | null) => {
    if (!files) return;
    setExtraFiles(Array.from(files).slice(0, 10));
  };

  const removeExtraFile = (idx: number) => {
    setExtraFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const ALLOWED_MODEL_EXTS = [".stl", ".3dm", ".obj"];
  const ALLOWED_EXTRA_EXTS = [".stl", ".3dm", ".obj", ".zip", ".pdf"];

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); e.stopPropagation(); };

  const onDropThumbnail = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("이미지 파일만 업로드 가능합니다.");
      return;
    }
    setThumbnailFile(file);
  };

  const onDropDetailImages = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!e.dataTransfer.files) return;
    const dropped = Array.from(e.dataTransfer.files);
    const valid = dropped.filter(f => f.type.startsWith("image/"));
    if (dropped.length > 0 && valid.length === 0) {
      showError("이미지 파일만 업로드 가능합니다.");
      return;
    }
    setDetailImageFiles(valid.slice(0, 10));
  };

  const onDropModelFile = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ALLOWED_MODEL_EXTS.includes(ext)) {
      showError("STL, 3DM, OBJ 파일만 업로드 가능합니다.");
      return;
    }
    setModelFile(file);
  };

  const onDropExtraFiles = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!e.dataTransfer.files) return;
    const dropped = Array.from(e.dataTransfer.files);
    const valid = dropped.filter(f => {
      const ext = "." + (f.name.split(".").pop()?.toLowerCase() ?? "");
      return ALLOWED_EXTRA_EXTS.includes(ext);
    });
    if (dropped.length > 0 && valid.length === 0) {
      showError("STL, 3DM, OBJ, ZIP, PDF 파일만 업로드 가능합니다.");
      return;
    }
    setExtraFiles(valid.slice(0, 10));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (!title.trim()) { showInfo("모델명을 입력하세요."); return; }
      if (price === null) { showInfo("가격을 입력하세요."); return; }

      // 서버 최신 금지어 재확인 (클라이언트 우회 방지)
      try {
        const bwRes = await fetch("/api/admin/banned-words");
        const { words: latestWords } = await bwRes.json();
        if (Array.isArray(latestWords)) {
          const serverDetected = detectBannedWords(
            `${title} ${description}`,
            latestWords.map((w: { word: string }) => w.word)
          );
          if (serverDetected.length > 0) {
            showError(`해당 단어는 저작권 문제로 사용할 수 없습니다: ${serverDetected.join(", ")}`);
            return;
          }
        }
      } catch {
        // 금지어 API 실패 시 클라이언트 목록으로 재확인
        if (detectedWords.length > 0) {
          showError(`해당 단어는 저작권 문제로 사용할 수 없습니다: ${detectedWords.join(", ")}`);
          return;
        }
      }
      if (price < 5000) { showInfo("최소 판매가는 5,000원입니다."); return; }
      if (!thumbnailFile) { showError("썸네일 이미지를 선택하세요."); return; }
      if (!modelFile) { showError("출력(대표)파일을 선택하세요."); return; }

      setUploading(true);

      const token = getAccessToken();
      if (!token) { showInfo("로그인이 필요합니다."); return; }
      const sellerId = (decodeJwt(token) as any)?.sub as string;
      const now = Date.now();

      // 썸네일 업로드
      const thumbExt = thumbnailFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const thumbPath = `${sellerId}/${now}-thumb.${thumbExt}`;

      const thumbForm = new FormData();
      thumbForm.append("file", thumbnailFile);
      thumbForm.append("bucket", "thumbnails");
      thumbForm.append("path", thumbPath);
      const thumbRes = await fetch("/api/upload", { method: "POST", body: thumbForm });
      if (!thumbRes.ok) { showError("썸네일 업로드 실패"); return; }
      const { url: thumbnailUrl } = await thumbRes.json();

      // 대표 모델 파일 업로드 (presigned URL → R2 직접 PUT, Vercel 크기 제한 없음)
      const modelExt = modelFile.name.split(".").pop()?.toLowerCase() || "obj";
      const modelPath = `${sellerId}/${now}-model.${modelExt}`;
      try {
        await uploadToR2(modelFile, "models-private", modelPath);
      } catch (err: any) {
        showError(`모델 파일 업로드 실패: ${err.message}`);
        return;
      }

      // 모델 DB 저장
      const { data: insertedModel, error: insertModelError } = await supabase
        .from("models")
        .insert({
          title,
          category,
          price: price,
          description,
          thumbnail: thumbnailUrl,
          thumbnail_path: thumbPath,
          seller_id: sellerId,
          file_url: "",
          model_file_path: modelPath,
        })
        .select("*")
        .single();

      if (insertModelError || !insertedModel) {
        console.error("모델 저장 실패:", insertModelError);
        showError("모델 저장에 실패했습니다.");
        return;
      }

      // 추가 이미지 업로드
      if (detailImageFiles.length > 0) {
        const imageRows: any[] = [];

        for (let i = 0; i < detailImageFiles.length; i++) {
          const file = detailImageFiles[i];
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${sellerId}/detail-${now}-${i}.${ext}`;

          const imgForm = new FormData();
          imgForm.append("file", file);
          imgForm.append("bucket", "thumbnails");
          imgForm.append("path", path);
          const imgRes = await fetch("/api/upload", { method: "POST", body: imgForm });
          if (!imgRes.ok) { console.error("추가 이미지 업로드 실패"); continue; }
          const { url } = await imgRes.json();

          imageRows.push({ model_id: insertedModel.id, image_url: url, image_path: path, sort_order: i + 1 });
        }

        if (imageRows.length > 0) {
          const { error: imageInsertError } = await supabase.from("model_images").insert(imageRows);
          if (imageInsertError) console.error("추가 이미지 저장 실패:", imageInsertError);
        }
      }

      // 추가 파일 업로드
      if (extraFiles.length > 0) {
        const fileRows: any[] = [];

        for (let i = 0; i < extraFiles.length; i++) {
          const file = extraFiles[i];
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const path = `${sellerId}/extra-${now}-${i}.${ext}`;

          try {
            await uploadToR2(file, "models-private", path);
          } catch (err: any) {
            console.error("추가 파일 업로드 실패:", err.message);
            continue;
          }

          fileRows.push({
            model_id: insertedModel.id,
            file_name: file.name,
            file_url: "",
            file_path: path,
            file_type: ext,
            sort_order: i + 1,
          });
        }

        if (fileRows.length > 0) {
          const { error: fileInsertError } = await supabase.from("model_files").insert(fileRows);
          if (fileInsertError) console.error("추가 파일 DB 저장 실패:", fileInsertError);
        }
      }

      showSuccess("모델 업로드가 완료되었습니다.");
      router.push("/my-models");
    } catch (error) {
      console.error("업로드 오류:", error);
      showError("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  if (sellerCheck === "loading") {
    return (
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "80px 20px", fontFamily: 'system-ui, sans-serif' }}>
        <p style={{ color: "#6b7280" }}>확인 중...</p>
      </main>
    );
  }

  if (sellerCheck === "blocked") {
    return (
      <main style={{
        maxWidth: 980, margin: "0 auto", padding: "80px 20px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <div style={{
          border: "1px solid #e5e7eb", borderRadius: 24, padding: "48px 40px",
          background: "white", textAlign: "center", maxWidth: 440,
          boxShadow: "0 6px 24px rgba(15,23,42,0.06)",
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 900, color: "#111827" }}>
            판매자 등록이 필요합니다
          </h2>
          <p style={{ margin: "0 0 6px", fontSize: 15, color: "#6b7280", lineHeight: 1.7 }}>
            판매자 등록 후 상품을 업로드할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => router.push("/profile?tab=seller")}
            style={{
              marginTop: 28, height: 52, padding: "0 32px", borderRadius: 14,
              border: "none", background: "#111827", color: "white",
              fontWeight: 800, fontSize: 16, cursor: "pointer",
            }}
          >
            판매자 등록하기
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      className="upload-main"
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "36px 20px 60px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 40, fontWeight: 900, color: "#111827" }}>
        모델 업로드
      </h1>
      <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 15 }}>
        썸네일 1장과 추가 이미지 최대 10장까지 업로드할 수 있습니다.
      </p>

      <div style={{
        marginTop: 16,
        padding: "14px 18px",
        borderRadius: 14,
        background: "#fffbeb",
        border: "1.5px solid #f59e0b",
        display: "grid",
        gap: 6,
      }}>
        <p style={{ margin: 0, fontWeight: 800, fontSize: 14, color: "#92400e" }}>
          ⚠️ 주의사항
        </p>
        <p style={{ margin: 0, fontSize: 13, color: "#78350f", lineHeight: 1.7 }}>
          타인의 저작권, 상표권, 디자인권을 침해하는 파일은 업로드할 수 없습니다.<br />
          카피 제품, 유명 브랜드 모방 디자인 등을 업로드할 경우<br />
          즉시 삭제 및 계정 정지 조치가 취해질 수 있으며,<br />
          <strong>법적 책임은 판매자 본인에게 있습니다.</strong>
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="upload-form"
        style={{
          marginTop: 24,
          border: "1px solid #e5e7eb",
          borderRadius: 28,
          background: "white",
          padding: 24,
          display: "grid",
          gap: 18,
        }}
      >
        <Field label="모델명">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={inputStyle}
          />
        </Field>

        <Field label="카테고리">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            style={inputStyle}
          >
            <option value="RING">RING</option>
            <option value="PENDANT">PENDANT</option>
            <option value="EARRING">EARRING</option>
            <option value="BRACELET">BRACELET</option>
            <option value="기타부속">기타부속</option>
          </select>
        </Field>

        <Field label="가격">
          <input
            ref={priceInputRef}
            type="text"
            inputMode="numeric"
            value={priceInput}
            onChange={handlePriceChange}
            onBlur={() => { if (price !== null && price < 5000) showInfo("최소 판매가는 5,000원입니다."); }}
            placeholder="최소 5,000원"
            style={inputStyle}
          />
        </Field>

        {/* 설명 + 공통 템플릿 컴포넌트 */}
        <Field label="설명">
          <DescriptionTemplateSelector
            description={description}
            onDescriptionChange={setDescription}
          />
        </Field>

        <Field label="썸네일 이미지 *">
          <div data-dropzone style={uploadBoxStyle} onDragOver={onDragOver} onDrop={onDropThumbnail}>
            <div style={helperTextStyle}>대표로 보여질 이미지를 1장 업로드하세요.</div>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            />
            {thumbnailFile && (
              <div style={fileListStyle}>선택 파일: {thumbnailFile.name}</div>
            )}
          </div>
        </Field>

        <Field label="추가 이미지 (최대 10장)">
          <div data-dropzone style={uploadBoxStyle} onDragOver={onDragOver} onDrop={onDropDetailImages}>
            <div style={helperTextStyle}>
              상세페이지에 들어갈 이미지를 여러 장 업로드할 수 있습니다.
            </div>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleDetailImages(e.target.files)}
            />
            <div style={fileListStyle}>
              <div>선택된 파일 수: {detailImageFiles.length}장</div>
              {detailImageFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`}>{idx + 1}. {file.name}</div>
              ))}
            </div>
          </div>
        </Field>

        <Field label="출력(대표)파일 *">
          <div data-dropzone style={uploadBoxStyle} onDragOver={onDragOver} onDrop={onDropModelFile}>
            <div style={helperTextStyle}>
              출력(대표)파일 1개를 업로드하세요. 예: STL, OBJ, 3DM
            </div>
            <input
              type="file"
              accept=".stl,.obj,.3dm"
              onChange={(e) => setModelFile(e.target.files?.[0] || null)}
            />
            {modelFile && (
              <div style={fileListStyle}>선택 파일: {modelFile.name}</div>
            )}
          </div>
        </Field>

        <Field label="추가 파일 (최대 10개)">
          <div data-dropzone style={uploadBoxStyle} onDragOver={onDragOver} onDrop={onDropExtraFiles}>
            <div style={helperTextStyle}>
              출력(대표)파일 외에 보조 파일을 추가로 업로드할 수 있습니다.
              예: STL, OBJ, 3DM, ZIP, PDF
            </div>
            <input
              type="file"
              accept=".stl,.obj,.3dm,.zip,.pdf"
              multiple
              onChange={(e) => handleExtraFiles(e.target.files)}
            />

            {extraFiles.length > 0 && (
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                  선택된 파일 수: {extraFiles.length}개
                </div>
                {extraFiles.map((file, idx) => (
                  <div
                    key={`${file.name}-${idx}`}
                    style={{
                      display: "flex", alignItems: "center",
                      justifyContent: "space-between", gap: 10,
                      padding: "8px 12px",
                      borderRadius: 10, border: "1px solid #e5e7eb",
                      background: "white", fontSize: 13, color: "#111827",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {idx + 1}. {file.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeExtraFile(idx)}
                      style={{
                        flexShrink: 0, width: 28, height: 28, borderRadius: 8,
                        border: "1px solid #fca5a5", background: "white",
                        color: "#dc2626", fontWeight: 900, fontSize: 16,
                        cursor: "pointer", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        lineHeight: 1,
                      }}
                      aria-label="파일 제거"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        {detectedWords.length > 0 && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fca5a5",
            borderRadius: 12, padding: "14px 16px",
            display: "grid", gap: 4,
          }}>
            <p style={{ margin: 0, fontWeight: 800, color: "#dc2626", fontSize: 14 }}>
              해당 단어는 저작권 문제로 사용할 수 없습니다.
            </p>
            <p style={{ margin: 0, color: "#ef4444", fontSize: 13 }}>
              감지된 단어: {detectedWords.join(", ")}
            </p>
          </div>
        )}

        <button
          type="submit"
          disabled={uploading || detectedWords.length > 0}
          style={{
            width: "100%", height: 54, borderRadius: 16, border: "none",
            background: detectedWords.length > 0 ? "#9ca3af" : "#111827",
            color: "white", fontWeight: 900, fontSize: 17,
            cursor: detectedWords.length > 0 ? "not-allowed" : "pointer",
          }}
        >
          {uploading ? "업로드 중..." : "업로드"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gap: 8, fontWeight: 800, color: "#111827" }}>
      {label}
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  outline: "none",
  fontSize: 14,
  width: "100%",
  boxSizing: "border-box",
};
