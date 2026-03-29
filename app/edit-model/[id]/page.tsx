"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { showError, showInfo, showSuccess } from "../../lib/toast";
import DescriptionTemplateSelector from "../../components/DescriptionTemplateSelector";

type ModelItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  thumbnail?: string;
  thumbnail_path?: string | null;
  model_file_path?: string | null;
  seller_id: string;
};

type ModelImageItem = {
  id: string;
  image_url?: string | null;
  image_path?: string | null;
  sort_order?: number | null;
};

type ModelFileItem = {
  id: string;
  file_name?: string | null;
  file_url?: string | null;
  file_path?: string | null;
  file_type?: string | null;
  sort_order?: number | null;
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  fontSize: 15,
  outline: "none",
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  minHeight: 160,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "14px",
  fontSize: 15,
  outline: "none",
  resize: "vertical",
  boxSizing: "border-box",
};

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

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "grid", gap: 8 }}>
      <span
        style={{
          fontSize: 14,
          fontWeight: 800,
          color: "#111827",
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

export default function EditModelPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [model, setModel] = useState<ModelItem | null>(null);
  const [existingImages, setExistingImages] = useState<ModelImageItem[]>([]);
  const [existingFiles, setExistingFiles] = useState<ModelFileItem[]>([]);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("RING");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [detailImageFiles, setDetailImageFiles] = useState<File[]>([]);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);

  const [draggingBox, setDraggingBox] = useState<
    "thumbnail" | "detailImages" | "modelFile" | "extraFiles" | null
  >(null);

  const getImageUrl = (image?: {
    image_url?: string | null;
    image_path?: string | null;
  }) => {
    if (image?.image_path) {
      return supabase.storage.from("thumbnails").getPublicUrl(image.image_path).data.publicUrl;
    }
    return image?.image_url || "";
  };

  const getThumbnailUrl = () => {
    if (!model) return "";
    if (model.thumbnail_path) {
      return supabase.storage.from("thumbnails").getPublicUrl(model.thumbnail_path).data.publicUrl;
    }
    return model.thumbnail || "";
  };

  const fetchModel = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        showInfo("로그인이 필요합니다.");
        router.push("/login");
        return;
      }

      const { data, error } = await supabase
        .from("models")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        console.error("모델 불러오기 실패:", error);
        showError("모델 정보를 불러오지 못했습니다.");
        router.push("/my-models");
        return;
      }

      if (data.seller_id !== user.id) {
        showError("수정 권한이 없습니다.");
        router.push("/my-models");
        return;
      }

      const { data: imageData, error: imageError } = await supabase
        .from("model_images")
        .select("*")
        .eq("model_id", id)
        .order("sort_order", { ascending: true });

      if (imageError) {
        console.error("기존 이미지 불러오기 실패:", imageError);
      }

      const { data: fileData, error: fileError } = await supabase
        .from("model_files")
        .select("*")
        .eq("model_id", id)
        .order("sort_order", { ascending: true });

      if (fileError) {
        console.error("기존 추가 파일 불러오기 실패:", fileError);
      }

      setModel(data as ModelItem);
      setExistingImages((imageData || []) as ModelImageItem[]);
      setExistingFiles((fileData || []) as ModelFileItem[]);

      setTitle(data.title || "");
      setCategory(data.category || "RING");
      setPrice(String(data.price ?? ""));
      setDescription(data.description || "");
    } catch (error) {
      console.error("수정 페이지 로딩 오류:", error);
      showError("페이지를 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModel();
  }, [id]);
  
  useEffect(() => {
    const preventWindowDrop = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener("dragover", preventWindowDrop);
    window.addEventListener("drop", preventWindowDrop);

    return () => {
      window.removeEventListener("dragover", preventWindowDrop);
      window.removeEventListener("drop", preventWindowDrop);
    };
  }, []);

  const handleDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    box: "thumbnail" | "detailImages" | "modelFile" | "extraFiles"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingBox !== box) {
      setDraggingBox(box);
    }
  };

  const handleDragEnter = (
    e: React.DragEvent<HTMLDivElement>,
    box: "thumbnail" | "detailImages" | "modelFile" | "extraFiles"
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBox(box);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBox(null);
  };

  const handleDropThumbnail = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBox(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setThumbnailFile(file);
  };

  const handleDropDetailImages = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBox(null);

    const files = Array.from(e.dataTransfer.files || []).filter((file) =>
      file.type.startsWith("image/")
    );

    if (files.length === 0) {
      showError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setDetailImageFiles(files.slice(0, 10));
  };

  const handleDropModelFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBox(null);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setModelFile(file);
  };

  const handleDropExtraFiles = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingBox(null);

    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;

    setExtraFiles(files.slice(0, 10));
  };  
  
  const handleDetailImages = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 10);
    setDetailImageFiles(arr);
  };

  const handleExtraFiles = (files: FileList | null) => {
    if (!files) return;
    const arr = Array.from(files).slice(0, 10);
    setExtraFiles(arr);
  };

  const removeExistingImage = async (imageId: string) => {
    const { error } = await supabase.from("model_images").delete().eq("id", imageId);

    if (error) {
      console.error("기존 이미지 삭제 실패:", error);
      showError("이미지 삭제에 실패했습니다.");
      return;
    }

    setExistingImages((prev) => prev.filter((item) => item.id !== imageId));
    showSuccess("이미지가 삭제되었습니다.");
  };

  const removeExistingFile = async (fileId: string) => {
    const { error } = await supabase.from("model_files").delete().eq("id", fileId);

    if (error) {
      console.error("기존 추가 파일 삭제 실패:", error);
      showError("추가 파일 삭제에 실패했습니다.");
      return;
    }

    setExistingFiles((prev) => prev.filter((item) => item.id !== fileId));
    showSuccess("추가 파일이 삭제되었습니다.");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!model) return;

    const parsedPrice = Number(price);

    if (!title.trim()) {
      showInfo("제목을 입력하세요.");
      return;
    }

    if (!price.trim()) {
      showInfo("가격을 입력하세요.");
      return;
    }

    if (Number.isNaN(parsedPrice)) {
      showInfo("가격은 숫자로 입력하세요.");
      return;
    }

    if (parsedPrice < 5000) {
      showError("최소 가격은 5,000원입니다.");
      return;
    }

    try {
      setSaving(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user;
      if (!user) {
        showInfo("로그인이 필요합니다.");
        return;
      }

      let thumbnailPath = model.thumbnail_path || null;
      let thumbnailUrl = model.thumbnail || "";

      if (thumbnailFile) {
        const ext = thumbnailFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${user.id}/thumb-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("thumbnails")
          .upload(path, thumbnailFile, { upsert: true });

        if (uploadError) {
          console.error("썸네일 업로드 실패:", uploadError);
          showError("썸네일 업로드에 실패했습니다.");
          return;
        }

        thumbnailPath = path;
        thumbnailUrl = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      }

      let modelPath = model.model_file_path || null;

      if (modelFile) {
        const ext = modelFile.name.split(".").pop()?.toLowerCase() || "stl";
        const path = `${user.id}/model-${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("models-private")
          .upload(path, modelFile, { upsert: true });

        if (uploadError) {
          console.error("대표 모델 파일 업로드 실패:", uploadError);
          showError("출력파일(대표) 업로드에 실패했습니다.");
          return;
        }

        modelPath = path;
      }

      const { error: updateError } = await supabase
        .from("models")
        .update({
          title: title.trim(),
          category,
          price: parsedPrice,
          description: description.trim(),
          thumbnail: thumbnailUrl,
          thumbnail_path: thumbnailPath,
          model_file_path: modelPath,
        })
        .eq("id", model.id);

      if (updateError) {
        console.error("모델 수정 실패:", updateError);
        showError("모델 수정에 실패했습니다.");
        return;
      }

      if (detailImageFiles.length > 0) {
        const imageRows: any[] = [];

        for (let i = 0; i < detailImageFiles.length; i++) {
          const file = detailImageFiles[i];
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${user.id}/detail-${Date.now()}-${i}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("thumbnails")
            .upload(path, file, {
              upsert: true,
            });

          if (uploadError) {
            console.error("추가 이미지 업로드 실패:", uploadError);
            continue;
          }

          const publicUrl = supabase.storage
            .from("thumbnails")
            .getPublicUrl(path).data.publicUrl;

          imageRows.push({
            model_id: model.id,
            image_url: publicUrl,
            image_path: path,
            sort_order: existingImages.length + i + 1,
          });
        }

        if (imageRows.length > 0) {
          const { error: insertError } = await supabase
            .from("model_images")
            .insert(imageRows);

          if (insertError) {
            console.error("추가 이미지 저장 실패:", insertError);
          }
        }
      }

      if (extraFiles.length > 0) {
        const fileRows: any[] = [];

        for (let i = 0; i < extraFiles.length; i++) {
          const file = extraFiles[i];
          const ext = file.name.split(".").pop()?.toLowerCase() || "";
          const path = `${user.id}/extra-${Date.now()}-${i}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("models-private")
            .upload(path, file, {
              upsert: true,
            });

          if (uploadError) {
            console.error("추가 파일 업로드 실패:", uploadError);
            continue;
          }

          fileRows.push({
            model_id: model.id,
            file_name: file.name,
            file_url: "",
            file_path: path,
            file_type: ext,
            sort_order: existingFiles.length + i + 1,
          });
        }

        if (fileRows.length > 0) {
          const { error: insertError } = await supabase
            .from("model_files")
            .insert(fileRows);

          if (insertError) {
            console.error("추가 파일 저장 실패:", insertError);
          }
        }
      }

      showSuccess("모델이 수정되었습니다.");
      router.push("/my-models");
    } catch (error) {
      console.error("모델 수정 오류:", error);
      showError("수정 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <main style={{ maxWidth: 980, margin: "0 auto", padding: "36px 20px 60px" }}>
        <p style={{ color: "#6b7280" }}>수정 페이지 불러오는 중...</p>
      </main>
    );
  }

  if (!model) return null;

  return (
    <main
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "36px 20px 60px",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 38,
            fontWeight: 900,
            color: "#111827",
          }}
        >
          모델 수정
        </h1>

        <p
          style={{
            margin: "10px 0 0",
            color: "#6b7280",
            fontSize: 15,
          }}
        >
          등록한 모델 정보를 수정하고 파일과 이미지를 관리할 수 있습니다.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        style={{
          display: "grid",
          gap: 22,
          border: "1px solid #e5e7eb",
          borderRadius: 24,
          background: "white",
          padding: 24,
          boxShadow: "0 10px 30px rgba(15,23,42,0.04)",
        }}
      >
        <Field label="모델 제목">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="예: 다이아 반지"
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
            <option value="ETC">ETC</option>
          </select>
        </Field>

        <Field label="가격 (최소 5,000원)">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
            placeholder="예: 5000"
            inputMode="numeric"
            min={5000}
            style={inputStyle}
          />
        </Field>

        <Field label="설명">
          <DescriptionTemplateSelector
            description={description}
            onDescriptionChange={setDescription}
            textareaStyle={textareaStyle}
          />
        </Field>

        {/* 1. 썸네일 이미지 */}
        <Field label="현재 썸네일 이미지">
          <div style={uploadBoxStyle}>
            {getThumbnailUrl() ? (
              <img
                src={getThumbnailUrl()}
                alt="현재 썸네일"
                style={{
                  width: 220,
                  maxWidth: "100%",
                  borderRadius: 16,
                  border: "1px solid #e5e7eb",
                }}
              />
            ) : (
              <div style={helperTextStyle}>등록된 썸네일이 없습니다.</div>
            )}
          </div>
        </Field>

        <Field label="썸네일 이미지 교체">
          <div
            onDragOver={(e) => handleDragOver(e, "thumbnail")}
            onDragEnter={(e) => handleDragEnter(e, "thumbnail")}
            onDragLeave={handleDragLeave}
            onDrop={handleDropThumbnail}
            style={{
              ...uploadBoxStyle,
              border: draggingBox === "thumbnail" ? "2px solid #111827" : "1px dashed #cbd5e1",
              background: draggingBox === "thumbnail" ? "#eef2ff" : "#f8fafc",
            }}
          >
            <div style={helperTextStyle}>
              새 대표 이미지를 업로드하면 기존 썸네일을 교체합니다.
            </div>

            <input
              type="file"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
            />

            {thumbnailFile && (
              <div style={fileListStyle}>
                <div>선택 파일: {thumbnailFile.name}</div>
              </div>
            )}
          </div>
        </Field>

        {/* 2. 추가 이미지 */}
        <Field label="기존 추가 이미지">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: 14,
            }}
          >
            {existingImages.length === 0 ? (
              <div style={helperTextStyle}>등록된 추가 이미지가 없습니다.</div>
            ) : (
              existingImages.map((img) => (
                <div
                  key={img.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 16,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <img
                    src={getImageUrl(img)}
                    alt="추가 이미지"
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                  <div style={{ padding: 10 }}>
                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id)}
                      style={{
                        width: "100%",
                        height: 36,
                        borderRadius: 10,
                        border: "1px solid #d1d5db",
                        background: "white",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Field>

        <Field label="추가 이미지 업로드 (최대 10장)">
          <div
            onDragOver={(e) => handleDragOver(e, "detailImages")}
            onDragEnter={(e) => handleDragEnter(e, "detailImages")}
            onDragLeave={handleDragLeave}
            onDrop={handleDropDetailImages}
            style={{
              ...uploadBoxStyle,
              border: draggingBox === "detailImages" ? "2px solid #111827" : "1px dashed #cbd5e1",
              background: draggingBox === "detailImages" ? "#eef2ff" : "#f8fafc",
            }}
          >
            <div style={helperTextStyle}>
              새 상세 이미지를 추가로 업로드할 수 있습니다.
            </div>

            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleDetailImages(e.target.files)}
            />

            {detailImageFiles.length > 0 && (
              <div style={fileListStyle}>
                <div>선택된 파일 수: {detailImageFiles.length}장</div>
                {detailImageFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`}>
                    {idx + 1}. {file.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="출력파일(대표) 교체">
          <div
            onDragOver={(e) => handleDragOver(e, "modelFile")}
            onDragEnter={(e) => handleDragEnter(e, "modelFile")}
            onDragLeave={handleDragLeave}
            onDrop={handleDropModelFile}
            style={{
              ...uploadBoxStyle,
              border: draggingBox === "modelFile" ? "2px solid #111827" : "1px dashed #cbd5e1",
              background: draggingBox === "modelFile" ? "#eef2ff" : "#f8fafc",
            }}
          >
            <div style={helperTextStyle}>
              새 모델 파일을 올리면 기존 출력파일(대표)을 교체합니다.
            </div>

            <input
              type="file"
              accept=".stl,.obj,.3dm,.glb,.gltf,.zip"
              onChange={(e) => setModelFile(e.target.files?.[0] || null)}
            />

            {modelFile && (
              <div style={fileListStyle}>
                <div>선택 파일: {modelFile.name}</div>
              </div>
            )}
          </div>
        </Field>

        {/* 4. 추가 파일 */}
        <Field label="기존 추가 파일">
          <div style={{ display: "grid", gap: 8 }}>
            {existingFiles.length === 0 ? (
              <div style={helperTextStyle}>등록된 추가 파일이 없습니다.</div>
            ) : (
              existingFiles.map((file, idx) => (
                <div
                  key={file.id}
                  style={{
                    display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 10,
                    padding: "10px 14px",
                    borderRadius: 12, border: "1px solid #e5e7eb",
                    background: "white", fontSize: 13,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{
                      background: "#111827", color: "white",
                      borderRadius: 6, padding: "2px 8px",
                      fontSize: 11, fontWeight: 900, flexShrink: 0,
                    }}>
                      {(file.file_type || "파일").toUpperCase()}
                    </span>
                    <span style={{
                      fontWeight: 700, color: "#111827",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {file.file_name || `파일 ${idx + 1}`}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => removeExistingFile(file.id)}
                    style={{
                      flexShrink: 0, height: 32, padding: "0 12px",
                      borderRadius: 8, border: "1px solid #fca5a5",
                      background: "white", color: "#dc2626",
                      fontWeight: 800, fontSize: 13, cursor: "pointer",
                    }}
                  >
                    삭제
                  </button>
                </div>
              ))
            )}
          </div>
        </Field>

        <Field label="추가 파일 업로드 (최대 10개)">
          <div
            onDragOver={(e) => handleDragOver(e, "extraFiles")}
            onDragEnter={(e) => handleDragEnter(e, "extraFiles")}
            onDragLeave={handleDragLeave}
            onDrop={handleDropExtraFiles}
            style={{
              ...uploadBoxStyle,
              border: draggingBox === "extraFiles" ? "2px solid #111827" : "1px dashed #cbd5e1",
              background: draggingBox === "extraFiles" ? "#eef2ff" : "#f8fafc",
            }}
          >
            <div style={helperTextStyle}>
              대표 파일 외에 STL, OBJ, 3DM, ZIP, PDF 등의 보조 파일을 추가할 수 있습니다.
            </div>

            <input
              type="file"
              accept=".stl,.obj,.3dm,.glb,.gltf,.zip,.pdf"
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
                      onClick={() => setExtraFiles((prev) => prev.filter((_, i) => i !== idx))}
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

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
            marginTop: 8,
          }}
        >
          <button
            type="button"
            onClick={() => router.push("/my-models")}
            style={{
              height: 46,
              padding: "0 16px",
              borderRadius: 14,
              border: "1px solid #d1d5db",
              background: "white",
              color: "#111827",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            취소
          </button>

          <button
            type="submit"
            disabled={saving}
            style={{
              height: 46,
              padding: "0 18px",
              borderRadius: 14,
              border: "none",
              background: "#111827",
              color: "white",
              fontWeight: 900,
              cursor: "pointer",
            }}
          >
            {saving ? "저장 중..." : "수정 완료"}
          </button>
        </div>
      </form>
    </main>
  );
}