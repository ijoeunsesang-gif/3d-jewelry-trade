"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken } from "@/lib/supabase-fetch";
import { showError, showInfo, showSuccess } from "../lib/toast";

/* ── 타입 ─────────────────────────────────────────────────── */
type PrinterContact = { id: string; name: string; email: string };
type SenderTemplate = {
  id: string; name: string; email: string;
  businessName: string; phoneNumber: string; notes: string;
};
type ModelFile = { name: string; path: string; isMain: boolean };
type FinishingWorker = { id: string; name: string; phone: string; email: string; work_scope: string[]; location: string | null };

const FINISHING_SCOPES = ["없음", "시야기까지", "원본까지", "고무가다까지"] as const;

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
  const printShopId = searchParams.get("printShopId") || "";

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
  const [printQty, setPrintQty] = useState(1);
  const [symmetric, setSymmetric] = useState(false);
  const [extraNote, setExtraNote] = useState("");

  /* 마무리 작업 */
  const [finishingScope, setFinishingScope] = useState<string>("없음");
  const [fwList, setFwList] = useState<FinishingWorker[]>([]);
  const [fwLoading, setFwLoading] = useState(false);
  const [selectedFw, setSelectedFw] = useState<FinishingWorker | null>(null);
  const [showFwPopup, setShowFwPopup] = useState(false);

  /* 모델 썸네일 */
  const [modelThumbnail, setModelThumbnail] = useState("");

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
    // 로그인 유저 정보
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    const identities = userData?.user?.identities ?? [];
    const authEmail = userData?.user?.email || identities[0]?.identity_data?.email || "";

    // DB에서 기본정보 로드, 없으면 localStorage
    let businessNameVal = "";
    let phoneNumberVal = "";
    let notesVal = "";
    if (userId) {
      const { data: pref } = await supabase.from("print_preferences").select("business_name, phone_number, notes").eq("user_id", userId).maybeSingle();
      if (pref) {
        businessNameVal = pref.business_name || "";
        phoneNumberVal  = pref.phone_number || "";
        notesVal        = pref.notes || "";
      }
    }

    // localStorage 템플릿 체크 (기본정보가 DB에도 없고 localStorage에도 없으면 입력 페이지로)
    const existingTpls = loadTemplates();
    if (!businessNameVal && !phoneNumberVal && existingTpls.length === 0) {
      router.replace(`/my/info/edit?modelId=${modelId}`);
      return;
    }

    // localStorage 템플릿이 있으면 그 값을 fallback으로 사용
    if (!businessNameVal && existingTpls.length > 0) {
      businessNameVal = existingTpls[0].businessName || "";
      phoneNumberVal  = existingTpls[0].phoneNumber || "";
      notesVal        = existingTpls[0].notes || "";
    }

    // 모델 정보 조회
    const { data: model } = await supabase
      .from("models").select("title, model_file_path, thumbnail_path, thumbnail").eq("id", modelId).single();
    if (model) {
      setModelTitle(model.title || "");
      setModelFilePath(model.model_file_path || null);
      const tp = model.thumbnail_path || model.thumbnail || "";
      if (tp) setModelThumbnail(tp.startsWith("http") ? tp : `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${tp}`);
    }

    // 출력소·템플릿 로드
    const loadedPrinters = loadAllPrinters();
    setPrinters(loadedPrinters);
    setTemplates(existingTpls);
    if (existingTpls.length > 0) setSelectedTemplateId(existingTpls[0].id);
    setBusinessName(businessNameVal);
    setPhoneNumber(phoneNumberVal);
    setExtraNote(notesVal);
    setSenderEmail(authEmail);

    // printShopId가 있으면 DB에서 이름 조회 후 로컬 목록에서 자동 선택
    if (printShopId) {
      const { data: shop } = await supabase.from("print_shops").select("name").eq("id", printShopId).maybeSingle();
      if (shop) {
        const match = loadedPrinters.find(p => p.name === shop.name);
        if (match) {
          setSelectedPrinterId(match.id);
          setPrinterEmail(match.email);
        }
      }
    }

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

  /* ── 마무리 작업자 ─────────────────────────────────────── */
  const fetchFinishingWorkers = async () => {
    if (fwList.length > 0) return;
    setFwLoading(true);
    try {
      const { data } = await supabase.from("finishing_workers").select("id, name, phone, email, work_scope, location").eq("is_active", true).order("created_at", { ascending: true });
      setFwList((data as FinishingWorker[]) || []);
    } catch { /* silent */ }
    finally { setFwLoading(false); }
  };

  const handleFinishingScopeChange = (scope: string) => {
    setFinishingScope(scope);
    if (scope === "없음") { setSelectedFw(null); return; }
    fetchFinishingWorkers();
  };

  /* ── DB 기본정보 저장 ──────────────────────────────────── */
  const savePreferencesToDB = async (bn: string, ph: string, nt: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;
      await supabase.from("print_preferences").upsert({ user_id: userId, business_name: bn, phone_number: ph, notes: nt, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    } catch { /* silent */ }
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
        savePreferencesToDB(tplFormBusinessName.trim(), tplFormPhoneNumber.trim(), tplFormNotes.trim());
      }
      showSuccess("템플릿을 수정했습니다.");
    } else {
      const nt: SenderTemplate = { id: crypto.randomUUID(), name, email: tplFormEmail.trim(), businessName: tplFormBusinessName.trim(), phoneNumber: tplFormPhoneNumber.trim(), notes: tplFormNotes.trim() };
      const updated = [...templates, nt];
      setTemplates(updated); saveTemplates(updated);
      handleSelectTemplate(nt);
      savePreferencesToDB(tplFormBusinessName.trim(), tplFormPhoneNumber.trim(), tplFormNotes.trim());
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
      savePreferencesToDB(businessName.trim(), phoneNumber.trim(), extraNote.trim());
      const token = getAccessToken();
      if (!token) { showInfo("로그인이 필요합니다."); return; }
      const effectiveCastingType = castingType === "금주물" && goldDetail ? `금주물(${goldDetail})` : castingType;
      const res = await fetch("/api/send-to-printer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          modelId, printerEmail: printerEmail.trim(),
          senderEmail: senderEmail.trim(), businessName: businessName.trim(),
          phoneNumber: phoneNumber.trim(), printType,
          castingType: effectiveCastingType, scaleType,
          scalePercent: scaleType ? scalePercent : "",
          printQty, symmetric,
          finishingScope: finishingScope === "없음" ? "" : finishingScope,
          finishingWorkerName: selectedFw?.name || "",
          finishingWorkerPhone: selectedFw?.phone || "",
          finishingWorkerEmail: selectedFw?.email || "",
          modelThumbnail,
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
                  { label: "출력형태",      value: printType || "-",                                                                      highlight: false },
                  { label: "주물여부",      value: castingType === "금주물" && goldDetail ? `금주물(${goldDetail})` : castingType || "-", highlight: false },
                  { label: "확대축소",      value: !scaleType ? "없음" : `${scaleType} ${scalePercent}%`,                                highlight: !!scaleType },
                  { label: "출력 수량",     value: `${printQty}개`,                                                                       highlight: printQty > 1 },
                  { label: "대칭 출력",     value: symmetric ? "✓ 좌우 반전 1쌍" : "-",                                                   highlight: symmetric },
                  { label: "마무리 작업",   value: finishingScope === "없음" || !finishingScope ? "없음" : `${finishingScope}${selectedFw ? ` · ${selectedFw.name}` : ""}`, highlight: !!(finishingScope && finishingScope !== "없음") },
                  { label: "전화번호",      value: phoneNumber.trim() || "-",                                                             highlight: false },
                  { label: "보내는 이메일", value: senderEmail.trim() || "-",                                                             highlight: false },
                  { label: "추가 내용",     value: extraNote.trim() || "-",                                                               highlight: false },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: "flex", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none", background: row.highlight ? "#fef9c3" : "transparent" }}>
                    <div style={{ width: 100, flexShrink: 0, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#6b7280", background: row.highlight ? "#fef9c3" : "#f8fafc" }}>{row.label}</div>
                    <div style={{ flex: 1, padding: "10px 14px", fontSize: 14, fontWeight: row.highlight ? 800 : 600, color: row.highlight ? "#b45309" : "#111827" }}>{row.value}</div>
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
              <input type="email" value={senderEmail} readOnly style={{ ...inputStyle, background: "#f3f4f6", cursor: "not-allowed" }} />
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
            <div style={fieldWrap}>
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
            <div style={fieldWrap}>
              <label style={labelStyle}>출력 수량</label>
              <div style={{ display: "flex", alignItems: "center", gap: 0 }}>
                <button type="button"
                  onClick={() => { const next = Math.max(1, printQty - 1); setPrintQty(next); if (next < 2) setSymmetric(false); }}
                  style={{ width: 40, height: 40, borderRadius: "10px 0 0 10px", border: "1.5px solid #d1d5db", borderRight: "none", background: "white", fontSize: 20, fontWeight: 700, color: "#374151", cursor: "pointer", lineHeight: 1 }}>−</button>
                <div style={{ width: 52, height: 40, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #d1d5db", borderLeft: "none", borderRight: "none", fontSize: 15, fontWeight: 800, color: "#111827", background: printQty > 1 ? "#fef9c3" : "white" }}>
                  {printQty}개
                </div>
                <button type="button"
                  onClick={() => setPrintQty(prev => prev + 1)}
                  style={{ width: 40, height: 40, borderRadius: "0 10px 10px 0", border: "1.5px solid #d1d5db", borderLeft: "none", background: "white", fontSize: 20, fontWeight: 700, color: "#374151", cursor: "pointer", lineHeight: 1 }}>+</button>
              </div>
            </div>
            <div style={{ ...fieldWrap, marginBottom: 0 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox" checked={symmetric}
                  onChange={(e) => { setSymmetric(e.target.checked); if (e.target.checked) setPrintQty(prev => Math.max(2, prev)); }}
                  style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#111827", flexShrink: 0 }} />
                <span style={{ fontSize: 14, fontWeight: 700, color: symmetric ? "#b45309" : "#374151" }}>
                  대칭 출력 <span style={{ fontWeight: 500, color: "#6b7280" }}>(귀걸이 좌우 1쌍)</span>
                </span>
              </label>
              {symmetric && (
                <p style={{ margin: "6px 0 0 26px", fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                  좌우 반전 파일을 1쌍으로 출력합니다. 수량이 자동으로 2개 이상으로 설정됩니다.
                </p>
              )}
            </div>
          </div>

          {/* 마무리 작업 */}
          <div style={section()}>
            <div style={sectionTitle}>마무리 작업 <span style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af" }}>(선택사항)</span></div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: finishingScope !== "없음" ? 12 : 0 }}>
              {FINISHING_SCOPES.map((s) => (
                <button key={s} type="button" onClick={() => handleFinishingScopeChange(s)}
                  style={{ height: 36, padding: "0 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
                    border: finishingScope === s ? "none" : "1.5px solid #d1d5db",
                    background: finishingScope === s ? (s === "없음" ? "#374151" : "#111827") : "white",
                    color: finishingScope === s ? "white" : "#374151" }}>
                  {s}
                </button>
              ))}
            </div>
            {finishingScope !== "없음" && (
              <div>
                {selectedFw ? (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, border: "2px solid #111827", background: "#f8fafc" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{selectedFw.name}</div>
                        <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{selectedFw.phone}{selectedFw.location ? ` · ${selectedFw.location}` : ""}</div>
                      </div>
                      <button type="button" onClick={() => { setSelectedFw(null); setShowFwPopup(true); }}
                        style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>변경</button>
                      <button type="button" onClick={() => setSelectedFw(null)}
                        style={{ padding: "4px 10px", borderRadius: 8, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>해제</button>
                    </div>
                    <p style={{ fontSize: 13, color: "#b45309", background: "#fef9c3", border: "1px solid #fde047", borderRadius: 6, padding: "10px 12px", marginTop: 8, lineHeight: 1.6, margin: "8px 0 0" }}>
                      ※ 출력비와 마무리 비용이 합산되어 청구되오니,<br />
                      마무리 작업자에게 함께 지급해 주세요.
                    </p>
                  </>
                ) : (
                  <button type="button" onClick={() => { fetchFinishingWorkers(); setShowFwPopup(true); }}
                    style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "1.5px dashed #d1d5db", background: "white", color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    작업자 선택
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 마무리 작업자 팝업 */}
          {showFwPopup && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
              onClick={() => setShowFwPopup(false)}>
              <div style={{ background: "white", borderRadius: 20, width: "100%", maxWidth: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }}
                onClick={e => e.stopPropagation()}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>마무리 작업자 선택</span>
                  <button type="button" onClick={() => setShowFwPopup(false)}
                    style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", fontSize: 16, color: "#6b7280", display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                </div>
                <div style={{ overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {fwLoading ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>불러오는 중...</p>
                  ) : fwList.length === 0 ? (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "24px 0" }}>등록된 작업자가 없습니다.</p>
                  ) : fwList.map(fw => (
                    <button key={fw.id} type="button" onClick={() => { setSelectedFw(fw); setShowFwPopup(false); }}
                      style={{ textAlign: "left", padding: "12px 14px", borderRadius: 12, border: "1.5px solid #e5e7eb", background: "white", cursor: "pointer", width: "100%" }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 4 }}>{fw.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{fw.phone}{fw.location ? ` · ${fw.location}` : ""}</div>
                      {fw.work_scope?.length > 0 && (
                        <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {fw.work_scope.map(s => (
                            <span key={s} style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#f3f4f6", color: "#374151" }}>{s}</span>
                          ))}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
