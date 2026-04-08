"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase";
import { showError, showInfo, showSuccess } from "../lib/toast";

/* ── 타입 ─────────────────────────────────────────────────── */
type PrinterContact = { id: string; name: string; email: string };
type SenderTemplate = {
  id: string; name: string; email: string;
  businessName: string; phoneNumber: string; notes: string;
};
type ModelFile = { name: string; path: string; isMain: boolean };

/* ── 로컬스토리지 ─────────────────────────────────────────── */
const ALL_PRINTERS_KEY = "all_printers";
const SENDER_TEMPLATES_KEY = "sender_templates";
const INITIAL_PRINTERS: PrinterContact[] = [
  { id: "default-gain", name: "가인출력소", email: "anscy2138@naver.com" },
  { id: "default-rpm",  name: "RPM",       email: "ssino1@daum.net" },
];
function loadAllPrinters(): PrinterContact[] {
  if (typeof window === "undefined") return INITIAL_PRINTERS;
  try {
    const raw = localStorage.getItem(ALL_PRINTERS_KEY);
    if (!raw) { localStorage.setItem(ALL_PRINTERS_KEY, JSON.stringify(INITIAL_PRINTERS)); return INITIAL_PRINTERS; }
    return JSON.parse(raw);
  } catch { return INITIAL_PRINTERS; }
}
function saveAllPrinters(p: PrinterContact[]) { localStorage.setItem(ALL_PRINTERS_KEY, JSON.stringify(p)); }
function loadTemplates(): SenderTemplate[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SENDER_TEMPLATES_KEY) || "[]"); }
  catch { return []; }
}
function saveTemplates(t: SenderTemplate[]) { localStorage.setItem(SENDER_TEMPLATES_KEY, JSON.stringify(t)); }

/* ── 전화번호 유틸 ───────────────────────────────────────── */
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

/* ── 스타일 상수 ─────────────────────────────────────────── */
const inputStyle: React.CSSProperties = {
  width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #d1d5db",
  padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none",
};
const selectStyle: React.CSSProperties = {
  width: "100%", height: 40, borderRadius: 10, border: "1.5px solid #d1d5db",
  padding: "0 12px", fontSize: 14, boxSizing: "border-box", background: "white", cursor: "pointer",
};
const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 4, display: "block" };
const fieldWrap: React.CSSProperties = { marginBottom: 10 };
const sectionTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 10, display: "block" };
const section = (bg?: string): React.CSSProperties => ({
  padding: "14px 20px 16px", borderBottom: "1px solid #f3f4f6",
  ...(bg ? { background: bg } : {}),
});

