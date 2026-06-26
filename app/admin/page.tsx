"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { scrollToTop } from "@/lib/scroll";
import Image from "next/image";
import { showError, showSuccess } from "../lib/toast";

const GOLD = "#c9a84c";
const SIDEBAR_BG = "#111827";

type AdminTab = "users" | "conversations" | "reports" | "stats" | "commissions" | "bannedWords" | "deletedMembers" | "notices" | "modelReports" | "deletionRequests" | "inquiries" | "printShops" | "finishingWorkers";

interface UserProfile {
  id: string;
  nickname: string | null;
  email: string | null;
  role: string;
  created_at: string;
  points: number | null;
  is_point_blocked: boolean;
  warning_count: number;
  deleted_at: string | null;
  last_sign_in_at: string | null;
}

interface DeletedConv {
  id: string;
  user1_id: string;
  user2_id: string;
  user1_nickname: string;
  user1_email: string;
  user2_nickname: string;
  user2_email: string;
  deleted_by_user1: boolean;
  deleted_by_user2: boolean;
  updated_at: string;
  messages?: ConvMsg[];
}

interface ConvMsg {
  id: string;
  sender_id: string;
  sender_nickname: string;
  content: string;
  created_at: string;
}

interface ReportedAnswer {
  id: string;
  post_id: string;
  post_title: string;
  user_id: string;
  nickname: string;
  content: string;
  report_count: number;
  created_at: string;
  reasons: string[];
}

interface Purchase {
  id: string;
  model_id: string;
  price: number;
  created_at: string;
}

interface ModelInfo {
  id: string;
  title: string;
  seller_id: string;
}

interface SellerProfile {
  id: string;
  nickname: string;
}

interface DeletionRequest {
  id: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  mission: { id: string; title: string } | null;
  requester: { nickname: string; email: string } | null;
}

interface InquiryAnswer {
  id: string;
  content: string;
  created_at: string;
}

interface Inquiry {
  id: string;
  user_id: string;
  user_email: string | null;
  title: string;
  content: string;
  status: "pending" | "answered";
  inquiry_answers: InquiryAnswer[];
  created_at: string;
}

interface Commission {
  id: string;
  title: string;
  images: string[];
  status: string;
  user_id: string;
  created_at: string;
  is_private: boolean;
  target_seller_id?: string | null;
  nickname: string;
  seller_nickname?: string;
  commission_results?: { count: number }[];
}

const STATUS_LABEL: Record<string, string> = {
  open: "의뢰중", in_progress: "작업중", completed: "완료",
  pending: "의뢰중", negotiating: "협의중", payment: "결제중",
  working: "작업중", downloaded: "다운완료", rejected: "거절됨", cancelled: "취소됨",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#2563eb", in_progress: "#d97706", completed: "#16a34a",
  pending: "#2563eb", negotiating: "#7c3aed", payment: "#d97706",
  working: "#ea580c", downloaded: "#16a34a", rejected: "#dc2626", cancelled: "#6b7280",
};
const STATUS_BG: Record<string, string> = {
  open: "#dbeafe", in_progress: "#fef3c7", completed: "#dcfce7",
  pending: "#dbeafe", negotiating: "#ede9fe", payment: "#fef3c7",
  working: "#fff7ed", downloaded: "#dcfce7", rejected: "#fef2f2", cancelled: "#f3f4f6",
};
const STATUS_GROUP: Record<string, string[]> = {
  "의뢰중": ["pending", "open"],
  "결제중": ["payment"],
  "작업중": ["working", "in_progress"],
  "완료":   ["completed", "downloaded"],
  "취소":   ["cancelled", "rejected"],
};

