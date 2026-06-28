"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";
import { loadTossPayments } from "@tosspayments/tosspayments-sdk";
import { ImagePlus } from "lucide-react";
import { getModelThumbnailUrl } from "@/lib/imageUrl";
import Image from "next/image";
import GradeBadge from "../../components/GradeBadge";
import { Grade } from "@/lib/grades";
import { GOLD } from "@/lib/constants";


const PRIVATE_STEPS = ["pending", "negotiating", "payment", "working", "completed", "downloaded"];
const PRIVATE_STEP_LABELS: Record<string, string> = {
  pending: "의뢰중", negotiating: "협의중", payment: "결제중",
  working: "작업중", completed: "작업완료", downloaded: "다운완료",
};
const PRIVATE_STATUS_LABEL: Record<string, string> = {
  ...PRIVATE_STEP_LABELS, rejected: "거절됨", cancelled: "취소됨",
};
const PRIVATE_STATUS_COLOR: Record<string, string> = {
  pending: "#2563eb", negotiating: "#7c3aed", payment: "#d97706",
  working: "#ea580c", completed: "#16a34a", downloaded: "#16a34a",
  rejected: "#dc2626", cancelled: "#6b7280",
};
const PRIVATE_STATUS_BG: Record<string, string> = {
  pending: "#dbeafe", negotiating: "#ede9fe", payment: "#fef3c7",
  working: "#fff7ed", completed: "#dcfce7", downloaded: "#dcfce7",
  rejected: "#fef2f2", cancelled: "#f3f4f6",
};

const PUBLIC_STATUS_LABEL: Record<string, string> = {
  open: "의뢰중", in_progress: "작업중", completed: "완료",
};
const PUBLIC_STATUS_COLOR: Record<string, string> = {
  open: "#2563eb", in_progress: "#d97706", completed: "#16a34a",
};
const PUBLIC_STATUS_BG: Record<string, string> = {
  open: "#dbeafe", in_progress: "#fef3c7", completed: "#dcfce7",
};

const REJECT_REASONS = [
  "작업 가능 기간이 맞지 않음",
  "요청 작업 범위가 맞지 않음",
  "현재 작업량이 많아 수락 불가",
  "기타",
];
const CANCEL_REASONS = [
  "가격이 맞지 않음",
  "작업 기간이 맞지 않음",
  "다른 판매자에게 의뢰 예정",
  "단순 변심",
  "기타",
];

const DISPUTE_REASONS = ["기간초과", "결과물불량", "수정요청미응답", "기타"];

type Commission = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  images: string[];
  status: string;
  result_link: string | null;
  created_at: string;
  nickname: string;
  is_private: boolean;
  target_seller_id: string | null;
  desired_price: number | null;
  desired_days: number | null;
  negotiation_count: number;
  final_price: number | null;
  final_days: number | null;
  revision_count: number;
  rejection_reason: string | null;
  cancellation_reason: string | null;
  cancel_reason: string | null;
  updated_at: string;
  commission_type: string | null;
  bid_status: string | null;
};

type CommissionRevision = {
  id: string;
  commission_id: string;
  type: "problem" | "additional";
  status: "pending" | "accepted" | "rejected" | "negotiating";
  negotiation_round: number;
  requester_message: string;
  images: string[] | null;
  seller_price: number | null;
  seller_days: number | null;
  seller_message: string | null;
  seller_rejection_reason: string | null;
  requester_neg_price: number | null;
  requester_neg_days: number | null;
  requester_neg_message: string | null;
  created_at: string;
  updated_at: string;
};

type CommissionBid = {
  id: string;
  commission_id: string;
  seller_id: string;
  price: number;
  work_days: number;
  message: string | null;
  created_at: string;
};

type BidWithProfile = CommissionBid & {
  nickname: string;
  grade: string | null;
};

type Comment = {
  id: string;
  commission_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: { nickname: string | null } | { nickname: string | null }[] | null;
};

type Negotiation = {
  id: string;
  commission_id: string;
  proposer_id: string;
  price: number;
  days: number;
  message: string;
  round: number;
  created_at: string;
};

type CommissionResult = {
  id: string;
  commission_id: string;
  seller_id: string;
  result_link: string;
  nickname: string;
  grade?: string | null;
};

async function sendNotification(userId: string, type: string, title: string, link: string) {
  if (!userId) return;
  try {
    const res = await fetch("/api/commission/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId, type, title, link }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(`[notify] API 실패 (${res.status}):`, body);
      return;
    }
    window.dispatchEvent(new Event("notifications-updated"));
  } catch (e) {
    console.error("[notify] 네트워크 오류:", e);
  }
}