/* ── 메인 컴포넌트 ───────────────────────────────────────── */
function SendToPrinterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modelId = searchParams.get("modelId") || "";

  /* 모델 정보 */
  const [modelTitle, setModelTitle] = useState("");
  const [modelFilePath, setModelFilePath] = useState<string | null>(null);

  /* 출력소 */
  const [printers, setPrinters] = useState<PrinterContact[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [printerEmail, setPrinterEmail] = useState("");
  const [printerFormMode, setPrinterFormMode] = useState<"add" | "edit" | null>(null);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerFormName, setPrinterFormName] = useState("");
  const [printerFormEmail, setPrinterFormEmail] = useState("");

  /* 템플릿 */
  const [templates, setTemplates] = useState<SenderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateFormMode, setTemplateFormMode] = useState<"add" | "edit" | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplFormName, setTplFormName] = useState("");
  const [tplFormEmail, setTplFormEmail] = useState("");
  const [tplFormBusinessName, setTplFormBusinessName] = useState("");
  const [tplFormPhoneNumber, setTplFormPhoneNumber] = useState("");
  const [tplFormNotes, setTplFormNotes] = useState("");
  const [tplPhoneError, setTplPhoneError] = useState(false);

  /* 발신 정보 */
  const [senderEmail, setSenderEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState(false);

  /* 출력 옵션 */
  const [printType, setPrintType] = useState<"CPX" | "일반" | "">("");
  const [castingType, setCastingType] = useState<"수지상태" | "은주물" | "금주물" | "">("");
  const [goldDetail, setGoldDetail] = useState<
    "14K_골드" | "14K_화이트" | "14K_핑크" | "18K_골드" | "18K_화이트" | "18K_핑크" | "25K" | "백금" | ""
  >("");
  const [scaleType, setScaleType] = useState<"" | "확대" | "축소">("");
  const [scalePercent, setScalePercent] = useState("0");
  const [extraNote, setExtraNote] = useState("");

  /* 파일 */
  const [modelFiles, setModelFiles] = useState<ModelFile[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [filesLoading, setFilesLoading] = useState(false);

  /* 전송 상태 */
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");

  /* ── 초기화 ───────────────────────────────────────────── */
  useEffect(() => {
    if (!modelId) { router.replace("/library"); return; }
    init();
  }, [modelId]);

  const init = async () => {
    // 템플릿 체크
    const existingTpls = loadTemplates();
    if (existingTpls.length === 0) {
      router.replace(`/my/info/edit?modelId=${modelId}`);
      return;
    }

    // 모델 정보 조회
    const { data: model } = await supabase
      .from("models").select("title, model_file_path").eq("id", modelId).single();
    if (model) {
      setModelTitle(model.title || "");
      setModelFilePath(model.model_file_path || null);
    }

    // 출력소·템플릿 로드
    setPrinters(loadAllPrinters());
    setTemplates(existingTpls);
    const firstTpl = existingTpls[0];
    setSelectedTemplateId(firstTpl.id);
    setSenderEmail(firstTpl.email || "");
    setBusinessName(firstTpl.businessName || "");
    setPhoneNumber(firstTpl.phoneNumber || "");
    setExtraNote(firstTpl.notes || "");

    // 파일 목록 조회
    setFilesLoading(true);
    const files: ModelFile[] = [];
    const filePath = model?.model_file_path;
    if (filePath) files.push({ name: filePath.split("/").pop() || "대표 파일", path: filePath, isMain: true });
    const { data: extras } = await supabase
      .from("model_files").select("file_name, file_path")
      .eq("model_id", modelId).order("sort_order", { ascending: true });
    if (extras) extras.forEach((f: any) => files.push({ name: f.file_name, path: f.file_path, isMain: false }));
    setModelFiles(files);
    setSelectedPaths(new Set(files.map((f) => f.path)));
    setFilesLoading(false);
  };

  /* ── 출력소 핸들러 ─────────────────────────────────────── */
  const handleSelectPrinter = (p: PrinterContact) => {
    setSelectedPrinterId(p.id);
    setPrinterEmail(p.email);
    setPrinterFormMode(null);
  };
  const handleSubmitPrinterForm = () => {
    const name = printerFormName.trim(), email = printerFormEmail.trim();
    if (!name) { showError("출력소 이름을 입력해주세요."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError("유효한 이메일 주소를 입력해주세요."); return; }
    if (printerFormMode === "edit" && editingPrinterId) {
      const updated = printers.map((p) => p.id === editingPrinterId ? { ...p, name, email } : p);
      setPrinters(updated); saveAllPrinters(updated);
      if (selectedPrinterId === editingPrinterId) setPrinterEmail(email);
      showSuccess("출력소를 수정했습니다.");
    } else {
      const np: PrinterContact = { id: crypto.randomUUID(), name, email };
      const updated = [...printers, np];
      setPrinters(updated); saveAllPrinters(updated);
      handleSelectPrinter(np);
      showSuccess("출력소를 추가했습니다.");
    }
    setPrinterFormMode(null); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail("");
  };
  const startEditPrinter = (p: PrinterContact) => {
    setPrinterFormMode("edit"); setEditingPrinterId(p.id);
    setPrinterFormName(p.name); setPrinterFormEmail(p.email);
  };
  const handleDeletePrinter = (id: string) => {
    if (!confirm("출력소를 삭제할까요?")) return;
    const updated = printers.filter((p) => p.id !== id);
    setPrinters(updated); saveAllPrinters(updated);
    if (selectedPrinterId === id) { setSelectedPrinterId(null); setPrinterEmail(""); }
    setPrinterFormMode(null);
  };

  /* ── 템플릿 핸들러 ─────────────────────────────────────── */
  const handleSelectTemplate = (t: SenderTemplate) => {
    setSelectedTemplateId(t.id);
    setSenderEmail(t.email || "");
    setBusinessName(t.businessName || "");
    setPhoneNumber(t.phoneNumber || "");
    setExtraNote(t.notes || "");
    setTemplateFormMode(null);
  };
  const handleSubmitTemplateForm = () => {
    const name = tplFormName.trim();
    if (!name) { showError("템플릿 이름을 입력해주세요."); return; }
    if (tplFormPhoneNumber && !isValidPhone(tplFormPhoneNumber)) { setTplPhoneError(true); showError("올바른 전화번호를 입력해주세요."); return; }
    if (templateFormMode === "edit" && editingTemplateId) {
      const updated = templates.map((t) => t.id === editingTemplateId
        ? { ...t, name, email: tplFormEmail.trim(), businessName: tplFormBusinessName.trim(), phoneNumber: tplFormPhoneNumber.trim(), notes: tplFormNotes.trim() }
        : t);
      setTemplates(updated); saveTemplates(updated);
      if (selectedTemplateId === editingTemplateId) {
        setSenderEmail(tplFormEmail.trim());
        setBusinessName(tplFormBusinessName.trim());
        setPhoneNumber(tplFormPhoneNumber.trim());
        setExtraNote(tplFormNotes.trim());
      }
      showSuccess("템플릿을 수정했습니다.");
    } else {
      const nt: SenderTemplate = { id: crypto.randomUUID(), name, email: tplFormEmail.trim(), businessName: tplFormBusinessName.trim(), phoneNumber: tplFormPhoneNumber.trim(), notes: tplFormNotes.trim() };
      const updated = [...templates, nt];
      setTemplates(updated); saveTemplates(updated);
      handleSelectTemplate(nt);
      showSuccess("템플릿을 저장했습니다.");
    }
    setTemplateFormMode(null); setEditingTemplateId(null);
    setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes("");
  };
  const startEditTemplate = (t: SenderTemplate) => {
    setTemplateFormMode("edit"); setEditingTemplateId(t.id); setTplPhoneError(false);
    setTplFormName(t.name); setTplFormEmail(t.email || ""); setTplFormBusinessName(t.businessName || ""); setTplFormPhoneNumber(t.phoneNumber || ""); setTplFormNotes(t.notes || "");
  };
  const handleDeleteTemplate = (id: string) => {
    if (!confirm("템플릿을 삭제할까요?")) return;
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated); saveTemplates(updated);
    if (selectedTemplateId === id) setSelectedTemplateId(null);
    setTemplateFormMode(null);
  };

  /* ── 파일 토글 ─────────────────────────────────────────── */
  const toggleFile = (path: string) => {
    setSelectedPaths((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  };

  /* ── 전송 ─────────────────────────────────────────────── */
  const handleSendClick = () => {
    if (!printerEmail.trim()) { showError("출력소를 선택해주세요."); return; }
    if (!businessName.trim()) { showError("상호를 입력해주세요."); return; }
    if (!phoneNumber.trim()) { showError("전화번호를 입력해주세요."); return; }
    if (!isValidPhone(phoneNumber)) { setPhoneError(true); showError("올바른 전화번호를 입력해주세요."); return; }
    if (!printType) { showError("출력형태를 선택해주세요."); return; }
    if (!castingType) { showError("주물여부를 선택해주세요."); return; }
    if (castingType === "금주물" && !goldDetail) { showError("금주물 세부 옵션을 선택해주세요."); return; }
    if (selectedPaths.size === 0) { showError("전송할 파일을 하나 이상 선택해주세요."); return; }
    setStep("confirm");
  };

  const handleConfirmSend = async () => {
    try {
      setSending(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { showInfo("로그인이 필요합니다."); return; }
      const effectiveCastingType = castingType === "금주물" && goldDetail ? `금주물(${goldDetail})` : castingType;
      const res = await fetch("/api/send-to-printer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          modelId, printerEmail: printerEmail.trim(),
          senderEmail: senderEmail.trim(), businessName: businessName.trim(),
          phoneNumber: phoneNumber.trim(), printType,
          castingType: effectiveCastingType, scaleType,
          scalePercent: scaleType ? scalePercent : "",
          extraNote: extraNote.trim(),
          selectedFilePaths: Array.from(selectedPaths),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "전송에 실패했습니다."); return; }
      const printerName = printers.find((p) => p.id === selectedPrinterId)?.name;
      const printerLabel = printerName
        ? `${printerName} (${printerEmail.trim()})`
        : printerEmail.trim();
      showSuccess(
        `${printerLabel}\n로 파일을 전송했습니다.`,
        5000,
        { whiteSpace: "pre-line", textAlign: "left" }
      );
      if (data.oversizedFiles?.length > 0) {
        showInfo(`${data.oversizedFiles.length}개 파일은 40MB 초과로 링크로 전송됐습니다.`);
      }
      router.push("/library");
    } catch (e) {
      console.error(e);
      showError("전송 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  /* ── 렌더 ─────────────────────────────────────────────── */
  return (
    <>
      <style>{`
        .stp-bottom {
          position: fixed; bottom: 0; left: 0; right: 0;
          background: white; border-top: 1px solid #f3f4f6;
          padding: 12px 20px 20px; z-index: 50;
        }
        @media (max-width: 768px) { .stp-bottom { bottom: 72px; } }
        .stp-form-grid {
          display: grid;
          grid-template-columns: 1fr 1px 1fr;
          gap: 0;
          align-items: start;
        }
        .stp-divider {
          background: #f3f4f6;
          align-self: stretch;
        }
        @media (max-width: 768px) {
          .stp-form-grid {
            grid-template-columns: 1fr;
          }
          .stp-divider { display: none; }
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
          onClick={() => step === "confirm" ? setStep("form") : router.push("/library")}
          style={{
            width: 38, height: 38, borderRadius: 10,
            border: "1px solid #e5e7eb", background: "white",
            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, color: "#374151", flexShrink: 0,
          }}
          aria-label="뒤로가기"
        >←</button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: "#111827", margin: 0 }}>
            {step === "confirm" ? "전송 확인" : "출력소로 보내기"}
          </h1>
          {modelTitle && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>{modelTitle}</p>
          )}
        </div>
      </div>

      {/* ── 전송 확인 화면 ── */}
      {step === "confirm" && (
        <main style={{
          maxWidth: 560, margin: "0 auto",
          padding: "20px 20px 160px",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>받는 이메일</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>{printerEmail}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>메일 제목</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>
                &lt;{businessName.trim()}&gt; 출력부탁드려요
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>메일 내용</div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                {[
                  { label: "출력형태",      value: printType || "-" },
                  { label: "주물여부",      value: castingType === "금주물" && goldDetail ? `금주물(${goldDetail})` : castingType || "-" },
                  { label: "확대축소",      value: !scaleType ? "없음" : `${scaleType} ${scalePercent}%` },
                  { label: "전화번호",      value: phoneNumber.trim() || "-" },
                  { label: "보내는 이메일", value: senderEmail.trim() || "-" },
                  { label: "추가 내용",     value: extraNote.trim() || "-" },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: "flex", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div style={{ width: 90, flexShrink: 0, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#6b7280", background: "#f8fafc" }}>{row.label}</div>
                    <div style={{ flex: 1, padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#111827" }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>첨부 파일 ({selectedPaths.size}개)</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {modelFiles.filter((f) => selectedPaths.has(f.path)).map((f) => (
                  <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 6, background: f.isMain ? "#111827" : "#6366f1", color: "white", flexShrink: 0 }}>
                      {f.isMain ? "대표" : "추가"}
                    </span>
                    <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ── 폼 화면 ── */}
      {step === "form" && (
        <main style={{
          maxWidth: 1000, margin: "0 auto",
          padding: "0 0 160px",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div className="stp-form-grid">
          {/* ── 왼쪽: 출력소 / 템플릿 / 보내는 사람 ── */}
          <div>

          {/* 출력소 */}
          <div style={{ ...section("#f9fafb") }}>
            <div style={sectionTitle}>출력소 <span style={{ color: "#ef4444" }}>*</span></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {printers.map((p) => (
                <button key={p.id} type="button" onClick={() => handleSelectPrinter(p)}
                  style={{ minHeight: 36, padding: "0 16px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer",
                    border: selectedPrinterId === p.id ? "none" : "1.5px solid #d1d5db",
                    background: selectedPrinterId === p.id ? "#111827" : "white",
                    color: selectedPrinterId === p.id ? "white" : "#374151" }}>
                  {p.name}
                </button>
              ))}
              {printerFormMode === "add" ? null : (
                <button type="button" onClick={() => { setPrinterFormMode("add"); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail(""); }}
                  style={{ height: 36, width: 36, borderRadius: 999, border: "1px dashed #d1d5db", background: "white", color: "#9ca3af", fontWeight: 900, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
              )}
            </div>
            {printerFormMode !== null && (
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}>
                <input value={printerFormName} onChange={(e) => setPrinterFormName(e.target.value)}
                  placeholder="출력소명" style={{ ...inputStyle, flex: "1 1 80px", minWidth: 80 }} />
                <input value={printerFormEmail} onChange={(e) => setPrinterFormEmail(e.target.value)}
                  placeholder="이메일" onKeyDown={(e) => { if (e.key === "Enter") handleSubmitPrinterForm(); }}
                  style={{ ...inputStyle, flex: "2 1 140px", minWidth: 140 }} />
                <button onClick={handleSubmitPrinterForm} style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>저장</button>
                <button onClick={() => { setPrinterFormMode(null); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail(""); }}
                  style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>취소</button>
              </div>
            )}
            {selectedPrinterId && printerFormMode !== "add" && (() => {
              const sel = printers.find((p) => p.id === selectedPrinterId);
              if (!sel) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, color: "#111827", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>→ {sel.email}</span>
                  {printerFormMode !== "edit" && (
                    <>
                      <button type="button" onClick={() => startEditPrinter(sel)}
                        style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", color: "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>편집</button>
                      <button type="button" onClick={() => handleDeletePrinter(sel.id)}
                        style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>삭제</button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* 내 정보 템플릿 */}
          <div style={section()}>
            <div style={sectionTitle}>
              내 정보 템플릿
              <span style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", marginLeft: 6 }}>기본정보를 저장해 사용하세요</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              {templates.map((t) => (
                <button key={t.id} type="button" onClick={() => handleSelectTemplate(t)}
                  style={{ minHeight: 36, padding: "0 16px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer",
                    border: selectedTemplateId === t.id ? "none" : "1.5px solid #d1d5db",
                    background: selectedTemplateId === t.id ? "#111827" : "white",
                    color: selectedTemplateId === t.id ? "white" : "#374151" }}>
                  {t.name}
                </button>
              ))}
              {templateFormMode === "add" ? null : (
                <button type="button" onClick={() => { setTemplateFormMode("add"); setEditingTemplateId(null); setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes(""); }}
                  style={{ height: 36, width: 36, borderRadius: 999, border: "1px dashed #d1d5db", background: "white", color: "#9ca3af", fontWeight: 900, cursor: "pointer", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
              )}
            </div>
            {templateFormMode !== null && (
              <div style={{ border: "1.5px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", marginTop: 8, background: "#f8fafc" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                  {templateFormMode === "edit" ? "템플릿 편집" : "새 템플릿 추가"}
                </div>
                <input value={tplFormName} onChange={(e) => setTplFormName(e.target.value)} placeholder="템플릿 이름" style={{ ...inputStyle, marginBottom: 8 }} />
                <input value={tplFormBusinessName} onChange={(e) => setTplFormBusinessName(e.target.value)} placeholder="상호명 (성함)" style={{ ...inputStyle, marginBottom: 8 }} />
                <input value={tplFormPhoneNumber}
                  onChange={(e) => { const f = formatPhone(e.target.value); setTplFormPhoneNumber(f); if (tplPhoneError && isValidPhone(f)) setTplPhoneError(false); }}
                  onBlur={() => { if (tplFormPhoneNumber && !isValidPhone(tplFormPhoneNumber)) setTplPhoneError(true); }}
                  placeholder="010-0000-0000"
                  style={{ ...inputStyle, marginBottom: tplPhoneError ? 4 : 8, border: tplPhoneError ? "1.5px solid #ef4444" : "1.5px solid #d1d5db" }} />
                {tplPhoneError && <p style={{ margin: "0 0 8px", fontSize: 11, color: "#ef4444" }}>올바른 전화번호를 입력해주세요</p>}
                <input value={tplFormEmail} onChange={(e) => setTplFormEmail(e.target.value)} placeholder="보내는 사람 이메일 (선택)" style={{ ...inputStyle, marginBottom: 8 }} />
                <textarea value={tplFormNotes} onChange={(e) => setTplFormNotes(e.target.value)} placeholder="기본 요청사항 (선택)" rows={2}
                  style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSubmitTemplateForm} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>저장</button>
                  <button onClick={() => { setTemplateFormMode(null); setEditingTemplateId(null); setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes(""); setTplPhoneError(false); }}
                    style={{ flex: 1, height: 42, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>취소</button>
                </div>
              </div>
            )}
            {selectedTemplateId && templateFormMode !== "add" && (() => {
              const sel = templates.find((t) => t.id === selectedTemplateId);
              if (!sel) return null;
              return templateFormMode !== "edit" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => startEditTemplate(sel)}
                    style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", color: "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>편집</button>
                  <button type="button" onClick={() => handleDeleteTemplate(sel.id)}
                    style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>삭제</button>
                </div>
              ) : null;
            })()}
          </div>

          {/* 보내는 사람 정보 */}
          <div style={section("#f9fafb")}>
            <div style={sectionTitle}>보내는 사람 정보</div>
            <div style={fieldWrap}>
              <label style={labelStyle}>이메일</label>
              <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="my@email.com" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>상호 <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="상호명" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>전화번호 <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={phoneNumber}
                  onChange={(e) => { const f = formatPhone(e.target.value); setPhoneNumber(f); if (phoneError && isValidPhone(f)) setPhoneError(false); }}
                  onBlur={() => { if (phoneNumber && !isValidPhone(phoneNumber)) setPhoneError(true); }}
                  placeholder="010-0000-0000"
                  style={{ ...inputStyle, border: phoneError ? "1.5px solid #ef4444" : inputStyle.border as string }} />
                {phoneError && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#ef4444" }}>올바른 전화번호를 입력해주세요</p>}
              </div>
            </div>
          </div>

          </div>{/* 왼쪽 컬럼 끝 */}

          {/* 구분선 */}
          <div className="stp-divider" />

          {/* ── 오른쪽: 출력 옵션 / 추가 내용 / 파일 선택 ── */}
          <div>

          {/* 출력 옵션 */}
          <div style={section()}>
            <div style={sectionTitle}>출력 옵션</div>
            <div style={fieldWrap}>
              <label style={labelStyle}>출력형태 <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["CPX", "일반"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setPrintType(v)}
                    style={{ flex: 1, height: 40, borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      border: printType === v ? "none" : "1.5px solid #d1d5db",
                      background: printType === v ? "#111827" : "white",
                      color: printType === v ? "white" : "#374151" }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div style={fieldWrap}>
              <label style={labelStyle}>주물여부 <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["수지상태", "은주물", "금주물"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => { setCastingType(v); setGoldDetail(""); }}
                    style={{ flex: "1 1 auto", height: 40, padding: "0 10px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      border: castingType === v ? "none" : "1.5px solid #d1d5db",
                      background: castingType === v ? "#111827" : "white",
                      color: castingType === v ? "white" : "#374151" }}>
                    {v}
                  </button>
                ))}
              </div>
              {castingType === "금주물" && (
                <select value={goldDetail} onChange={(e) => setGoldDetail(e.target.value as any)} style={{ ...selectStyle, marginTop: 8 }}>
                  <option value="">세부 옵션 선택</option>
                  <option value="14K_골드">14K 골드</option>
                  <option value="14K_화이트">14K 화이트</option>
                  <option value="14K_핑크">14K 핑크</option>
                  <option value="18K_골드">18K 골드</option>
                  <option value="18K_화이트">18K 화이트</option>
                  <option value="18K_핑크">18K 핑크</option>
                  <option value="25K">25K</option>
                  <option value="백금">백금</option>
                </select>
              )}
            </div>
            <div style={{ ...fieldWrap, marginBottom: 0 }}>
              <label style={labelStyle}>확대축소여부</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {(["", "확대", "축소"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setScaleType(v)}
                    style={{ flex: "1 1 auto", height: 40, padding: "0 10px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      border: scaleType === v ? "none" : "1.5px solid #d1d5db",
                      background: scaleType === v ? "#111827" : "white",
                      color: scaleType === v ? "white" : "#374151" }}>
                    {v === "" ? "없음" : v}
                  </button>
                ))}
                {scaleType !== "" && (
                  <select value={scalePercent} onChange={(e) => setScalePercent(e.target.value)}
                    style={{ height: 40, borderRadius: 10, border: "1.5px solid #d1d5db", padding: "0 12px", fontSize: 14, background: "white", cursor: "pointer", flexShrink: 0 }}>
                    {Array.from({ length: 11 }, (_, i) => (
                      <option key={i} value={String(i)}>{i}%</option>
                    ))}
                  </select>
                )}
              </div>
            </div>
          </div>

          {/* 추가 내용 */}
          <div style={section("#f9fafb")}>
            <div style={sectionTitle}>추가 내용</div>
            <textarea value={extraNote} onChange={(e) => setExtraNote(e.target.value)}
              placeholder="출력 시 참고할 내용을 입력해주세요." rows={3}
              style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
          </div>

          {/* 파일 선택 */}
          <div style={{ padding: "14px 20px 20px" }}>
            <div style={sectionTitle}>파일 선택</div>
            {filesLoading ? (
              <p style={{ fontSize: 14, color: "#9ca3af" }}>파일 목록을 불러오는 중...</p>
            ) : modelFiles.length === 0 ? (
              <p style={{ fontSize: 14, color: "#9ca3af" }}>파일이 없습니다.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {modelFiles.map((f) => {
                  const checked = selectedPaths.has(f.path);
                  return (
                    <label key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, border: checked ? "2px solid #111827" : "1.5px solid #e5e7eb", background: checked ? "#f8fafc" : "white", cursor: "pointer" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleFile(f.path)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#111827", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: f.isMain ? "#111827" : "#6366f1", color: "white", flexShrink: 0 }}>
                        {f.isMain ? "대표" : "추가"}
                      </span>
                      <span style={{ fontSize: 14, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>{/* 파일 선택 div 끝 */}
          </div>{/* 오른쪽 컬럼 끝 */}
          </div>{/* stp-form-grid 끝 */}
        </main>
      )}

      {/* 하단 고정 버튼 */}
      <div className="stp-bottom">
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          {step === "confirm" ? (
            <>
              <button type="button" onClick={() => setStep("form")}
                style={{ height: 52, borderRadius: 14, border: "1.5px solid #d1d5db", background: "white", color: "#111827", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                수정
              </button>
              <button type="button" onClick={handleConfirmSend} disabled={sending}
                style={{ height: 52, borderRadius: 14, border: "none", background: sending ? "#6b7280" : "#111827", color: "white", fontWeight: 900, fontSize: 15, cursor: sending ? "default" : "pointer" }}>
                {sending ? "전송 중..." : "전송하기"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => router.push("/library")}
                style={{ height: 52, borderRadius: 14, border: "1.5px solid #d1d5db", background: "white", color: "#111827", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                취소
              </button>
              <button type="button" onClick={handleSendClick}
                style={{ height: 52, borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
                전송 →
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

export default function SendToPrinterPage() {
  return (
    <Suspense fallback={null}>
      <SendToPrinterContent />
    </Suspense>
  );
}
