"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import toast from "react-hot-toast";
import { showError, showInfo, showSuccess } from "../lib/toast";

export default function UploadPage() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("RING");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [detailImageFiles, setDetailImageFiles] = useState<File[]>([]);
  const [modelFile, setModelFile] = useState<File | null>(null);

  const [editingTemplate, setEditingTemplate] = useState<DescriptionTemplate | null>(null);
  const [editingName, setEditingName] = useState("");

  const [uploading, setUploading] = useState(false);

  type DescriptionTemplate = {
    id: string;
    name: string;
    content: string;
  };

  const [descriptionTemplates, setDescriptionTemplates] = useState<DescriptionTemplate[]>([]);
  const [hoveredTemplateIndex, setHoveredTemplateIndex] = useState<number | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [extraFiles, setExtraFiles] = useState<File[]>([]);

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

  const saveTemplate = () => {
    const value = description.trim();

    if (!value) {
      showInfo("설명 내용을 먼저 입력하세요.");
      return;
    }

    if (descriptionTemplates.length >= 10) {
      showError("템플릿은 최대 10개까지만 저장할 수 있습니다.");
      return;
    }

    const nextTemplate = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: `템플릿 ${descriptionTemplates.length + 1}`,
      content: value,
    };

    const next = [...descriptionTemplates, nextTemplate];

    setDescriptionTemplates(next);
    localStorage.setItem("upload_description_templates", JSON.stringify(next));
    showSuccess("설명 템플릿이 저장되었습니다.");
  };

  const applyTemplate = (template: DescriptionTemplate) => {
    setDescription(template.content);
  };

  const deleteTemplate = (id: string) => {
    const next = descriptionTemplates.filter((item) => item.id !== id);
    setDescriptionTemplates(next);
    localStorage.setItem("upload_description_templates", JSON.stringify(next));
  };

  const renameTemplate = (id: string) => {
    const target = descriptionTemplates.find((item) => item.id === id);
    if (target == null) return;

    setEditingTemplate(target);
    setEditingName(target.name);
  };

  const saveEditedTemplateName = () => {
    if (!editingTemplate) return;

    const nextName = editingName.trim();
    if (!nextName) {
      showInfo("템플릿 이름을 입력하세요.");
      return;
    }

    const next = descriptionTemplates.map((item) =>
      item.id === editingTemplate.id ? { ...item, name: nextName } : item
    );

    setDescriptionTemplates(next);
    localStorage.setItem("upload_description_templates", JSON.stringify(next));

    setEditingTemplate(null);
    setEditingName("");
  };

  useEffect(() => {
    const raw = localStorage.getItem("upload_description_templates");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);

      if (Array.isArray(parsed)) {
        // 예전 string[] 구조도 호환
        const normalized = parsed.map((item: any, idx: number) => {
          if (typeof item === "string") {
            return {
              id: `legacy-${idx}`,
              name: `템플릿 ${idx + 1}`,
              content: item,
            };
          }

          return {
            id: item.id || `template-${idx}`,
            name: item.name || `템플릿 ${idx + 1}`,
            content: item.content || "",
          };
        });

        setDescriptionTemplates(normalized);
      }
    } catch {}
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    try {
      if (!title.trim()) {
        showInfo("모델명을 입력하세요.");
        return;
      }

      if (!price.trim()) {
        showInfo("가격을 입력하세요.");
        return;
      }

      if (!thumbnailFile) {
        showInfo("썸네일 이미지를 선택하세요.");
        return;
      }

      if (!modelFile) {
        showInfo("모델 파일을 선택하세요.");
        return;
      }

      setUploading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        showInfo("로그인이 필요합니다.");
        return;
      }

      const sellerId = session.user.id;
      const now = Date.now();

      const thumbExt = thumbnailFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const thumbPath = `${sellerId}/${now}-thumb.${thumbExt}`;

      const { error: thumbUploadError } = await supabase.storage
        .from("thumbnails")
        .upload(thumbPath, thumbnailFile, {
          upsert: true,
        });

      if (thumbUploadError) {
        showError(`썸네일 업로드 실패: ${thumbUploadError.message}`);
        return;
      }

      const thumbnailUrl = supabase.storage
        .from("thumbnails")
        .getPublicUrl(thumbPath).data.publicUrl;

      const modelExt = modelFile.name.split(".").pop()?.toLowerCase() || "obj";
      const modelPath = `${sellerId}/${now}-model.${modelExt}`;

      const { error: modelUploadError } = await supabase.storage
        .from("models-private")
        .upload(modelPath, modelFile, {
          upsert: true,
        });

      if (modelUploadError) {
        showError(`모델 파일 업로드 실패: ${modelUploadError.message}`);
        return;
      }

      const { data: insertedModel, error: insertModelError } = await supabase
        .from("models")
        .insert({
          title,
          category,
          price: Number(price),
          description,
          thumbnail: thumbnailUrl,
          thumbnail_path: thumbPath,
          seller_id: sellerId,
          file_url: "",
          model_file_path: modelPath,
        })
        .select("*")
        .single();

      if (insertModelError) {
        console.error("모델 저장 실패:", insertModelError);
        showError("모델 저장에 실패했습니다.");
        return;
      }

      if (detailImageFiles.length > 0) {
        const imageRows: any[] = [];

        for (let i = 0; i < detailImageFiles.length; i++) {
          const file = detailImageFiles[i];
          const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${sellerId}/detail-${now}-${i}.${ext}`;

          const { error } = await supabase.storage
            .from("thumbnails")
            .upload(path, file, {
              upsert: true,
            });

          if (error) {
            console.error("추가 이미지 업로드 실패:", error);
            continue;
          }

          const url = supabase.storage
            .from("thumbnails")
            .getPublicUrl(path).data.publicUrl;

          imageRows.push({
            model_id: insertedModel.id,
            image_url: url,
            image_path: path,
            sort_order: i + 1,
          });
        }

        if (extraFiles.length > 0) {
          const fileRows: any[] = [];

          for (let i = 0; i < extraFiles.length; i++) {
            const file = extraFiles[i];
            const ext = file.name.split(".").pop()?.toLowerCase() || "";
            const path = `${sellerId}/extra-${now}-${i}.${ext}`;

            const { error } = await supabase.storage
              .from("models-private")
              .upload(path, file, {
                upsert: true,
              });

            if (error) {
              console.error("추가 파일 업로드 실패:", error);
              continue;
            }

            const { data: signedData, error: signedError } = await supabase.storage
              .from("models-private")
              .createSignedUrl(path, 60 * 60 * 24 * 7);

            if (signedError || !signedData?.signedUrl) {
              console.error("추가 파일 signed url 생성 실패:", signedError);
              continue;
            }

            fileRows.push({
              model_id: insertedModel.id,
              file_name: file.name,
              file_url: signedData.signedUrl,
              file_path: path,
              file_type: ext,
              sort_order: i + 1,
            });
          }

          if (fileRows.length > 0) {
            const { error: fileInsertError } = await supabase
              .from("model_files")
              .insert(fileRows);

            if (fileInsertError) {
              console.error("추가 파일 DB 저장 실패:", fileInsertError);
            }
          }
        }

        if (imageRows.length > 0) {
          const { error: imageInsertError } = await supabase
            .from("model_images")
            .insert(imageRows);

          if (imageInsertError) {
            console.error("추가 이미지 저장 실패:", imageInsertError);
          }
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
      <h1
        style={{
          margin: 0,
          fontSize: 40,
          fontWeight: 900,
          color: "#111827",
        }}
      >
        모델 업로드
      </h1>

      <p
        style={{
          margin: "10px 0 0",
          color: "#6b7280",
          fontSize: 15,
        }}
      >
        썸네일 1장과 추가 이미지 최대 10장까지 업로드할 수 있습니다.
      </p>

      <form
        onSubmit={handleSubmit}
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
            <option value="SET">SET</option>
          </select>
        </Field>

        <Field label="가격">
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^0-9]/g, ""))}
            style={inputStyle}
          />
        </Field>

        <Field label="설명">
          <div style={{ display: "grid", gap: 12 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={saveTemplate}
                style={{
                  height: 38,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                  flexShrink: 0,
                }}
              >
                현재 설명 템플릿 저장
              </button>

              {descriptionTemplates.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                    position: "relative",
                  }}
                >
                {descriptionTemplates.slice(0, 10).map((item, idx) => (
                  <div
                    key={item.id}
                    style={{
                      position: "relative",
                      display: "inline-block"
                    }}
                    onMouseEnter={() => setHoveredTemplateIndex(idx)}
                    onMouseLeave={() => setHoveredTemplateIndex(null)}
                  >
                     <button           // 템플릿 버튼
                      type="button"
                      title={item.name}
                      onClick={() => applyTemplate(item)}
                      style={{
                        height: 38,
                        padding: "0 12px",
                        borderRadius: 999,
                        border: "1px solid #d1d5db",
                        background: hoveredTemplateIndex === idx ? "#111827" : "white",
                        color: hoveredTemplateIndex === idx ? "white" : "#111827",
                        fontWeight: 800,
                        fontSize: 13,
                        cursor: "pointer",

                        // 🔥 추가
                        maxWidth: 120,           // ← 길이 제한 (중요)
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.name}
                    </button>

                    {hoveredTemplateIndex === idx && (
                      <>
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            width: 320,
                            height: 12,
                            background: "transparent",
                            zIndex: 29,
                          }}
                        />

                        <div
                          style={{
                            position: "absolute",
                            top: "calc(100% + 8px)",
                            left: 0,
                            width: 320,
                            maxWidth: "70vw",
                            padding: 12,
                            borderRadius: 14,
                            border: "1px solid #e5e7eb",
                            background: "white",
                            boxShadow: "0 16px 40px rgba(15,23,42,0.16)",
                            zIndex: 30,
                            display: "grid",
                            gap: 10,
                          }}
                        >
                          ...
                        </div>
                      </>
                    )}

                    {hoveredTemplateIndex === idx && (
                      <div
                        style={{
                          position: "absolute",
                          top: 40,
                          left: 0,
                          width: 320,
                          maxWidth: "70vw",
                          padding: 12,
                          borderRadius: 14,
                          border: "1px solid #e5e7eb",
                          background: "white",
                          boxShadow: "0 16px 40px rgba(15,23,42,0.16)",
                          zIndex: 30,
                          display: "grid",
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 13,
                            color: "#374151",
                            lineHeight: 1.5,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                            maxHeight: 180,
                            overflowY: "auto",
                          }}
                        >
                          {item.content}
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <button
                            type="button"
                            onClick={() => {
                              applyTemplate(item);
                              setHoveredTemplateIndex(null);
                            }}
                            style={{
                              height: 32,
                              padding: "0 10px",
                              borderRadius: 10,
                              border: "none",
                              background: "#111827",
                              color: "white",
                              fontWeight: 800,
                              cursor: "pointer",
                            }}
                          >
                            적용
                          </button>

                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => renameTemplate(item.id)}
                              style={{
                                height: 32,
                                padding: "0 10px",
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                background: "white",
                                color: "#111827",
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              이름 수정
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteTemplate(item.id)}
                              style={{
                                height: 32,
                                padding: "0 10px",
                                borderRadius: 10,
                                border: "1px solid #d1d5db",
                                background: "white",
                                color: "#111827",
                                fontWeight: 800,
                                cursor: "pointer",
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                </div>
              )}
            </div>

            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={textareaStyle}
            />
          </div>
        </Field>

        <Field label="썸네일 이미지">
          <div style={uploadBoxStyle}>
            <div style={helperTextStyle}>
              대표로 보여질 이미지를 1장 업로드하세요.
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

        <Field label="추가 이미지 (최대 10장)">
          <div style={uploadBoxStyle}>
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

        <Field label="대표 모델 파일">
          <div style={uploadBoxStyle}>
            <div style={helperTextStyle}>
              대표 모델 파일 1개를 업로드하세요. 예: STL, OBJ, 3DM
            </div>

            <input
              type="file"
              accept=".stl,.obj,.3dm"
              onChange={(e) => setModelFile(e.target.files?.[0] || null)}
            />

            {modelFile && (
              <div style={fileListStyle}>
                <div>선택 파일: {modelFile.name}</div>
              </div>
            )}
          </div>
        </Field>

        <Field label="추가 파일 (최대 10개)">
          <div style={uploadBoxStyle}>
            <div style={helperTextStyle}>
              대표 모델 파일 외에 보조 파일을 추가로 업로드할 수 있습니다.
              예: STL, OBJ, 3DM, ZIP, PDF
            </div>

            <input
              type="file"
              accept=".stl,.obj,.3dm,.zip,.pdf"
              multiple
              onChange={(e) => handleExtraFiles(e.target.files)}
            />

            <div style={fileListStyle}>
              <div>선택된 파일 수: {extraFiles.length}개</div>
              {extraFiles.map((file, idx) => (
                <div key={`${file.name}-${idx}`}>{idx + 1}. {file.name}</div>
              ))}
            </div>
          </div>
        </Field>

        <button
          type="submit"
          disabled={uploading}
          style={{
            height: 54,
            borderRadius: 16,
            border: "none",
            background: "#111827",
            color: "white",
            fontWeight: 900,
            fontSize: 17,
            cursor: "pointer",
          }}
        >
          {uploading ? "업로드 중..." : "업로드"}
        </button>
      </form>

      {editingTemplate && (
        <div
          onClick={() => {
            setEditingTemplate(null);
            setEditingName("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.38)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 20,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(15, 23, 42, 0.2)",
              padding: 22,
              display: "grid",
              gap: 14,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              템플릿 이름 수정
            </div>

            <div
              style={{
                fontSize: 13,
                color: "#6b7280",
                lineHeight: 1.5,
              }}
            >
              템플릿 이름을 알아보기 쉽게 수정하세요.
            </div>

            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  saveEditedTemplateName();
                }

                if (e.key === "Escape") {
                  setEditingTemplate(null);
                  setEditingName("");
                }
              }}
              placeholder="템플릿 이름 입력"
              autoFocus
              style={{
                height: 46,
                borderRadius: 12,
                border: "1px solid #d1d5db",
                padding: "0 14px",
                fontSize: 14,
                outline: "none",
              }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                marginTop: 4,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setEditingTemplate(null);
                  setEditingName("");
                }}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#111827",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                취소
              </button>

              <button
                type="button"
                onClick={saveEditedTemplateName}
                style={{
                  height: 40,
                  padding: "0 14px",
                  borderRadius: 12,
                  border: "none",
                  background: "#111827",
                  color: "white",
                  fontWeight: 800,
                  cursor: "pointer",
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label
      style={{
        display: "grid",
        gap: 8,
        fontWeight: 800,
        color: "#111827",
      }}
    >
      {label}
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  height: 48,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  outline: "none",
  fontSize: 14,
};

const textareaStyle: React.CSSProperties = {
  minHeight: 140,
  borderRadius: 16,
  border: "1px solid #d1d5db",
  padding: 14,
  outline: "none",
  fontSize: 14,
  resize: "vertical",
  fontFamily:
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};