export default function CommissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);

  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [negLoading, setNegLoading] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePrice, setProposePrice] = useState("");
  const [proposeDays, setProposeDays] = useState("");
  const [proposeMsg, setProposeMsg] = useState("");
  const [negSubmitting, setNegSubmitting] = useState(false);

  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [rejectReasonIdx, setRejectReasonIdx] = useState(-1);
  const [rejectReasonOther, setRejectReasonOther] = useState("");
  const [cancelReasonIdx, setCancelReasonIdx] = useState(-1);
  const [cancelReasonOther, setCancelReasonOther] = useState("");

  const fileUploadRef = useRef<HTMLInputElement>(null);

  const [results, setResults] = useState<CommissionResult[]>([]);
  const [myResult, setMyResult] = useState<CommissionResult | null>(null);
  const [resultLink, setResultLink] = useState("");
  const [resultSaving, setResultSaving] = useState(false);
  const [resultEditing, setResultEditing] = useState(false);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [myModels, setMyModels] = useState<{ id: string; title: string; thumbnail: string | null; thumbnail_path: string | null }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  const [showPaymentWidget, setShowPaymentWidget] = useState(false);
  const [widgetLoading, setWidgetLoading] = useState(false);
  const widgetsRef = useRef<any>(null);

  type ChatMsg = { id: string; sender_id: string; message: string | null; image_url: string | null; created_at: string };
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatNicknames, setChatNicknames] = useState<Record<string, string>>({});
  const [chatDragOver, setChatDragOver] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const chatImageRef = useRef<HTMLInputElement>(null);

  const [sellerNickname, setSellerNickname] = useState<string | null>(null);
  const [sellerGrade, setSellerGrade] = useState<string | null>(null);
  const [sellerPhone, setSellerPhone] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [myNickname, setMyNickname] = useState<string | null>(null);

  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [disputeReasonIdx, setDisputeReasonIdx] = useState(-1);
  const [disputeDetail, setDisputeDetail] = useState("");
  const [disputeSubmitting, setDisputeSubmitting] = useState(false);
  const [disputes, setDisputes] = useState<any[]>([]);
  const [disputeRefunding, setDisputeRefunding] = useState<string | null>(null);
  const [disputeRefundRatio, setDisputeRefundRatio] = useState<Record<string, number>>({});
  const [disputeWarning, setDisputeWarning] = useState<string | null>(null);

  const [myBid, setMyBid] = useState<CommissionBid | null>(null);
  const [bidPrice, setBidPrice] = useState("");
  const [bidDays, setBidDays] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [bidSubmitting, setBidSubmitting] = useState(false);

  const [allBids, setAllBids] = useState<BidWithProfile[]>([]);
  const [bidsLoading, setBidsLoading] = useState(false);
  const [selectingBid, setSelectingBid] = useState<string | null>(null);

  // ── 수정요청 ──
  const [activeRevision, setActiveRevision] = useState<CommissionRevision | null>(null);
  const [revisionType, setRevisionType] = useState<"problem" | "additional" | null>(null);
  const [revisionMessage, setRevisionMessage] = useState("");
  const [revisionImages, setRevisionImages] = useState<string[]>([]);
  const [revisionImageUploading, setRevisionImageUploading] = useState(false);
  const revisionImageRef = useRef<HTMLInputElement>(null);
  const [revisionDragOver, setRevisionDragOver] = useState(false);
  const [revisionSubmitting, setRevisionSubmitting] = useState(false);
  const [sellerRevResponse, setSellerRevResponse] = useState("");
  const [sellerRevPrice, setSellerRevPrice] = useState("");
  const [sellerRevDays, setSellerRevDays] = useState("");
  const [sellerRevRejectReason, setSellerRevRejectReason] = useState("");
  const [showSellerRejectForm, setShowSellerRejectForm] = useState(false);
  const [buyerNegPrice, setBuyerNegPrice] = useState("");
  const [buyerNegDays, setBuyerNegDays] = useState("");
  const [buyerNegMessage, setBuyerNegMessage] = useState("");
  const [showBuyerNegForm, setShowBuyerNegForm] = useState(false);
  const [sellerReNegPrice, setSellerReNegPrice] = useState("");
  const [sellerReNegDays, setSellerReNegDays] = useState("");
  const [sellerReNegMessage, setSellerReNegMessage] = useState("");
  const [showSellerReNegForm, setShowSellerReNegForm] = useState(false);

  const [showUploadWarning, setShowUploadWarning] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as any;
      const uid = payload?.sub as string;
      setMyId(uid);
      supabase.from("profiles").select("role, nickname").eq("id", uid).single()
        .then(({ data }) => {
          setIsSeller(data?.role === "seller");
          setIsAdmin(data?.role === "admin");
          setMyNickname(data?.nickname || null);
        });
    }
    fetchCommission();
    fetchComments();
    fetchResults();
  }, [id]);

  // 채팅창 밖 파일 드롭 시 브라우저 새 탭 열림 방지
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    document.addEventListener("dragover", prevent);
    document.addEventListener("drop", prevent);
    return () => {
      document.removeEventListener("dragover", prevent);
      document.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    if (!myId) return;
    setMyResult(results.find((r) => r.seller_id === myId) || null);
  }, [results, myId]);

  useEffect(() => {
    if (!myId || !commission || myId === commission.user_id) return;
    if (commission.commission_type === "공개모집" && commission.bid_status === "모집중") {
      fetchMyBid(myId);
    }
  }, [myId, commission]);

  useEffect(() => {
    if (!myId || !commission) return;
    if (
      commission.is_private &&
      commission.commission_type === "공개모집" &&
      commission.bid_status === "모집중" &&
      myId === commission.user_id
    ) {
      fetchAllBids();
    }
  }, [myId, commission]);

  const fetchCommission = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commissions")
        .select("id, user_id, title, description, images, status, result_link, created_at, updated_at, is_private, target_seller_id, desired_price, desired_days, negotiation_count, final_price, final_days, revision_count, rejection_reason, cancellation_reason, cancel_reason, commission_type, bid_status")
        .eq("id", id)
        .single();

      if (error || !data) {
        // RLS may be blocking — try admin API if user is admin
        const token = getAccessToken();
        if (token) {
          const uid = (decodeJwt(token) as any)?.sub as string;
          if (uid) {
            const { data: pData } = await supabase.from("profiles").select("role").eq("id", uid).single();
            if (pData?.role === "admin") {
              setIsAdmin(true);
              const res = await fetch(`/api/commission/admin?id=${id}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              if (res.ok) {
                const { data: adminData } = await res.json();
                if (adminData) {
                  setCommission({ ...adminData, nickname: adminData.nickname || "익명" });
                  if (adminData.is_private && adminData.target_seller_id) {
                    setSellerNickname(adminData.seller_nickname || "알 수 없음");
                    setSellerGrade(adminData.seller_grade || null);
                    setSellerPhone(adminData.seller_phone || null);
                  }
                  if (adminData.is_private) { fetchNegotiations(); fetchActiveRevision(); }
                  return;
                }
              }
            }
          }
        }
        console.error("fetchCommission error:", error);
        return;
      }

      const { data: profile } = await supabase.from("profiles").select("nickname").eq("id", data.user_id).single();
      setCommission({ ...data, nickname: profile?.nickname || "익명" });
      if (data.is_private && data.target_seller_id) {
        const { data: sp } = await supabase
          .from("profiles")
          .select("nickname, grade, phone_number")
          .eq("id", data.target_seller_id)
          .single();
        setSellerNickname(sp?.nickname || "알 수 없음");
        setSellerGrade((sp as any)?.grade || null);
        setSellerPhone((sp as any)?.phone_number || null);
      }
      if (data.is_private) fetchNegotiations();
      if (data.is_private) fetchActiveRevision();
    } finally {
      setLoading(false);
    }
  };

  const fetchResults = async () => {
    const { data } = await supabase.from("commission_results").select("id, commission_id, seller_id, result_link").eq("commission_id", id);
    const rows = data || [];
    if (!rows.length) { setResults([]); return; }
    const { data: profilesData } = await supabase.from("profiles").select("id, nickname, grade").in("id", rows.map((r: any) => r.seller_id));
    const pm = Object.fromEntries((profilesData || []).map((p: any) => [p.id, p]));
    setResults(rows.map((r: any) => ({ ...r, nickname: pm[r.seller_id]?.nickname || "판매자", grade: pm[r.seller_id]?.grade || null })));
  };

  const fetchMyModels = async () => {
    if (!myId || myModels.length > 0) return;
    setModelsLoading(true);
    try {
      const { data } = await supabase
        .from("models")
        .select("id, title, thumbnail, thumbnail_path")
        .eq("seller_id", myId)
        .order("created_at", { ascending: false });
      setMyModels(data || []);
    } finally {
      setModelsLoading(false);
    }
  };

  const getModelThumbnail = getModelThumbnailUrl;

  const handleModelSelect = (modelId: string) => {
    setResultLink(`${window.location.origin}/models/${modelId}`);
    setShowModelPicker(false);
  };

  const handleResultInsert = async () => {
    if (!resultLink.trim() || !myId) return;
    setResultSaving(true);
    try {
      const { data, error } = await supabase.from("commission_results")
        .insert({ commission_id: id, seller_id: myId, result_link: resultLink.trim() })
        .select("id, commission_id, seller_id, result_link").single();
      if (error) throw error;
      const { data: profile } = await supabase.from("profiles").select("nickname, grade").eq("id", myId).single();
      setResults((prev) => [...prev, { id: data.id, commission_id: data.commission_id, seller_id: data.seller_id, result_link: data.result_link, nickname: profile?.nickname || "판매자", grade: (profile as any)?.grade || null }]);
      setLinkPanelOpen(false);
      if (commission?.user_id && commission.user_id !== myId)
        await sendNotification(commission.user_id, "result_link", `📦 ${commission.title} - 결과물이 등록되었습니다`, `/commission/${id}`);
      showSuccess("등록되었습니다.");
    } catch (e: any) { showError(e.message || "등록 실패"); }
    finally { setResultSaving(false); }
  };

  const handleResultUpdate = async () => {
    if (!resultLink.trim() || !myResult) return;
    setResultSaving(true);
    try {
      const { error } = await supabase.from("commission_results").update({ result_link: resultLink.trim() }).eq("id", myResult.id);
      if (error) throw error;
      setResults((prev) => prev.map((r) => r.id === myResult.id ? { ...r, result_link: resultLink.trim() } : r));
      setResultEditing(false);
      showSuccess("수정되었습니다.");
    } catch (e: any) { showError(e.message || "수정 실패"); }
    finally { setResultSaving(false); }
  };

  const handleResultDelete = async () => {
    if (!myResult || !confirm("결과물 링크를 삭제하시겠습니까?")) return;
    setResultSaving(true);
    try {
      const { error } = await supabase.from("commission_results").delete().eq("id", myResult.id);
      if (error) throw error;
      setResults((prev) => prev.filter((r) => r.id !== myResult.id));
      setResultLink(""); setResultEditing(false);
      showSuccess("삭제되었습니다.");
    } catch (e: any) { showError(e.message || "삭제 실패"); }
    finally { setResultSaving(false); }
  };

  const fetchMyBid = async (uid: string) => {
    const { data } = await supabase
      .from("commission_bids")
      .select("*")
      .eq("commission_id", id)
      .eq("seller_id", uid)
      .maybeSingle();
    setMyBid(data || null);
  };

  const fetchAllBids = async () => {
    setBidsLoading(true);
    try {
      const { data: bids, error } = await supabase
        .from("commission_bids")
        .select("*")
        .eq("commission_id", id)
        .order("created_at", { ascending: true });
      if (error || !bids || bids.length === 0) { setAllBids([]); return; }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, grade")
        .in("id", bids.map((b: any) => b.seller_id));
      const pm = Object.fromEntries((profiles || []).map((p: any) => [p.id, p]));
      setAllBids(bids.map((b: any) => ({
        ...b,
        nickname: pm[b.seller_id]?.nickname || "판매자",
        grade: pm[b.seller_id]?.grade || null,
      })));
    } finally {
      setBidsLoading(false);
    }
  };

  const handleSelectBid = async (bid: BidWithProfile) => {
    if (!commission || !confirm(`${bid.nickname} 님의 견적을 선택하시겠습니까?`)) return;
    setSelectingBid(bid.id);
    try {
      const { error } = await supabase.from("commissions").update({
        target_seller_id: bid.seller_id,
        bid_status: "선택완료",
        desired_price: bid.price,
        desired_days: bid.work_days,
        status: "pending",
      }).eq("id", id);
      if (error) throw error;
      await sendNotification(
        bid.seller_id,
        "private_commission",
        `📬 ${commission.title} - ${commission.nickname}님이 개인 의뢰를 요청했습니다`,
        `/commission/${id}`
      );
      showSuccess(`${bid.nickname} 님을 선택했습니다.`);
      await fetchCommission();
    } catch (e: any) {
      showError(e.message || "처리 실패");
    } finally {
      setSelectingBid(null);
    }
  };

  const handleBidSubmit = async () => {
    if (!myId || !commission) return;
    const price = parseInt(bidPrice);
    const work_days = parseInt(bidDays);
    if (!price || price <= 0) { showError("희망 가격을 입력해주세요."); return; }
    if (!work_days || work_days <= 0) { showError("희망 작업기간을 입력해주세요."); return; }
    setBidSubmitting(true);
    try {
      const { data, error } = await supabase
        .from("commission_bids")
        .insert({ commission_id: id, seller_id: myId, price, work_days, message: bidMessage.trim() || null })
        .select()
        .single();
      if (error) throw error;
      setMyBid(data);
      setBidPrice(""); setBidDays(""); setBidMessage("");
      showSuccess("견적을 신청했습니다.");
    } catch (e: any) {
      showError(e.message || "견적 신청 실패");
    } finally {
      setBidSubmitting(false);
    }
  };

  const handleBidCancel = async () => {
    if (!myBid || !confirm("견적 신청을 취소하시겠습니까?")) return;
    setBidSubmitting(true);
    try {
      const { error } = await supabase.from("commission_bids").delete().eq("id", myBid.id);
      if (error) throw error;
      setMyBid(null);
      showSuccess("견적 신청이 취소되었습니다.");
    } catch (e: any) {
      showError(e.message || "취소 실패");
    } finally {
      setBidSubmitting(false);
    }
  };

  const fetchNegotiations = async () => {
    setNegLoading(true);
    const { data } = await supabase.from("commission_negotiations").select("*").eq("commission_id", id).order("round", { ascending: true });
    setNegotiations((data as Negotiation[]) || []);
    setNegLoading(false);
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const { data } = await supabase.from("commission_comments")
        .select("id, commission_id, user_id, content, created_at, profiles(nickname)")
        .eq("commission_id", id).order("created_at", { ascending: false });
      setComments((data as Comment[]) || []);
    } finally { setCommentsLoading(false); }
  };

  const handleDelete = async () => {
    if (!commission || !confirm("의뢰를 삭제하면 복구할 수 없습니다. 정말 삭제하시겠습니까?")) return;
    setDeleting(true);
    try {
      const token = getAccessToken();
      const res = await fetch(`/api/commission/delete?id=${commission.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        console.error("commission delete error:", body);
        showError(body.error || "삭제 실패");
        setDeleting(false);
        return;
      }
      router.push("/commission");
    } catch (e) {
      console.error("commission delete exception:", e);
      showError("삭제 실패");
      setDeleting(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !myId) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase.from("commission_comments").insert({ commission_id: id, user_id: myId, content: commentText.trim() });
      if (error) throw error;
      setCommentText("");
      await fetchComments();
      if (commission?.user_id && commission.user_id !== myId)
        await sendNotification(commission.user_id, "comment", `💬 ${commission.title} - ${myNickname || "익명"}님이 댓글을 남겼습니다`, `/commission/${id}`);
    } catch (e: any) { showError(e.message || "댓글 등록 실패"); }
    finally { setSubmittingComment(false); }
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from("commission_comments").delete().eq("id", commentId);
    if (!error) setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  // ─── 개인의뢰 액션 ───

  const handleSellerAccept = async () => {
    if (!commission) return;
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({
        status: "negotiating",
        final_price: commission.desired_price,
        final_days: commission.desired_days,
      }).eq("id", id);
      await sendNotification(commission.user_id, "negotiation", `💬 ${commission.title} - ${myNickname || "판매자"}님이 협의를 시작했습니다`, `/commission/${id}`);
      await fetchCommission();
      showSuccess("수락되었습니다.");
    } catch { showError("처리 실패"); }
    setNegSubmitting(false);
  };

  const handlePropose = async () => {
    if (!commission || !myId) return;
    const price = parseInt(proposePrice);
    const days = parseInt(proposeDays);
    if (!price || !days) { showError("비용과 기간을 입력해주세요."); return; }
    setNegSubmitting(true);
    try {
      const newCount = commission.negotiation_count + 1;
      await supabase.from("commission_negotiations").insert({
        commission_id: id, proposer_id: myId, price, days,
        message: proposeMsg.trim(), round: negotiations.length + 1,
      });
      await supabase.from("commissions").update({
        status: "negotiating", negotiation_count: newCount,
        final_price: price, final_days: days,
      }).eq("id", id);
      const isRequester = myId === commission.user_id;
      const targetId = isRequester ? commission.target_seller_id! : commission.user_id;
      await sendNotification(targetId, "negotiation", `💬 ${commission.title} - ${myNickname || "사용자"}님이 협의를 시작했습니다`, `/commission/${id}`);
      setProposeOpen(false); setProposePrice(""); setProposeDays(""); setProposeMsg("");
      await fetchCommission(); await fetchNegotiations();
    } catch { showError("제안 전송 실패"); }
    setNegSubmitting(false);
  };

  const handleNegotiationComplete = async () => {
    if (!commission) return;
    const lastNeg = negotiations.length > 0 ? negotiations[negotiations.length - 1] : null;
    const finalP = lastNeg ? lastNeg.price : commission.final_price;
    const finalD = lastNeg ? lastNeg.days : commission.final_days;
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({
        status: "payment", final_price: finalP, final_days: finalD,
      }).eq("id", id);
      await Promise.all([
        sendNotification(commission.user_id, "negotiation", `✅ ${commission.title} - 협의가 완료되었습니다`, `/commission/${id}`),
        sendNotification(commission.target_seller_id!, "negotiation", `✅ ${commission.title} - 협의가 완료되었습니다`, `/commission/${id}`),
      ]);
      await fetchCommission();
      showSuccess("협의완료 처리되었습니다.");
    } catch { showError("처리 실패"); }
    setNegSubmitting(false);
  };

  // 결제위젯 초기화 (showPaymentWidget이 true가 된 직후 DOM이 마운트된 뒤 실행)
  useEffect(() => {
    if (!showPaymentWidget || !commission?.final_price || !myId) return;
    let cancelled = false;
    const initWidgets = async () => {
      setWidgetLoading(true);
      try {
        const tossPayments = await loadTossPayments(process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY!);
        const widgets = tossPayments.widgets({ customerKey: myId });
        await widgets.setAmount({ currency: "KRW", value: commission.final_price! });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#toss-payment-method", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#toss-agreement", variantKey: "AGREEMENT" }),
        ]);
        if (!cancelled) widgetsRef.current = widgets;
      } catch (e: any) {
        if (!cancelled) showError(e?.message || "결제 위젯 초기화 실패");
      } finally {
        if (!cancelled) setWidgetLoading(false);
      }
    };
    initWidgets();
    return () => { cancelled = true; };
  }, [showPaymentWidget]);

  // ── 채팅 ──────────────────────────────────────────────────
  const addNicknames = async (senderIds: string[]) => {
    const newIds = senderIds.filter((sid) => !chatNicknames[sid]);
    if (!newIds.length) return;
    const { data } = await supabase.from("profiles").select("id, nickname").in("id", newIds);
    if (data) setChatNicknames((prev) => {
      const next = { ...prev };
      data.forEach((p: any) => { next[p.id] = p.nickname || "알 수 없음"; });
      return next;
    });
  };

  const fetchChats = async () => {
    setChatLoading(true);
    const { data } = await supabase
      .from("commission_chats")
      .select("id, sender_id, message, image_url, created_at")
      .eq("commission_id", id)
      .order("created_at", { ascending: true });
    const msgs = (data as ChatMsg[]) || [];
    setChatMessages(msgs);
    await addNicknames([...new Set(msgs.map((m) => m.sender_id))]);
    setChatLoading(false);
  };

  // Realtime 구독 + 초기 로드
  useEffect(() => {
    if (!myId || !commission?.is_private) return;
    const isParticipant = myId === commission.user_id || myId === commission.target_seller_id;
    if (!isParticipant) return;

    fetchChats();

    const channel = supabase
      .channel(`chat-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "commission_chats", filter: `commission_id=eq.${id}` },
        async (payload) => {
          const msg = payload.new as ChatMsg;
          setChatMessages((prev) => {
            if (prev.find((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          await addNicknames([msg.sender_id]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [myId, commission?.is_private, commission?.user_id, commission?.target_seller_id]);

  // 새 메시지 수신 시 자동 스크롤 (컨테이너 직접 제어 — scrollIntoView는 페이지까지 스크롤됨)
  useEffect(() => {
    const el = chatContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  useEffect(() => {
    if (!myId || !commission) return;
    if (isAdmin || myId === commission.user_id) fetchDisputes();
  }, [myId, commission?.id, isAdmin]);

  const handleSendChat = async () => {
    const msg = chatInput.trim();
    if (!msg || !myId || chatSending) return;
    setChatInput("");
    setChatSending(true);
    try {
      await supabase.from("commission_chats").insert({ commission_id: id, sender_id: myId, message: msg, image_url: null });
    } catch {
      showError("전송 실패");
      setChatInput(msg);
    } finally {
      setChatSending(false);
    }
  };

  const uploadChatImage = async (file: File) => {
    if (!myId) return;
    setChatSending(true);
    try {
      const path = `commission-chats/${id}/${Date.now()}-${file.name}`;
      const form = new FormData();
      form.append("file", file); form.append("bucket", "thumbnails"); form.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("업로드 실패");
      const { url } = await res.json();
      await supabase.from("commission_chats").insert({ commission_id: id, sender_id: myId, message: null, image_url: url });
    } catch { showError("이미지 전송 실패"); }
    finally { setChatSending(false); }
  };

  const handleChatImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadChatImage(file);
    e.target.value = "";
  };

  const handleChatDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setChatDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) { showError("이미지 파일만 첨부 가능합니다."); return; }
    await uploadChatImage(file);
  };

  const handlePaymentRequest = async () => {
    if (!widgetsRef.current || !commission) return;
    setNegSubmitting(true);
    try {
      const orderId = `commission-${commission.id}-${Date.now()}`;
      await widgetsRef.current.requestPayment({
        orderId,
        orderName: `개인의뢰: ${commission.title}`,
        successUrl: `${window.location.origin}/commission/${id}/payment/success`,
        failUrl: `${window.location.origin}/commission/${id}/payment/fail`,
      });
    } catch (e: any) {
      if (e?.code !== "USER_CANCEL") showError(e?.message || "결제 요청 실패");
    } finally {
      setNegSubmitting(false);
    }
  };

  const ALLOWED_EXTENSIONS = [".stl", ".3dm", ".obj"];

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !commission) return;
    const ext = "." + (file.name.split(".").pop()?.toLowerCase() ?? "");
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      showError("STL, 3DM, OBJ 파일만 업로드 가능합니다.");
      e.target.value = "";
      return;
    }
    setNegSubmitting(true);
    try {
      const path = `commission-files/${commission.id}/${file.name}`;
      const form = new FormData();
      form.append("file", file); form.append("bucket", "thumbnails"); form.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("파일 업로드 실패");
      const { url } = await res.json();
      await supabase.from("commissions").update({ status: "completed", result_link: url }).eq("id", id);
      await sendNotification(commission.user_id, "file_upload", `📦 ${commission.title} - 결과물이 등록되었습니다`, `/commission/${id}`);
      await fetchCommission();
      showSuccess("결과물이 업로드되었습니다.");
    } catch { showError("파일 업로드 실패"); }
    setNegSubmitting(false);
    e.target.value = "";
  };

  const handleDownload = async () => {
    if (!commission?.result_link) return;
    window.open(commission.result_link, "_blank");
    if (commission.status !== "downloaded") {
      await supabase.from("commissions").update({ status: "downloaded" }).eq("id", id);
      if (commission.target_seller_id)
        await sendNotification(commission.target_seller_id, "negotiation", "다운로드 완료", `/commission/${id}`);
      await fetchCommission();
    }
  };

  const fetchActiveRevision = async () => {
    const { data } = await supabase
      .from("commission_revisions")
      .select("*")
      .eq("commission_id", id)
      .in("status", ["pending", "negotiating"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setActiveRevision(data || null);
  };

  const uploadRevisionImage = async (file: File): Promise<string | null> => {
    const form = new FormData();
    form.append("file", file);
    form.append("bucket", "thumbnails");
    form.append("path", `revision-images/${id}/${Date.now()}-${file.name}`);
    const res = await fetch("/api/upload", { method: "POST", body: form });
    if (!res.ok) return null;
    const { url } = await res.json();
    return url;
  };

  const handleRevisionImageDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setRevisionDragOver(false);
    const dropped = Array.from(e.dataTransfer.files);
    const files = dropped.filter((f) => f.type.startsWith("image/"));
    if (dropped.length > 0 && files.length === 0) {
      showError("이미지 파일만 업로드 가능합니다.");
      return;
    }
    if (!files.length) return;
    setRevisionImageUploading(true);
    const urls: string[] = [];
    for (const file of files) { const url = await uploadRevisionImage(file); if (url) urls.push(url); }
    setRevisionImages((prev) => [...prev, ...urls]);
    setRevisionImageUploading(false);
  };

  const handleRevisionImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    if (!files.length) return;
    setRevisionImageUploading(true);
    const urls: string[] = [];
    for (const file of files) { const url = await uploadRevisionImage(file); if (url) urls.push(url); }
    setRevisionImages((prev) => [...prev, ...urls]);
    setRevisionImageUploading(false);
    e.target.value = "";
  };

  const submitRevision = async () => {
    if (!commission || !revisionType) return;
    if (!revisionMessage.trim()) { showError("상세 내용을 입력해주세요."); return; }
    setRevisionSubmitting(true);
    try {
      const { error } = await supabase.from("commission_revisions").insert({
        commission_id: id, type: revisionType, status: "pending",
        requester_message: revisionMessage.trim(), images: revisionImages,
      });
      if (error) throw error;
      if (commission.target_seller_id)
        await sendNotification(commission.target_seller_id, "revision",
          `[${revisionType === "problem" ? "문제수정" : "추가수정"}] ${commission.title} - 수정 요청이 접수되었습니다.`,
          `/commission/${id}`);
      setRevisionType(null); setRevisionMessage(""); setRevisionImages([]);
      await fetchActiveRevision();
      showSuccess("수정 요청이 전송되었습니다.");
    } catch { showError("수정 요청 전송 실패"); }
    setRevisionSubmitting(false);
  };

  const sellerAcceptProblemFix = async () => {
    if (!activeRevision || !commission) return;
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({ status: "accepted", seller_message: sellerRevResponse.trim() || null }).eq("id", activeRevision.id);
      await supabase.from("commissions").update({ status: "working" }).eq("id", id);
      await sendNotification(commission.user_id, "revision", `[문제수정] ${commission.title} - 판매자가 수정 요청을 수락했습니다.`, `/commission/${id}`);
      setSellerRevResponse("");
      await fetchCommission();
      showSuccess("수정 요청을 수락했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const sellerRejectRevision = async () => {
    if (!activeRevision || !commission) return;
    if (!sellerRevRejectReason.trim()) { showError("거절 사유를 입력해주세요."); return; }
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({ status: "rejected", seller_rejection_reason: sellerRevRejectReason.trim() }).eq("id", activeRevision.id);
      await sendNotification(commission.user_id, "revision",
        `[${activeRevision.type === "problem" ? "문제수정" : "추가수정"}] ${commission.title} - 판매자가 수정 요청을 거절했습니다.`,
        `/commission/${id}`);
      setSellerRevRejectReason(""); setShowSellerRejectForm(false);
      await fetchActiveRevision();
      showSuccess("수정 요청을 거절했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const sellerOfferAdditional = async () => {
    if (!activeRevision || !commission) return;
    if (!sellerRevPrice.trim() || !sellerRevDays.trim()) { showError("비용과 기간을 입력해주세요."); return; }
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({
        status: "negotiating", negotiation_round: 0,
        seller_price: Number(sellerRevPrice), seller_days: Number(sellerRevDays),
        seller_message: sellerRevResponse.trim() || null,
      }).eq("id", activeRevision.id);
      await sendNotification(commission.user_id, "revision", `[추가수정] ${commission.title} - 판매자가 추가수정 조건을 제안했습니다.`, `/commission/${id}`);
      setSellerRevPrice(""); setSellerRevDays(""); setSellerRevResponse("");
      await fetchActiveRevision();
      showSuccess("추가수정 조건을 전송했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const buyerAcceptOffer = async () => {
    if (!activeRevision || !commission) return;
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({ status: "accepted" }).eq("id", activeRevision.id);
      await supabase.from("commissions").update({ status: "working" }).eq("id", id);
      if (commission.target_seller_id)
        await sendNotification(commission.target_seller_id, "revision", `[추가수정] ${commission.title} - 의뢰자가 추가수정 조건에 동의했습니다.`, `/commission/${id}`);
      await fetchCommission();
      showSuccess("추가수정 조건에 동의했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const buyerNegotiateOffer = async () => {
    if (!activeRevision || !commission) return;
    if (!buyerNegPrice.trim() || !buyerNegDays.trim()) { showError("제안 비용과 기간을 입력해주세요."); return; }
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({
        negotiation_round: 1,
        requester_neg_price: Number(buyerNegPrice), requester_neg_days: Number(buyerNegDays),
        requester_neg_message: buyerNegMessage.trim() || null,
      }).eq("id", activeRevision.id);
      if (commission.target_seller_id)
        await sendNotification(commission.target_seller_id, "revision", `[추가수정] ${commission.title} - 의뢰자가 비용/기간 협의를 요청했습니다.`, `/commission/${id}`);
      setBuyerNegPrice(""); setBuyerNegDays(""); setBuyerNegMessage(""); setShowBuyerNegForm(false);
      await fetchActiveRevision();
      showSuccess("협의 요청을 전송했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const sellerAcceptNegotiation = async () => {
    if (!activeRevision || !commission) return;
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({ status: "accepted" }).eq("id", activeRevision.id);
      await supabase.from("commissions").update({ status: "working" }).eq("id", id);
      await sendNotification(commission.user_id, "revision", `[추가수정] ${commission.title} - 판매자가 협의 조건에 동의했습니다.`, `/commission/${id}`);
      await fetchCommission();
      showSuccess("협의 조건에 동의했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const sellerReNegotiate = async () => {
    if (!activeRevision || !commission) return;
    if (!sellerReNegPrice.trim() || !sellerReNegDays.trim()) { showError("비용과 기간을 입력해주세요."); return; }
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({
        negotiation_round: 2,
        seller_price: Number(sellerReNegPrice), seller_days: Number(sellerReNegDays),
        seller_message: sellerReNegMessage.trim() || null,
      }).eq("id", activeRevision.id);
      await sendNotification(commission.user_id, "revision", `[추가수정] ${commission.title} - 판매자가 조건을 재조정했습니다.`, `/commission/${id}`);
      setSellerReNegPrice(""); setSellerReNegDays(""); setSellerReNegMessage(""); setShowSellerReNegForm(false);
      await fetchActiveRevision();
      showSuccess("재협의 조건을 전송했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const buyerFinalAccept = async () => {
    if (!activeRevision || !commission) return;
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({ status: "accepted" }).eq("id", activeRevision.id);
      await supabase.from("commissions").update({ status: "working" }).eq("id", id);
      if (commission.target_seller_id)
        await sendNotification(commission.target_seller_id, "revision", `[추가수정] ${commission.title} - 의뢰자가 최종 조건에 동의했습니다.`, `/commission/${id}`);
      await fetchCommission();
      showSuccess("최종 조건에 동의했습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const buyerFinalReject = async () => {
    if (!activeRevision || !commission) return;
    setRevisionSubmitting(true);
    try {
      await supabase.from("commission_revisions").update({ status: "rejected", seller_rejection_reason: "의뢰자 최종 거절" }).eq("id", activeRevision.id);
      if (commission.target_seller_id)
        await sendNotification(commission.target_seller_id, "revision", `[추가수정] ${commission.title} - 의뢰자가 최종 조건을 거절했습니다.`, `/commission/${id}`);
      await fetchActiveRevision();
      showSuccess("최종 거절 처리되었습니다.");
    } catch { showError("처리 실패"); }
    setRevisionSubmitting(false);
  };

  const handleReject = async () => {
    if (rejectReasonIdx < 0) { showError("사유를 선택해주세요."); return; }
    const isOther = rejectReasonIdx === REJECT_REASONS.length - 1;
    const reason = isOther ? rejectReasonOther.trim() : REJECT_REASONS[rejectReasonIdx];
    if (isOther && !reason) { showError("사유를 직접 입력해주세요."); return; }
    if (!commission) return;
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({ status: "rejected", rejection_reason: reason }).eq("id", id);
      await sendNotification(commission.user_id, "negotiation", "의뢰 거절", `/commission/${id}`);
      setRejectModalOpen(false);
      await fetchCommission();
    } catch { showError("처리 실패"); }
    setNegSubmitting(false);
  };

  const handleCancel = async () => {
    if (cancelReasonIdx < 0) { showError("사유를 선택해주세요."); return; }
    const isOther = cancelReasonIdx === CANCEL_REASONS.length - 1;
    const reason = isOther ? cancelReasonOther.trim() : CANCEL_REASONS[cancelReasonIdx];
    if (isOther && !reason) { showError("사유를 직접 입력해주세요."); return; }
    if (!commission) return;
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({ status: "cancelled", cancellation_reason: reason }).eq("id", id);
      if (commission.target_seller_id)
        await sendNotification(commission.target_seller_id, "negotiation", "의뢰 취소", `/commission/${id}`);
      setCancelModalOpen(false);
      await fetchCommission();
    } catch { showError("취소 실패"); }
    setNegSubmitting(false);
  };

  const fetchDisputes = async () => {
    const token = getAccessToken();
    if (!token) return;
    const res = await fetch(`/api/commission/dispute?commission_id=${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setDisputes(data.disputes || []);
    }
  };

  const handleDisputeSubmit = async () => {
    if (disputeReasonIdx < 0) { showError("사유를 선택해주세요."); return; }
    const reason = DISPUTE_REASONS[disputeReasonIdx];
    const token = getAccessToken();
    setDisputeSubmitting(true);
    try {
      const res = await fetch("/api/commission/dispute", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commission_id: id, reason, detail: disputeDetail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "신고 실패");
      setDisputeModalOpen(false);
      showSuccess("신고가 접수되었습니다.");
    } catch (e: any) { showError(e.message || "신고 실패"); }
    finally { setDisputeSubmitting(false); }
  };

  const handleRefund = async (disputeId: string) => {
    const ratio = disputeRefundRatio[disputeId] ?? 100;
    if (!confirm(`${ratio}% 환불 처리하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    setDisputeRefunding(disputeId);
    const token = getAccessToken();
    try {
      const res = await fetch("/api/commission/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commission_id: id, dispute_id: disputeId, refundRate: ratio }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "환불 실패");
      showSuccess(data.message || "환불 처리가 완료되었습니다.");
      await Promise.all([fetchDisputes(), fetchCommission()]);
    } catch (e: any) { showError(e.message || "환불 처리 실패"); }
    finally { setDisputeRefunding(null); }
  };

  const handleWarn = async (disputeId: string) => {
    if (!confirm("판매자에게 경고를 부여하시겠습니까? 경고 3회 누적 시 판매 활동이 정지됩니다.")) return;
    setDisputeWarning(disputeId);
    const token = getAccessToken();
    try {
      const res = await fetch("/api/commission/warn", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ commission_id: id, dispute_id: disputeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "경고 처리 실패");
      const msg = data.is_seller_banned
        ? `경고 ${data.warning_count}회 누적 — 판매자 활동이 정지되었습니다.`
        : `경고가 부여되었습니다. (누적 ${data.warning_count}회)`;
      showSuccess(msg);
    } catch (e: any) { showError(e.message || "경고 처리 실패"); }
    finally { setDisputeWarning(null); }
  };

  const fd = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };
  const fdt = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ height: 28, background: "#f3f4f6", borderRadius: 8, marginBottom: 20, width: "55%" }} />
        <div style={{ height: 360, background: "#f3f4f6", borderRadius: 14, marginBottom: 16 }} />
        <div style={{ height: 120, background: "#f3f4f6", borderRadius: 14 }} />
      </div>
    );
  }

  if (!commission) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 20px", textAlign: "center", fontFamily: "system-ui, sans-serif" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>😢</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>의뢰를 찾을 수 없습니다</div>
        <Link href="/commission" style={{ display: "inline-block", marginTop: 20, color: GOLD, textDecoration: "none", fontWeight: 700 }}>
          목록으로 돌아가기
        </Link>
      </div>
    );
  }

  const isAuthor = myId === commission.user_id;
  const isTargetSeller = myId === commission.target_seller_id;
  // 개인의뢰가 "open"으로 잘못 생성된 기존 데이터 호환: "open" → "pending" 정규화
  const status = commission.is_private && commission.status === "open" ? "pending" : commission.status;

  const canReject = isTargetSeller && ["pending", "negotiating"].includes(status);
  const canCancel = isAuthor && ["pending", "negotiating"].includes(status);

  const isOverdue = (() => {
    if (status !== "working" || !commission.final_days || !commission.updated_at) return false;
    const deadline = new Date(commission.updated_at);
    deadline.setDate(deadline.getDate() + commission.final_days);
    return new Date() > deadline;
  })();

  const lastNeg = negotiations.length > 0 ? negotiations[negotiations.length - 1] : null;
  const isMyTurnToRespond = status === "negotiating" && !!lastNeg && lastNeg.proposer_id !== myId;

  const statusLabel = commission.is_private
    ? (PRIVATE_STATUS_LABEL[status] || status)
    : (results.length > 0 ? `링크 ${results.length}개` : (PUBLIC_STATUS_LABEL[status] || status));
  const statusColor = commission.is_private
    ? (PRIVATE_STATUS_COLOR[status] || "#374151")
    : (results.length > 0 ? "#16a34a" : (PUBLIC_STATUS_COLOR[status] || "#374151"));
  const statusBg = commission.is_private
    ? (PRIVATE_STATUS_BG[status] || "#f3f4f6")
    : (results.length > 0 ? "#dcfce7" : (PUBLIC_STATUS_BG[status] || "#f3f4f6"));

  const stepIdx = PRIVATE_STEPS.indexOf(status);

  // Build progress bar elements
  const progressEls: React.ReactNode[] = [];
  PRIVATE_STEPS.forEach((step, i) => {
    const isDone = stepIdx > i;
    const isActive = step === status;
    progressEls.push(
      <div key={`s${i}`} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 0 }}>
        <div style={{
          width: 26, height: 26, borderRadius: "50%",
          background: isDone ? "#111827" : isActive ? GOLD : "#e5e7eb",
          color: isDone || isActive ? "white" : "#9ca3af",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, flexShrink: 0,
        }}>
          {isDone ? "✓" : i + 1}
        </div>
        <div style={{
          fontSize: 10, marginTop: 4, textAlign: "center",
          color: isActive ? GOLD : isDone ? "#111827" : "#9ca3af",
          fontWeight: isActive ? 700 : 500, lineHeight: 1.2, wordBreak: "keep-all",
        }}>
          {PRIVATE_STEP_LABELS[step]}
        </div>
      </div>
    );
    if (i < PRIVATE_STEPS.length - 1) {
      progressEls.push(
        <div key={`l${i}`} style={{
          height: 2, flex: 0.8, background: stepIdx > i ? "#111827" : "#e5e7eb",
          marginBottom: 18, minWidth: 6, flexShrink: 0,
        }} />
      );
    }
  });

  return (
    <div style={{
      maxWidth: 800, margin: "0 auto", padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>

      {/* ── 결과물 업로드 경고 모달 ── */}
      {showUploadWarning && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.55)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: "0 20px",
        }}
          onClick={() => setShowUploadWarning(false)}
        >
          <div style={{
            background: "white", borderRadius: 20, padding: "32px 28px",
            maxWidth: 420, width: "100%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 22, fontWeight: 900, color: "#111827", marginBottom: 16 }}>
              ⚠️ 업로드 전 확인해주세요
            </div>
            <p style={{
              margin: "0 0 28px", fontSize: 16, color: "#374151",
              lineHeight: 1.8, fontWeight: 500,
            }}>
              전체적인 이미지 컨펌 후 업로드 하시기 바랍니다.<br />
              전체 이미지 컨펌을 하지 않고 업로드 시<br />
              무료 수정요청을 받을 수 있습니다.
            </p>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setShowUploadWarning(false)}
                style={{
                  flex: 1, height: 48, borderRadius: 12,
                  border: "1.5px solid #e5e7eb", background: "white",
                  color: "#6b7280", fontSize: 15, fontWeight: 700, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                onClick={() => { setShowUploadWarning(false); fileUploadRef.current?.click(); }}
                style={{
                  flex: 1, height: 48, borderRadius: 12,
                  border: "none", background: "#111827",
                  color: "#c9a84c", fontSize: 15, fontWeight: 800, cursor: "pointer",
                }}
              >
                확인했습니다
              </button>
            </div>
          </div>
        </div>
      )}

      <Link href="/commission" style={{
        display: "inline-flex", alignItems: "center", gap: 6,
        fontSize: 18, fontWeight: 700, color: "#111827",
        textDecoration: "none", marginBottom: 16, cursor: "pointer",
      }}>
        ← 목록으로
      </Link>

      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 16 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.35, flex: 1 }}>
              {commission.title}
            </h1>
            <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: statusColor, background: statusBg, padding: "4px 12px", borderRadius: 999 }}>
              {statusLabel}
            </span>
            {commission.is_private && (
              <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: "#7c3aed", background: "#ede9fe", padding: "4px 12px", borderRadius: 999 }}>
                개인의뢰
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 13, color: "#6b7280" }}>
            <span>{commission.nickname}</span>
            <span>·</span>
            <span>{fd(commission.created_at)}</span>
          </div>
        </div>
        {isSeller && !commission.is_private && (
          <button type="button" onClick={() => {
            if (!linkPanelOpen) { setResultLink(myResult?.result_link || ""); setResultEditing(false); }
            setLinkPanelOpen((p) => !p);
          }} style={{
            flexShrink: 0, border: "1px solid #d1d5db", borderRadius: 10,
            padding: "8px 16px", background: "white",
            fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            🔗 {myResult ? "내 결과물 관리" : "결과물 링크 등록"}
          </button>
        )}
      </div>

      {/* 링크 패널 (공개의뢰 판매자) */}
      {isSeller && !commission.is_private && linkPanelOpen && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 20, background: "#fafafa" }}>
          {myResult && !resultEditing ? (
            <div>
              <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>등록된 링크</div>
              <a href={myResult.result_link} style={{ fontSize: 13, color: "#2563eb", wordBreak: "break-all" }}>{myResult.result_link}</a>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button type="button" onClick={() => { setResultLink(myResult.result_link); setResultEditing(true); }}
                  style={{ height: 38, padding: "0 20px", borderRadius: 10, border: "none", background: "#111827", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>수정</button>
                <button type="button" onClick={handleResultDelete} disabled={resultSaving}
                  style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "1px solid #fca5a5", background: "white", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: resultSaving ? "not-allowed" : "pointer" }}>
                  {resultSaving ? "처리 중..." : "삭제"}</button>
                <button type="button" onClick={() => setLinkPanelOpen(false)}
                  style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#374151" }}>닫기</button>
              </div>
            </div>
          ) : (
            <div style={{ position: "relative" }}>
              {/* URL 입력 + 내 모델 버튼 */}
              <div style={{ display: "flex", gap: 8 }}>
                <input type="url" value={resultLink} onChange={(e) => setResultLink(e.target.value)} placeholder="https://..."
                  style={{ flex: 1, height: 44, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }} />
                <button
                  type="button"
                  onClick={() => { setShowModelPicker((p) => !p); fetchMyModels(); }}
                  style={{ flexShrink: 0, height: 44, padding: "0 14px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#374151", whiteSpace: "nowrap" }}
                >
                  내 모델
                </button>
              </div>

              {/* 내 모델 선택 팝업 */}
              {showModelPicker && (
                <div style={{
                  position: "absolute", top: 48, left: 0, right: 0, zIndex: 50,
                  background: "white", border: "1px solid #e5e7eb", borderRadius: 12,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.10)", maxHeight: 320, overflowY: "auto",
                }}>
                  {modelsLoading ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>불러오는 중...</div>
                  ) : myModels.length === 0 ? (
                    <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>등록된 모델이 없습니다.</div>
                  ) : (
                    myModels.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => handleModelSelect(m.id)}
                        style={{
                          width: "100%", display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 14px", border: "none", background: "none",
                          borderBottom: "1px solid #f3f4f6", cursor: "pointer", textAlign: "left",
                        }}
                      >
                        <img
                          src={getModelThumbnail(m)}
                          alt={m.title}
                          style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }}
                        />
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {m.title}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button type="button" onClick={resultEditing ? handleResultUpdate : handleResultInsert} disabled={resultSaving}
                  style={{ height: 38, padding: "0 20px", borderRadius: 10, border: "none", background: resultSaving ? "#d1d5db" : GOLD, color: "white", fontSize: 13, fontWeight: 700, cursor: resultSaving ? "not-allowed" : "pointer" }}>
                  {resultSaving ? "처리 중..." : resultEditing ? "수정 저장" : "등록"}</button>
                <button type="button" onClick={() => { setResultEditing(false); setLinkPanelOpen(false); setShowModelPicker(false); }}
                  style={{ height: 38, padding: "0 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#374151" }}>취소</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 이미지 갤러리 */}
      {commission.images && commission.images.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f8fafc", marginBottom: 10, position: "relative" }}>
            <Image src={commission.images[selectedImage]} alt={commission.title} fill style={{ objectFit: "cover" }} />
          </div>
          {commission.images.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {commission.images.map((img, i) => (
                <div key={i} onClick={() => setSelectedImage(i)} style={{
                  width: 64, height: 64, borderRadius: 8, overflow: "hidden", cursor: "pointer", flexShrink: 0,
                  border: selectedImage === i ? `2px solid ${GOLD}` : "2px solid transparent",
                }}>
                  <Image src={img} alt="" width={64} height={64} style={{ objectFit: "cover", display: "block" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 14, background: "#f8fafc", display: "flex", alignItems: "center", justifyContent: "center", color: "#d1d5db", fontSize: 48, marginBottom: 28 }}>📋</div>
      )}

      {/* 설명 */}
      {commission.description && (
        <div style={{ background: "#f8fafc", borderRadius: 14, padding: "18px 20px", fontSize: 14, color: "#374151", lineHeight: 1.8, marginBottom: 28, whiteSpace: "pre-wrap" }}>
          {commission.description}
        </div>
      )}

      {/* ─── 개인 의뢰 패널 ─── */}
      {commission.is_private &&
        (isAuthor || isTargetSeller) &&
        !(commission.commission_type === "공개모집" && commission.bid_status === "모집중") && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 28, background: "#fafafa" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>개인 의뢰 진행 상황</div>

          {/* 판매자 정보 */}
          {sellerNickname && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, background: "white", border: "1px solid #e5e7eb", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flex: 1, flexWrap: "wrap", fontSize: 14, color: "#374151" }}>
                <span style={{ fontWeight: 700, color: "#111827" }}>{commission.nickname}</span>
                <span>님이</span>
                <span style={{ fontWeight: 700, color: "#111827" }}>{sellerNickname}</span>
                {sellerGrade && <GradeBadge grade={sellerGrade as Grade} size="sm" />}
                <span>님께 의뢰중입니다</span>
              </div>
              {sellerPhone && (
                <a href={`tel:${sellerPhone}`} style={{ fontSize: 12, color: "#2563eb", fontWeight: 600, textDecoration: "none", flexShrink: 0 }}>
                  {sellerPhone}
                </a>
              )}
            </div>
          )}

          {/* 프로그레스 바 */}
          {!["rejected", "cancelled"].includes(status) && (
            <div style={{ display: "flex", alignItems: "flex-start", marginBottom: 24 }}>
              {progressEls}
            </div>
          )}

          {/* ── 의뢰중 (pending) ── */}
          {status === "pending" && (
            <>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>희망 비용</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {commission.desired_price != null ? `${commission.desired_price.toLocaleString()}원` : "미지정"}
                  </div>
                </div>
                <div style={{ flex: 1, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4 }}>희망 기간</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {commission.desired_days != null ? `${commission.desired_days}일` : "미지정"}
                  </div>
                </div>
              </div>
              {isTargetSeller && !proposeOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={handleSellerAccept} disabled={negSubmitting} style={{
                    height: 44, borderRadius: 10, border: "none",
                    background: negSubmitting ? "#d1d5db" : "#111827",
                    color: "white", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                  }}>
                    {negSubmitting ? "처리 중..." : "수락하기"}
                  </button>
                  <button onClick={() => {
                    setProposePrice(commission.desired_price?.toString() || "");
                    setProposeDays(commission.desired_days?.toString() || "");
                    setProposeOpen(true);
                  }} style={{
                    height: 44, borderRadius: 10, border: "1px solid #d1d5db", background: "white",
                    color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
                  }}>
                    협의 제안
                  </button>
                </div>
              )}
              {proposeOpen && status === "pending" && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <input type="number" value={proposePrice} onChange={(e) => setProposePrice(e.target.value)} placeholder="비용 (원)"
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                    <input type="number" value={proposeDays} onChange={(e) => setProposeDays(e.target.value)} placeholder="기간 (일)"
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                  </div>
                  <textarea value={proposeMsg} onChange={(e) => setProposeMsg(e.target.value)} placeholder="메시지 (선택)" rows={2}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={handlePropose} disabled={negSubmitting} style={{
                      flex: 1, height: 40, borderRadius: 8, border: "none",
                      background: negSubmitting ? "#d1d5db" : "#111827",
                      color: "white", fontSize: 13, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                    }}>{negSubmitting ? "전송 중..." : "제안 전송"}</button>
                    <button onClick={() => setProposeOpen(false)} style={{
                      flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", background: "white",
                      color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>취소</button>
                  </div>
                </div>
              )}
              {isAuthor && (
                <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 14, color: "#92400e", fontWeight: 600 }}>
                  판매자 응답 대기 중...
                </div>
              )}
            </>
          )}

          {/* ── 협의중 (negotiating) ── */}
          {status === "negotiating" && (
            <>
              {/* 현재 합의 조건 */}
              {(commission.final_price != null || commission.final_days != null) && (
                <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <div style={{ flex: 1, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>현재 합의 비용</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                      {commission.final_price != null ? `${commission.final_price.toLocaleString()}원` : "미지정"}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: "white", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "#6b7280", marginBottom: 2 }}>현재 합의 기간</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>
                      {commission.final_days != null ? `${commission.final_days}일` : "미지정"}
                    </div>
                  </div>
                </div>
              )}

              {/* 협의 히스토리 */}
              {negotiations.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                  {negLoading ? (
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>불러오는 중...</div>
                  ) : negotiations.map((neg) => {
                    const isMine = neg.proposer_id === myId;
                    return (
                      <div key={neg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMine ? "flex-end" : "flex-start" }}>
                        <div style={{
                          maxWidth: "80%",
                          background: isMine ? "#111827" : "white",
                          color: isMine ? "white" : "#111827",
                          border: isMine ? "none" : "1px solid #e5e7eb",
                          borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                          padding: "12px 14px",
                        }}>
                          <div style={{ display: "flex", gap: 12, marginBottom: neg.message ? 8 : 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{neg.price.toLocaleString()}원</span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{neg.days}일</span>
                            <span style={{ fontSize: 11, opacity: 0.6, alignSelf: "center" }}>라운드 {neg.round}</span>
                          </div>
                          {neg.message && <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{neg.message}</div>}
                        </div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{fdt(neg.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* 내 차례 재제안 폼 */}
              {isMyTurnToRespond && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white", marginBottom: 10 }}>
                  <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 700, marginBottom: 8 }}>상대방이 새 조건을 제안했습니다. 재제안하거나 협의완료를 눌러주세요.</div>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <input type="number" value={proposePrice} onChange={(e) => setProposePrice(e.target.value)}
                      placeholder={`비용 (이전: ${lastNeg?.price.toLocaleString()}원)`}
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                    <input type="number" value={proposeDays} onChange={(e) => setProposeDays(e.target.value)}
                      placeholder={`기간 (이전: ${lastNeg?.days}일)`}
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                  </div>
                  <textarea value={proposeMsg} onChange={(e) => setProposeMsg(e.target.value)} placeholder="메시지 (선택)" rows={2}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={handlePropose} disabled={negSubmitting} style={{
                      flex: 1, height: 40, borderRadius: 8, border: "none",
                      background: negSubmitting ? "#d1d5db" : "#111827",
                      color: "white", fontSize: 13, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                    }}>재제안</button>
                  </div>
                </div>
              )}

              {/* 새 제안 버튼 (내 차례가 아닐 때) */}
              {!isMyTurnToRespond && !proposeOpen && (
                <button onClick={() => { setProposePrice(commission.final_price?.toString() || ""); setProposeDays(commission.final_days?.toString() || ""); setProposeOpen(true); }}
                  style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 10 }}>
                  협의 제안하기
                </button>
              )}
              {!isMyTurnToRespond && proposeOpen && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white", marginBottom: 10 }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <input type="number" value={proposePrice} onChange={(e) => setProposePrice(e.target.value)} placeholder="비용 (원)"
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                    <input type="number" value={proposeDays} onChange={(e) => setProposeDays(e.target.value)} placeholder="기간 (일)"
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                  </div>
                  <textarea value={proposeMsg} onChange={(e) => setProposeMsg(e.target.value)} placeholder="메시지 (선택)" rows={2}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={handlePropose} disabled={negSubmitting} style={{
                      flex: 1, height: 40, borderRadius: 8, border: "none",
                      background: negSubmitting ? "#d1d5db" : "#111827",
                      color: "white", fontSize: 13, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                    }}>{negSubmitting ? "전송 중..." : "제안 전송"}</button>
                    <button onClick={() => setProposeOpen(false)} style={{
                      flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", background: "white",
                      color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>취소</button>
                  </div>
                </div>
              )}

              {/* 협의완료 버튼 */}
              <button onClick={handleNegotiationComplete} disabled={negSubmitting} style={{
                width: "100%", height: 44, borderRadius: 10, border: "none",
                background: negSubmitting ? "#d1d5db" : "#16a34a",
                color: "white", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
              }}>
                {negSubmitting ? "처리 중..." : "협의완료 → 결제 단계로"}
              </button>
            </>
          )}

          {/* ── 결제중 (payment) ── */}
          {status === "payment" && (
            <div>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 4, fontWeight: 600 }}>합의 비용</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                    {commission.final_price != null ? `${commission.final_price.toLocaleString()}원` : "-"}
                  </div>
                </div>
                <div style={{ flex: 1, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#16a34a", marginBottom: 4, fontWeight: 600 }}>합의 기간</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>
                    {commission.final_days != null ? `${commission.final_days}일` : "-"}
                  </div>
                </div>
              </div>
              {isAuthor && !showPaymentWidget && (
                <button onClick={() => setShowPaymentWidget(true)} style={{
                  width: "100%", height: 44, borderRadius: 10, border: "none",
                  background: GOLD, color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}>
                  결제하기
                </button>
              )}
              {isAuthor && showPaymentWidget && (
                <div style={{ marginTop: 8 }}>
                  {widgetLoading && (
                    <div style={{ padding: 20, textAlign: "center", color: "#6b7280", fontSize: 14 }}>결제 위젯 로딩 중...</div>
                  )}
                  <div id="toss-payment-method" />
                  <div id="toss-agreement" />
                  <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                    <button
                      onClick={handlePaymentRequest}
                      disabled={negSubmitting || widgetLoading}
                      style={{
                        flex: 1, height: 48, borderRadius: 10, border: "none",
                        background: negSubmitting || widgetLoading ? "#d1d5db" : GOLD,
                        color: "white", fontSize: 15, fontWeight: 800,
                        cursor: negSubmitting || widgetLoading ? "not-allowed" : "pointer",
                      }}
                    >
                      {negSubmitting ? "처리 중..." : "결제 확인"}
                    </button>
                    <button
                      onClick={() => { setShowPaymentWidget(false); widgetsRef.current = null; }}
                      disabled={negSubmitting}
                      style={{
                        height: 48, padding: "0 20px", borderRadius: 10,
                        border: "1px solid #d1d5db", background: "white",
                        fontSize: 14, fontWeight: 700, cursor: "pointer", color: "#374151",
                      }}
                    >
                      취소
                    </button>
                  </div>
                </div>
              )}
              {isTargetSeller && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 14, color: "#92400e", fontWeight: 600 }}>
                  결제 대기 중... 구매자가 결제를 완료하면 작업을 시작해주세요.
                </div>
              )}
            </div>
          )}

          {/* ── 작업중 (working) ── */}
          {status === "working" && (
            <div>
              <div style={{ display: "flex", gap: 16, marginBottom: 16 }}>
                <div style={{ flex: 1, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#ea580c", marginBottom: 4, fontWeight: 600 }}>합의 비용</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {commission.final_price != null ? `${commission.final_price.toLocaleString()}원` : "-"}
                  </div>
                </div>
                <div style={{ flex: 1, background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "12px 16px" }}>
                  <div style={{ fontSize: 12, color: "#ea580c", marginBottom: 4, fontWeight: 600 }}>합의 기간</div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#111827" }}>
                    {commission.final_days != null ? `${commission.final_days}일` : "-"}
                  </div>
                </div>
              </div>
              {isTargetSeller && (
                <>
                  <button onClick={() => setShowUploadWarning(true)} disabled={negSubmitting} style={{
                    width: "100%", height: 44, borderRadius: 10, border: "1px dashed #d1d5db", background: "white",
                    color: "#374151", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                  }}>
                    {negSubmitting ? "업로드 중..." : "결과물 업로드"}
                  </button>
                  <input ref={fileUploadRef} type="file" accept=".stl,.3dm,.obj" style={{ display: "none" }} onChange={handleFileUpload} />
                </>
              )}
              {isAuthor && isOverdue && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fefce8", border: "1px solid #fde047", fontSize: 14, color: "#b45309", fontWeight: 700, display: "flex", alignItems: "center", gap: 8 }}>
                  ⚠️ 합의한 작업 기간이 초과되었습니다. 문제 신고가 가능합니다.
                </div>
              )}
              {isAuthor && !isOverdue && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fff7ed", border: "1px solid #fed7aa", fontSize: 14, color: "#92400e", fontWeight: 600 }}>
                  작업 진행 중... 판매자가 결과물을 업로드하면 알림을 드립니다.
                </div>
              )}
            </div>
          )}

          {/* ── 작업완료 (completed) ── */}
          {status === "completed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: 14, color: "#166534", fontWeight: 600 }}>
                결과물이 업로드되었습니다. 확인 후 다운로드해주세요.
              </div>

              {/* ─── 의뢰자 뷰 ─── */}
              {isAuthor && (
                <>
                  <button onClick={handleDownload} style={{ width: "100%", height: 44, borderRadius: 10, border: "none", background: "#111827", color: "white", fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                    파일 다운로드
                  </button>

                  {/* 활성 수정요청 없을 때: 요청 버튼 or 폼 */}
                  {!activeRevision && (
                    <>
                      {!revisionType ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setRevisionType("problem")} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            📋 문제수정 요청
                          </button>
                          <button onClick={() => setRevisionType("additional")} style={{ flex: 1, height: 40, borderRadius: 9, border: `1px solid ${GOLD}`, background: "white", color: "#92400e", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                            ✏️ 추가수정 요청
                          </button>
                        </div>
                      ) : (
                        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                            {revisionType === "problem" ? "📋 문제수정 요청" : "✏️ 추가수정 요청"}
                          </div>
                          {revisionType === "problem" && (
                            <div style={{ fontSize: 12, color: "#374151", background: "#f9fafb", borderRadius: 8, padding: "10px 12px", lineHeight: 1.8 }}>
                              <div style={{ fontWeight: 700, color: "#16a34a", marginBottom: 4 }}>✅ 문제수정 가능 항목</div>
                              <div>· 알 물림이 안되는 경우</div>
                              <div>· 조립이 안되는 경우</div>
                              <div>· 두께가 얇아서 주물이 안나오는 경우</div>
                              <div>· 이미지 컨펌을 하지 않았을 때 라인 변경 가능</div>
                              <div style={{ fontWeight: 700, color: "#dc2626", marginTop: 8, marginBottom: 4 }}>❌ 문제수정 불가 항목 (추가수정으로 요청)</div>
                              <div>· 이미지 컨펌 후 전체적인 라인 변경</div>
                              <div>· 민자 ↔ 알세팅 또는 알세팅 관련 변경</div>
                            </div>
                          )}
                          <textarea
                            value={revisionMessage}
                            onChange={(e) => setRevisionMessage(e.target.value)}
                            placeholder="상세 내용을 입력해주세요"
                            style={{ width: "100%", minHeight: 80, borderRadius: 8, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 13, resize: "vertical", boxSizing: "border-box" }}
                          />
                          {revisionType === "additional" && (
                            <div>
                              <div
                                onDragOver={(e) => { e.preventDefault(); setRevisionDragOver(true); }}
                                onDragLeave={() => setRevisionDragOver(false)}
                                onDrop={handleRevisionImageDrop}
                                onClick={() => revisionImageRef.current?.click()}
                                style={{ border: `2px dashed ${revisionDragOver ? GOLD : "#d1d5db"}`, borderRadius: 10, padding: "16px 12px", textAlign: "center", cursor: "pointer", background: revisionDragOver ? "#fffbeb" : "#fafafa", transition: "all 0.15s" }}
                              >
                                <div style={{ fontSize: 20, marginBottom: 4 }}>🖼️</div>
                                <div style={{ fontSize: 12, color: "#6b7280" }}>{revisionImageUploading ? "업로드 중..." : "이미지를 드래그하거나 클릭해서 첨부"}</div>
                              </div>
                              <input ref={revisionImageRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleRevisionImageSelect} />
                              {revisionImages.length > 0 && (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                                  {revisionImages.map((url, i) => (
                                    <div key={i} style={{ position: "relative" }}>
                                      <Image src={url} alt="" width={60} height={60} style={{ objectFit: "cover", borderRadius: 6 }} />
                                      <button onClick={() => setRevisionImages((prev) => prev.filter((_, j) => j !== i))} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#ef4444", border: "none", color: "white", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}>✕</button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => { setRevisionType(null); setRevisionMessage(""); setRevisionImages([]); }} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>
                            <button onClick={submitRevision} disabled={revisionSubmitting} style={{ flex: 2, height: 40, borderRadius: 9, border: "none", background: revisionType === "problem" ? "#16a34a" : GOLD, color: "white", fontSize: 13, fontWeight: 700, cursor: revisionSubmitting ? "not-allowed" : "pointer" }}>
                              {revisionSubmitting ? "전송 중..." : "요청 전송"}
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* 활성 수정요청 진행 중 - 의뢰자 뷰 */}
                  {activeRevision && (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                        {activeRevision.type === "problem" ? "📋 문제수정" : "✏️ 추가수정"} 진행 중
                      </div>
                      {activeRevision.status === "pending" && (
                        <div style={{ fontSize: 13, color: "#6b7280", padding: "10px 12px", background: "#f9fafb", borderRadius: 8 }}>
                          수정 요청이 판매자에게 전달되었습니다. 판매자 응답을 기다리는 중입니다.
                        </div>
                      )}
                      {activeRevision.type === "additional" && activeRevision.status === "negotiating" && activeRevision.negotiation_round === 0 && (
                        <>
                          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#92400e", fontWeight: 600, marginBottom: 4 }}>판매자 제안 비용</div><div style={{ fontSize: 16, fontWeight: 700 }}>{activeRevision.seller_price?.toLocaleString()}원</div></div>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#92400e", fontWeight: 600, marginBottom: 4 }}>판매자 제안 기간</div><div style={{ fontSize: 16, fontWeight: 700 }}>{activeRevision.seller_days}일</div></div>
                          </div>
                          {activeRevision.seller_message && <div style={{ fontSize: 13, color: "#374151", padding: "8px 12px", background: "#f9fafb", borderRadius: 8 }}>{activeRevision.seller_message}</div>}
                          {!showBuyerNegForm ? (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button onClick={buyerAcceptOffer} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: "#16a34a", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>수락</button>
                              <button onClick={() => setShowBuyerNegForm(true)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>비용/기간 협의</button>
                            </div>
                          ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                              <div style={{ display: "flex", gap: 8 }}>
                                <input value={buyerNegPrice} onChange={(e) => setBuyerNegPrice(e.target.value)} placeholder="제안 비용 (원)" type="number" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
                                <input value={buyerNegDays} onChange={(e) => setBuyerNegDays(e.target.value)} placeholder="제안 기간 (일)" type="number" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
                              </div>
                              <textarea value={buyerNegMessage} onChange={(e) => setBuyerNegMessage(e.target.value)} placeholder="협의 내용 (선택)" style={{ borderRadius: 8, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 60 }} />
                              <div style={{ display: "flex", gap: 8 }}>
                                <button onClick={() => setShowBuyerNegForm(false)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>
                                <button onClick={buyerNegotiateOffer} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: GOLD, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>협의 요청</button>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                      {activeRevision.type === "additional" && activeRevision.status === "negotiating" && activeRevision.negotiation_round === 1 && (
                        <div style={{ fontSize: 13, color: "#6b7280", padding: "10px 12px", background: "#f9fafb", borderRadius: 8 }}>
                          협의 요청을 전달했습니다. 판매자 응답을 기다리는 중입니다.
                        </div>
                      )}
                      {activeRevision.type === "additional" && activeRevision.status === "negotiating" && activeRevision.negotiation_round === 2 && (
                        <>
                          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 12 }}>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#92400e", fontWeight: 600, marginBottom: 4 }}>재조정 비용</div><div style={{ fontSize: 16, fontWeight: 700 }}>{activeRevision.seller_price?.toLocaleString()}원</div></div>
                            <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#92400e", fontWeight: 600, marginBottom: 4 }}>재조정 기간</div><div style={{ fontSize: 16, fontWeight: 700 }}>{activeRevision.seller_days}일</div></div>
                          </div>
                          {activeRevision.seller_message && <div style={{ fontSize: 13, color: "#374151", padding: "8px 12px", background: "#f9fafb", borderRadius: 8 }}>{activeRevision.seller_message}</div>}
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={buyerFinalAccept} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: "#16a34a", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>최종 수락</button>
                            <button onClick={buyerFinalReject} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #dc2626", background: "white", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>최종 거절</button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <a href="/library?tab=commissions" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 36, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                    다운로드에서 받기 →
                  </a>
                </>
              )}

              {/* ─── 판매자 뷰 ─── */}
              {isTargetSeller && !activeRevision && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 14, color: "#92400e", fontWeight: 600 }}>
                  구매자가 파일을 다운로드하면 거래가 완료됩니다.
                </div>
              )}
              {isTargetSeller && activeRevision && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>
                    {activeRevision.type === "problem" ? "📋 문제수정 요청 접수" : "✏️ 추가수정 요청 접수"}
                  </div>
                  <div style={{ fontSize: 13, color: "#374151", padding: "10px 12px", background: "#f9fafb", borderRadius: 8 }}>
                    {activeRevision.requester_message}
                  </div>
                  {activeRevision.images && activeRevision.images.length > 0 && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {activeRevision.images.map((url, i) => (
                        <Image key={i} src={url} alt="" width={72} height={72} style={{ objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                      ))}
                    </div>
                  )}
                  {/* 문제수정 - 판매자 응답 */}
                  {activeRevision.type === "problem" && activeRevision.status === "pending" && (
                    <>
                      <textarea value={sellerRevResponse} onChange={(e) => setSellerRevResponse(e.target.value)} placeholder="응답 내용 (선택)" style={{ borderRadius: 8, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 60 }} />
                      {!showSellerRejectForm ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={sellerAcceptProblemFix} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: "#16a34a", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>수락</button>
                          <button onClick={() => setShowSellerRejectForm(true)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #dc2626", background: "white", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>거절</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input value={sellerRevRejectReason} onChange={(e) => setSellerRevRejectReason(e.target.value)} placeholder="거절 사유 (필수)" style={{ height: 40, borderRadius: 8, border: "1px solid #dc2626", padding: "0 12px", fontSize: 13 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowSellerRejectForm(false)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>
                            <button onClick={sellerRejectRevision} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: "#dc2626", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>거절 확인</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* 추가수정 - 판매자 최초 응답 */}
                  {activeRevision.type === "additional" && activeRevision.status === "pending" && (
                    <>
                      <div style={{ display: "flex", gap: 8 }}>
                        <input value={sellerRevPrice} onChange={(e) => setSellerRevPrice(e.target.value)} placeholder="추가 비용 (원)" type="number" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
                        <input value={sellerRevDays} onChange={(e) => setSellerRevDays(e.target.value)} placeholder="추가 기간 (일)" type="number" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
                      </div>
                      <textarea value={sellerRevResponse} onChange={(e) => setSellerRevResponse(e.target.value)} placeholder="내용 (선택)" style={{ borderRadius: 8, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 60 }} />
                      {!showSellerRejectForm ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={sellerOfferAdditional} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: GOLD, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>수락 (조건 전달)</button>
                          <button onClick={() => setShowSellerRejectForm(true)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #dc2626", background: "white", color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>거절</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <input value={sellerRevRejectReason} onChange={(e) => setSellerRevRejectReason(e.target.value)} placeholder="거절 사유 (필수)" style={{ height: 40, borderRadius: 8, border: "1px solid #dc2626", padding: "0 12px", fontSize: 13 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowSellerRejectForm(false)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>
                            <button onClick={sellerRejectRevision} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: "#dc2626", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>거절 확인</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {/* 추가수정 - 의뢰자 협의 요청 받음 (round 1) */}
                  {activeRevision.type === "additional" && activeRevision.status === "negotiating" && activeRevision.negotiation_round === 1 && (
                    <>
                      <div style={{ background: "#ede9fe", border: "1px solid #ddd6fe", borderRadius: 8, padding: "12px 14px", display: "flex", gap: 12 }}>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, marginBottom: 4 }}>의뢰자 제안 비용</div><div style={{ fontSize: 16, fontWeight: 700 }}>{activeRevision.requester_neg_price?.toLocaleString()}원</div></div>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 11, color: "#7c3aed", fontWeight: 600, marginBottom: 4 }}>의뢰자 제안 기간</div><div style={{ fontSize: 16, fontWeight: 700 }}>{activeRevision.requester_neg_days}일</div></div>
                      </div>
                      {activeRevision.requester_neg_message && <div style={{ fontSize: 13, color: "#374151", padding: "8px 12px", background: "#f9fafb", borderRadius: 8 }}>{activeRevision.requester_neg_message}</div>}
                      {!showSellerReNegForm ? (
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={sellerAcceptNegotiation} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: "#16a34a", color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>수락</button>
                          <button onClick={() => setShowSellerReNegForm(true)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>재협의</button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", gap: 8 }}>
                            <input value={sellerReNegPrice} onChange={(e) => setSellerReNegPrice(e.target.value)} placeholder="재조정 비용 (원)" type="number" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
                            <input value={sellerReNegDays} onChange={(e) => setSellerReNegDays(e.target.value)} placeholder="재조정 기간 (일)" type="number" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 13 }} />
                          </div>
                          <textarea value={sellerReNegMessage} onChange={(e) => setSellerReNegMessage(e.target.value)} placeholder="내용 (선택)" style={{ borderRadius: 8, border: "1px solid #d1d5db", padding: "10px 12px", fontSize: 13, resize: "vertical", minHeight: 60 }} />
                          <div style={{ display: "flex", gap: 8 }}>
                            <button onClick={() => setShowSellerReNegForm(false)} style={{ flex: 1, height: 40, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>취소</button>
                            <button onClick={sellerReNegotiate} disabled={revisionSubmitting} style={{ flex: 1, height: 40, borderRadius: 9, border: "none", background: GOLD, color: "white", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>재협의 전달</button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── 다운완료 (downloaded) ── */}
          {status === "downloaded" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ padding: "20px 16px", borderRadius: 12, background: "#f0fdf4", border: "1px solid #bbf7d0", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>🎉</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: "#166534" }}>거래가 완료되었습니다!</div>
                <div style={{ fontSize: 13, color: "#16a34a", marginTop: 4 }}>구매자가 결과물을 다운로드했습니다.</div>
              </div>
              {commission.result_link && (
                <a href={commission.result_link} target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 44, borderRadius: 10, border: "1px solid #d1d5db", background: "white",
                  color: "#374151", fontSize: 14, fontWeight: 700, textDecoration: "none",
                }}>파일 다시 다운로드</a>
              )}
              {isAuthor && (
                <a href="/library?tab=commissions" style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 36, borderRadius: 9, border: "1px solid #d1d5db", background: "white", color: "#374151", textDecoration: "none", fontSize: 13, fontWeight: 700 }}>
                  다운로드에서 받기 →
                </a>
              )}
            </div>
          )}

          {/* ── 거절됨 (rejected) ── */}
          {status === "rejected" && (
            <div>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#991b1b" }}>판매자가 의뢰를 거절했습니다.</div>
                {commission.rejection_reason && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "white", borderRadius: 8, fontSize: 13, color: "#dc2626", borderLeft: "3px solid #fca5a5" }}>
                    <span style={{ fontWeight: 700 }}>거절 사유: </span>{commission.rejection_reason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 취소됨 (cancelled) ── */}
          {status === "cancelled" && (
            <div>
              <div style={{ padding: "14px 16px", borderRadius: 10, background: "#f3f4f6", border: "1px solid #d1d5db" }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>의뢰가 취소되었습니다.</div>
                {(commission.cancellation_reason || commission.cancel_reason) && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "white", borderRadius: 8, fontSize: 13, color: "#6b7280", borderLeft: "3px solid #d1d5db" }}>
                    <span style={{ fontWeight: 700 }}>취소 사유: </span>{commission.cancellation_reason || commission.cancel_reason}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 거절/취소 버튼 */}
          {(canReject || canCancel) && (
            <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 14, display: "flex", gap: 8 }}>
              {canReject && (
                <button onClick={() => { setRejectReasonIdx(-1); setRejectReasonOther(""); setRejectModalOpen(true); }} style={{
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: "1px solid #fca5a5", background: "white",
                  color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>거절하기</button>
              )}
              {canCancel && (
                <button onClick={() => { setCancelReasonIdx(-1); setCancelReasonOther(""); setCancelModalOpen(true); }} style={{
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: "1px solid #fca5a5", background: "white",
                  color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>취소하기</button>
              )}
            </div>
          )}

          {/* 문제 신고 버튼 */}
          {["working", "completed", "downloaded"].includes(status) && isAuthor && (
            <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              {disputes.some((d) => ["접수", "검토중"].includes(d.status)) ? (
                <div style={{ padding: "10px 16px", borderRadius: 8, background: "#fef3c7", border: "1px solid #fde68a", fontSize: 13, color: "#92400e", fontWeight: 600, textAlign: "center" }}>
                  신고 접수됨 (검토 중)
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setDisputeReasonIdx(-1); setDisputeDetail(""); setDisputeModalOpen(true); }}
                  style={{
                    width: "100%", height: 38, borderRadius: 10,
                    border: "1px solid #fed7aa", background: "#fff7ed",
                    color: "#92400e", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  문제 신고
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── 공개모집 견적 목록 (의뢰자용) ── */}
      {commission.is_private &&
        commission.commission_type === "공개모집" &&
        commission.bid_status === "모집중" &&
        isAuthor && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 28, background: "#fafafa" }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>
            견적 신청 목록
            {allBids.length > 0 && (
              <span style={{ marginLeft: 8, fontSize: 13, fontWeight: 600, color: "#6b7280" }}>({allBids.length}건)</span>
            )}
          </div>

          {bidsLoading ? (
            <div style={{ fontSize: 14, color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>불러오는 중...</div>
          ) : allBids.length === 0 ? (
            <div style={{ fontSize: 14, color: "#9ca3af", textAlign: "center", padding: "24px 0" }}>
              아직 견적 신청이 없습니다.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {allBids.map((bid) => (
                <div
                  key={bid.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    border: "1px solid #e5e7eb", borderRadius: 12,
                    padding: "14px 16px", background: "white",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{bid.nickname}</span>
                      {bid.grade && <GradeBadge grade={bid.grade as Grade} size="sm" />}
                    </div>
                    <div style={{ display: "flex", gap: 16, marginBottom: bid.message ? 6 : 0 }}>
                      <span style={{ fontSize: 13, color: "#374151" }}>
                        <span style={{ fontWeight: 700 }}>가격</span>{" "}
                        {bid.price.toLocaleString()}원
                      </span>
                      <span style={{ fontSize: 13, color: "#374151" }}>
                        <span style={{ fontWeight: 700 }}>기간</span>{" "}
                        {bid.work_days}일
                      </span>
                    </div>
                    {bid.message && (
                      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{bid.message}</div>
                    )}
                  </div>
                  <button
                    onClick={() => handleSelectBid(bid)}
                    disabled={!!selectingBid}
                    style={{
                      flexShrink: 0, height: 38, padding: "0 18px",
                      borderRadius: 10, border: "none",
                      background: selectingBid === bid.id ? "#d1d5db" : GOLD,
                      color: "white", fontSize: 13, fontWeight: 700,
                      cursor: selectingBid ? "not-allowed" : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {selectingBid === bid.id ? "처리 중..." : "선택"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 공개모집 견적 신청 패널 (판매자용) ── */}
      {commission.is_private &&
        commission.commission_type === "공개모집" &&
        commission.bid_status === "모집중" &&
        isSeller &&
        !isAuthor && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: 20, marginBottom: 28, background: "#fafafa" }}>
          {myBid ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 14 }}>견적 신청 완료</div>
              <div style={{
                background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
                padding: "14px 16px", marginBottom: 14, display: "flex", flexDirection: "column", gap: 6,
              }}>
                <div style={{ fontSize: 14, color: "#374151" }}>
                  <span style={{ fontWeight: 700, color: "#111827" }}>희망 가격:</span> {myBid.price.toLocaleString()}원
                </div>
                <div style={{ fontSize: 14, color: "#374151" }}>
                  <span style={{ fontWeight: 700, color: "#111827" }}>희망 작업기간:</span> {myBid.work_days}일
                </div>
                {myBid.message && (
                  <div style={{ fontSize: 14, color: "#374151" }}>
                    <span style={{ fontWeight: 700, color: "#111827" }}>한마디:</span> {myBid.message}
                  </div>
                )}
              </div>
              <button
                onClick={handleBidCancel}
                disabled={bidSubmitting}
                style={{
                  height: 40, padding: "0 18px", borderRadius: 10,
                  border: "1px solid #fca5a5", background: "white",
                  color: "#dc2626", fontSize: 13, fontWeight: 700,
                  cursor: bidSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {bidSubmitting ? "취소 중..." : "견적 신청 취소"}
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>견적 신청</div>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>희망 가격 (원)</div>
                  <input
                    type="number"
                    value={bidPrice}
                    onChange={(e) => setBidPrice(e.target.value)}
                    placeholder="예: 50000"
                    min={0}
                    style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 4, fontWeight: 600 }}>희망 작업기간 (일)</div>
                  <input
                    type="number"
                    value={bidDays}
                    onChange={(e) => setBidDays(e.target.value)}
                    placeholder="예: 7"
                    min={1}
                    style={{ width: "100%", height: 42, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 12px", fontSize: 14, boxSizing: "border-box", outline: "none" }}
                  />
                </div>
              </div>
              <textarea
                value={bidMessage}
                onChange={(e) => setBidMessage(e.target.value)}
                placeholder="한마디 (선택)"
                rows={3}
                style={{
                  width: "100%", borderRadius: 10, border: "1px solid #d1d5db",
                  padding: "10px 12px", fontSize: 14, resize: "vertical",
                  boxSizing: "border-box", outline: "none", fontFamily: "inherit",
                  marginBottom: 12,
                }}
              />
              <button
                onClick={handleBidSubmit}
                disabled={bidSubmitting}
                style={{
                  width: "100%", height: 44, borderRadius: 10, border: "none",
                  background: bidSubmitting ? "#d1d5db" : GOLD,
                  color: "white", fontSize: 14, fontWeight: 700,
                  cursor: bidSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {bidSubmitting ? "신청 중..." : "견적 신청"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ── 개인의뢰 채팅 ── */}
      {commission.is_private &&
        (isAuthor || isTargetSeller) &&
        !(commission.commission_type === "공개모집" && commission.bid_status === "모집중") && (
        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 28, paddingTop: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>채팅</span>
            <span style={{ fontSize: 13, color: "#c9a84c", fontWeight: 600 }}>충분한 대화 후 작업을 진행해주세요.</span>
          </div>

          {/* 메시지 목록 */}
          <div
            ref={chatContainerRef}
            style={{
              position: "relative", height: 380, overflowY: "auto",
              border: chatDragOver ? `2px dashed ${GOLD}` : "1px solid #e5e7eb",
              borderRadius: 14, padding: "12px 14px",
              background: chatDragOver ? "#fdf6e3" : "#f9fafb",
              display: "flex", flexDirection: "column", gap: 10,
              transition: "border 0.15s, background 0.15s",
            }}
            onDragOver={(e) => { e.preventDefault(); setChatDragOver(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setChatDragOver(false); }}
            onDrop={handleChatDrop}
          >
            {chatDragOver && (
              <div style={{
                position: "absolute", inset: 0, borderRadius: 14,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: "rgba(253,246,227,0.92)", zIndex: 10, pointerEvents: "none",
              }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: GOLD }}>🖼 이미지를 여기에 놓으세요</div>
              </div>
            )}
            {chatLoading ? (
              <div style={{ margin: "auto", color: "#9ca3af", fontSize: 13 }}>불러오는 중...</div>
            ) : chatMessages.length === 0 ? (
              <div style={{ margin: "auto", color: "#9ca3af", fontSize: 13 }}>아직 메시지가 없습니다.</div>
            ) : (
              chatMessages.map((msg) => {
                const isMe = msg.sender_id === myId;
                const nick = chatNicknames[msg.sender_id] || "...";
                const time = new Date(msg.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
                return (
                  <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start" }}>
                    <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 3 }}>
                      {!isMe && <span style={{ marginRight: 6, fontWeight: 600, color: "#6b7280" }}>{nick}</span>}
                      {time}
                    </div>
                    {msg.image_url ? (
                      <Image src={msg.image_url} alt="첨부 이미지"
                        width={220} height={220}
                        style={{ objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb", cursor: "pointer" }}
                        onClick={() => window.open(msg.image_url!, "_blank")}
                      />
                    ) : (
                      <div style={{
                        maxWidth: "72%", padding: "9px 13px", borderRadius: 14,
                        background: isMe ? GOLD : "white",
                        color: isMe ? "white" : "#111827",
                        fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
                        border: isMe ? "none" : "1px solid #e5e7eb",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      }}>
                        {msg.message}
                      </div>
                    )}
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 입력창 */}
          <div style={{ display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end" }}>
            <button
              type="button"
              onClick={() => chatImageRef.current?.click()}
              disabled={chatSending}
              style={{
                flexShrink: 0, background: "none", border: "1px solid #ccc",
                borderRadius: 8, padding: "6px 10px", cursor: chatSending ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", gap: 4,
                opacity: chatSending ? 0.5 : 1,
              }}
              title="이미지 첨부"
            >
              <ImagePlus size={20} color="#666" />
            </button>
            <input ref={chatImageRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleChatImage} />
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
              placeholder="메시지 입력 (Shift+Enter 줄바꿈)"
              rows={2}
              disabled={chatSending}
              style={{
                flex: 1, borderRadius: 10, border: "1px solid #d1d5db",
                padding: "10px 12px", fontSize: 14, resize: "none",
                outline: "none", fontFamily: "system-ui, -apple-system, sans-serif",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={handleSendChat}
              disabled={chatSending || !chatInput.trim()}
              style={{
                flexShrink: 0, height: 40, padding: "0 18px", borderRadius: 10,
                border: "none", background: chatSending || !chatInput.trim() ? "#d1d5db" : GOLD,
                color: "white", fontSize: 13, fontWeight: 700,
                cursor: chatSending || !chatInput.trim() ? "not-allowed" : "pointer",
              }}
            >
              {chatSending ? "..." : "전송"}
            </button>
          </div>
        </div>
      )}

      {/* 결과물 링크 (공개의뢰) */}
      {results.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>결과물</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {results.map((r) => (
              <a key={r.id} href={r.result_link} style={{
                padding: "8px 16px", background: "#111827", color: "white",
                borderRadius: 10, fontSize: 13, fontWeight: 700, textDecoration: "none",
                display: "inline-flex", alignItems: "center", gap: 6,
              }}>
                {r.nickname}
                {r.grade && <GradeBadge grade={r.grade as Grade} size="sm" />}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 관리자 신고 내역 */}
      {isAdmin && commission.is_private && disputes.length > 0 && (
        <div style={{ borderTop: "1px solid #e5e7eb", marginTop: 28, paddingTop: 24, marginBottom: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 12 }}>신고 내역</div>
          {disputes.map((d) => (
            <div key={d.id} style={{ border: "1px solid #fde68a", borderRadius: 12, padding: 16, marginBottom: 10, background: "#fffbeb" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#92400e" }}>{d.reason}</span>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "#fef3c7", color: "#92400e", fontWeight: 600 }}>{d.status}</span>
                </div>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>{fd(d.created_at)}</span>
              </div>
              {d.detail && (
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 10, whiteSpace: "pre-wrap" }}>{d.detail}</div>
              )}
              {d.status === "접수" && (() => {
                const ratio = disputeRefundRatio[d.id] ?? 100;
                return (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {[30, 50, 70, 100].map((r) => (
                        <button
                          key={r} type="button"
                          onClick={() => setDisputeRefundRatio((prev) => ({ ...prev, [d.id]: r }))}
                          style={{
                            height: 30, padding: "0 12px", borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: "pointer",
                            border: ratio === r ? "none" : "1px solid #d1d5db",
                            background: ratio === r ? "#111827" : "white",
                            color: ratio === r ? "white" : "#374151",
                          }}
                        >{r}%</button>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => handleRefund(d.id)}
                        disabled={disputeRefunding === d.id}
                        style={{
                          height: 36, padding: "0 18px", borderRadius: 8, border: "none",
                          background: disputeRefunding === d.id ? "#d1d5db" : "#dc2626",
                          color: "white", fontSize: 13, fontWeight: 700,
                          cursor: disputeRefunding === d.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {disputeRefunding === d.id ? "처리 중..." : `${ratio}% 환불 처리`}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWarn(d.id)}
                        disabled={disputeWarning === d.id}
                        style={{
                          height: 36, padding: "0 18px", borderRadius: 8, border: "none",
                          background: disputeWarning === d.id ? "#d1d5db" : "#f59e0b",
                          color: "white", fontSize: 13, fontWeight: 700,
                          cursor: disputeWarning === d.id ? "not-allowed" : "pointer",
                        }}
                      >
                        {disputeWarning === d.id ? "처리 중..." : "경고 부여"}
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}

      {/* 삭제 버튼 — 관리자: 항상 표시 / 의뢰자: 결제 전(pending/open) 상태일 때만 표시 */}
      {(isAdmin || (isAuthor && (commission.status === "pending" || commission.status === "open"))) && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 36 }}>
          <button type="button" onClick={handleDelete} disabled={deleting} style={{
            padding: "8px 18px", borderRadius: 8, border: "1px solid #fca5a5", background: "white",
            color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: deleting ? "not-allowed" : "pointer",
          }}>
            {deleting ? "삭제 중..." : (isAdmin ? "관리자 삭제" : "삭제")}
          </button>
        </div>
      )}

      {/* 댓글 (공개의뢰) */}
      {!commission.is_private && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>댓글 {comments.length}개</div>
          {myId ? (
            <div style={{ marginBottom: 24 }}>
              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="댓글을 입력하세요" rows={3}
                style={{ width: "100%", borderRadius: 12, border: "1px solid #d1d5db", padding: "12px", fontSize: 14, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "system-ui, -apple-system, sans-serif" }} />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button type="button" onClick={handleAddComment} disabled={submittingComment || !commentText.trim()} style={{
                  height: 38, padding: "0 20px", borderRadius: 10, border: "none",
                  background: submittingComment || !commentText.trim() ? "#d1d5db" : "#111827",
                  color: "white", fontSize: 13, fontWeight: 700,
                  cursor: submittingComment || !commentText.trim() ? "not-allowed" : "pointer",
                }}>
                  {submittingComment ? "등록 중..." : "등록"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: "14px 16px", borderRadius: 12, background: "#f8fafc", fontSize: 13, color: "#6b7280", marginBottom: 24 }}>
              댓글을 작성하려면 로그인이 필요합니다.
            </div>
          )}
          {commentsLoading ? (
            <div style={{ color: "#6b7280", fontSize: 14 }}>불러오는 중...</div>
          ) : comments.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 14 }}>아직 댓글이 없습니다.</div>
          ) : (
            <div>
              {comments.map((comment) => (
                <div key={comment.id} style={{ borderBottom: "1px solid #f3f4f6", padding: "12px 0" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#111827" }}>
                      {(Array.isArray(comment.profiles) ? comment.profiles[0]?.nickname : comment.profiles?.nickname) || "익명"}
                    </span>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{fd(comment.created_at)}</span>
                      {myId === comment.user_id && (
                        <button type="button" onClick={() => handleDeleteComment(comment.id)} style={{ background: "none", border: "none", padding: 0, color: "#d1d5db", fontSize: 11, cursor: "pointer", fontWeight: 700 }}>삭제</button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: "#374151", marginTop: 4, whiteSpace: "pre-wrap" }}>{comment.content}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── 거절 모달 ─── */}
      {rejectModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 4 }}>의뢰 거절</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>거절 사유를 선택해주세요.</div>
            {REJECT_REASONS.map((reason, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < REJECT_REASONS.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                <input type="radio" name="rejectReason" checked={rejectReasonIdx === i} onChange={() => setRejectReasonIdx(i)}
                  style={{ width: 16, height: 16, accentColor: "#dc2626", cursor: "pointer" }} />
                <span style={{ fontSize: 14, color: "#374151" }}>{reason}</span>
              </label>
            ))}
            {rejectReasonIdx === REJECT_REASONS.length - 1 && (
              <textarea value={rejectReasonOther} onChange={(e) => setRejectReasonOther(e.target.value)}
                placeholder="직접 입력하세요" rows={2}
                style={{ width: "100%", marginTop: 10, borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleReject} disabled={negSubmitting} style={{
                flex: 1, height: 44, borderRadius: 10, border: "none",
                background: negSubmitting ? "#d1d5db" : "#dc2626",
                color: "white", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
              }}>{negSubmitting ? "처리 중..." : "확인"}</button>
              <button onClick={() => setRejectModalOpen(false)} style={{
                flex: 1, height: 44, borderRadius: 10, border: "1px solid #d1d5db", background: "white",
                color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 문제 신고 모달 ─── */}
      {disputeModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 4 }}>문제 신고</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>신고 사유를 선택해주세요.</div>
            {DISPUTE_REASONS.map((reason, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < DISPUTE_REASONS.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                <input type="radio" name="disputeReason" checked={disputeReasonIdx === i} onChange={() => setDisputeReasonIdx(i)}
                  style={{ width: 16, height: 16, accentColor: "#d97706", cursor: "pointer" }} />
                <span style={{ fontSize: 14, color: "#374151" }}>{reason}</span>
              </label>
            ))}
            <textarea
              value={disputeDetail}
              onChange={(e) => setDisputeDetail(e.target.value)}
              placeholder="상세 내용을 입력해주세요 (선택)"
              rows={3}
              style={{ width: "100%", marginTop: 12, borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleDisputeSubmit} disabled={disputeSubmitting} style={{
                flex: 1, height: 44, borderRadius: 10, border: "none",
                background: disputeSubmitting ? "#d1d5db" : "#d97706",
                color: "white", fontSize: 14, fontWeight: 700, cursor: disputeSubmitting ? "not-allowed" : "pointer",
              }}>{disputeSubmitting ? "접수 중..." : "신고 접수"}</button>
              <button onClick={() => setDisputeModalOpen(false)} style={{
                flex: 1, height: 44, borderRadius: 10, border: "1px solid #d1d5db", background: "white",
                color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 취소 모달 ─── */}
      {cancelModalOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 24, maxWidth: 440, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginBottom: 4 }}>의뢰 취소</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>취소 사유를 선택해주세요.</div>
            {CANCEL_REASONS.map((reason, i) => (
              <label key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 0", borderBottom: i < CANCEL_REASONS.length - 1 ? "1px solid #f3f4f6" : "none", cursor: "pointer" }}>
                <input type="radio" name="cancelReason" checked={cancelReasonIdx === i} onChange={() => setCancelReasonIdx(i)}
                  style={{ width: 16, height: 16, accentColor: "#dc2626", cursor: "pointer" }} />
                <span style={{ fontSize: 14, color: "#374151" }}>{reason}</span>
              </label>
            ))}
            {cancelReasonIdx === CANCEL_REASONS.length - 1 && (
              <textarea value={cancelReasonOther} onChange={(e) => setCancelReasonOther(e.target.value)}
                placeholder="직접 입력하세요" rows={2}
                style={{ width: "100%", marginTop: 10, borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, boxSizing: "border-box", outline: "none", fontFamily: "inherit", resize: "vertical" }} />
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={handleCancel} disabled={negSubmitting} style={{
                flex: 1, height: 44, borderRadius: 10, border: "none",
                background: negSubmitting ? "#d1d5db" : "#dc2626",
                color: "white", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
              }}>{negSubmitting ? "처리 중..." : "확인"}</button>
              <button onClick={() => setCancelModalOpen(false)} style={{
                flex: 1, height: 44, borderRadius: 10, border: "1px solid #d1d5db", background: "white",
                color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
