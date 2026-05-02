"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo, showSuccess } from "../lib/toast";

export type DescriptionTemplate = {
  id: string;
  name: string;
  content: string;
};

type Props = {
  description: string;
  onDescriptionChange: (value: string) => void;
  textareaStyle?: React.CSSProperties;
  placeholder?: string;
};

const baseTextareaStyle: React.CSSProperties = {
  minHeight: 140,
  borderRadius: 16,
  border: "1px solid #d1d5db",
  padding: 14,
  outline: "none",
  fontSize: 14,
  resize: "vertical",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  width: "100%",
  boxSizing: "border-box",
};

export default function DescriptionTemplateSelector({
  description,
  onDescriptionChange,
  textareaStyle,
  placeholder = "모델 설명을 입력하세요.",
}: Props) {
  const [templates, setTemplates] = useState<DescriptionTemplate[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<DescriptionTemplate | null>(null);
  const [editingName, setEditingName] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    const uid = (decodeJwt(token) as any)?.sub as string;
    if (!uid) return;
    setUserId(uid);
    loadTemplates(uid);
  }, []);

  useEffect(() => {
    if (openIdx === null) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenIdx(null); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [openIdx]);

  const loadTemplates = async (uid: string) => {
    const { data, error } = await supabase
      .from("description_templates")
      .select("id, name, content")
      .eq("user_id", uid)
      .order("created_at", { ascending: true });
    if (error) { console.error("템플릿 로드 실패:", error); return; }
    setTemplates((data || []) as DescriptionTemplate[]);
  };

  const saveTemplate = async () => {
    const value = description.trim();
    if (!value) { showInfo("설명 내용을 먼저 입력하세요."); return; }
    if (!userId) return;
    if (templates.length >= 10) { showError("템플릿은 최대 10개까지만 저장할 수 있습니다."); return; }

    const { data, error } = await supabase
      .from("description_templates")
      .insert({ user_id: userId, name: `템플릿 ${templates.length + 1}`, content: value })
      .select("id, name, content")
      .single();

    if (error) { showError("템플릿 저장에 실패했습니다."); return; }
    setTemplates((prev) => [...prev, data as DescriptionTemplate]);
    showSuccess("설명 템플릿이 저장되었습니다.");
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from("description_templates")
      .delete()
      .eq("id", id);
    if (error) { showError("템플릿 삭제에 실패했습니다."); return; }
    setTemplates((prev) => prev.filter((t) => t.id !== id));
    if (openIdx !== null) setOpenIdx(null);
  };

  const startRename = (id: string) => {
    const target = templates.find((t) => t.id === id);
    if (!target) return;
    setEditingTemplate(target);
    setEditingName(target.name);
  };

  const saveRename = async () => {
    if (!editingTemplate) return;
    const name = editingName.trim();
    if (!name) { showInfo("템플릿 이름을 입력하세요."); return; }

    const { error } = await supabase
      .from("description_templates")
      .update({ name })
      .eq("id", editingTemplate.id);

    if (error) { showError("이름 변경에 실패했습니다."); return; }
    setTemplates((prev) => prev.map((t) => (t.id === editingTemplate.id ? { ...t, name } : t)));
    setEditingTemplate(null);
    setEditingName("");
  };

  const cancelRename = () => {
    setEditingTemplate(null);
    setEditingName("");
  };

  return (
    <>
      {/* onClick stopPropagation: Field 컴포넌트의 <label> 래퍼가 내부 클릭을 가로채는 것을 방지 */}
      <div style={{ display: "grid", gap: 12 }} onClick={(e) => e.stopPropagation()}>
        {/* 템플릿 저장 버튼 + 기존 템플릿 목록 */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={saveTemplate}
            style={{
              height: 38, padding: "0 14px", borderRadius: 12,
              border: "1px solid #d1d5db", background: "white",
              fontWeight: 800, fontSize: 13, cursor: "pointer", flexShrink: 0,
            }}
          >
            현재 설명 템플릿 저장
          </button>

          {templates.map((item, idx) => (
            <div
              key={item.id}
              style={{ position: "relative", display: "inline-block" }}
            >
              <button
                type="button"
                onClick={() => setOpenIdx(openIdx === idx ? null : idx)}
                style={{
                  height: 38, padding: "0 12px", borderRadius: 999,
                  border: "1px solid #d1d5db",
                  background: openIdx === idx ? "#111827" : "white",
                  color: openIdx === idx ? "white" : "#111827",
                  fontWeight: 800, fontSize: 13, cursor: "pointer",
                  maxWidth: 120, overflow: "hidden",
                  textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}
              >
                {item.name}
              </button>

              {openIdx === idx && (
                <div style={{
                  position: "absolute", top: "calc(100% + 8px)", left: 0,
                  width: 320, maxWidth: "70vw",
                  padding: 12, borderRadius: 14,
                  border: "1px solid #e5e7eb", background: "white",
                  boxShadow: "0 16px 40px rgba(15,23,42,0.16)",
                  zIndex: 30, display: "grid", gap: 10,
                }}>
                  <div style={{
                    fontSize: 13, color: "#374151", lineHeight: 1.5,
                    whiteSpace: "pre-wrap", wordBreak: "break-word",
                    maxHeight: 180, overflowY: "auto",
                  }}>
                    {item.content}
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { onDescriptionChange(item.content); setOpenIdx(null); }}
                      style={{
                        height: 32, padding: "0 10px", borderRadius: 10,
                        border: "none", background: "#111827", color: "white",
                        fontWeight: 800, cursor: "pointer",
                      }}
                    >
                      적용
                    </button>

                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => startRename(item.id)}
                        style={{
                          height: 32, padding: "0 10px", borderRadius: 10,
                          border: "1px solid #d1d5db", background: "white",
                          color: "#111827", fontWeight: 800, cursor: "pointer",
                        }}
                      >
                        이름 수정
                      </button>

                      <button
                        type="button"
                        onClick={() => deleteTemplate(item.id)}
                        style={{
                          height: 32, padding: "0 10px", borderRadius: 10,
                          border: "1px solid #fca5a5", background: "white",
                          color: "#dc2626", fontWeight: 800, cursor: "pointer",
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

        <textarea
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={placeholder}
          style={{ ...baseTextareaStyle, ...textareaStyle }}
        />
      </div>

      {/* 이름 수정 모달 */}
      {editingTemplate && (
        <div
          onClick={cancelRename}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(15,23,42,0.38)",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 9999, padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 420,
              background: "white", borderRadius: 20,
              border: "1px solid #e5e7eb",
              boxShadow: "0 24px 60px rgba(15,23,42,0.2)",
              padding: 22, display: "grid", gap: 14,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 900, color: "#111827" }}>
              템플릿 이름 수정
            </div>
            <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>
              템플릿 이름을 알아보기 쉽게 수정하세요.
            </div>

            <input
              value={editingName}
              onChange={(e) => setEditingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); saveRename(); }
                if (e.key === "Escape") cancelRename();
              }}
              placeholder="템플릿 이름 입력"
              autoFocus
              style={{
                height: 46, borderRadius: 12, border: "1px solid #d1d5db",
                padding: "0 14px", fontSize: 14, outline: "none",
                width: "100%", boxSizing: "border-box",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={cancelRename}
                style={{
                  height: 40, padding: "0 14px", borderRadius: 12,
                  border: "1px solid #d1d5db", background: "white",
                  color: "#111827", fontWeight: 800, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={saveRename}
                style={{
                  height: 40, padding: "0 14px", borderRadius: 12,
                  border: "none", background: "#111827", color: "white",
                  fontWeight: 800, cursor: "pointer",
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
