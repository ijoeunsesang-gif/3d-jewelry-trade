"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { showError, showInfo, showSuccess } from "../lib/toast";

/* ?€?€ ?€???€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
type PrinterContact = { id: string; name: string; email: string };
type SenderTemplate = {
  id: string; name: string; email: string;
  businessName: string; phoneNumber: string; notes: string;
};
type ModelFile = { name: string; path: string; isMain: boolean };

/* ?€?€ ë¡œì»¬?¤í† ë¦¬ì? ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
const ALL_PRINTERS_KEY = "all_printers";
const SENDER_TEMPLATES_KEY = "sender_templates";
const INITIAL_PRINTERS: PrinterContact[] = [
  { id: "default-gain", name: "ê°€?¸ì¶œ?¥ì†Œ", email: "anscy2138@naver.com" },
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

/* ?€?€ ?„í™”ë²ˆí˜¸ ? í‹¸ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
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

/* ?€?€ ?¤í????ìˆ˜ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
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

/* ?€?€ ë©”ì¸ ì»´í¬?ŒíŠ¸ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
function SendToPrinterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modelId = searchParams.get("modelId") || "";

  /* ëª¨ë¸ ?•ë³´ */
  const [modelTitle, setModelTitle] = useState("");
  const [modelFilePath, setModelFilePath] = useState<string | null>(null);

  /* ì¶œë ¥??*/
  const [printers, setPrinters] = useState<PrinterContact[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [printerEmail, setPrinterEmail] = useState("");
  const [printerFormMode, setPrinterFormMode] = useState<"add" | "edit" | null>(null);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerFormName, setPrinterFormName] = useState("");
  const [printerFormEmail, setPrinterFormEmail] = useState("");

  /* ?œí”Œë¦?*/
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

  /* ë°œì‹  ?•ë³´ */
  const [senderEmail, setSenderEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState(false);

  /* ì¶œë ¥ ?µì…˜ */
  const [printType, setPrintType] = useState<"CPX" | "?¼ë°˜" | "">("");
  const [castingType, setCastingType] = useState<"?˜ì??íƒœ" | "?€ì£¼ë¬¼" | "ê¸ˆì£¼ë¬? | "">("");
  const [goldDetail, setGoldDetail] = useState<
    "14K_ê³¨ë“œ" | "14K_?”ì´?? | "14K_?‘í¬" | "18K_ê³¨ë“œ" | "18K_?”ì´?? | "18K_?‘í¬" | "25K" | "ë°±ê¸ˆ" | ""
  >("");
  const [scaleType, setScaleType] = useState<"" | "?•ë?" | "ì¶•ì†Œ">("");
  const [scalePercent, setScalePercent] = useState("0");
  const [extraNote, setExtraNote] = useState("");

  /* ?Œì¼ */
  const [modelFiles, setModelFiles] = useState<ModelFile[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [filesLoading, setFilesLoading] = useState(false);

  /* ?„ì†¡ ?íƒœ */
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");

  /* ?€?€ ì´ˆê¸°???€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
  useEffect(() => {
    if (!modelId) { router.replace("/library"); return; }
    init();
  }, [modelId]);

  const init = async () => {
    // ?œí”Œë¦?ì²´í¬
    const existingTpls = loadTemplates();
    if (existingTpls.length === 0) {
      router.replace(`/my/info/edit?modelId=${modelId}`);
      return;
    }

    // ëª¨ë¸ ?•ë³´ ì¡°íšŒ
    const { data: model } = await supabase
      .from("models").select("title, model_file_path").eq("id", modelId).single();
    if (model) {
      setModelTitle(model.title || "");
      setModelFilePath(model.model_file_path || null);
    }

    // ì¶œë ¥?ŒÂ·í…œ?Œë¦¿ ë¡œë“œ
    setPrinters(loadAllPrinters());
    setTemplates(existingTpls);
    const firstTpl = existingTpls[0];
    setSelectedTemplateId(firstTpl.id);
    setSenderEmail(firstTpl.email || "");
    setBusinessName(firstTpl.businessName || "");
    setPhoneNumber(firstTpl.phoneNumber || "");
    setExtraNote(firstTpl.notes || "");

    // ?Œì¼ ëª©ë¡ ì¡°íšŒ
    setFilesLoading(true);
    const files: ModelFile[] = [];
    const filePath = model?.model_file_path;
    if (filePath) files.push({ name: filePath.split("/").pop() || "?€???Œì¼", path: filePath, isMain: true });
    const { data: extras } = await supabase
      .from("model_files").select("file_name, file_path")
      .eq("model_id", modelId).order("sort_order", { ascending: true });
    if (extras) extras.forEach((f: any) => files.push({ name: f.file_name, path: f.file_path, isMain: false }));
    setModelFiles(files);
    setSelectedPaths(new Set(files.map((f) => f.path)));
    setFilesLoading(false);
  };

  /* ?€?€ ì¶œë ¥???¸ë“¤???€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
  const handleSelectPrinter = (p: PrinterContact) => {
    setSelectedPrinterId(p.id);
    setPrinterEmail(p.email);
    setPrinterFormMode(null);
  };
  const handleSubmitPrinterForm = () => {
    const name = printerFormName.trim(), email = printerFormEmail.trim();
    if (!name) { showError("ì¶œë ¥???´ë¦„???…ë ¥?´ì£¼?¸ìš”."); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { showError("? íš¨???´ë©”??ì£¼ì†Œë¥??…ë ¥?´ì£¼?¸ìš”."); return; }
    if (printerFormMode === "edit" && editingPrinterId) {
      const updated = printers.map((p) => p.id === editingPrinterId ? { ...p, name, email } : p);
      setPrinters(updated); saveAllPrinters(updated);
      if (selectedPrinterId === editingPrinterId) setPrinterEmail(email);
      showSuccess("ì¶œë ¥?Œë? ?˜ì •?ˆìŠµ?ˆë‹¤.");
    } else {
      const np: PrinterContact = { id: crypto.randomUUID(), name, email };
      const updated = [...printers, np];
      setPrinters(updated); saveAllPrinters(updated);
      handleSelectPrinter(np);
      showSuccess("ì¶œë ¥?Œë? ì¶”ê??ˆìŠµ?ˆë‹¤.");
    }
    setPrinterFormMode(null); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail("");
  };
  const startEditPrinter = (p: PrinterContact) => {
    setPrinterFormMode("edit"); setEditingPrinterId(p.id);
    setPrinterFormName(p.name); setPrinterFormEmail(p.email);
  };
  const handleDeletePrinter = (id: string) => {
    if (!confirm("ì¶œë ¥?Œë? ?? œ? ê¹Œ??")) return;
    const updated = printers.filter((p) => p.id !== id);
    setPrinters(updated); saveAllPrinters(updated);
    if (selectedPrinterId === id) { setSelectedPrinterId(null); setPrinterEmail(""); }
    setPrinterFormMode(null);
  };

  /* ?€?€ ?œí”Œë¦??¸ë“¤???€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
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
    if (!name) { showError("?œí”Œë¦??´ë¦„???…ë ¥?´ì£¼?¸ìš”."); return; }
    if (tplFormPhoneNumber && !isValidPhone(tplFormPhoneNumber)) { setTplPhoneError(true); showError("?¬ë°”ë¥??„í™”ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”."); return; }
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
      showSuccess("?œí”Œë¦¿ì„ ?˜ì •?ˆìŠµ?ˆë‹¤.");
    } else {
      const nt: SenderTemplate = { id: crypto.randomUUID(), name, email: tplFormEmail.trim(), businessName: tplFormBusinessName.trim(), phoneNumber: tplFormPhoneNumber.trim(), notes: tplFormNotes.trim() };
      const updated = [...templates, nt];
      setTemplates(updated); saveTemplates(updated);
      handleSelectTemplate(nt);
      showSuccess("?œí”Œë¦¿ì„ ?€?¥í–ˆ?µë‹ˆ??");
    }
    setTemplateFormMode(null); setEditingTemplateId(null);
    setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes("");
  };
  const startEditTemplate = (t: SenderTemplate) => {
    setTemplateFormMode("edit"); setEditingTemplateId(t.id); setTplPhoneError(false);
    setTplFormName(t.name); setTplFormEmail(t.email || ""); setTplFormBusinessName(t.businessName || ""); setTplFormPhoneNumber(t.phoneNumber || ""); setTplFormNotes(t.notes || "");
  };
  const handleDeleteTemplate = (id: string) => {
    if (!confirm("?œí”Œë¦¿ì„ ?? œ? ê¹Œ??")) return;
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated); saveTemplates(updated);
    if (selectedTemplateId === id) setSelectedTemplateId(null);
    setTemplateFormMode(null);
  };

  /* ?€?€ ?Œì¼ ? ê? ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
  const toggleFile = (path: string) => {
    setSelectedPaths((prev) => { const n = new Set(prev); n.has(path) ? n.delete(path) : n.add(path); return n; });
  };

  /* ?€?€ ?„ì†¡ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
  const handleSendClick = () => {
    if (!printerEmail.trim()) { showError("ì¶œë ¥?Œë? ? íƒ?´ì£¼?¸ìš”."); return; }
    if (!businessName.trim()) { showError("?í˜¸ë¥??…ë ¥?´ì£¼?¸ìš”."); return; }
    if (!phoneNumber.trim()) { showError("?„í™”ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”."); return; }
    if (!isValidPhone(phoneNumber)) { setPhoneError(true); showError("?¬ë°”ë¥??„í™”ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”."); return; }
    if (!printType) { showError("ì¶œë ¥?•íƒœë¥?? íƒ?´ì£¼?¸ìš”."); return; }
    if (!castingType) { showError("ì£¼ë¬¼?¬ë?ë¥?? íƒ?´ì£¼?¸ìš”."); return; }
    if (castingType === "ê¸ˆì£¼ë¬? && !goldDetail) { showError("ê¸ˆì£¼ë¬??¸ë? ?µì…˜??? íƒ?´ì£¼?¸ìš”."); return; }
    if (selectedPaths.size === 0) { showError("?„ì†¡???Œì¼???˜ë‚˜ ?´ìƒ ? íƒ?´ì£¼?¸ìš”."); return; }
    setStep("confirm");
  };

  const handleConfirmSend = async () => {
    try {
      setSending(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { showInfo("ë¡œê·¸?¸ì´ ?„ìš”?©ë‹ˆ??"); return; }
      const effectiveCastingType = castingType === "ê¸ˆì£¼ë¬? && goldDetail ? `ê¸ˆì£¼ë¬?${goldDetail})` : castingType;
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
      if (!res.ok) { showError(data.error || "?„ì†¡???¤íŒ¨?ˆìŠµ?ˆë‹¤."); return; }
      const printerName = printers.find((p) => p.id === selectedPrinterId)?.name;
      const printerLabel = printerName
        ? `${printerName} (${printerEmail.trim()})`
        : printerEmail.trim();
      showSuccess(
        `${printerLabel}\në¡??Œì¼???„ì†¡?ˆìŠµ?ˆë‹¤.`,
        5000,
        { whiteSpace: "pre-line", textAlign: "left" }
      );
      if (data.oversizedFiles?.length > 0) {
        showInfo(`${data.oversizedFiles.length}ê°??Œì¼?€ 40MB ì´ˆê³¼ë¡?ë§í¬ë¡??„ì†¡?ìŠµ?ˆë‹¤.`);
      }
      router.push("/library");
    } catch (e) {
      console.error(e);
      showError("?„ì†¡ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.");
    } finally {
      setSending(false);
    }
  };

  /* ?€?€ ?Œë” ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
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

      {/* ?ë‹¨ ?¤ë” */}
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
          aria-label="?¤ë¡œê°€ê¸?
        >??/button>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 900, color: "#111827", margin: 0 }}>
            {step === "confirm" ? "?„ì†¡ ?•ì¸" : "ì¶œë ¥?Œë¡œ ë³´ë‚´ê¸?}
          </h1>
          {modelTitle && (
            <p style={{ fontSize: 13, color: "#6b7280", margin: "2px 0 0" }}>{modelTitle}</p>
          )}
        </div>
      </div>

      {/* ?€?€ ?„ì†¡ ?•ì¸ ?”ë©´ ?€?€ */}
      {step === "confirm" && (
        <main style={{
          maxWidth: 560, margin: "0 auto",
          padding: "20px 20px 160px",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>ë°›ëŠ” ?´ë©”??/div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>{printerEmail}</div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>ë©”ì¼ ?œëª©</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>
                &lt;{businessName.trim()}&gt; ì¶œë ¥ë¶€?ë“œ?¤ìš”
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>ë©”ì¼ ?´ìš©</div>
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                {[
                  { label: "ì¶œë ¥?•íƒœ",      value: printType || "-" },
                  { label: "ì£¼ë¬¼?¬ë?",      value: castingType === "ê¸ˆì£¼ë¬? && goldDetail ? `ê¸ˆì£¼ë¬?${goldDetail})` : castingType || "-" },
                  { label: "?•ë?ì¶•ì†Œ",      value: !scaleType ? "?†ìŒ" : `${scaleType} ${scalePercent}%` },
                  { label: "?„í™”ë²ˆí˜¸",      value: phoneNumber.trim() || "-" },
                  { label: "ë³´ë‚´???´ë©”??, value: senderEmail.trim() || "-" },
                  { label: "ì¶”ê? ?´ìš©",     value: extraNote.trim() || "-" },
                ].map((row, i, arr) => (
                  <div key={row.label} style={{ display: "flex", borderBottom: i < arr.length - 1 ? "1px solid #f3f4f6" : "none" }}>
                    <div style={{ width: 90, flexShrink: 0, padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "#6b7280", background: "#f8fafc" }}>{row.label}</div>
                    <div style={{ flex: 1, padding: "10px 14px", fontSize: 14, fontWeight: 600, color: "#111827" }}>{row.value}</div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6b7280", marginBottom: 6 }}>ì²¨ë? ?Œì¼ ({selectedPaths.size}ê°?</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {modelFiles.filter((f) => selectedPaths.has(f.path)).map((f) => (
                  <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                    <span style={{ fontSize: 11, fontWeight: 900, padding: "2px 8px", borderRadius: 6, background: f.isMain ? "#111827" : "#6366f1", color: "white", flexShrink: 0 }}>
                      {f.isMain ? "?€?? : "ì¶”ê?"}
                    </span>
                    <span style={{ fontSize: 14, color: "#374151", fontWeight: 600 }}>{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      )}

      {/* ?€?€ ???”ë©´ ?€?€ */}
      {step === "form" && (
        <main style={{
          maxWidth: 1000, margin: "0 auto",
          padding: "0 0 160px",
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}>
          <div className="stp-form-grid">
          {/* ?€?€ ?¼ìª½: ì¶œë ¥??/ ?œí”Œë¦?/ ë³´ë‚´???¬ëŒ ?€?€ */}
          <div>

          {/* ì¶œë ¥??*/}
          <div style={{ ...section("#f9fafb") }}>
            <div style={sectionTitle}>ì¶œë ¥??<span style={{ color: "#ef4444" }}>*</span></div>
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
                  placeholder="ì¶œë ¥?Œëª…" style={{ ...inputStyle, flex: "1 1 80px", minWidth: 80 }} />
                <input value={printerFormEmail} onChange={(e) => setPrinterFormEmail(e.target.value)}
                  placeholder="?´ë©”?? onKeyDown={(e) => { if (e.key === "Enter") handleSubmitPrinterForm(); }}
                  style={{ ...inputStyle, flex: "2 1 140px", minWidth: 140 }} />
                <button onClick={handleSubmitPrinterForm} style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>?€??/button>
                <button onClick={() => { setPrinterFormMode(null); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail(""); }}
                  style={{ height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14, flexShrink: 0 }}>ì·¨ì†Œ</button>
              </div>
            )}
            {selectedPrinterId && printerFormMode !== "add" && (() => {
              const sel = printers.find((p) => p.id === selectedPrinterId);
              if (!sel) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 15, color: "#111827", fontWeight: 500, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>??{sel.email}</span>
                  {printerFormMode !== "edit" && (
                    <>
                      <button type="button" onClick={() => startEditPrinter(sel)}
                        style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", color: "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>?¸ì§‘</button>
                      <button type="button" onClick={() => handleDeletePrinter(sel.id)}
                        style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>?? œ</button>
                    </>
                  )}
                </div>
              );
            })()}
          </div>

          {/* ???•ë³´ ?œí”Œë¦?*/}
          <div style={section()}>
            <div style={sectionTitle}>
              ???•ë³´ ?œí”Œë¦?              <span style={{ fontSize: 12, fontWeight: 500, color: "#9ca3af", marginLeft: 6 }}>ê¸°ë³¸?•ë³´ë¥??€?¥í•´ ?¬ìš©?˜ì„¸??/span>
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
                  {templateFormMode === "edit" ? "?œí”Œë¦??¸ì§‘" : "???œí”Œë¦?ì¶”ê?"}
                </div>
                <input value={tplFormName} onChange={(e) => setTplFormName(e.target.value)} placeholder="?œí”Œë¦??´ë¦„" style={{ ...inputStyle, marginBottom: 8 }} />
                <input value={tplFormBusinessName} onChange={(e) => setTplFormBusinessName(e.target.value)} placeholder="?í˜¸ëª?(?±í•¨)" style={{ ...inputStyle, marginBottom: 8 }} />
                <input value={tplFormPhoneNumber}
                  onChange={(e) => { const f = formatPhone(e.target.value); setTplFormPhoneNumber(f); if (tplPhoneError && isValidPhone(f)) setTplPhoneError(false); }}
                  onBlur={() => { if (tplFormPhoneNumber && !isValidPhone(tplFormPhoneNumber)) setTplPhoneError(true); }}
                  placeholder="010-0000-0000"
                  style={{ ...inputStyle, marginBottom: tplPhoneError ? 4 : 8, border: tplPhoneError ? "1.5px solid #ef4444" : "1.5px solid #d1d5db" }} />
                {tplPhoneError && <p style={{ margin: "0 0 8px", fontSize: 11, color: "#ef4444" }}>?¬ë°”ë¥??„í™”ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”</p>}
                <input value={tplFormEmail} onChange={(e) => setTplFormEmail(e.target.value)} placeholder="ë³´ë‚´???¬ëŒ ?´ë©”??(? íƒ)" style={{ ...inputStyle, marginBottom: 8 }} />
                <textarea value={tplFormNotes} onChange={(e) => setTplFormNotes(e.target.value)} placeholder="ê¸°ë³¸ ?”ì²­?¬í•­ (? íƒ)" rows={2}
                  style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleSubmitTemplateForm} style={{ flex: 1, height: 42, borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 700, cursor: "pointer", fontSize: 14 }}>?€??/button>
                  <button onClick={() => { setTemplateFormMode(null); setEditingTemplateId(null); setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes(""); setTplPhoneError(false); }}
                    style={{ flex: 1, height: 42, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>ì·¨ì†Œ</button>
                </div>
              </div>
            )}
            {selectedTemplateId && templateFormMode !== "add" && (() => {
              const sel = templates.find((t) => t.id === selectedTemplateId);
              if (!sel) return null;
              return templateFormMode !== "edit" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => startEditTemplate(sel)}
                    style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #d1d5db", background: "white", color: "#6b7280", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>?¸ì§‘</button>
                  <button type="button" onClick={() => handleDeleteTemplate(sel.id)}
                    style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", fontSize: 11, fontWeight: 600, cursor: "pointer", flexShrink: 0, lineHeight: "18px" }}>?? œ</button>
                </div>
              ) : null;
            })()}
          </div>

          {/* ë³´ë‚´???¬ëŒ ?•ë³´ */}
          <div style={section("#f9fafb")}>
            <div style={sectionTitle}>ë³´ë‚´???¬ëŒ ?•ë³´</div>
            <div style={fieldWrap}>
              <label style={labelStyle}>?´ë©”??/label>
              <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="my@email.com" style={inputStyle} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={labelStyle}>?í˜¸ <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="?í˜¸ëª? style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>?„í™”ë²ˆí˜¸ <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={phoneNumber}
                  onChange={(e) => { const f = formatPhone(e.target.value); setPhoneNumber(f); if (phoneError && isValidPhone(f)) setPhoneError(false); }}
                  onBlur={() => { if (phoneNumber && !isValidPhone(phoneNumber)) setPhoneError(true); }}
                  placeholder="010-0000-0000"
                  style={{ ...inputStyle, border: phoneError ? "1.5px solid #ef4444" : inputStyle.border as string }} />
                {phoneError && <p style={{ margin: "4px 0 0", fontSize: 11, color: "#ef4444" }}>?¬ë°”ë¥??„í™”ë²ˆí˜¸ë¥??…ë ¥?´ì£¼?¸ìš”</p>}
              </div>
            </div>
          </div>

          </div>{/* ?¼ìª½ ì»¬ëŸ¼ ??*/}

          {/* êµ¬ë¶„??*/}
          <div className="stp-divider" />

          {/* ?€?€ ?¤ë¥¸ìª? ì¶œë ¥ ?µì…˜ / ì¶”ê? ?´ìš© / ?Œì¼ ? íƒ ?€?€ */}
          <div>

          {/* ì¶œë ¥ ?µì…˜ */}
          <div style={section()}>
            <div style={sectionTitle}>ì¶œë ¥ ?µì…˜</div>
            <div style={fieldWrap}>
              <label style={labelStyle}>ì¶œë ¥?•íƒœ <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display: "flex", gap: 8 }}>
                {(["CPX", "?¼ë°˜"] as const).map((v) => (
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
              <label style={labelStyle}>ì£¼ë¬¼?¬ë? <span style={{ color: "#ef4444" }}>*</span></label>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["?˜ì??íƒœ", "?€ì£¼ë¬¼", "ê¸ˆì£¼ë¬?] as const).map((v) => (
                  <button key={v} type="button" onClick={() => { setCastingType(v); setGoldDetail(""); }}
                    style={{ flex: "1 1 auto", height: 40, padding: "0 10px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      border: castingType === v ? "none" : "1.5px solid #d1d5db",
                      background: castingType === v ? "#111827" : "white",
                      color: castingType === v ? "white" : "#374151" }}>
                    {v}
                  </button>
                ))}
              </div>
              {castingType === "ê¸ˆì£¼ë¬? && (
                <select value={goldDetail} onChange={(e) => setGoldDetail(e.target.value as any)} style={{ ...selectStyle, marginTop: 8 }}>
                  <option value="">?¸ë? ?µì…˜ ? íƒ</option>
                  <option value="14K_ê³¨ë“œ">14K ê³¨ë“œ</option>
                  <option value="14K_?”ì´??>14K ?”ì´??/option>
                  <option value="14K_?‘í¬">14K ?‘í¬</option>
                  <option value="18K_ê³¨ë“œ">18K ê³¨ë“œ</option>
                  <option value="18K_?”ì´??>18K ?”ì´??/option>
                  <option value="18K_?‘í¬">18K ?‘í¬</option>
                  <option value="25K">25K</option>
                  <option value="ë°±ê¸ˆ">ë°±ê¸ˆ</option>
                </select>
              )}
            </div>
            <div style={{ ...fieldWrap, marginBottom: 0 }}>
              <label style={labelStyle}>?•ë?ì¶•ì†Œ?¬ë?</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {(["", "?•ë?", "ì¶•ì†Œ"] as const).map((v) => (
                  <button key={v} type="button" onClick={() => setScaleType(v)}
                    style={{ flex: "1 1 auto", height: 40, padding: "0 10px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      border: scaleType === v ? "none" : "1.5px solid #d1d5db",
                      background: scaleType === v ? "#111827" : "white",
                      color: scaleType === v ? "white" : "#374151" }}>
                    {v === "" ? "?†ìŒ" : v}
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

          {/* ì¶”ê? ?´ìš© */}
          <div style={section("#f9fafb")}>
            <div style={sectionTitle}>ì¶”ê? ?´ìš©</div>
            <textarea value={extraNote} onChange={(e) => setExtraNote(e.target.value)}
              placeholder="ì¶œë ¥ ??ì°¸ê³ ???´ìš©???…ë ¥?´ì£¼?¸ìš”." rows={3}
              style={{ width: "100%", borderRadius: 10, border: "1.5px solid #e5e7eb", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }} />
          </div>

          {/* ?Œì¼ ? íƒ */}
          <div style={{ padding: "14px 20px 20px" }}>
            <div style={sectionTitle}>?Œì¼ ? íƒ</div>
            {filesLoading ? (
              <p style={{ fontSize: 14, color: "#9ca3af" }}>?Œì¼ ëª©ë¡??ë¶ˆëŸ¬?¤ëŠ” ì¤?..</p>
            ) : modelFiles.length === 0 ? (
              <p style={{ fontSize: 14, color: "#9ca3af" }}>?Œì¼???†ìŠµ?ˆë‹¤.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {modelFiles.map((f) => {
                  const checked = selectedPaths.has(f.path);
                  return (
                    <label key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, border: checked ? "2px solid #111827" : "1.5px solid #e5e7eb", background: checked ? "#f8fafc" : "white", cursor: "pointer" }}>
                      <input type="checkbox" checked={checked} onChange={() => toggleFile(f.path)} style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#111827", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 800, padding: "2px 8px", borderRadius: 6, background: f.isMain ? "#111827" : "#6366f1", color: "white", flexShrink: 0 }}>
                        {f.isMain ? "?€?? : "ì¶”ê?"}
                      </span>
                      <span style={{ fontSize: 14, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>{/* ?Œì¼ ? íƒ div ??*/}
          </div>{/* ?¤ë¥¸ìª?ì»¬ëŸ¼ ??*/}
          </div>{/* stp-form-grid ??*/}
        </main>
      )}

      {/* ?˜ë‹¨ ê³ ì • ë²„íŠ¼ */}
      <div className="stp-bottom">
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
          {step === "confirm" ? (
            <>
              <button type="button" onClick={() => setStep("form")}
                style={{ height: 52, borderRadius: 14, border: "1.5px solid #d1d5db", background: "white", color: "#111827", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                ?˜ì •
              </button>
              <button type="button" onClick={handleConfirmSend} disabled={sending}
                style={{ height: 52, borderRadius: 14, border: "none", background: sending ? "#6b7280" : "#111827", color: "white", fontWeight: 900, fontSize: 15, cursor: sending ? "default" : "pointer" }}>
                {sending ? "?„ì†¡ ì¤?.." : "?„ì†¡?˜ê¸°"}
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => router.push("/library")}
                style={{ height: 52, borderRadius: 14, border: "1.5px solid #d1d5db", background: "white", color: "#111827", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                ì·¨ì†Œ
              </button>
              <button type="button" onClick={handleSendClick}
                style={{ height: 52, borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 900, fontSize: 15, cursor: "pointer" }}>
                ?„ì†¡ ??              </button>
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
