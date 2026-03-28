"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { showError, showInfo, showSuccess } from "../lib/toast";

type PurchasedModel = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  thumbnail_path?: string | null;
  file_url: string;
  model_file_path?: string | null;
  seller_id: string;
  category: string;
  created_at: string;
  purchased_at: string;
};

const CATEGORIES = ["ALL", "RING", "PENDANT", "EARRING", "BRACELET", "SET"];
const CATEGORY_LABEL: Record<string, string> = {
  ALL: "전체", RING: "링", PENDANT: "팬던트", EARRING: "이어링", BRACELET: "브레이슬릿", SET: "세트",
};

type PrinterContact = {
  id: string;
  name: string;
  email: string;
};

type SenderTemplate = {
  id: string;
  name: string;
  email: string;
  businessName: string;
  phoneNumber: string;
  notes: string;
};

type PrinterModal = {
  modelId: string;
  modelTitle: string;
  modelFilePath?: string | null;
} | null;

type ModelFile = {
  name: string;
  path: string;
  isMain: boolean;
};

const INITIAL_PRINTERS: PrinterContact[] = [
  { id: "default-gain", name: "가인출력소", email: "anscy2138@naver.com" },
  { id: "default-rpm", name: "RPM", email: "ssino1@daum.net" },
];
const ALL_PRINTERS_KEY = "all_printers";
const SENDER_TEMPLATES_KEY = "sender_templates";

function loadAllPrinters(): PrinterContact[] {
  if (typeof window === "undefined") return INITIAL_PRINTERS;
  try {
    const raw = localStorage.getItem(ALL_PRINTERS_KEY);
    if (!raw) { localStorage.setItem(ALL_PRINTERS_KEY, JSON.stringify(INITIAL_PRINTERS)); return INITIAL_PRINTERS; }
    return JSON.parse(raw);
  } catch { return INITIAL_PRINTERS; }
}
function saveAllPrinters(printers: PrinterContact[]) {
  localStorage.setItem(ALL_PRINTERS_KEY, JSON.stringify(printers));
}
function loadTemplates(): SenderTemplate[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(SENDER_TEMPLATES_KEY) || "[]"); }
  catch { return []; }
}
function saveTemplates(templates: SenderTemplate[]) {
  localStorage.setItem(SENDER_TEMPLATES_KEY, JSON.stringify(templates));
}