const SIDEBAR_TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: "users",         label: "유저 관리",   icon: "👥" },
  { key: "conversations", label: "삭제된 대화",  icon: "🗑" },
  { key: "reports",       label: "신고 관리",   icon: "🚩" },
  { key: "stats",         label: "판매 통계",   icon: "📊" },
  { key: "commissions",   label: "의뢰 관리",   icon: "📋" },
  { key: "bannedWords",    label: "금지어 관리",  icon: "🚫" },
  { key: "deletedMembers", label: "탈퇴 회원",    icon: "👤" },
  { key: "notices",        label: "공지사항",     icon: "📢" },
  { key: "modelReports",      label: "모델 신고",      icon: "🚨" },
  { key: "deletionRequests",  label: "삭제 요청 관리",  icon: "🗂" },
  { key: "inquiries",         label: "문의 관리",       icon: "💬" },
  { key: "printShops",        label: "출력소 관리",      icon: "🖨" },
  { key: "finishingWorkers",  label: "마무리 작업자",    icon: "🔧" },
];

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>("users");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  /* ── Users ── */
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [userActionId, setUserActionId] = useState<string | null>(null);

  /* ── Conversations ── */
  const [convs, setConvs] = useState<DeletedConv[]>([]);
  const [convsLoading, setConvsLoading] = useState(false);
  const [expandedConvId, setExpandedConvId] = useState<string | null>(null);
  const [loadingMsgsFor, setLoadingMsgsFor] = useState<string | null>(null);

  /* ── Reports ── */
  const [reports, setReports] = useState<ReportedAnswer[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportActionId, setReportActionId] = useState<string | null>(null);

  /* ── Stats ── */
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [modelsInfo, setModelsInfo] = useState<ModelInfo[]>([]);
  const [sellerProfiles, setSellerProfiles] = useState<SellerProfile[]>([]);
  const [allUsers, setAllUsers] = useState<{ id: string; created_at: string }[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsPeriod, setStatsPeriod] = useState<"today" | "week" | "month" | "all">("month");

  /* ── Deleted Members ── */
  const [deletedMembers, setDeletedMembers] = useState<{
    id: string; original_user_id: string; nickname: string | null; email: string | null;
    phone: string | null; bank_account: string | null; role: string | null;
    warning_count: number; deleted_at: string; reason: string | null;
  }[]>([]);
  const [deletedMembersLoading, setDeletedMembersLoading] = useState(false);
  const [deletedMemberSearch, setDeletedMemberSearch] = useState("");

  /* ── Deletion Requests ── */
  const [deletionRequests, setDeletionRequests] = useState<DeletionRequest[]>([]);
  const [deletionRequestsLoading, setDeletionRequestsLoading] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);

  /* ── Model Reports ── */
  const [modelReports, setModelReports] = useState<{
    id: string; model_id: string; reporter_id: string; reason: string;
    detail: string | null; status: string; created_at: string;
    model_title?: string; reporter_nickname?: string;
  }[]>([]);
  const [modelReportsLoading, setModelReportsLoading] = useState(false);

  /* ── Notices ── */
  const [notices, setNotices] = useState<{ id: string; title: string; content: string; is_pinned: boolean; created_at: string }[]>([]);
  const [noticesLoading, setNoticesLoading] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ title: "", content: "", is_pinned: false });
  const [noticeSaving, setNoticeSaving] = useState(false);
  const [noticeEditId, setNoticeEditId] = useState<string | null>(null);

  /* ── Banned Words ── */
  const [bannedWords, setBannedWords] = useState<{ id: string; word: string; created_at: string }[]>([]);
  const [bannedWordsLoading, setBannedWordsLoading] = useState(false);
  const [newBannedWord, setNewBannedWord] = useState("");
  const [addingBannedWord, setAddingBannedWord] = useState(false);
  const [removingBannedWordId, setRemovingBannedWordId] = useState<string | null>(null);

  /* ── Inquiries ── */
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [inqLoading, setInqLoading] = useState(false);
  const [inqStatusFilter, setInqStatusFilter] = useState("");
  const [inqExpanded, setInqExpanded] = useState<string | null>(null);
  const [inqAnswerText, setInqAnswerText] = useState<Record<string, string>>({});
  const [inqAnswering, setInqAnswering] = useState<string | null>(null);

  /* ── Print Shops ── */
  const [printShops, setPrintShops] = useState<{
    id: string; name: string; address: string; phone: string;
    hours: string | null; description: string | null; naver_map_url: string | null;
    is_active: boolean; created_at: string;
  }[]>([]);
  const [printShopsLoading, setPrintShopsLoading] = useState(false);
  const [psForm, setPsForm] = useState({ name: "", address: "", phone: "", hours: "", description: "", naver_map_url: "", is_active: true });
  const [psEditId, setPsEditId] = useState<string | null>(null);
  const [psSaving, setPsSaving] = useState(false);
  const [psShowForm, setPsShowForm] = useState(false);

  /* ── Finishing Workers ── */
  const WORK_SCOPE_OPTIONS = ["시야기까지", "원본까지", "고무가다까지"] as const;
  const [finishingWorkers, setFinishingWorkers] = useState<{
    id: string; name: string; email: string; phone: string;
    work_scope: string[]; location: string | null; description: string | null;
    is_active: boolean; created_at: string;
  }[]>([]);
  const [fwLoading, setFwLoading] = useState(false);
  const [fwForm, setFwForm] = useState({ name: "", email: "", phone: "", location: "", work_scope: [] as string[], description: "", is_active: true });
  const [fwEditId, setFwEditId] = useState<string | null>(null);
  const [fwSaving, setFwSaving] = useState(false);
  const [fwShowForm, setFwShowForm] = useState(false);

  /* ── Commissions ── */
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [commLoading, setCommLoading] = useState(false);
  const [commSearch, setCommSearch] = useState("");
  const [commStatusFilter, setCommStatusFilter] = useState("");
  const [commTypeFilter, setCommTypeFilter] = useState("");
  const [commDeleting, setCommDeleting] = useState<string | null>(null);

  /* ── Auth ─────────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      const token = getAccessToken();
      if (!token) { router.replace("/"); return; }
      const uid = (decodeJwt(token) as any)?.sub as string;
      if (!uid) { router.replace("/"); return; }

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?id=eq.${uid}&select=role&limit=1`,
        {
          headers: {
            "apikey": process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Authorization": `Bearer ${token}`,
          },
        }
      );
      const profileArr = await res.json();
      const role = profileArr?.[0]?.role;
      if (role !== "admin") { router.replace("/"); return; }

      setAuthorized(true);
      setLoading(false);
      loadTab("users");
    })();
  }, []);

  /* ── Helpers ───────────────────────────────────────────── */
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  };

  const authHeader = async () => ({
    Authorization: `Bearer ${await getToken()}`,
    "Content-Type": "application/json",
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const fmtKRW = (n: number) => n.toLocaleString("ko-KR") + "원";

  /* ── Tab Loader ────────────────────────────────────────── */
  const loadTab = async (tab: AdminTab) => {
    if (tab === "users"         && users.length === 0)       fetchUsers();
    if (tab === "conversations" && convs.length === 0)       fetchConvs();
    if (tab === "reports"       && reports.length === 0)     fetchReports();
    if (tab === "stats"         && purchases.length === 0)   fetchStats();
    if (tab === "commissions"   && commissions.length === 0) fetchCommissions();
    if (tab === "bannedWords"    && bannedWords.length === 0)    fetchBannedWords();
    if (tab === "deletedMembers" && deletedMembers.length === 0) fetchDeletedMembers();
    if (tab === "notices"        && notices.length === 0)        fetchNotices();
    if (tab === "modelReports"     && modelReports.length === 0)     fetchModelReports();
    if (tab === "deletionRequests" && deletionRequests.length === 0) fetchDeletionRequests();
    if (tab === "inquiries"        && inquiries.length === 0)        fetchInquiries();
    if (tab === "printShops"       && printShops.length === 0)       fetchPrintShops();
    if (tab === "finishingWorkers" && finishingWorkers.length === 0) fetchFinishingWorkers();
  };

  const switchTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setSidebarOpen(false);
    loadTab(tab);
  };

  /* ── Fetchers ──────────────────────────────────────────── */
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: await authHeader() });
      const { data } = await res.json();
      setUsers(data || []);
    } catch { showError("유저 목록 불러오기 실패"); }
    finally { setUsersLoading(false); }
  };

  const fetchConvs = async () => {
    setConvsLoading(true);
    try {
      const res = await fetch("/api/admin/deleted-conversations", { headers: await authHeader() });
      const { data } = await res.json();
      setConvs(data || []);
    } catch { showError("대화 목록 불러오기 실패"); }
    finally { setConvsLoading(false); }
  };

  const fetchConvMessages = async (convId: string) => {
    if (expandedConvId === convId) { setExpandedConvId(null); return; }
    const already = convs.find(c => c.id === convId)?.messages;
    if (already) { setExpandedConvId(convId); return; }

    setLoadingMsgsFor(convId);
    try {
      const res = await fetch("/api/admin/deleted-conversations", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ conversationId: convId }),
      });
      const { data: msgs } = await res.json();
      setConvs(prev => prev.map(c => c.id === convId ? { ...c, messages: msgs } : c));
      setExpandedConvId(convId);
    } catch { showError("메시지 불러오기 실패"); }
    finally { setLoadingMsgsFor(null); }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await fetch("/api/admin/reports", { headers: await authHeader() });
      const { data } = await res.json();
      setReports(data || []);
    } catch { showError("신고 목록 불러오기 실패"); }
    finally { setReportsLoading(false); }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await fetch("/api/admin/stats", { headers: await authHeader() });
      const { purchases: p, models: m, newUsers: u, sellerProfiles: s } = await res.json();
      setPurchases(p || []);
      setModelsInfo(m || []);
      setAllUsers(u || []);
      setSellerProfiles(s || []);
    } catch { showError("통계 불러오기 실패"); }
    finally { setStatsLoading(false); }
  };

  const fetchInquiries = async () => {
    setInqLoading(true);
    try {
      const res = await fetch("/api/admin/inquiries", { headers: await authHeader() });
      const { data } = await res.json();
      setInquiries(data || []);
    } catch { showError("문의 목록 불러오기 실패"); }
    finally { setInqLoading(false); }
  };

  const handleDeleteInquiryAnswer = async (answerId: string) => {
    if (!confirm("답변을 삭제하시겠습니까?")) return;
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "DELETE",
        headers: await authHeader(),
        body: JSON.stringify({ answerId }),
      });
      if (!res.ok) { showError("답변 삭제 실패"); return; }
      showSuccess("답변이 삭제되었습니다.");
      await fetchInquiries();
    } catch { showError("오류가 발생했습니다."); }
  };

  const handleAnswerInquiry = async (id: string) => {
    const answer = inqAnswerText[id]?.trim();
    if (!answer) { showError("답변 내용을 입력하세요."); return; }
    setInqAnswering(id);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: await authHeader(),
        body: JSON.stringify({ id, answer }),
      });
      if (!res.ok) { showError("답변 저장 실패"); return; }
      showSuccess("답변이 저장되고 사용자에게 알림이 발송되었습니다.");
      setInqAnswerText(prev => { const n = { ...prev }; delete n[id]; return n; });
      await fetchInquiries(); // 낙관적 업데이트 대신 서버에서 재조회해 기존 답변 유실 방지
    } catch { showError("오류가 발생했습니다."); }
    finally { setInqAnswering(null); }
  };

  const fetchCommissions = async () => {
    setCommLoading(true);
    try {
      const res = await fetch("/api/commission/admin", { headers: await authHeader() });
      const { data } = await res.json();
      setCommissions(data || []);
    } catch { showError("의뢰 목록 불러오기 실패"); }
    finally { setCommLoading(false); }
  };

  const fetchDeletionRequests = async () => {
    setDeletionRequestsLoading(true);
    try {
      const res = await fetch("/api/admin/cad-school/mission-delete-requests", { headers: await authHeader() });
      const { requests } = await res.json();
      setDeletionRequests(requests || []);
    } catch { showError("삭제 요청 목록 불러오기 실패"); }
    finally { setDeletionRequestsLoading(false); }
  };

  const handleDeletionRequest = async (requestId: string, action: "approve" | "reject") => {
    const msg = action === "approve"
      ? "미션을 실제로 삭제하고 요청을 승인하시겠습니까?"
      : "이 삭제 요청을 거절하시겠습니까?";
    if (!confirm(msg)) return;
    setProcessingRequestId(requestId + action);
    try {
      const res = await fetch("/api/admin/cad-school/mission-delete-requests", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ request_id: requestId, action }),
      });
      if (!res.ok) { showError("처리 실패"); return; }
      showSuccess(action === "approve" ? "미션이 삭제되고 요청이 승인되었습니다." : "요청이 거절되었습니다.");
      const newStatus = action === "approve" ? "approved" : "rejected";
      setDeletionRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: newStatus } : r));
    } catch { showError("오류가 발생했습니다."); }
    finally { setProcessingRequestId(null); }
  };

  const fetchDeletedMembers = async () => {
    setDeletedMembersLoading(true);
    try {
      const res = await fetch("/api/admin/deleted-profiles", { headers: await authHeader() });
      const { data } = await res.json();
      setDeletedMembers(data || []);
    } catch { showError("탈퇴 회원 목록 불러오기 실패"); }
    finally { setDeletedMembersLoading(false); }
  };

  const fetchModelReports = async () => {
    setModelReportsLoading(true);
    try {
      const { data, error } = await supabase
        .from("model_reports")
        .select("id, model_id, reporter_id, reason, detail, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) { setModelReports([]); return; }

      const modelIds  = [...new Set(data.map((r: any) => r.model_id))];
      const reporterIds = [...new Set(data.map((r: any) => r.reporter_id))];

      const [{ data: models }, { data: reporters }] = await Promise.all([
        supabase.from("models").select("id, title").in("id", modelIds),
        supabase.from("profiles").select("id, nickname").in("id", reporterIds),
      ]);

      const modelMap: Record<string, string> = {};
      (models || []).forEach((m: any) => { modelMap[m.id] = m.title; });
      const reporterMap: Record<string, string> = {};
      (reporters || []).forEach((p: any) => { reporterMap[p.id] = p.nickname || p.id.slice(0, 8); });

      setModelReports(data.map((r: any) => ({
        ...r,
        model_title: modelMap[r.model_id] || r.model_id.slice(0, 8),
        reporter_nickname: reporterMap[r.reporter_id] || r.reporter_id.slice(0, 8),
      })));
    } catch (e) {
      console.error("[admin/modelReports] 조회 실패:", e);
      showError("모델 신고 목록 불러오기 실패");
    } finally {
      setModelReportsLoading(false);
    }
  };

  const fetchPrintShops = async () => {
    setPrintShopsLoading(true);
    try {
      const { data, error } = await supabase.from("print_shops").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      setPrintShops(data || []);
    } catch { showError("출력소 목록 불러오기 실패"); }
    finally { setPrintShopsLoading(false); }
  };

  const fetchFinishingWorkers = async () => {
    setFwLoading(true);
    try {
      const { data, error } = await supabase.from("finishing_workers").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      setFinishingWorkers(data || []);
    } catch { showError("마무리 작업자 목록 불러오기 실패"); }
    finally { setFwLoading(false); }
  };

  const handleSaveFinishingWorker = async () => {
    if (!fwForm.name.trim()) { showError("이름을 입력하세요."); return; }
    if (!fwForm.email.trim()) { showError("이메일을 입력하세요."); return; }
    if (!fwForm.phone.trim()) { showError("연락처를 입력하세요."); return; }
    setFwSaving(true);
    try {
      const payload = {
        name: fwForm.name.trim(), email: fwForm.email.trim(), phone: fwForm.phone.trim(),
        location: fwForm.location.trim() || null, work_scope: fwForm.work_scope,
        description: fwForm.description.trim() || null, is_active: fwForm.is_active,
      };
      if (fwEditId) {
        const { error } = await supabase.from("finishing_workers").update(payload).eq("id", fwEditId);
        if (error) throw error;
        showSuccess("작업자 정보를 수정했습니다.");
      } else {
        const { error } = await supabase.from("finishing_workers").insert(payload);
        if (error) throw error;
        showSuccess("작업자를 추가했습니다.");
      }
      setFwShowForm(false); setFwEditId(null);
      setFwForm({ name: "", email: "", phone: "", location: "", work_scope: [], description: "", is_active: true });
      await fetchFinishingWorkers();
    } catch { showError("저장에 실패했습니다."); }
    finally { setFwSaving(false); }
  };

  const handleDeleteFinishingWorker = async (id: string) => {
    if (!confirm("작업자를 삭제할까요?")) return;
    const { error } = await supabase.from("finishing_workers").delete().eq("id", id);
    if (error) { showError("삭제 실패"); return; }
    setFinishingWorkers(prev => prev.filter(w => w.id !== id));
    showSuccess("삭제했습니다.");
  };

  const startEditFinishingWorker = (w: typeof finishingWorkers[0]) => {
    setFwEditId(w.id);
    setFwForm({ name: w.name, email: w.email, phone: w.phone, location: w.location || "", work_scope: w.work_scope || [], description: w.description || "", is_active: w.is_active });
    setFwShowForm(true);
  };

  const toggleFwScope = (scope: string) => {
    setFwForm(prev => ({
      ...prev,
      work_scope: prev.work_scope.includes(scope)
        ? prev.work_scope.filter(s => s !== scope)
        : [...prev.work_scope, scope],
    }));
  };

  const handleSavePrintShop = async () => {
    if (!psForm.name.trim()) { showError("출력소 이름을 입력하세요."); return; }
    if (!psForm.address.trim()) { showError("주소를 입력하세요."); return; }
    if (!psForm.phone.trim()) { showError("연락처를 입력하세요."); return; }
    setPsSaving(true);
    try {
      const payload = {
        name: psForm.name.trim(), address: psForm.address.trim(), phone: psForm.phone.trim(),
        hours: psForm.hours.trim() || null, description: psForm.description.trim() || null,
        naver_map_url: psForm.naver_map_url.trim() || null, is_active: psForm.is_active,
      };
      if (psEditId) {
        const { error } = await supabase.from("print_shops").update(payload).eq("id", psEditId);
        if (error) throw error;
        showSuccess("출력소를 수정했습니다.");
      } else {
        const { error } = await supabase.from("print_shops").insert(payload);
        if (error) throw error;
        showSuccess("출력소를 추가했습니다.");
      }
      setPsShowForm(false); setPsEditId(null);
      setPsForm({ name: "", address: "", phone: "", hours: "", description: "", naver_map_url: "", is_active: true });
      await fetchPrintShops();
    } catch { showError("저장에 실패했습니다."); }
    finally { setPsSaving(false); }
  };

  const handleDeletePrintShop = async (id: string) => {
    if (!confirm("출력소를 삭제할까요?")) return;
    const { error } = await supabase.from("print_shops").delete().eq("id", id);
    if (error) { showError("삭제 실패"); return; }
    setPrintShops(prev => prev.filter(p => p.id !== id));
    showSuccess("삭제했습니다.");
  };

  const startEditPrintShop = (ps: typeof printShops[0]) => {
    setPsEditId(ps.id);
    setPsForm({ name: ps.name, address: ps.address, phone: ps.phone, hours: ps.hours || "", description: ps.description || "", naver_map_url: ps.naver_map_url || "", is_active: ps.is_active });
    setPsShowForm(true);
  };

  const handleReportStatus = async (id: string, status: "reviewed" | "dismissed") => {
    const { error } = await supabase.from("model_reports").update({ status }).eq("id", id);
    if (error) { showError("상태 변경 실패"); return; }
    setModelReports((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
    showSuccess(status === "reviewed" ? "검토 완료 처리했습니다." : "기각 처리했습니다.");
  };

  const handleDeleteReportedModel = async (modelId: string) => {
    if (!confirm("해당 모델을 삭제할까요? 이 작업은 되돌릴 수 없습니다.")) return;
    const { error } = await supabase.from("models").delete().eq("id", modelId);
    if (error) { showError("모델 삭제 실패"); return; }
    setModelReports((prev) => prev.filter((r) => r.model_id !== modelId));
    showSuccess("모델이 삭제되었습니다.");
  };

  const fetchNotices = async () => {
    setNoticesLoading(true);
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notices?select=*&order=is_pinned.desc,created_at.desc`,
        {
          headers: {
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            Authorization: `Bearer ${token || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
          },
        }
      );
      const data = await res.json();
      if (!res.ok) {
        console.error("[admin/notices] 응답 오류:", data);
        showError(`공지사항 불러오기 실패: ${data?.message || data?.code || res.status}`);
        setNotices([]);
        return;
      }
      setNotices(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("[admin/notices] 예외:", e);
      showError("공지사항 불러오기 실패");
    } finally {
      setNoticesLoading(false);
    }
  };

  const saveNotice = async () => {
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      showError("제목과 내용을 입력하세요."); return;
    }
    setNoticeSaving(true);
    try {
      const token = getAccessToken();
      const headers = {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      };
      if (noticeEditId) {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notices?id=eq.${noticeEditId}`,
          { method: "PATCH", headers, body: JSON.stringify({ title: noticeForm.title, content: noticeForm.content, is_pinned: noticeForm.is_pinned }) }
        );
        showSuccess("공지사항이 수정되었습니다.");
      } else {
        await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notices`,
          { method: "POST", headers, body: JSON.stringify({ title: noticeForm.title, content: noticeForm.content, is_pinned: noticeForm.is_pinned }) }
        );
        showSuccess("공지사항이 등록되었습니다.");
      }
      setNoticeForm({ title: "", content: "", is_pinned: false });
      setNoticeEditId(null);
      await fetchNotices();
    } catch { showError("저장 실패"); }
    finally { setNoticeSaving(false); }
  };

  const deleteNotice = async (id: string) => {
    if (!confirm("공지사항을 삭제할까요?")) return;
    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notices?id=eq.${id}`,
        { method: "DELETE", headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, Authorization: `Bearer ${getAccessToken()}` } }
      );
      showSuccess("삭제되었습니다.");
      setNotices((prev) => prev.filter((n) => n.id !== id));
    } catch { showError("삭제 실패"); }
  };

  const fetchBannedWords = async () => {
    setBannedWordsLoading(true);
    try {
      const res = await fetch("/api/admin/banned-words", { headers: await authHeader() });
      const { words } = await res.json();
      setBannedWords(words || []);
    } catch { showError("금지어 목록 불러오기 실패"); }
    finally { setBannedWordsLoading(false); }
  };

  const handleAddBannedWord = async () => {
    const trimmed = newBannedWord.trim().toLowerCase();
    if (!trimmed) return;
    setAddingBannedWord(true);
    try {
      const res = await fetch("/api/admin/banned-words", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({ word: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || "추가 실패"); return; }
      setBannedWords(prev => [...prev, json.word].sort((a, b) => a.word.localeCompare(b.word)));
      setNewBannedWord("");
      showSuccess(`"${trimmed}" 금지어 추가 완료`);
    } catch { showError("오류가 발생했습니다."); }
    finally { setAddingBannedWord(false); }
  };

  const handleRemoveBannedWord = async (id: string, word: string) => {
    setRemovingBannedWordId(id);
    try {
      const res = await fetch("/api/admin/banned-words", {
        method: "DELETE",
        headers: await authHeader(),
        body: JSON.stringify({ id }),
      });
      if (!res.ok) { showError("삭제 실패"); return; }
      setBannedWords(prev => prev.filter(w => w.id !== id));
      showSuccess(`"${word}" 금지어 삭제 완료`);
    } catch { showError("오류가 발생했습니다."); }
    finally { setRemovingBannedWordId(null); }
  };

  const handleDeleteCommission = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.")) return;
    setCommDeleting(id);
    try {
      const res = await fetch(`/api/commission/delete?id=${id}`, {
        method: "DELETE", headers: await authHeader(),
      });
      if (!res.ok) { showError("삭제 실패"); return; }
      showSuccess("의뢰가 삭제되었습니다.");
      setCommissions(prev => prev.filter(c => c.id !== id));
    } catch { showError("오류가 발생했습니다."); }
    finally { setCommDeleting(null); }
  };

  /* ── User Actions ──────────────────────────────────────── */
  const updateUser = async (userId: string, updates: Record<string, unknown>, msg: string) => {
    setUserActionId(userId + JSON.stringify(updates));
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: await authHeader(),
        body: JSON.stringify({ userId, updates }),
      });
      if (!res.ok) { showError("처리 실패"); return; }
      showSuccess(msg);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    } catch { showError("오류가 발생했습니다."); }
    finally { setUserActionId(null); }
  };

  /* ── Report Actions ────────────────────────────────────── */
  const handleDeleteAnswer = async (answerId: string) => {
    setReportActionId(answerId + "-del");
    try {
      const res = await fetch(`/api/admin/reports?answerId=${answerId}`, {
        method: "DELETE", headers: await authHeader(),
      });
      if (!res.ok) { showError("삭제 실패"); return; }
      showSuccess("답변이 삭제되었습니다.");
      setReports(prev => prev.filter(r => r.id !== answerId));
    } catch { showError("오류가 발생했습니다."); }
    finally { setReportActionId(null); }
  };

  const handleDeductPoints = async (answer: ReportedAnswer) => {
    setReportActionId(answer.id + "-pts");
    try {
      const res = await fetch("/api/points", {
        method: "POST",
        headers: await authHeader(),
        body: JSON.stringify({
          user_id: answer.user_id,
          amount: -10,
          reason: "신고된 답변 포인트 회수",
          reference_id: answer.id,
        }),
      });
      if (!res.ok) { showError("포인트 회수 실패"); return; }
      showSuccess(`${answer.nickname}님 10포인트 회수 완료`);
    } catch { showError("오류가 발생했습니다."); }
    finally { setReportActionId(null); }
  };

  /* ── Stats Calculation ─────────────────────────────────── */
  const filteredPurchases = (() => {
    if (statsPeriod === "all") return purchases;
    const cutoff = new Date();
    if (statsPeriod === "today") cutoff.setHours(0, 0, 0, 0);
    else if (statsPeriod === "week") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);
    return purchases.filter(p => new Date(p.created_at) >= cutoff);
  })();

  const totalRevenue = filteredPurchases.reduce((s, p) => s + (p.price || 0), 0);

  const sellerRankings = (() => {
    const map: Record<string, { sellerId: string; revenue: number; count: number }> = {};
    const modelSellerMap: Record<string, string> = {};
    modelsInfo.forEach(m => { modelSellerMap[m.id] = m.seller_id; });
    filteredPurchases.forEach(p => {
      const sid = modelSellerMap[p.model_id];
      if (!sid) return;
      if (!map[sid]) map[sid] = { sellerId: sid, revenue: 0, count: 0 };
      map[sid].revenue += p.price || 0;
      map[sid].count++;
    });
    const spMap: Record<string, string> = {};
    sellerProfiles.forEach(s => { spMap[s.id] = s.nickname; });
    return Object.values(map)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10)
      .map(r => ({ ...r, nickname: spMap[r.sellerId] || "알 수 없음" }));
  })();

  const productRankings = (() => {
    const map: Record<string, { modelId: string; count: number; revenue: number }> = {};
    filteredPurchases.forEach(p => {
      if (!map[p.model_id]) map[p.model_id] = { modelId: p.model_id, count: 0, revenue: 0 };
      map[p.model_id].count++;
      map[p.model_id].revenue += p.price || 0;
    });
    const mMap: Record<string, string> = {};
    modelsInfo.forEach(m => { mMap[m.id] = m.title; });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(r => ({ ...r, title: mMap[r.modelId] || "알 수 없음" }));
  })();

  const newUserCount = (() => {
    if (statsPeriod === "all") return allUsers.length;
    const cutoff = new Date();
    if (statsPeriod === "today") cutoff.setHours(0, 0, 0, 0);
    else if (statsPeriod === "week") cutoff.setDate(cutoff.getDate() - 7);
    else cutoff.setMonth(cutoff.getMonth() - 1);
    return allUsers.filter(u => new Date(u.created_at) >= cutoff).length;
  })();

  /* ── Filtered lists ────────────────────────────────────── */
  const filteredUsers = users.filter(u => {
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (u.nickname || "").toLowerCase().includes(q)
      || (u.email || "").toLowerCase().includes(q);
  });

  const filteredCommissions = commissions.filter(c => {
    if (commSearch) {
      const q = commSearch.toLowerCase();
      if (!c.title.toLowerCase().includes(q) && !(c.nickname || "").toLowerCase().includes(q)) return false;
    }
    if (commStatusFilter) {
      const allowed = STATUS_GROUP[commStatusFilter] ?? [];
      if (!allowed.includes(c.status)) return false;
    }
    if (commTypeFilter === "공개의뢰" && c.is_private) return false;
    if (commTypeFilter === "개인의뢰" && (!c.is_private || !c.target_seller_id)) return false;
    if (commTypeFilter === "미지정의뢰" && (!c.is_private || c.target_seller_id)) return false;
    return true;
  });

  const filteredInquiries = inquiries.filter(inq =>
    !inqStatusFilter || inq.status === inqStatusFilter
  );

  /* ── Render ────────────────────────────────────────────── */
  if (loading) return (
    <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
      <p style={{ color: "#6b7280" }}>권한 확인 중...</p>
    </main>
  );
  if (!authorized) return null;

  return (
    <div style={{
      display: "flex", minHeight: "calc(100vh - 68px)",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        .adm-sidebar { width: 220px; background: ${SIDEBAR_BG}; flex-shrink: 0; display: flex; flex-direction: column; position: sticky; top: 68px; height: calc(100vh - 68px); overflow-y: auto; }
        .adm-main    { flex: 1; min-width: 0; background: #f8f9fa; }
        .adm-tab-btn:hover { background: rgba(201,168,76,0.1) !important; }
        .adm-row:hover { background: #fafafa; }
        .adm-mobile-header { display: none; align-items: center; justify-content: space-between; height: 52px; background: white; border-bottom: 1px solid #e5e7eb; padding: 0 16px; position: sticky; top: 68px; z-index: 10; }
        .adm-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 40; }
        @media (max-width: 768px) {
          .adm-sidebar { position: fixed !important; top: 68px; left: 0; bottom: 0; z-index: 50; transform: translateX(-100%); transition: transform 0.25s; }
          .adm-sidebar.open { transform: translateX(0); }
          .adm-main { margin-left: 0 !important; }
          .adm-mobile-header { display: flex !important; }
          .adm-overlay { display: block !important; }
          .adm-content { padding: 16px 12px 80px !important; }
          .adm-user-email { display: none; }
        }
      `}</style>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="adm-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className={`adm-sidebar${sidebarOpen ? " open" : ""}`}>
        <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.35)", letterSpacing: "0.1em", marginBottom: 4 }}>ADMIN PANEL</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: GOLD }}>관리자 페이지</div>
        </div>

        <nav style={{ padding: "10px 0", flex: 1 }}>
          {SIDEBAR_TABS.map(tab => (
            <button
              key={tab.key}
              type="button"
              className="adm-tab-btn"
              onClick={() => switchTab(tab.key)}
              style={{
                width: "100%", height: 48, display: "flex", alignItems: "center",
                gap: 10, padding: "0 20px", border: "none", cursor: "pointer",
                background: activeTab === tab.key ? "rgba(201,168,76,0.12)" : "transparent",
                color: activeTab === tab.key ? GOLD : "rgba(255,255,255,0.7)",
                fontWeight: activeTab === tab.key ? 700 : 500, fontSize: 14,
                borderLeft: activeTab === tab.key ? `3px solid ${GOLD}` : "3px solid transparent",
                transition: "all 0.15s", textAlign: "left",
              }}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", flexDirection: "column", gap: 10 }}>
          <Link href="/admin/settlement" style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
            정산 관리 →
          </Link>
          <Link href="/" style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", textDecoration: "none" }}>
            ← 사이트로
          </Link>
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────── */}
      <main className="adm-main">
        {/* Mobile header */}
        <div className="adm-mobile-header">
          <button type="button" onClick={() => setSidebarOpen(p => !p)}
            style={{ border: "none", background: "none", cursor: "pointer", fontSize: 22, color: "#374151" }}>
            ☰
          </button>
          <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>
            {SIDEBAR_TABS.find(t => t.key === activeTab)?.icon}{" "}
            {SIDEBAR_TABS.find(t => t.key === activeTab)?.label}
          </span>
          <div style={{ width: 40 }} />
        </div>

        <div className="adm-content" style={{ padding: "28px 28px 80px" }}>

          {/* ══════════════════════════════════════════════
              1. 유저 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "users" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>유저 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>전체 유저 {users.length}명</p>
                </div>
                <button type="button" onClick={fetchUsers} style={btnStyle("outline")}>새로고침</button>
              </div>

              {/* Search */}
              <input
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="닉네임 또는 이메일 검색"
                style={{
                  width: "100%", maxWidth: 400, height: 42, padding: "0 14px",
                  borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14,
                  outline: "none", marginBottom: 16, boxSizing: "border-box",
                }}
              />

              {usersLoading ? <LoadingSpinner /> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                        {["닉네임", "이메일", "역할", "포인트", "상태", "가입일", "마지막 접속", "관리"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => {
                        const isSuspended = !!u.deleted_at;
                        const isBlocked   = u.is_point_blocked;
                        const actionBase  = userActionId?.startsWith(u.id);

                        return (
                          <tr key={u.id} className="adm-row" style={{ borderBottom: "1px solid #f3f4f6", opacity: isSuspended ? 0.6 : 1 }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                              {u.nickname || "—"}
                              {isBlocked && <span style={badgeStyle("#ef4444", "#fef2f2")}> 차단</span>}
                              {u.warning_count > 0 && <span style={badgeStyle("#d97706", "#fef3c7")}> 경고{u.warning_count}</span>}
                            </td>
                            <td className="adm-user-email" style={{ padding: "10px 12px", color: "#6b7280", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {u.email || "—"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={badgeStyle(
                                u.role === "admin" ? "#7c3aed" : u.role === "seller" ? "#16a34a" : "#6b7280",
                                u.role === "admin" ? "#ede9fe" : u.role === "seller" ? "#dcfce7" : "#f3f4f6",
                              )}>
                                {u.role}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#374151" }}>
                              {(u.points ?? 0).toLocaleString()}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span style={badgeStyle(
                                isSuspended ? "#dc2626" : "#16a34a",
                                isSuspended ? "#fef2f2" : "#dcfce7",
                              )}>
                                {isSuspended ? "정지" : "활성"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                              {u.created_at ? new Date(u.created_at).toLocaleDateString("ko-KR") : "-"}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#9ca3af", whiteSpace: "nowrap" }}>
                              {u.last_sign_in_at ? (() => {
                                const dt = new Date(u.last_sign_in_at);
                                const y = dt.getFullYear();
                                const m = String(dt.getMonth() + 1).padStart(2, "0");
                                const d = String(dt.getDate()).padStart(2, "0");
                                const h = String(dt.getHours()).padStart(2, "0");
                                const min = String(dt.getMinutes()).padStart(2, "0");
                                return `${y}.${m}.${d} ${h}:${min}`;
                              })() : "접속 기록 없음"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                {/* Role toggle */}
                                {u.role !== "admin" && (
                                  <button type="button" disabled={!!actionBase} onClick={() =>
                                    updateUser(u.id, { role: u.role === "seller" ? "user" : "seller" },
                                      u.role === "seller" ? "판매자 → 일반 유저로 변경" : "일반 유저 → 판매자로 변경")
                                  } style={miniBtn(GOLD)}>
                                    {u.role === "seller" ? "→유저" : "→판매자"}
                                  </button>
                                )}

                                {/* Unblock */}
                                {isBlocked && (
                                  <button type="button" disabled={!!actionBase} onClick={() =>
                                    updateUser(u.id, { is_point_blocked: false }, "포인트 차단 해제")
                                  } style={miniBtn("#7c3aed")}>
                                    차단해제
                                  </button>
                                )}

                                {/* Reset warnings */}
                                {u.warning_count > 0 && (
                                  <button type="button" disabled={!!actionBase} onClick={() =>
                                    updateUser(u.id, { warning_count: 0 }, "경고 횟수 초기화")
                                  } style={miniBtn("#d97706")}>
                                    경고초기화
                                  </button>
                                )}

                                {/* Suspend / Restore */}
                                {!isSuspended ? (
                                  <button type="button" disabled={!!actionBase || u.role === "admin"} onClick={() =>
                                    updateUser(u.id, { deleted_at: new Date().toISOString() }, "계정이 정지되었습니다.")
                                  } style={miniBtn("#dc2626")}>
                                    정지
                                  </button>
                                ) : (
                                  <button type="button" disabled={!!actionBase} onClick={() =>
                                    updateUser(u.id, { deleted_at: null }, "계정이 복구되었습니다.")
                                  } style={miniBtn("#16a34a")}>
                                    복구
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <p style={{ textAlign: "center", color: "#9ca3af", padding: "32px 0" }}>
                      {userSearch ? "검색 결과가 없습니다." : "유저가 없습니다."}
                    </p>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              2. 삭제된 대화
          ══════════════════════════════════════════════ */}
          {activeTab === "conversations" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>삭제된 대화</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>한쪽 이상이 삭제한 대화 {convs.length}건</p>
                </div>
                <button type="button" onClick={fetchConvs} style={btnStyle("outline")}>새로고침</button>
              </div>

              {convsLoading ? <LoadingSpinner /> : convs.length === 0 ? (
                <Empty text="삭제된 대화가 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {convs.map(c => (
                    <div key={c.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "white", overflow: "hidden" }}>
                      <button
                        type="button"
                        onClick={() => fetchConvMessages(c.id)}
                        style={{
                          width: "100%", background: "none", border: "none", cursor: "pointer",
                          padding: "14px 18px", textAlign: "left", display: "flex",
                          alignItems: "center", justifyContent: "space-between", gap: 12,
                        }}
                      >
                        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", flex: 1, minWidth: 0 }}>
                          {/* User 1 */}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{c.user1_nickname}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.user1_email}</div>
                            {c.deleted_by_user1 && <span style={badgeStyle("#dc2626", "#fef2f2")}>삭제함</span>}
                          </div>
                          <div style={{ fontSize: 16, color: "#d1d5db", alignSelf: "center" }}>↔</div>
                          {/* User 2 */}
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{c.user2_nickname}</div>
                            <div style={{ fontSize: 11, color: "#9ca3af" }}>{c.user2_email}</div>
                            {c.deleted_by_user2 && <span style={badgeStyle("#dc2626", "#fef2f2")}>삭제함</span>}
                          </div>
                          <div style={{ marginLeft: "auto", fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", alignSelf: "center" }}>
                            {formatDate(c.updated_at)}
                          </div>
                        </div>
                        <span style={{ fontSize: 18, color: "#9ca3af", flexShrink: 0 }}>
                          {loadingMsgsFor === c.id ? "⋯" : expandedConvId === c.id ? "−" : "+"}
                        </span>
                      </button>

                      {expandedConvId === c.id && c.messages && (
                        <div style={{ borderTop: "1px solid #f3f4f6", padding: "14px 18px", maxHeight: 400, overflowY: "auto", background: "#fafafa" }}>
                          {c.messages.length === 0 ? (
                            <p style={{ color: "#9ca3af", fontSize: 13, textAlign: "center" }}>메시지가 없습니다.</p>
                          ) : c.messages.map(m => (
                            <div key={m.id} style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "flex-start" }}>
                              <div style={{ flexShrink: 0, width: 28, height: 28, borderRadius: "50%", background: "#e5e7eb", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>
                                {(m.sender_nickname || "?")[0]}
                              </div>
                              <div>
                                <div style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>
                                  {m.sender_nickname}
                                  <span style={{ marginLeft: 8, fontWeight: 400, color: "#9ca3af" }}>{formatDate(m.created_at)}</span>
                                </div>
                                <div style={{ fontSize: 14, color: "#111827", marginTop: 2, lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                                  {m.content}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              3. 신고 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "reports" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>신고 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>신고된 답변 {reports.length}건</p>
                </div>
                <button type="button" onClick={fetchReports} style={btnStyle("outline")}>새로고침</button>
              </div>

              {reportsLoading ? <LoadingSpinner /> : reports.length === 0 ? (
                <Empty text="신고된 답변이 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {reports.map(r => (
                    <div key={r.id} style={{ border: "1px solid #fecaca", borderRadius: 14, background: "white", padding: "16px 20px" }}>
                      {/* Header */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 22, fontWeight: 900, color: "#dc2626" }}>🚩 {r.report_count}</span>
                            <Link href={`/ask/${r.post_id}`} target="_blank" style={{ fontSize: 14, fontWeight: 700, color: "#111827", textDecoration: "none" }}>
                              {r.post_title}
                            </Link>
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: "#9ca3af" }}>
                            작성자: {r.nickname} · {formatDate(r.created_at)}
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                          <button type="button"
                            disabled={reportActionId === r.id + "-pts"}
                            onClick={() => handleDeductPoints(r)}
                            style={btnStyle("warn", reportActionId === r.id + "-pts")}>
                            {reportActionId === r.id + "-pts" ? "처리 중..." : "포인트 회수"}
                          </button>
                          <button type="button"
                            disabled={reportActionId === r.id + "-del"}
                            onClick={() => handleDeleteAnswer(r.id)}
                            style={btnStyle("danger", reportActionId === r.id + "-del")}>
                            {reportActionId === r.id + "-del" ? "삭제 중..." : "답변 삭제"}
                          </button>
                        </div>
                      </div>

                      {/* Answer content */}
                      <div style={{ background: "#fef2f2", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: "#374151", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: 10 }}>
                        {r.content}
                      </div>

                      {/* Report reasons */}
                      {r.reasons.length > 0 && (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>신고 사유:</span>
                          {[...new Set(r.reasons)].map((reason, i) => (
                            <span key={i} style={badgeStyle("#dc2626", "#fef2f2")}>{reason}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              4. 판매 통계
          ══════════════════════════════════════════════ */}
          {activeTab === "stats" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>판매 통계</h2>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {(["today", "week", "month", "all"] as const).map(p => (
                    <button key={p} type="button" onClick={() => setStatsPeriod(p)}
                      style={{
                        height: 36, padding: "0 14px", borderRadius: 999, fontSize: 13,
                        border: "1px solid #d1d5db", cursor: "pointer", fontWeight: 700,
                        background: statsPeriod === p ? SIDEBAR_BG : "white",
                        color: statsPeriod === p ? "white" : "#374151",
                      }}>
                      {{ today: "오늘", week: "이번주", month: "이번달", all: "전체" }[p]}
                    </button>
                  ))}
                  <button type="button" onClick={fetchStats} style={btnStyle("outline")}>새로고침</button>
                </div>
              </div>

              {statsLoading ? <LoadingSpinner /> : (
                <>
                  {/* Summary cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14, marginBottom: 28 }}>
                    <StatCard label="총 매출" value={fmtKRW(totalRevenue)} color={GOLD} />
                    <StatCard label="총 판매건수" value={`${filteredPurchases.length}건`} color="#2563eb" />
                    <StatCard label="신규 가입자" value={`${newUserCount}명`} color="#16a34a" />
                    <StatCard label="전체 유저" value={`${allUsers.length}명`} color="#7c3aed" />
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
                    {/* Seller rankings */}
                    <div style={cardStyle}>
                      <h3 style={cardTitle}>판매자별 매출 순위</h3>
                      {sellerRankings.length === 0 ? <Empty text="데이터 없음" /> : (
                        sellerRankings.map((s, i) => (
                          <div key={s.sellerId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ width: 24, height: 24, borderRadius: "50%", background: i < 3 ? GOLD : "#e5e7eb", color: i < 3 ? "white" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{s.nickname}</span>
                            </div>
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>{fmtKRW(s.revenue)}</div>
                              <div style={{ fontSize: 11, color: "#9ca3af" }}>{s.count}건</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>

                    {/* Product rankings */}
                    <div style={cardStyle}>
                      <h3 style={cardTitle}>상품별 다운로드 순위</h3>
                      {productRankings.length === 0 ? <Empty text="데이터 없음" /> : (
                        productRankings.map((p, i) => (
                          <div key={p.modelId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                              <span style={{ width: 24, height: 24, borderRadius: "50%", background: i < 3 ? GOLD : "#e5e7eb", color: i < 3 ? "white" : "#6b7280", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                              <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.title}</span>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#2563eb" }}>{p.count}회</div>
                              <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtKRW(p.revenue)}</div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              5. 의뢰 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "commissions" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>의뢰 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>전체 의뢰 {commissions.length}건</p>
                </div>
                <button type="button" onClick={fetchCommissions} style={btnStyle("outline")}>새로고침</button>
              </div>

              {/* Filters */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                <input
                  value={commSearch}
                  onChange={e => setCommSearch(e.target.value)}
                  placeholder="제목 또는 의뢰자 닉네임"
                  style={{
                    height: 40, padding: "0 14px", borderRadius: 10, border: "1px solid #d1d5db",
                    fontSize: 13, outline: "none", minWidth: 200, flex: 1,
                  }}
                />
                <select value={commStatusFilter} onChange={e => setCommStatusFilter(e.target.value)}
                  style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}>
                  <option value="">전체 상태</option>
                  {Object.keys(STATUS_GROUP).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={commTypeFilter} onChange={e => setCommTypeFilter(e.target.value)}
                  style={{ height: 40, padding: "0 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}>
                  <option value="">전체 유형</option>
                  <option>공개의뢰</option>
                  <option>개인의뢰</option>
                  <option>미지정의뢰</option>
                </select>
              </div>

              {commLoading ? <LoadingSpinner /> : filteredCommissions.length === 0 ? (
                <Empty text="의뢰가 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filteredCommissions.map(c => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, border: "1px solid #e5e7eb", borderRadius: 14, background: "white", padding: "14px 18px", flexWrap: "wrap" }}>
                      {/* Thumbnail */}
                      <a href={`/commission/${c.id}`} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 14, flex: 1, minWidth: 0, textDecoration: "none" }}>
                        {c.images?.[0] ? (
                          <Image src={c.images[0]} alt="" width={56} height={56} style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 10, background: "#f3f4f6", flexShrink: 0 }} />
                        )}

                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {c.title}
                          </div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                            {c.nickname}
                            {c.is_private && c.target_seller_id && c.seller_nickname && (
                              <> → <span style={{ color: GOLD, fontWeight: 700 }}>{c.seller_nickname}</span></>
                            )}
                            {c.is_private && !c.target_seller_id && " (미지정 개인의뢰)"}
                            {!c.is_private && " (공개의뢰)"}
                            {" · "}{new Date(c.created_at).toLocaleDateString("ko-KR")}
                          </div>
                        </div>
                      </a>

                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        {c.commission_results?.[0]?.count !== undefined && (
                          <span style={{ fontSize: 12, color: "#6b7280" }}>결과 {c.commission_results[0].count}개</span>
                        )}
                        <span style={{
                          height: 26, padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                          background: STATUS_BG[c.status] || "#f3f4f6",
                          color: STATUS_COLOR[c.status] || "#6b7280",
                          display: "inline-flex", alignItems: "center",
                        }}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteCommission(c.id)}
                          disabled={commDeleting === c.id}
                          style={{
                            height: 28, padding: "0 12px", borderRadius: 8, border: "1px solid #fca5a5",
                            background: "white", color: "#dc2626", fontSize: 12, fontWeight: 700,
                            cursor: commDeleting === c.id ? "not-allowed" : "pointer", opacity: commDeleting === c.id ? 0.6 : 1,
                          }}
                        >
                          {commDeleting === c.id ? "삭제 중..." : "삭제"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              6. 탈퇴 회원
          ══════════════════════════════════════════════ */}
          {activeTab === "deletedMembers" && (() => {
            const q = deletedMemberSearch.toLowerCase();
            const filtered = deletedMembers.filter(m =>
              !q ||
              (m.nickname || "").toLowerCase().includes(q) ||
              (m.email    || "").toLowerCase().includes(q) ||
              (m.phone    || "").toLowerCase().includes(q)
            );
            return (
              <section>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>탈퇴 회원</h2>
                    <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
                      탈퇴한 판매자·회원 정보 — 전자상거래법 기준 5년 보관 ({deletedMembers.length}명)
                    </p>
                  </div>
                  <button type="button" onClick={fetchDeletedMembers} style={btnStyle("outline")}>새로고침</button>
                </div>

                <input
                  value={deletedMemberSearch}
                  onChange={e => setDeletedMemberSearch(e.target.value)}
                  placeholder="닉네임, 이메일, 연락처 검색"
                  style={{
                    width: "100%", maxWidth: 400, height: 42, padding: "0 14px",
                    borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14,
                    outline: "none", marginBottom: 16, boxSizing: "border-box",
                  }}
                />

                {deletedMembersLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
                  <Empty text="탈퇴 회원이 없습니다." />
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                      <thead>
                        <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                          {["닉네임", "이메일", "연락처", "역할", "경고", "탈퇴일", "사유"].map(h => (
                            <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filtered.map(m => (
                          <tr key={m.id} className="adm-row" style={{ borderBottom: "1px solid #f3f4f6" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>
                              {m.nickname || "—"}
                              {m.role === "seller" && (
                                <span style={{ ...badgeStyle(GOLD, "#fdf6e3"), marginLeft: 4 }}>판매자</span>
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#374151" }}>{m.email || "—"}</td>
                            <td style={{ padding: "10px 12px", color: "#374151", whiteSpace: "nowrap" }}>{m.phone || "—"}</td>
                            <td style={{ padding: "10px 12px", color: "#6b7280" }}>{m.role || "user"}</td>
                            <td style={{ padding: "10px 12px", color: "#6b7280", textAlign: "center" }}>{m.warning_count}</td>
                            <td style={{ padding: "10px 12px", color: "#6b7280", whiteSpace: "nowrap" }}>
                              {new Date(m.deleted_at).toLocaleDateString("ko-KR")}
                            </td>
                            <td style={{ padding: "10px 12px", color: "#6b7280", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m.reason || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            );
          })()}

          {/* ══════════════════════════════════════════════
              7. 금지어 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "bannedWords" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>금지어 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
                    업로드 시 제목·설명에서 자동 감지되는 단어 목록 ({bannedWords.length}개)
                  </p>
                </div>
                <button type="button" onClick={fetchBannedWords} style={btnStyle("outline")}>새로고침</button>
              </div>

              {/* 추가 입력 */}
              <div style={{
                display: "flex", gap: 10, marginBottom: 20,
                background: "white", border: "1px solid #e5e7eb",
                borderRadius: 14, padding: "14px 16px",
              }}>
                <input
                  value={newBannedWord}
                  onChange={e => setNewBannedWord(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddBannedWord()}
                  placeholder="추가할 금지어 입력 (소문자 자동 변환)"
                  style={{
                    flex: 1, height: 42, padding: "0 14px",
                    borderRadius: 10, border: "1px solid #d1d5db",
                    fontSize: 14, outline: "none", boxSizing: "border-box",
                  }}
                />
                <button
                  type="button"
                  onClick={handleAddBannedWord}
                  disabled={addingBannedWord || !newBannedWord.trim()}
                  style={{
                    height: 42, padding: "0 20px", borderRadius: 10,
                    border: "none", background: GOLD, color: "white",
                    fontWeight: 700, fontSize: 14,
                    cursor: addingBannedWord || !newBannedWord.trim() ? "not-allowed" : "pointer",
                    opacity: addingBannedWord || !newBannedWord.trim() ? 0.6 : 1,
                    whiteSpace: "nowrap",
                  }}
                >
                  {addingBannedWord ? "추가 중..." : "추가"}
                </button>
              </div>

              {/* 안내 */}
              <div style={{
                background: "#fef3c7", border: "1px solid #fde68a",
                borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#92400e",
              }}>
                모델 업로드 시 제목·설명에 아래 단어가 포함되면 자동으로 업로드가 차단됩니다.
              </div>

              {/* 목록 */}
              {bannedWordsLoading ? <LoadingSpinner /> : bannedWords.length === 0 ? (
                <Empty text="등록된 금지어가 없습니다." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 8 }}>
                  {bannedWords.map(bw => (
                    <div
                      key={bw.id}
                      style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        background: "white", border: "1px solid #e5e7eb",
                        borderRadius: 10, padding: "10px 14px", gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827", wordBreak: "break-all" }}>
                        {bw.word}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveBannedWord(bw.id, bw.word)}
                        disabled={removingBannedWordId === bw.id}
                        style={{
                          flexShrink: 0, height: 26, padding: "0 10px", borderRadius: 7,
                          border: "1px solid #fca5a5", background: "white",
                          color: "#dc2626", fontSize: 12, fontWeight: 700,
                          cursor: removingBannedWordId === bw.id ? "not-allowed" : "pointer",
                          opacity: removingBannedWordId === bw.id ? 0.5 : 1,
                        }}
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              모델 신고 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "modelReports" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>모델 신고</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
                    신고된 모델 목록 — 검토 완료/기각 처리 및 모델 삭제
                  </p>
                </div>
                <button type="button" onClick={fetchModelReports} style={btnStyle("outline")}>새로고침</button>
              </div>

              {modelReportsLoading ? <LoadingSpinner /> : modelReports.length === 0 ? (
                <Empty text="신고된 모델이 없습니다." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {modelReports.map((r) => {
                    const statusColor = r.status === "reviewed" ? "#16a34a" : r.status === "dismissed" ? "#9ca3af" : "#d97706";
                    const statusLabel = r.status === "reviewed" ? "검토완료" : r.status === "dismissed" ? "기각" : "대기중";
                    return (
                      <div key={r.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                              <Link href={`/models/${r.model_id}`} target="_blank"
                                style={{ fontSize: 15, fontWeight: 800, color: "#111827", textDecoration: "none" }}>
                                {r.model_title}
                              </Link>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40` }}>
                                {statusLabel}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>
                              <strong>사유:</strong> {r.reason}
                            </div>
                            {r.detail && (
                              <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 4 }}>
                                <strong>상세:</strong> {r.detail}
                              </div>
                            )}
                            <div style={{ fontSize: 12, color: "#9ca3af" }}>
                              신고자: {r.reporter_nickname} · {new Date(r.created_at).toLocaleDateString("ko-KR")}
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap" }}>
                            {r.status === "pending" && (
                              <>
                                <button type="button" onClick={() => handleReportStatus(r.id, "reviewed")} style={miniBtn("#16a34a")}>검토완료</button>
                                <button type="button" onClick={() => handleReportStatus(r.id, "dismissed")} style={miniBtn("#6b7280")}>기각</button>
                              </>
                            )}
                            <button type="button" onClick={() => handleDeleteReportedModel(r.model_id)} style={miniBtn("#dc2626")}>모델 삭제</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              공지사항 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "notices" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>공지사항 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
                    공지사항 등록·수정·삭제 및 중요 공지 핀 설정
                  </p>
                </div>
                <button type="button" onClick={fetchNotices} style={btnStyle("outline")}>새로고침</button>
              </div>

              {/* 작성/수정 폼 */}
              <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: 20, marginBottom: 28 }}>
                <h3 style={{ margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#111827" }}>
                  {noticeEditId ? "공지사항 수정" : "새 공지사항 등록"}
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input
                      type="text"
                      placeholder="제목"
                      value={noticeForm.title}
                      onChange={(e) => setNoticeForm((f) => ({ ...f, title: e.target.value }))}
                      style={{ flex: 1, height: 38, border: "1px solid #d1d5db", borderRadius: 8, padding: "0 12px", fontSize: 14 }}
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#374151", cursor: "pointer", whiteSpace: "nowrap" }}>
                      <input
                        type="checkbox"
                        checked={noticeForm.is_pinned}
                        onChange={(e) => setNoticeForm((f) => ({ ...f, is_pinned: e.target.checked }))}
                      />
                      📌 중요 공지
                    </label>
                  </div>
                  <textarea
                    placeholder="내용"
                    value={noticeForm.content}
                    onChange={(e) => setNoticeForm((f) => ({ ...f, content: e.target.value }))}
                    rows={5}
                    style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "10px 12px", fontSize: 14, resize: "vertical", lineHeight: 1.7 }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={saveNotice}
                      disabled={noticeSaving}
                      style={{ height: 38, padding: "0 20px", borderRadius: 10, border: "none", background: GOLD, color: "white", fontWeight: 700, fontSize: 13, cursor: noticeSaving ? "not-allowed" : "pointer", opacity: noticeSaving ? 0.6 : 1 }}
                    >
                      {noticeSaving ? "저장 중..." : noticeEditId ? "수정 저장" : "등록"}
                    </button>
                    {noticeEditId && (
                      <button
                        type="button"
                        onClick={() => { setNoticeEditId(null); setNoticeForm({ title: "", content: "", is_pinned: false }); }}
                        style={btnStyle("outline")}
                      >
                        취소
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* 목록 */}
              {noticesLoading ? <LoadingSpinner /> : notices.length === 0 ? (
                <Empty text="등록된 공지사항이 없습니다." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {notices.map((n) => (
                    <div
                      key={n.id}
                      style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          {n.is_pinned && <span style={{ fontSize: 13 }}>📌</span>}
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{n.title}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: 13, color: "#6b7280", whiteSpace: "pre-wrap", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as any }}>
                          {n.content}
                        </p>
                        <span style={{ fontSize: 12, color: "#9ca3af", marginTop: 4, display: "block" }}>
                          {new Date(n.created_at).toLocaleDateString("ko-KR")}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setNoticeEditId(n.id);
                            setNoticeForm({ title: n.title, content: n.content, is_pinned: n.is_pinned });
                            scrollToTop();
                          }}
                          style={miniBtn("#2563eb")}
                        >
                          수정
                        </button>
                        <button type="button" onClick={() => deleteNotice(n.id)} style={miniBtn("#dc2626")}>
                          삭제
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              삭제 요청 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "deletionRequests" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>삭제 요청 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>
                    미션 게시판 삭제 요청 — 전체 {deletionRequests.length}건
                  </p>
                </div>
                <button type="button" onClick={fetchDeletionRequests} style={btnStyle("outline")}>새로고침</button>
              </div>

              {deletionRequestsLoading ? <LoadingSpinner /> : deletionRequests.length === 0 ? (
                <Empty text="삭제 요청이 없습니다." />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {deletionRequests.map((r) => {
                    const isPending = r.status === "pending";
                    const statusColor = r.status === "approved" ? "#16a34a" : r.status === "rejected" ? "#dc2626" : "#d97706";
                    const statusLabel = r.status === "approved" ? "승인" : r.status === "rejected" ? "거절" : "대기중";
                    const isProcessing = processingRequestId?.startsWith(r.id);
                    return (
                      <div key={r.id} style={{ background: "white", border: `1px solid ${isPending ? "#fde68a" : "#e5e7eb"}`, borderRadius: 14, padding: "16px 20px" }}>
                        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* 제목 + 상태 */}
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>
                                {r.mission?.title ?? "(삭제된 미션)"}
                              </span>
                              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, color: statusColor, background: `${statusColor}18`, border: `1px solid ${statusColor}40` }}>
                                {statusLabel}
                              </span>
                            </div>
                            {/* 메타 */}
                            <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
                              <span>작성자: <strong style={{ color: "#374151" }}>{r.requester?.nickname ?? "—"}</strong></span>
                              <span>{r.requester?.email ?? ""}</span>
                              <span>요청일: {new Date(r.created_at).toLocaleDateString("ko-KR")}</span>
                            </div>
                            {/* 사유 */}
                            <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#374151", lineHeight: 1.6 }}>
                              <span style={{ fontWeight: 700, color: "#6b7280", marginRight: 6 }}>삭제 사유:</span>
                              {r.reason}
                            </div>
                            {r.admin_note && (
                              <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                                관리자 메모: {r.admin_note}
                              </div>
                            )}
                          </div>
                          {/* 버튼 */}
                          {isPending && (
                            <div style={{ display: "flex", gap: 6, flexShrink: 0, flexWrap: "wrap", alignSelf: "flex-start" }}>
                              <button
                                type="button"
                                disabled={!!isProcessing}
                                onClick={() => handleDeletionRequest(r.id, "approve")}
                                style={{ ...miniBtn("#16a34a"), opacity: isProcessing ? 0.5 : 1 }}
                              >
                                {processingRequestId === r.id + "approve" ? "처리 중..." : "삭제 승인"}
                              </button>
                              <button
                                type="button"
                                disabled={!!isProcessing}
                                onClick={() => handleDeletionRequest(r.id, "reject")}
                                style={{ ...miniBtn("#dc2626"), opacity: isProcessing ? 0.5 : 1 }}
                              >
                                {processingRequestId === r.id + "reject" ? "처리 중..." : "요청 거절"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              문의 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "inquiries" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>문의 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>전체 {inquiries.length}건</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <select
                    value={inqStatusFilter}
                    onChange={e => setInqStatusFilter(e.target.value)}
                    style={{ height: 38, padding: "0 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 13, outline: "none" }}
                  >
                    <option value="">전체</option>
                    <option value="pending">대기중</option>
                    <option value="answered">답변완료</option>
                  </select>
                  <button type="button" onClick={fetchInquiries} style={btnStyle("outline")}>새로고침</button>
                </div>
              </div>

              {inqLoading ? <LoadingSpinner /> : filteredInquiries.length === 0 ? (
                <Empty text="문의가 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {filteredInquiries.map(inq => (
                    <div key={inq.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, overflow: "hidden" }}>
                      <button
                        type="button"
                        onClick={() => setInqExpanded(prev => prev === inq.id ? null : inq.id)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center",
                          justifyContent: "space-between", gap: 12,
                          padding: "16px 20px", background: "none", border: "none",
                          cursor: "pointer", textAlign: "left",
                        }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>{inq.title}</span>
                            <span style={badgeStyle(
                              inq.status === "answered" ? "#16a34a" : "#d97706",
                              inq.status === "answered" ? "#dcfce7" : "#fef3c7",
                            )}>
                              {inq.status === "answered" ? "답변완료" : "대기중"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
                            {inq.user_email || "—"} · {formatDate(inq.created_at)}
                          </div>
                        </div>
                        <span style={{ fontSize: 18, color: "#9ca3af", flexShrink: 0 }}>
                          {inqExpanded === inq.id ? "−" : "+"}
                        </span>
                      </button>

                      {inqExpanded === inq.id && (
                        <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f3f4f6" }}>
                          {/* 문의 내용 */}
                          <div style={{ background: "#f9fafb", borderRadius: 12, padding: "14px 16px", fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap", marginTop: 12 }}>
                            {inq.content}
                          </div>

                          {/* 기존 답변 목록 */}
                          {(inq.inquiry_answers || []).length > 0 && (
                            <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>
                                관리자 답변 {inq.inquiry_answers.length}건
                              </div>
                              {inq.inquiry_answers.map(ans => (
                                <div key={ans.id}>
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(ans.created_at)}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteInquiryAnswer(ans.id)}
                                      style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 700, padding: "0 4px" }}
                                    >
                                      삭제
                                    </button>
                                  </div>
                                  <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12, padding: "12px 14px", fontSize: 14, color: "#374151", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                                    {ans.content}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* 새 답변 입력 (항상 표시) */}
                          <div style={{ marginTop: 14 }}>
                            <textarea
                              value={inqAnswerText[inq.id] || ""}
                              onChange={e => setInqAnswerText(prev => ({ ...prev, [inq.id]: e.target.value }))}
                              placeholder="답변을 입력하세요"
                              rows={4}
                              style={{
                                width: "100%", borderRadius: 12, border: "1px solid #d1d5db",
                                padding: "12px 14px", fontSize: 14, outline: "none",
                                resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
                              }}
                            />
                            <button
                              type="button"
                              disabled={inqAnswering === inq.id}
                              onClick={() => handleAnswerInquiry(inq.id)}
                              style={{ ...btnStyle("outline", inqAnswering === inq.id), marginTop: 8, background: "#111827", color: "white", border: "none" }}
                            >
                              {inqAnswering === inq.id ? "저장 중..." : "답변 추가"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              출력소 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "printShops" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>출력소 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>전체 {printShops.length}개</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={fetchPrintShops} style={btnStyle("outline")}>새로고침</button>
                  <button type="button" onClick={() => { setPsEditId(null); setPsForm({ name: "", address: "", phone: "", hours: "", description: "", naver_map_url: "", is_active: true }); setPsShowForm(true); }} style={{ ...btnStyle("outline"), background: "#111827", color: "white", border: "none" }}>+ 추가</button>
                </div>
              </div>

              {/* 추가/수정 폼 */}
              {psShowForm && (
                <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#111827" }}>{psEditId ? "출력소 수정" : "출력소 추가"}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {[
                      { label: "출력소명 *", key: "name", placeholder: "예: 가인출력소" },
                      { label: "연락처 *", key: "phone", placeholder: "예: 070-0000-0000" },
                    ].map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>{label}</label>
                        <input value={(psForm as any)[key]} onChange={e => setPsForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                          style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                      </div>
                    ))}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>주소 *</label>
                      <input value={psForm.address} onChange={e => setPsForm(p => ({ ...p, address: e.target.value }))} placeholder="예: 서울 종로구 돈화문로6나길 36"
                        style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>영업시간</label>
                      <input value={psForm.hours} onChange={e => setPsForm(p => ({ ...p, hours: e.target.value }))} placeholder="예: 월~금 10:00-19:00 / 일 휴무"
                        style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>네이버 지도 URL</label>
                      <input value={psForm.naver_map_url} onChange={e => setPsForm(p => ({ ...p, naver_map_url: e.target.value }))} placeholder="https://map.naver.com/..."
                        style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>설명 (선택)</label>
                      <textarea value={psForm.description} onChange={e => setPsForm(p => ({ ...p, description: e.target.value }))} placeholder="출력소 설명"
                        rows={2} style={{ width: "100%", borderRadius: 10, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" id="ps-active" checked={psForm.is_active} onChange={e => setPsForm(p => ({ ...p, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <label htmlFor="ps-active" style={{ fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer" }}>활성화</label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button type="button" disabled={psSaving} onClick={handleSavePrintShop}
                      style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: psSaving ? "default" : "pointer" }}>
                      {psSaving ? "저장 중..." : psEditId ? "수정" : "추가"}
                    </button>
                    <button type="button" onClick={() => { setPsShowForm(false); setPsEditId(null); }}
                      style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      취소
                    </button>
                  </div>
                </div>
              )}

              {printShopsLoading ? <LoadingSpinner /> : printShops.length === 0 ? (
                <Empty text="등록된 출력소가 없습니다." />
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {printShops.map(ps => (
                    <div key={ps.id} style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{ps.name}</span>
                          <span style={badgeStyle(ps.is_active ? "#16a34a" : "#6b7280", ps.is_active ? "#dcfce7" : "#f3f4f6")}>
                            {ps.is_active ? "활성" : "비활성"}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>📍 {ps.address}</div>
                        <div style={{ fontSize: 13, color: "#374151", marginBottom: 2 }}>📞 {ps.phone}</div>
                        {ps.hours && <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 2 }}>🕐 {ps.hours}</div>}
                        {ps.naver_map_url && (
                          <a href={ps.naver_map_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: "#2563eb", textDecoration: "underline" }}>
                            네이버 지도 보기
                          </a>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button type="button" onClick={() => startEditPrintShop(ps)} style={miniBtn("#374151")}>수정</button>
                        <button type="button" onClick={() => handleDeletePrintShop(ps.id)} style={miniBtn("#dc2626")}>삭제</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* ══════════════════════════════════════════════
              마무리 작업자 관리
          ══════════════════════════════════════════════ */}
          {activeTab === "finishingWorkers" && (
            <section>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>마무리 작업자 관리</h2>
                  <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>전체 {finishingWorkers.length}명</p>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={fetchFinishingWorkers} style={btnStyle("outline")}>새로고침</button>
                  <button type="button" onClick={() => { setFwEditId(null); setFwForm({ name: "", email: "", phone: "", location: "", work_scope: [], description: "", is_active: true }); setFwShowForm(true); }} style={{ ...btnStyle("outline"), background: "#111827", color: "white", border: "none" }}>+ 추가</button>
                </div>
              </div>

              {/* 추가/수정 폼 */}
              {fwShowForm && (
                <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px 24px", marginBottom: 20 }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 800, color: "#111827" }}>{fwEditId ? "작업자 수정" : "작업자 추가"}</h3>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    {([
                      { label: "이름 *",   key: "name",     placeholder: "홍길동" },
                      { label: "연락처 *", key: "phone",    placeholder: "010-0000-0000" },
                      { label: "이메일 *", key: "email",    placeholder: "example@email.com" },
                      { label: "위치",     key: "location", placeholder: "서울 종로구" },
                    ] as const).map(({ label, key, placeholder }) => (
                      <div key={key}>
                        <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>{label}</label>
                        <input value={fwForm[key]} onChange={e => setFwForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
                          style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                      </div>
                    ))}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 8 }}>작업 범위</label>
                      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                        {WORK_SCOPE_OPTIONS.map(scope => (
                          <label key={scope} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                            <input type="checkbox" checked={fwForm.work_scope.includes(scope)} onChange={() => toggleFwScope(scope)}
                              style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#111827" }} />
                            <span style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>{scope}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", display: "block", marginBottom: 4 }}>설명 (선택)</label>
                      <textarea value={fwForm.description} onChange={e => setFwForm(p => ({ ...p, description: e.target.value }))} placeholder="작업자 소개 또는 메모"
                        rows={2} style={{ width: "100%", borderRadius: 10, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 14, boxSizing: "border-box", outline: "none", resize: "vertical", fontFamily: "inherit" }} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input type="checkbox" id="fw-active" checked={fwForm.is_active} onChange={e => setFwForm(p => ({ ...p, is_active: e.target.checked }))} style={{ width: 16, height: 16, cursor: "pointer" }} />
                      <label htmlFor="fw-active" style={{ fontSize: 14, fontWeight: 600, color: "#374151", cursor: "pointer" }}>활성화</label>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button type="button" disabled={fwSaving} onClick={handleSaveFinishingWorker}
                      style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: fwSaving ? "default" : "pointer" }}>
                      {fwSaving ? "저장 중..." : fwEditId ? "수정" : "추가"}
                    </button>
                    <button type="button" onClick={() => { setFwShowForm(false); setFwEditId(null); }}
                      style={{ height: 40, padding: "0 20px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                      취소
                    </button>
                  </div>
                </div>
              )}

              {fwLoading ? <LoadingSpinner /> : finishingWorkers.length === 0 ? (
                <Empty text="등록된 마무리 작업자가 없습니다." />
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: "#f3f4f6", textAlign: "left" }}>
                        {["이름", "이메일", "연락처", "위치", "작업 범위", "상태", "관리"].map(h => (
                          <th key={h} style={{ padding: "10px 12px", fontWeight: 700, color: "#374151", whiteSpace: "nowrap", borderBottom: "1px solid #e5e7eb" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {finishingWorkers.map(w => (
                        <tr key={w.id} className="adm-row" style={{ borderBottom: "1px solid #f3f4f6" }}>
                          <td style={{ padding: "10px 12px", fontWeight: 700, color: "#111827", whiteSpace: "nowrap" }}>{w.name}</td>
                          <td style={{ padding: "10px 12px", color: "#374151" }}>{w.email}</td>
                          <td style={{ padding: "10px 12px", color: "#374151", whiteSpace: "nowrap" }}>{w.phone}</td>
                          <td style={{ padding: "10px 12px", color: "#6b7280" }}>{w.location || "—"}</td>
                          <td style={{ padding: "10px 12px" }}>
                            {(w.work_scope || []).length === 0 ? (
                              <span style={{ color: "#9ca3af" }}>—</span>
                            ) : (
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                                {(w.work_scope || []).map(s => (
                                  <span key={s} style={badgeStyle("#374151", "#f3f4f6")}>{s}</span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <span style={badgeStyle(w.is_active ? "#16a34a" : "#6b7280", w.is_active ? "#dcfce7" : "#f3f4f6")}>
                              {w.is_active ? "활성" : "비활성"}
                            </span>
                          </td>
                          <td style={{ padding: "10px 12px" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" onClick={() => startEditFinishingWorker(w)} style={miniBtn("#374151")}>수정</button>
                              <button type="button" onClick={() => handleDeleteFinishingWorker(w.id)} style={miniBtn("#dc2626")}>삭제</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ──────────────────────────────────────── */
function LoadingSpinner() {
  return (
    <div style={{ padding: "48px 0", textAlign: "center", color: "#9ca3af" }}>
      불러오는 중...
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <p style={{ textAlign: "center", color: "#9ca3af", padding: "48px 0", fontSize: 15 }}>{text}</p>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: "white", borderRadius: 16, padding: "20px", border: "1px solid #e5e7eb",
      borderTop: `3px solid ${color}`,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#9ca3af", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{value}</div>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: "white", borderRadius: 16, padding: "20px", border: "1px solid #e5e7eb",
};

const cardTitle: React.CSSProperties = {
  margin: "0 0 14px", fontSize: 15, fontWeight: 800, color: "#111827",
};

/* ── Style helpers ───────────────────────────────────────── */
function badgeStyle(color: string, bg: string): React.CSSProperties {
  return {
    display: "inline-flex", alignItems: "center", height: 20,
    padding: "0 7px", borderRadius: 999, fontSize: 11, fontWeight: 700,
    color, background: bg, marginLeft: 4,
  };
}

function miniBtn(color: string): React.CSSProperties {
  return {
    height: 28, padding: "0 10px", borderRadius: 8,
    border: `1px solid ${color}`, background: "white",
    color, fontWeight: 700, fontSize: 11, cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

function btnStyle(variant: "outline" | "warn" | "danger", disabled?: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    height: 38, padding: "0 16px", borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer",
    fontWeight: 700, fontSize: 13, opacity: disabled ? 0.5 : 1,
  };
  if (variant === "outline") return { ...base, border: "1px solid #d1d5db", background: "white", color: "#374151" };
  if (variant === "warn")    return { ...base, border: "none", background: "#f59e0b", color: "white" };
  if (variant === "danger")  return { ...base, border: "none", background: "#ef4444", color: "white" };
  return base;
}
