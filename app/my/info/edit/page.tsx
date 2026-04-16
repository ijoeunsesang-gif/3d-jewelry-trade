"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { showError, showSuccess } from "../../../lib/toast";

type SenderTemplate = {
  id: string;
  name: string;
  email: string;
  businessName: string;
  phoneNumber: string;
  notes: string;
};

const SENDER_TEMPLATES_KEY = "sender_templates";

function loadTemplates(): SenderTemplate[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SENDER_TEMPLATES_KEY) || "[]"); }
  catch { return []; }
}
function saveTemplates(t: SenderTemplate[]) {
  localStorage.setItem(SENDER_TEMPLATES_KEY, JSON.stringify(t));
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.startsWith("010")) {
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  } else {
    if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
}
function isValidPhone(v: string) { return /^01[0-9]-\d{3,4}-\d{4}$/.test(v); }

const inputStyle: React.CSSProperties = {
  width: "100%", height: 48, borderRadius: 12, border: "1.5px solid #d1d5db",
  padding: "0 14px", fontSize: 15, boxSizing: "border-box", outline: "none",
};
const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 6, display: "block",
};

function MyInfoEditContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modelId = searchParams.get("modelId") || "";

  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const [notes, setNotes] = useState("");

  const handleSave = () => {
    if (!businessName.trim()) { showError("상호명(성함)을 입력해주세요."); return; }
    if (!phone.trim()) { showError("연락처를 입력해주세요."); return; }
    if (!isValidPhone(phone)) { setPhoneError(true); showError("올바른 전화번호를 입력해주세요."); return; }

    const newTpl: SenderTemplate = {
      id: crypto.randomUUID(),
      name: businessName.trim(),
      email: "",
      businessName: businessName.trim(),
      phoneNumber: phone.trim(),
      notes: notes.trim(),
    };
    const existing = loadTemplates();
    saveTemplates([newTpl, ...existing]);
    showSuccess("내 정보가 저장되었습니다.");

    if (modelId) {
      router.push(`/send-to-printer?modelId=${modelId}`);
    } else {
      router.back();
    }
  };

  return (
    <>
      <style>{`
        .info-edit-bottom {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: white; border-top: 1px solid #f3f4f6;
          padding: 12px 20px 20px; z-index: 50;
        }
        @media (max-width: 768px) {
          .info-edit-bottom { bottom: 72px; }
        }
      `}</style>

      {/* 상단 헤더 */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "white", borderBottom: "1px solid #f3f4f6",
        padding: "14px 20px", display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            width: 38, height: 38, borderRadius: 10,
            border: "1px solid #e5e7eb", background: "white",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#374151", flexShrink: 0,
          }}
          aria-label="뒤로가기"
        >←</button>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#c9a84c", marginBottom: 2 }}>
            처음 이용 시 1회 입력
          </div>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: "#111827", margin: 0 }}>
            기본정보 입력
          </h1>
        </div>
      </div>

      {/* 본문 */}
      <main style={{
        maxWidth: 560, margin: "0 auto",
        padding: "24px 20px 160px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 28 }}>
          저장된 정보는 다음 전송 시 자동으로 입력됩니다.
        </p>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>상호명 (성함)<span style={{ color: "#ef4444" }}>*</span></label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="예: 홍길동 공방"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>연락처 <span style={{ color: "#ef4444" }}>*</span></label>
          <input
            value={phone}
            onChange={(e) => {
              const formatted = formatPhone(e.target.value);
              setPhone(formatted);
              if (phoneError && isValidPhone(formatted)) setPhoneError(false);
            }}
            onBlur={() => { if (phone && !isValidPhone(phone)) setPhoneError(true); }}
            placeholder="010-0000-0000"
            style={{ ...inputStyle, border: phoneError ? "1.5px solid #ef4444" : "1.5px solid #d1d5db" }}
          />
          {phoneError && (
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#ef4444" }}>
              올바른 전화번호를 입력해주세요
            </p>
          )}
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>기본 요청사항</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="출력 시 참고할 내용을 입력해주세요."
            rows={4}
            style={{
              width: "100%", borderRadius: 12, border: "1.5px solid #d1d5db",
              padding: "12px 14px", fontSize: 15, boxSizing: "border-box",
              outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6,
            }}
          />
        </div>
      </main>

      {/* 하단 고정 버튼 */}
      <div className="info-edit-bottom">
        <div style={{ maxWidth: 560, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          <button
            type="button"
            onClick={() => router.back()}
            style={{
              height: 52, borderRadius: 14, border: "1.5px solid #d1d5db",
              background: "white", color: "#111827", fontWeight: 700,
              fontSize: 15, cursor: "pointer",
            }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              height: 52, borderRadius: 14, border: "none",
              background: "#111827", color: "white", fontWeight: 900,
              fontSize: 15, cursor: "pointer",
            }}
          >
            저장 →
          </button>
        </div>
      </div>
    </>
  );
}

export default function MyInfoEditPage() {
  return (
    <Suspense fallback={null}>
      <MyInfoEditContent />
    </Suspense>
  );
}