export default function LibraryPage() {
  const [items, setItems] = useState<PurchasedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // 팝업
  const [printerModal, setPrinterModal] = useState<PrinterModal>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  // 템플릿 저장 팝업 (최초 1회)
  const [showTemplateSetup, setShowTemplateSetup] = useState(false);
  const [pendingItem, setPendingItem] = useState<PurchasedModel | null>(null);
  const [setupBusinessName, setSetupBusinessName] = useState("");
  const [setupPhone, setSetupPhone] = useState("");
  const [setupNotes, setSetupNotes] = useState("");

  // 출력소 버튼
  const [printers, setPrinters] = useState<PrinterContact[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [printerFormMode, setPrinterFormMode] = useState<"add" | "edit" | null>(null);
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [printerFormName, setPrinterFormName] = useState("");
  const [printerFormEmail, setPrinterFormEmail] = useState("");

  // 템플릿
  const [templates, setTemplates] = useState<SenderTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateFormMode, setTemplateFormMode] = useState<"add" | "edit" | null>(null);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplFormName, setTplFormName] = useState("");
  const [tplFormEmail, setTplFormEmail] = useState("");
  const [tplFormBusinessName, setTplFormBusinessName] = useState("");
  const [tplFormPhoneNumber, setTplFormPhoneNumber] = useState("");
  const [tplFormNotes, setTplFormNotes] = useState("");

  // 주문 입력
  const [printerEmail, setPrinterEmail] = useState("");
  const [senderEmail, setSenderEmail] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [printType, setPrintType] = useState<"CPX" | "일반" | "">("");
  const [castingType, setCastingType] = useState<"수지상태" | "은주물" | "금주물" | "">("");
  const [goldDetail, setGoldDetail] = useState<"14K_골드" | "14K_화이트" | "14K_핑크" | "18K_골드" | "18K_화이트" | "18K_핑크" | "25K" | "백금" | "">("");
  const [scaleType, setScaleType] = useState<"" | "확대" | "축소">("");
  const [scalePercent, setScalePercent] = useState("0");
  const [extraNote, setExtraNote] = useState("");

  // 검색 / 카테고리 필터
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  // 파일 선택
  const [modelFiles, setModelFiles] = useState<ModelFile[]>([]);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [filesLoading, setFilesLoading] = useState(false);

  useEffect(() => { fetchLibrary(); }, []);

  const fetchLibrary = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { showInfo("로그인이 필요합니다."); window.location.href = "/auth"; return; }

      const { data: purchases, error: purchaseError } = await supabase
        .from("purchases").select("model_id, created_at")
        .eq("user_id", session.user.id).order("created_at", { ascending: false });
      if (purchaseError) { console.error(purchaseError); return; }
      if (!purchases || purchases.length === 0) { setItems([]); return; }

      const modelIds = [...new Set(purchases.map((p) => p.model_id))];
      const { data: models, error: modelError } = await supabase
        .from("models").select("*").in("id", modelIds);
      if (modelError) { console.error(modelError); return; }

      const ordered = purchases
        .map((p) => {
          const m = models?.find((mm) => mm.id === p.model_id);
          if (!m) return null;
          return { ...m, purchased_at: p.created_at };
        })
        .filter(Boolean) || [];
      setItems(Array.from(new Map(ordered.map((i: any) => [i.id, i])).values()) as PurchasedModel[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDownload = async (item: PurchasedModel) => {
    try {
      setDownloadingId(item.id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { showInfo("로그인이 필요합니다."); return; }
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ modelId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "다운로드 링크 생성에 실패했습니다."); return; }
      window.open(data.signedUrl, "_blank");
    } catch (e) { console.error(e); showError("다운로드 중 오류가 발생했습니다."); }
    finally { setDownloadingId(null); }
  };

  // ── 팝업 열기 (실제) ─────────────────────────────────────────
  const doOpenSendModal = async (item: PurchasedModel, tpl?: SenderTemplate) => {
    setPrinters(loadAllPrinters());
    setSelectedPrinterId(null);
    setPrinterFormMode(null); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail("");

    const allTpls = loadTemplates();
    setTemplates(allTpls);
    const applyTpl = tpl || (allTpls.length > 0 ? allTpls[0] : null);
    if (applyTpl) {
      setSelectedTemplateId(applyTpl.id);
      setSenderEmail(applyTpl.email || "");
      setBusinessName(applyTpl.businessName || "");
      setPhoneNumber(applyTpl.phoneNumber || "");
      setExtraNote(applyTpl.notes || "");
    } else {
      setSelectedTemplateId(null);
      setSenderEmail(""); setBusinessName(""); setPhoneNumber(""); setExtraNote("");
    }
    setTemplateFormMode(null); setEditingTemplateId(null);
    setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes("");
    setPrinterEmail("");
    setPrintType(""); setCastingType(""); setGoldDetail(""); setScaleType(""); setScalePercent("0");
    setPrinterModal({ modelId: item.id, modelTitle: item.title, modelFilePath: item.model_file_path });

    setFilesLoading(true);
    setModelFiles([]);
    setSelectedPaths(new Set());
    const files: ModelFile[] = [];
    if (item.model_file_path) {
      files.push({ name: item.model_file_path.split("/").pop() || "대표 파일", path: item.model_file_path, isMain: true });
    }
    const { data: extras } = await supabase
      .from("model_files").select("file_name, file_path")
      .eq("model_id", item.id).order("sort_order", { ascending: true });
    if (extras) extras.forEach((f: any) => files.push({ name: f.file_name, path: f.file_path, isMain: false }));
    setModelFiles(files);
    setSelectedPaths(new Set(files.map((f) => f.path)));
    setFilesLoading(false);
  };

  // ── "출력소 전송" 버튼 클릭 ──────────────────────────────────
  const openPrinterModal = (item: PurchasedModel) => {
    const existingTemplates = loadTemplates();
    if (existingTemplates.length === 0) {
      // 템플릿 없음 → 내 정보 저장 팝업 먼저
      setPendingItem(item);
      setSetupBusinessName(""); setSetupPhone(""); setSetupNotes("");
      setShowTemplateSetup(true);
    } else {
      // 템플릿 있음 → 바로 전송 팝업
      doOpenSendModal(item, existingTemplates[0]);
    }
  };

  // ── 내 정보 저장 (템플릿 설정 팝업) ─────────────────────────
  const handleSaveTemplateSetup = async () => {
    if (!setupBusinessName.trim()) { showError("출력소명(상호)을 입력해주세요."); return; }
    if (!setupPhone.trim()) { showError("연락처를 입력해주세요."); return; }
    const newTpl: SenderTemplate = {
      id: crypto.randomUUID(),
      name: setupBusinessName.trim(),
      email: "",
      businessName: setupBusinessName.trim(),
      phoneNumber: setupPhone.trim(),
      notes: setupNotes.trim(),
    };
    const updated = [newTpl];
    saveTemplates(updated);
    setTemplates(updated);
    setShowTemplateSetup(false);
    showSuccess("내 정보가 저장되었습니다.");
    if (pendingItem) {
      await doOpenSendModal(pendingItem, newTpl);
      setPendingItem(null);
    }
  };

  const closePrinterModal = () => {
    setPrinterModal(null);
    setSelectedPrinterId(null);
    setPrinterFormMode(null);
    setTemplateFormMode(null);
  };

  // ── 출력소 ──────────────────────────────────────────────────
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

  // ── 템플릿 ──────────────────────────────────────────────────
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
    setTemplateFormMode("edit"); setEditingTemplateId(t.id);
    setTplFormName(t.name); setTplFormEmail(t.email || ""); setTplFormBusinessName(t.businessName || ""); setTplFormPhoneNumber(t.phoneNumber || ""); setTplFormNotes(t.notes || "");
  };
  const handleDeleteTemplate = (id: string) => {
    if (!confirm("템플릿을 삭제할까요?")) return;
    const updated = templates.filter((t) => t.id !== id);
    setTemplates(updated); saveTemplates(updated);
    if (selectedTemplateId === id) setSelectedTemplateId(null);
    setTemplateFormMode(null);
  };

  // ── 파일 선택 ────────────────────────────────────────────────
  const toggleFile = (path: string) => {
    setSelectedPaths((prev) => {
      const next = new Set(prev);
      next.has(path) ? next.delete(path) : next.add(path);
      return next;
    });
  };

  // ── 전송 ────────────────────────────────────────────────────
  const handleSendToPrinter = () => {
    if (!printerModal) return;
    if (!printerEmail.trim()) { showError("출력소를 선택해주세요."); return; }
    if (!businessName.trim()) { showError("상호를 입력해주세요."); return; }
    if (!phoneNumber.trim()) { showError("전화번호를 입력해주세요."); return; }
    if (!printType) { showError("출력형태를 선택해주세요."); return; }
    if (!castingType) { showError("주물여부를 선택해주세요."); return; }
    if (castingType === "금주물" && !goldDetail) { showError("금주물 세부 옵션을 선택해주세요."); return; }
    if (selectedPaths.size === 0) { showError("전송할 파일을 하나 이상 선택해주세요."); return; }
    setShowConfirm(true);
  };

  const handleConfirmSend = async () => {
    if (!printerModal) return;
    const trimmedEmail = printerEmail.trim();
    try {
      setSendingId(printerModal.modelId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { showInfo("로그인이 필요합니다."); return; }

      const effectiveCastingType = castingType === "금주물" && goldDetail ? `금주물(${goldDetail})` : castingType;
      const combinedNote = extraNote.trim();

      const res = await fetch("/api/send-to-printer", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          modelId: printerModal.modelId,
          printerEmail: trimmedEmail,
          senderEmail: senderEmail.trim(),
          businessName: businessName.trim(),
          phoneNumber: phoneNumber.trim(),
          printType,
          castingType: effectiveCastingType,
          scaleType,
          scalePercent: scaleType ? scalePercent : "",
          extraNote: combinedNote,
          selectedFilePaths: Array.from(selectedPaths),
        }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "전송에 실패했습니다."); return; }
      showSuccess(`${trimmedEmail}으로 파일을 전송했습니다.`);
      if (data.oversizedFiles?.length > 0) {
        showInfo(`${data.oversizedFiles.length}개 파일은 40MB 초과로 링크로 전송됐습니다: ${data.oversizedFiles.join(", ")}`);
      }
      setShowConfirm(false);
      closePrinterModal();
    } catch (e) { console.error(e); showError("전송 중 오류가 발생했습니다."); }
    finally { setSendingId(null); }
  };

  const getThumbnailUrl = (item: PurchasedModel) => {
    if (item.thumbnail_path) {
      return supabase.storage.from("thumbnails").getPublicUrl(item.thumbnail_path).data.publicUrl;
    }
    return item.thumbnail || "";
  };

  const filteredItems = items.filter((item) => {
    const matchSearch = !search.trim() || item.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchCat = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const pagedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) {
    return <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}><p>내 다운로드를 불러오는 중...</p></main>;
  }

  // ── 스타일 (18px 기준) ─────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: "100%", height: 52, borderRadius: 12, border: "1.5px solid #d1d5db",
    padding: "0 14px", fontSize: 18, boxSizing: "border-box", outline: "none",
  };
  const selectStyle: React.CSSProperties = {
    width: "100%", height: 52, borderRadius: 12, border: "1.5px solid #d1d5db",
    padding: "0 14px", fontSize: 18, boxSizing: "border-box", background: "white", cursor: "pointer",
  };
  const labelStyle: React.CSSProperties = { fontSize: 32, fontWeight: 800, color: "#111827", marginBottom: 8, display: "block" };
  const fieldWrap: React.CSSProperties = { marginBottom: 18 };

  // ── 팝업 공통 overlay ─────────────────────────────────────
  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 100,
    display: "flex", alignItems: "flex-end", justifyContent: "center",
    padding: 0,
  };
  const modalStyle: React.CSSProperties = {
    background: "white", borderRadius: "24px 24px 0 0", width: "100%", maxWidth: 560,
    boxShadow: "0 -8px 40px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
    maxHeight: "92vh",
  };

  return (
    <>
      <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111827", margin: 0 }}>내 다운로드</h1>
              <p style={{ color: "#6b7280", fontSize: 14, margin: "6px 0 0" }}>구매한 3D 모델을 안전하게 다시 다운로드할 수 있습니다.</p>
            </div>
            <div style={{ padding: "8px 14px", borderRadius: 999, background: "#f3f4f6", color: "#111827", fontWeight: 800, fontSize: 13 }}>총 {items.length}개</div>
          </div>

          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="모델 이름으로 검색..."
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid #d1d5db", padding: "0 16px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 12 }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat} type="button"
                onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
                style={{
                  height: 34, padding: "0 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: "pointer",
                  border: selectedCategory === cat ? "none" : "1px solid #d1d5db",
                  background: selectedCategory === cat ? "#111827" : "white",
                  color: selectedCategory === cat ? "white" : "#374151",
                }}
              >
                {CATEGORY_LABEL[cat] ?? cat}
              </button>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white" }}>
            <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 16 }}>아직 구매한 상품이 없습니다.</p>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, padding: "0 18px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800 }}>상품 보러가기</Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white", textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#6b7280" }}>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="library-card-grid">
            {pagedItems.map((item) => {
              const thumbUrl = getThumbnailUrl(item);
              const fileName = item.model_file_path ? item.model_file_path.split("/").pop() || "" : "";
              const fileExt = fileName.includes(".") ? fileName.split(".").pop()?.toUpperCase() : "";
              const purchaseDate = item.purchased_at
                ? new Date(item.purchased_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
                : "-";
              return (
                <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
                  <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "#0b1220" }}>
                    {thumbUrl && <img src={thumbUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", borderRadius: 999, background: "rgba(15,23,42,0.75)", color: "white", fontSize: 11, fontWeight: 800 }}>
                      {item.category}
                    </div>
                    {fileExt && (
                      <div style={{ position: "absolute", top: 10, right: 10, padding: "3px 8px", borderRadius: 6, background: "#111827", color: "white", fontSize: 11, fontWeight: 900 }}>
                        {fileExt}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</h2>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{item.price.toLocaleString("ko-KR")}원</div>
                    {fileName && (
                      <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📎 {fileName}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>구매일 {purchaseDate}</div>
                  </div>

                  <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                    <button
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      style={{ height: 40, borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 900, cursor: downloadingId === item.id ? "default" : "pointer", fontSize: 13 }}
                    >
                      {downloadingId === item.id ? "생성 중..." : "다운로드"}
                    </button>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      <button
                        onClick={() => openPrinterModal(item)}
                        style={{ height: 36, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                      >
                        출력소 전송
                      </button>
                      <Link
                        href={`/models/${item.id}`}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 36, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", textDecoration: "none", fontWeight: 800, fontSize: 12 }}
                      >
                        상세 보기
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32 }}>
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button key={page} onClick={() => setCurrentPage(page)}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: currentPage === page ? "none" : "1px solid #d1d5db", background: currentPage === page ? "#111827" : "white", color: currentPage === page ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>
                {page}
              </button>
            ))}
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === totalPages ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === totalPages ? 0.4 : 1 }}>›</button>
          </div>
        )}
      </main>

      {/* ── 내 정보 저장 팝업 (최초 1회) ─────────────────────── */}
      {showTemplateSetup && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) setShowTemplateSetup(false); }}>
          <div style={modalStyle}>
            {/* 헤더 */}
            <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #f3f4f6", position: "relative" }}>
              <button
                onClick={() => setShowTemplateSetup(false)}
                style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: 999, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#374151", fontWeight: 700 }}
                aria-label="닫기"
              >×</button>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#c9a84c", marginBottom: 4 }}>처음 이용 시 1회 입력</div>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: 0, color: "#111827" }}>내 정보 저장</h2>
              <p style={{ fontSize: 16, color: "#6b7280", margin: "6px 0 0" }}>저장된 정보는 다음 전송 시 자동으로 입력됩니다.</p>
            </div>

            {/* 폼 */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              <div style={fieldWrap}>
                <label style={labelStyle}>상호명 (출력소명) <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  value={setupBusinessName}
                  onChange={(e) => setSetupBusinessName(e.target.value)}
                  placeholder="예: 홍길동 공방"
                  style={inputStyle}
                />
              </div>
              <div style={fieldWrap}>
                <label style={labelStyle}>연락처 <span style={{ color: "#ef4444" }}>*</span></label>
                <input
                  value={setupPhone}
                  onChange={(e) => setSetupPhone(e.target.value)}
                  placeholder="010-0000-0000"
                  style={inputStyle}
                />
              </div>
              <div style={{ ...fieldWrap, marginBottom: 4 }}>
                <label style={labelStyle}>기본 요청사항</label>
                <textarea
                  value={setupNotes}
                  onChange={(e) => setSetupNotes(e.target.value)}
                  placeholder="출력 시 참고할 내용을 입력해주세요."
                  rows={3}
                  style={{ width: "100%", borderRadius: 12, border: "1.5px solid #d1d5db", padding: "12px 14px", fontSize: 18, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }}
                />
              </div>
            </div>

            {/* 하단 버튼 */}
            <div style={{ padding: "16px 24px 32px", borderTop: "1px solid #f3f4f6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button onClick={() => setShowTemplateSetup(false)}
                style={{ minHeight: 56, borderRadius: 14, border: "1.5px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer", fontSize: 18 }}>
                취소
              </button>
              <button onClick={handleSaveTemplateSetup}
                style={{ minHeight: 56, borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 900, cursor: "pointer", fontSize: 18 }}>
                저장 후 전송 →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 출력소 전송 팝업 ──────────────────────────────────── */}
      {printerModal && (
        <div style={overlayStyle} onClick={(e) => { if (e.target === e.currentTarget) closePrinterModal(); }}>
          <div style={modalStyle}>

            {/* 헤더 */}
            <div style={{ padding: "24px 24px 14px", borderBottom: "1px solid #f3f4f6", position: "relative" }}>
              <button
                onClick={closePrinterModal}
                style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: 999, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#374151", fontWeight: 700 }}
                aria-label="닫기"
              >×</button>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 4px", color: "#111827" }}>출력소로 보내기</h2>
              <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>{printerModal.modelTitle}</p>
            </div>

            {/* 스크롤 영역 */}
            <div style={{ padding: "18px 24px", overflowY: "auto", flex: 1 }}>

              {/* ── 출력소 선택 ── */}
              <div style={fieldWrap}>
                <div style={labelStyle}>출력소 <span style={{ color: "#ef4444" }}>*</span></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {printers.map((p) => (
                    <button key={p.id} type="button" onClick={() => handleSelectPrinter(p)}
                      style={{
                        minHeight: 44, padding: "0 18px", borderRadius: 999, fontSize: 16, fontWeight: 800, cursor: "pointer",
                        border: selectedPrinterId === p.id ? "none" : "1.5px solid #d1d5db",
                        background: selectedPrinterId === p.id ? "#111827" : "white",
                        color: selectedPrinterId === p.id ? "white" : "#374151",
                      }}>
                      {p.name}
                    </button>
                  ))}
                  {printerFormMode === "add" ? null : (
                    <button type="button" onClick={() => { setPrinterFormMode("add"); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail(""); }}
                      style={{ height: 44, width: 44, borderRadius: 999, border: "1px dashed #d1d5db", background: "white", color: "#9ca3af", fontWeight: 900, cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                  )}
                </div>

                {printerFormMode !== null && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                    <input value={printerFormName} onChange={(e) => setPrinterFormName(e.target.value)}
                      placeholder="출력소명" style={{ height: 44, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 16, flex: "1 1 80px", minWidth: 80, boxSizing: "border-box", outline: "none" }} />
                    <input value={printerFormEmail} onChange={(e) => setPrinterFormEmail(e.target.value)}
                      placeholder="이메일" onKeyDown={(e) => { if (e.key === "Enter") handleSubmitPrinterForm(); }}
                      style={{ height: 44, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 16, flex: "2 1 140px", minWidth: 140, boxSizing: "border-box", outline: "none" }} />
                    <button onClick={handleSubmitPrinterForm} style={{ height: 44, padding: "0 14px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 800, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>저장</button>
                    <button onClick={() => { setPrinterFormMode(null); setEditingPrinterId(null); setPrinterFormName(""); setPrinterFormEmail(""); }}
                      style={{ height: 44, padding: "0 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, cursor: "pointer", fontSize: 16, flexShrink: 0 }}>취소</button>
                  </div>
                )}

                {selectedPrinterId && printerFormMode !== "add" && (() => {
                  const sel = printers.find((p) => p.id === selectedPrinterId);
                  if (!sel) return null;
                  return (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: 15, color: "#6b7280" }}>→ {sel.email}</div>
                      {printerFormMode !== "edit" && (
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <button type="button" onClick={() => startEditPrinter(sel)}
                            style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>편집</button>
                          <button type="button" onClick={() => handleDeletePrinter(sel.id)}
                            style={{ height: 36, padding: "0 14px", borderRadius: 8, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>삭제</button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* ── 내 정보 템플릿 ── */}
              <div style={fieldWrap}>
                <div style={labelStyle}>내 정보 템플릿 <span style={{ fontSize: 16, fontWeight: 600, color: "#6b7280" }}>(기본정보를 저장해 사용하세요)</span></div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  {templates.map((t) => (
                    <button key={t.id} type="button" onClick={() => handleSelectTemplate(t)}
                      style={{
                        minHeight: 44, padding: "0 18px", borderRadius: 999, fontSize: 16, fontWeight: 800, cursor: "pointer",
                        border: selectedTemplateId === t.id ? "none" : "1.5px solid #d1d5db",
                        background: selectedTemplateId === t.id ? "#111827" : "white",
                        color: selectedTemplateId === t.id ? "white" : "#374151",
                      }}>
                      {t.name}
                    </button>
                  ))}
                  {templateFormMode === "add" ? null : (
                    <button type="button" onClick={() => { setTemplateFormMode("add"); setEditingTemplateId(null); setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes(""); }}
                      style={{ height: 44, width: 44, borderRadius: 999, border: "1px dashed #d1d5db", background: "white", color: "#9ca3af", fontWeight: 900, cursor: "pointer", fontSize: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>+</button>
                  )}
                </div>

                {templateFormMode !== null && (
                  <div style={{ border: "1.5px solid #d1d5db", borderRadius: 16, padding: "16px", marginTop: 10, background: "#f8fafc" }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#374151", marginBottom: 12 }}>
                      {templateFormMode === "edit" ? "템플릿 편집" : "새 템플릿 추가"}
                    </div>
                    <input value={tplFormName} onChange={(e) => setTplFormName(e.target.value)} placeholder="템플릿 이름" style={{ ...inputStyle, marginBottom: 10 }} />
                    <input value={tplFormBusinessName} onChange={(e) => setTplFormBusinessName(e.target.value)} placeholder="상호명 (출력소명)" style={{ ...inputStyle, marginBottom: 10 }} />
                    <input value={tplFormPhoneNumber} onChange={(e) => setTplFormPhoneNumber(e.target.value)} placeholder="연락처" style={{ ...inputStyle, marginBottom: 10 }} />
                    <input value={tplFormEmail} onChange={(e) => setTplFormEmail(e.target.value)} placeholder="보내는 사람 이메일 (선택)" style={{ ...inputStyle, marginBottom: 10 }} />
                    <textarea value={tplFormNotes} onChange={(e) => setTplFormNotes(e.target.value)} placeholder="기본 요청사항 (선택)" rows={2}
                      style={{ width: "100%", borderRadius: 12, border: "1.5px solid #d1d5db", padding: "12px 14px", fontSize: 18, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit", marginBottom: 12 }} />
                    <div style={{ display: "flex", gap: 10 }}>
                      <button onClick={handleSubmitTemplateForm} style={{ flex: 1, minHeight: 48, borderRadius: 12, border: "none", background: "#111827", color: "white", fontWeight: 800, cursor: "pointer", fontSize: 17 }}>저장</button>
                      <button onClick={() => { setTemplateFormMode(null); setEditingTemplateId(null); setTplFormName(""); setTplFormEmail(""); setTplFormBusinessName(""); setTplFormPhoneNumber(""); setTplFormNotes(""); }}
                        style={{ flex: 1, minHeight: 48, borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, cursor: "pointer", fontSize: 17 }}>취소</button>
                    </div>
                  </div>
                )}

                {selectedTemplateId && templateFormMode !== "add" && (() => {
                  const sel = templates.find((t) => t.id === selectedTemplateId);
                  if (!sel) return null;
                  return templateFormMode !== "edit" ? (
                    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                      <button type="button" onClick={() => startEditTemplate(sel)}
                        style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>편집</button>
                      <button type="button" onClick={() => handleDeleteTemplate(sel.id)}
                        style={{ height: 38, padding: "0 14px", borderRadius: 8, border: "1px solid #fee2e2", background: "#fff5f5", color: "#ef4444", fontSize: 15, fontWeight: 700, cursor: "pointer" }}>삭제</button>
                    </div>
                  ) : null;
                })()}
              </div>

              <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0 18px" }} />

              {/* 보내는 사람 이메일 */}
              <div style={fieldWrap}>
                <label style={labelStyle}>보내는 사람 이메일</label>
                <input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="my@email.com" style={inputStyle} />
              </div>

              {/* 상호 */}
              <div style={fieldWrap}>
                <label style={labelStyle}>상호 <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="상호명" style={inputStyle} />
              </div>

              {/* 전화번호 */}
              <div style={fieldWrap}>
                <label style={labelStyle}>전화번호 <span style={{ color: "#ef4444" }}>*</span></label>
                <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="010-0000-0000" style={inputStyle} />
              </div>


              {/* 출력형태 */}
              <div style={fieldWrap}>
                <label style={labelStyle}>출력형태 <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 10 }}>
                  {(["CPX", "일반"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setPrintType(v)}
                      style={{ flex: 1, minHeight: 52, borderRadius: 12, fontSize: 18, fontWeight: 800, cursor: "pointer", border: printType === v ? "none" : "1.5px solid #d1d5db", background: printType === v ? "#111827" : "white", color: printType === v ? "white" : "#374151" }}>
                      {v}
                    </button>
                  ))}
                </div>
              </div>

              {/* 주물여부 */}
              <div style={fieldWrap}>
                <label style={labelStyle}>주물여부 <span style={{ color: "#ef4444" }}>*</span></label>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {(["수지상태", "은주물", "금주물"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => { setCastingType(v); setGoldDetail(""); }}
                      style={{ flex: "1 1 auto", minHeight: 52, padding: "0 10px", borderRadius: 12, fontSize: 18, fontWeight: 800, cursor: "pointer", border: castingType === v ? "none" : "1.5px solid #d1d5db", background: castingType === v ? "#111827" : "white", color: castingType === v ? "white" : "#374151" }}>
                      {v}
                    </button>
                  ))}
                </div>
                {castingType === "금주물" && (
                  <select value={goldDetail} onChange={(e) => setGoldDetail(e.target.value as any)} style={{ ...selectStyle, marginTop: 10 }}>
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

              {/* 확대축소여부 */}
              <div style={fieldWrap}>
                <label style={labelStyle}>확대축소여부</label>
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  {(["", "확대", "축소"] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setScaleType(v)}
                      style={{
                        flex: "1 1 auto", minHeight: 52, padding: "0 10px", borderRadius: 12, fontSize: 18, fontWeight: 800, cursor: "pointer",
                        border: scaleType === v ? "none" : "1.5px solid #d1d5db",
                        background: scaleType === v ? "#111827" : "white",
                        color: scaleType === v ? "white" : "#374151",
                      }}>
                      {v === "" ? "없음" : v}
                    </button>
                  ))}
                  {scaleType !== "" && (
                    <select value={scalePercent} onChange={(e) => setScalePercent(e.target.value)}
                      style={{ height: 52, borderRadius: 12, border: "1.5px solid #d1d5db", padding: "0 12px", fontSize: 18, background: "white", cursor: "pointer", flexShrink: 0 }}>
                      {Array.from({ length: 11 }, (_, i) => (
                        <option key={i} value={String(i)}>{i}%</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>

              {/* 추가 내용 */}
              <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0 18px" }} />
              <div style={fieldWrap}>
                <label style={labelStyle}>추가 내용</label>
                <textarea
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                  placeholder="출력 시 참고할 내용을 입력해주세요."
                  rows={3}
                  style={{ width: "100%", borderRadius: 12, border: "1.5px solid #d1d5db", padding: "12px 14px", fontSize: 18, boxSizing: "border-box", outline: "none", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }}
                />
              </div>

              {/* 파일 선택 */}
              <div style={{ height: 1, background: "#e5e7eb", margin: "4px 0 18px" }} />
              <div style={{ fontSize: 16, fontWeight: 800, color: "#374151", marginBottom: 12 }}>파일 선택</div>
              {filesLoading ? (
                <p style={{ fontSize: 16, color: "#9ca3af" }}>파일 목록을 불러오는 중...</p>
              ) : modelFiles.length === 0 ? (
                <p style={{ fontSize: 16, color: "#9ca3af" }}>파일이 없습니다.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {modelFiles.map((f) => {
                    const checked = selectedPaths.has(f.path);
                    return (
                      <label key={f.path} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 14, border: checked ? "2px solid #111827" : "1.5px solid #e5e7eb", background: checked ? "#f8fafc" : "white", cursor: "pointer" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleFile(f.path)} style={{ width: 20, height: 20, cursor: "pointer", accentColor: "#111827", flexShrink: 0 }} />
                        <span style={{ fontSize: 13, fontWeight: 900, padding: "3px 9px", borderRadius: 6, background: f.isMain ? "#111827" : "#6366f1", color: "white", flexShrink: 0 }}>
                          {f.isMain ? "대표" : "추가"}
                        </span>
                        <span style={{ fontSize: 16, color: "#374151", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 하단 버튼 */}
            <div style={{ padding: "16px 24px 32px", borderTop: "1px solid #f3f4f6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button onClick={closePrinterModal}
                style={{ minHeight: 56, borderRadius: 14, border: "1.5px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer", fontSize: 18 }}>취소</button>
              <button onClick={handleSendToPrinter} disabled={sendingId === printerModal.modelId}
                style={{ minHeight: 56, borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 900, cursor: sendingId === printerModal.modelId ? "default" : "pointer", fontSize: 18 }}>
                {sendingId === printerModal.modelId ? "전송 중..." : "전송"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 전송 확인 팝업 ───────────────────────────────── */}
      {showConfirm && printerModal && (
        <div style={{ ...overlayStyle, zIndex: 200 }} onClick={(e) => { if (e.target === e.currentTarget) setShowConfirm(false); }}>
          <div style={{ ...modalStyle, borderRadius: "24px 24px 0 0" }}>

            {/* 헤더 */}
            <div style={{ padding: "24px 24px 16px", borderBottom: "1px solid #f3f4f6", position: "relative" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ position: "absolute", top: 20, right: 20, width: 44, height: 44, borderRadius: 999, border: "1px solid #e5e7eb", background: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#374151", fontWeight: 700 }}
                aria-label="닫기"
              >×</button>
              <h2 style={{ fontSize: 22, fontWeight: 900, margin: "0 0 4px", color: "#111827" }}>전송 확인</h2>
              <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>아래 내용으로 이메일을 전송합니다.</p>
            </div>

            {/* 내용 */}
            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280", marginBottom: 8, letterSpacing: "0.04em" }}>받는 이메일</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>{printerEmail}</div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280", marginBottom: 8, letterSpacing: "0.04em" }}>메일 제목</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>&lt;{businessName.trim()}&gt; 출력부탁드려요</div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280", marginBottom: 8, letterSpacing: "0.04em" }}>메일 내용</div>
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
                      <div style={{ width: 90, flexShrink: 0, padding: "10px 14px", fontSize: 14, fontWeight: 800, color: "#6b7280", background: "#f8fafc" }}>{row.label}</div>
                      <div style={{ flex: 1, padding: "10px 14px", fontSize: 16, fontWeight: 700, color: "#111827" }}>{row.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#6b7280", marginBottom: 8, letterSpacing: "0.04em" }}>첨부 파일 ({selectedPaths.size}개)</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {modelFiles.filter((f) => selectedPaths.has(f.path)).map((f) => (
                    <div key={f.path} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 12, background: "#f8fafc", border: "1px solid #e5e7eb" }}>
                      <span style={{ fontSize: 12, fontWeight: 900, padding: "3px 8px", borderRadius: 6, background: f.isMain ? "#111827" : "#6366f1", color: "white", flexShrink: 0 }}>
                        {f.isMain ? "대표" : "추가"}
                      </span>
                      <span style={{ fontSize: 15, color: "#374151", fontWeight: 600 }}>{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 하단 버튼 */}
            <div style={{ padding: "16px 24px 32px", borderTop: "1px solid #f3f4f6", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <button onClick={() => setShowConfirm(false)}
                style={{ minHeight: 56, borderRadius: 14, border: "1.5px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer", fontSize: 18 }}>
                수정
              </button>
              <button onClick={handleConfirmSend} disabled={sendingId === printerModal.modelId}
                style={{ minHeight: 56, borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 900, cursor: sendingId === printerModal.modelId ? "default" : "pointer", fontSize: 18 }}>
                {sendingId === printerModal.modelId ? "전송 중..." : "전송하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
