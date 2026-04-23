"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";

const GOLD = "#c9a84c";

const STATUS_LABEL: Record<string, string> = {
  open: "의뢰중", in_progress: "작업중", completed: "완료",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#2563eb", in_progress: "#d97706", completed: "#16a34a",
};
const STATUS_BG: Record<string, string> = {
  open: "#dbeafe", in_progress: "#fef3c7", completed: "#dcfce7",
};

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
  negotiation_status: string | null;
  negotiation_count: number;
  final_price: number | null;
  final_days: number | null;
  revision_count: number;
  cancel_reason: string | null;
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

async function sendNotification(
  userId: string,
  type: string,
  title: string,
  content: string,
  link: string,
) {
  await supabase.from("notifications").insert({
    user_id: userId, type, title, content, link, is_read: false,
  });
  window.dispatchEvent(new Event("notifications-updated"));
}

export default function CommissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [commission, setCommission] = useState<Commission | null>(null);
  const [loading, setLoading] = useState(true);
  const [myId, setMyId] = useState<string | null>(null);
  const [isSeller, setIsSeller] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [editResultLink, setEditResultLink] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [linkPanelOpen, setLinkPanelOpen] = useState(false);

  // 댓글
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);

  // 협의 관련
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);
  const [negLoading, setNegLoading] = useState(false);
  const [proposeOpen, setProposeOpen] = useState(false);
  const [proposePrice, setProposePrice] = useState("");
  const [proposeDays, setProposeDays] = useState("");
  const [proposeMsg, setProposeMsg] = useState("");
  const [negSubmitting, setNegSubmitting] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
  const fileUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const uid = (decodeJwt(token) as any)?.sub as string;
      setMyId(uid);
      supabase.from("profiles").select("role").eq("id", uid).single()
        .then(({ data }) => { setIsSeller(data?.role === "seller"); });
    }
    fetchCommission();
    fetchComments();
  }, [id]);

  const fetchCommission = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("commissions")
        .select("id, user_id, title, description, images, status, result_link, created_at, is_private, target_seller_id, desired_price, desired_days, negotiation_status, negotiation_count, final_price, final_days, revision_count, cancel_reason")
        .eq("id", id)
        .single();
      if (error || !data) return;

      const { data: profile } = await supabase
        .from("profiles").select("nickname").eq("id", data.user_id).single();
      const c: Commission = { ...data, nickname: profile?.nickname || "익명" };
      setCommission(c);
      setEditResultLink(c.result_link || "");

      if (data.is_private) fetchNegotiations();
    } finally {
      setLoading(false);
    }
  };

  const fetchNegotiations = async () => {
    setNegLoading(true);
    const { data } = await supabase
      .from("commission_negotiations")
      .select("*")
      .eq("commission_id", id)
      .order("round", { ascending: true });
    setNegotiations((data as Negotiation[]) || []);
    setNegLoading(false);
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const { data } = await supabase
        .from("commission_comments")
        .select("id, commission_id, user_id, content, created_at, profiles(nickname)")
        .eq("commission_id", id)
        .order("created_at", { ascending: false });
      setComments((data as Comment[]) || []);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!commission) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("commissions").update({
        result_link: editResultLink.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq("id", commission.id);
      if (error) throw error;
      setCommission((prev) => prev ? { ...prev, result_link: editResultLink.trim() || null } : prev);
      setLinkPanelOpen(false);
      showSuccess("저장되었습니다.");
    } catch (e: any) {
      showError(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!commission || !confirm("정말 삭제하시겠습니까?")) return;
    setDeleting(true);
    const { error } = await supabase.from("commissions").delete().eq("id", commission.id);
    if (error) { showError("삭제 실패"); setDeleting(false); return; }
    router.push("/commission");
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !myId) return;
    setSubmittingComment(true);
    try {
      const { error } = await supabase.from("commission_comments").insert({
        commission_id: id, user_id: myId, content: commentText.trim(),
      });
      if (error) throw error;
      setCommentText("");
      await fetchComments();
    } catch (e: any) {
      showError(e.message || "댓글 등록 실패");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    const { error } = await supabase.from("commission_comments").delete().eq("id", commentId);
    if (!error) setComments((prev) => prev.filter((c) => c.id !== commentId));
  };

  // ─── 협의 액션 ───

  const handleAccept = async () => {
    if (!commission) return;
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({
        negotiation_status: "agreed",
        final_price: commission.desired_price,
        final_days: commission.desired_days,
      }).eq("id", id);
      await Promise.all([
        sendNotification(commission.user_id, "negotiation", "협의 완료", "협의가 완료되었습니다.", `/commission/${id}`),
        sendNotification(commission.target_seller_id!, "negotiation", "협의 완료", "협의가 완료되었습니다.", `/commission/${id}`),
      ]);
      await fetchCommission();
    } catch { showError("처리 실패"); }
    setNegSubmitting(false);
  };

  const handlePropose = async (isInitial: boolean) => {
    if (!commission || !myId) return;
    const price = parseInt(proposePrice);
    const days = parseInt(proposeDays);
    if (!price || !days) { showError("비용과 기간을 입력해주세요."); return; }

    setNegSubmitting(true);
    try {
      const newCount = commission.negotiation_count + 1;
      const newRound = negotiations.length + 1;

      await supabase.from("commission_negotiations").insert({
        commission_id: id,
        proposer_id: myId,
        price,
        days,
        message: proposeMsg.trim(),
        round: newRound,
      });
      await supabase.from("commissions").update({
        negotiation_status: "negotiating",
        negotiation_count: newCount,
      }).eq("id", id);

      const isRequester = myId === commission.user_id;
      const targetId = isRequester ? commission.target_seller_id! : commission.user_id;
      const notifContent = isRequester
        ? "의뢰자가 재협의를 요청했습니다."
        : "판매자가 비용/기간을 제안했습니다.";
      const notifTitle = isRequester ? "재협의 요청" : "판매자 제안";
      await sendNotification(targetId, "negotiation", notifTitle, notifContent, `/commission/${id}`);

      setProposeOpen(false);
      setProposePrice("");
      setProposeDays("");
      setProposeMsg("");
      await fetchCommission();
      await fetchNegotiations();
    } catch { showError("제안 전송 실패"); }
    setNegSubmitting(false);
  };

  const handleAgreeNeg = async () => {
    if (!commission || !negotiations.length) return;
    const last = negotiations[negotiations.length - 1];
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({
        negotiation_status: "agreed",
        final_price: last.price,
        final_days: last.days,
      }).eq("id", id);
      await Promise.all([
        sendNotification(commission.user_id, "negotiation", "협의 완료", "협의가 완료되었습니다.", `/commission/${id}`),
        sendNotification(commission.target_seller_id!, "negotiation", "협의 완료", "협의가 완료되었습니다.", `/commission/${id}`),
      ]);
      await fetchCommission();
    } catch { showError("처리 실패"); }
    setNegSubmitting(false);
  };

  const handleCancel = async () => {
    if (!commission) return;
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({
        negotiation_status: "cancelled",
        cancel_reason: cancelReason.trim() || null,
      }).eq("id", id);
      const isRequester = myId === commission.user_id;
      const targetId = isRequester ? commission.target_seller_id! : commission.user_id;
      await sendNotification(targetId, "negotiation", "의뢰 취소", "의뢰가 취소되었습니다.", `/commission/${id}`);
      setCancelOpen(false);
      await fetchCommission();
    } catch { showError("취소 실패"); }
    setNegSubmitting(false);
  };

  const handleRevision = async () => {
    if (!commission) return;
    const newCount = commission.revision_count + 1;
    setNegSubmitting(true);
    try {
      await supabase.from("commissions").update({ revision_count: newCount }).eq("id", id);
      await sendNotification(
        commission.target_seller_id!,
        "revision", "수정 요청",
        `수정 요청이 왔습니다 (${newCount}/2회)`,
        `/commission/${id}`,
      );
      setCommission((prev) => prev ? { ...prev, revision_count: newCount } : prev);
      showSuccess("수정 요청이 전송되었습니다.");
    } catch { showError("수정 요청 실패"); }
    setNegSubmitting(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !commission) return;
    setNegSubmitting(true);
    try {
      const path = `commission-files/${commission.id}/${file.name}`;
      const { error } = await supabase.storage.from("commission-files").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("commission-files").getPublicUrl(path);
      setUploadedFileUrl(urlData.publicUrl);
      await supabase.from("commissions").update({
        negotiation_status: "completed",
        status: "completed",
      }).eq("id", id);
      await sendNotification(commission.user_id, "file_upload", "파일 업로드", "파일이 업로드되었습니다.", `/commission/${id}`);
      await fetchCommission();
      showSuccess("파일이 업로드되었습니다.");
    } catch { showError("파일 업로드 실패"); }
    setNegSubmitting(false);
    e.target.value = "";
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 20px", fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ height: 28, background: "#f3f4f6", borderRadius: 8, marginBottom: 20, width: "55%" }} />
        <div style={{ height: 360, background: "#f3f4f6", borderRadius: 14, marginBottom: 16 }} />
        <div style={{ height: 120, background: "#f3f4f6", borderRadius: 14 }} />
      </div>
    );
  }

  if (!commission) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "80px 20px", textAlign: "center", fontFamily: 'system-ui, sans-serif' }}>
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
  const negStatus = commission.negotiation_status;

  // 협의 중: 마지막 제안자 기준 차례 판별
  const lastNeg = negotiations.length > 0 ? negotiations[negotiations.length - 1] : null;
  const isMyTurnToRespond = commission.is_private && negStatus === "negotiating" && lastNeg
    ? lastNeg.proposer_id !== myId
    : false;

  const canCancel = commission.is_private && isAuthor &&
    (negStatus === "agreed" || negStatus === "completed" || negStatus === "negotiating" || negStatus === "pending");

  return (
    <div style={{
      maxWidth: 800, margin: "0 auto",
      padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <Link href="/commission" style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        color: "#6b7280", textDecoration: "none", fontSize: 14, marginBottom: 24,
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
            <span style={{
              flexShrink: 0, fontSize: 12, fontWeight: 700,
              color: STATUS_COLOR[commission.status] || "#374151",
              background: STATUS_BG[commission.status] || "#f3f4f6",
              padding: "4px 12px", borderRadius: 999,
            }}>
              {STATUS_LABEL[commission.status] || commission.status}
            </span>
            {commission.is_private && (
              <span style={{
                flexShrink: 0, fontSize: 12, fontWeight: 700,
                color: "#7c3aed", background: "#ede9fe",
                padding: "4px 12px", borderRadius: 999,
              }}>
                개인의뢰
              </span>
            )}
          </div>
          <div style={{ display: "flex", gap: 10, fontSize: 13, color: "#6b7280" }}>
            <span>{commission.nickname}</span>
            <span>·</span>
            <span>{formatDate(commission.created_at)}</span>
          </div>
        </div>
        {isSeller && !commission.is_private && (
          <button type="button" onClick={() => setLinkPanelOpen((p) => !p)} style={{
            flexShrink: 0, border: "1px solid #d1d5db", borderRadius: 10,
            padding: "8px 16px", background: "white",
            fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
          }}>
            🔗 결과물 링크 등록
          </button>
        )}
      </div>

      {/* 판매자 링크 패널 */}
      {isSeller && !commission.is_private && linkPanelOpen && (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, marginBottom: 20, background: "#fafafa" }}>
          <input type="url" value={editResultLink} onChange={(e) => setEditResultLink(e.target.value)}
            placeholder="https://..." style={{
              height: 44, borderRadius: 10, border: "1px solid #d1d5db",
              padding: "0 12px", fontSize: 14, width: "100%", boxSizing: "border-box", outline: "none",
            }} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{
              height: 38, padding: "0 20px", borderRadius: 10, border: "none",
              background: saving ? "#d1d5db" : GOLD, color: "white", fontSize: 13, fontWeight: 700,
              cursor: saving ? "not-allowed" : "pointer",
            }}>{saving ? "저장 중..." : "저장"}</button>
            <button type="button" onClick={() => setLinkPanelOpen(false)} style={{
              height: 38, padding: "0 16px", borderRadius: 10, border: "1px solid #d1d5db", background: "white",
              fontSize: 13, fontWeight: 700, cursor: "pointer", color: "#374151",
            }}>취소</button>
          </div>
        </div>
      )}

      {/* 이미지 갤러리 */}
      {commission.images && commission.images.length > 0 ? (
        <div style={{ marginBottom: 28 }}>
          <div style={{ width: "100%", aspectRatio: "16/9", borderRadius: 14, overflow: "hidden", background: "#f8fafc", marginBottom: 10 }}>
            <img src={commission.images[selectedImage]} alt={commission.title}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          {commission.images.length > 1 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {commission.images.map((img, i) => (
                <div key={i} onClick={() => setSelectedImage(i)} style={{
                  width: 64, height: 64, borderRadius: 8, overflow: "hidden", cursor: "pointer", flexShrink: 0,
                  border: selectedImage === i ? `2px solid ${GOLD}` : "2px solid transparent",
                }}>
                  <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{
          width: "100%", aspectRatio: "16/9", borderRadius: 14, background: "#f8fafc",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#d1d5db", fontSize: 48, marginBottom: 28,
        }}>📋</div>
      )}

      {/* 설명 */}
      {commission.description && (
        <div style={{
          background: "#f8fafc", borderRadius: 14, padding: "18px 20px",
          fontSize: 14, color: "#374151", lineHeight: 1.8, marginBottom: 28, whiteSpace: "pre-wrap",
        }}>
          {commission.description}
        </div>
      )}

      {/* ─── 개인 의뢰 협의 패널 ─── */}
      {commission.is_private && (isAuthor || isTargetSeller) && (
        <div style={{
          border: "1px solid #e5e7eb", borderRadius: 16, padding: 20,
          marginBottom: 28, background: "#fafafa",
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>
            개인 의뢰 협의
          </div>

          {/* ── pending ── */}
          {negStatus === "pending" && (
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

              {isTargetSeller && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <button onClick={handleAccept} disabled={negSubmitting} style={{
                    height: 44, borderRadius: 10, border: "none",
                    background: negSubmitting ? "#d1d5db" : "#111827",
                    color: "white", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                  }}>
                    수락하기 (희망 비용/기간 동의)
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

              {isAuthor && (
                <div style={{
                  padding: "14px 16px", borderRadius: 10, background: "#fffbeb",
                  border: "1px solid #fde68a", fontSize: 14, color: "#92400e", fontWeight: 600,
                }}>
                  판매자 응답 대기 중...
                </div>
              )}
            </>
          )}

          {/* ── negotiating ── */}
          {negStatus === "negotiating" && (
            <>
              {/* 협의 히스토리 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
                {negLoading ? (
                  <div style={{ fontSize: 13, color: "#9ca3af" }}>불러오는 중...</div>
                ) : negotiations.map((neg) => {
                  const isMine = neg.proposer_id === myId;
                  return (
                    <div key={neg.id} style={{
                      display: "flex", flexDirection: "column",
                      alignItems: isMine ? "flex-end" : "flex-start",
                    }}>
                      <div style={{
                        maxWidth: "80%", background: isMine ? "#111827" : "white",
                        color: isMine ? "white" : "#111827",
                        border: isMine ? "none" : "1px solid #e5e7eb",
                        borderRadius: isMine ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                        padding: "12px 14px",
                      }}>
                        <div style={{ display: "flex", gap: 12, marginBottom: neg.message ? 8 : 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>
                            {neg.price.toLocaleString()}원
                          </span>
                          <span style={{ fontSize: 13, fontWeight: 700 }}>
                            {neg.days}일
                          </span>
                          <span style={{ fontSize: 11, opacity: 0.6, alignSelf: "center" }}>
                            라운드 {neg.round}
                          </span>
                        </div>
                        {neg.message && (
                          <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{neg.message}</div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                        {formatDateTime(neg.created_at)}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 내 차례 입력 폼 */}
              {isMyTurnToRespond && (
                <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white" }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                    <input type="number" value={proposePrice} onChange={(e) => setProposePrice(e.target.value)}
                      placeholder={`비용 (원) - 이전: ${lastNeg?.price.toLocaleString()}`}
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                    <input type="number" value={proposeDays} onChange={(e) => setProposeDays(e.target.value)}
                      placeholder={`기간 (일) - 이전: ${lastNeg?.days}`}
                      style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                  </div>
                  <textarea value={proposeMsg} onChange={(e) => setProposeMsg(e.target.value)}
                    placeholder="메시지 (선택)" rows={2}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
                  <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                    <button onClick={handleAgreeNeg} disabled={negSubmitting} style={{
                      flex: 1, height: 40, borderRadius: 8, border: "none",
                      background: negSubmitting ? "#d1d5db" : "#16a34a",
                      color: "white", fontSize: 13, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                    }}>동의하기</button>
                    {commission.negotiation_count < 3 ? (
                      <button onClick={() => handlePropose(false)} disabled={negSubmitting} style={{
                        flex: 1, height: 40, borderRadius: 8, border: "none",
                        background: negSubmitting ? "#d1d5db" : "#111827",
                        color: "white", fontSize: 13, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                      }}>재제안</button>
                    ) : (
                      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#9ca3af" }}>
                        최대 협의 횟수 초과
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!isMyTurnToRespond && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 14, color: "#92400e", fontWeight: 600 }}>
                  상대방 응답 대기 중...
                </div>
              )}
            </>
          )}

          {/* ── agreed ── */}
          {negStatus === "agreed" && (
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
              {isAuthor && (
                <button disabled style={{
                  width: "100%", height: 44, borderRadius: 10, border: "none",
                  background: "#e5e7eb", color: "#9ca3af", fontSize: 14, fontWeight: 700, cursor: "not-allowed",
                }}>결제하기 (준비중)</button>
              )}
              {isTargetSeller && (
                <div style={{ padding: "12px 16px", borderRadius: 10, background: "#fffbeb", border: "1px solid #fde68a", fontSize: 14, color: "#92400e", fontWeight: 600 }}>
                  결제 대기 중...
                </div>
              )}
            </div>
          )}

          {/* ── completed ── */}
          {negStatus === "completed" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {isTargetSeller && (
                <>
                  <button onClick={() => fileUploadRef.current?.click()} disabled={negSubmitting} style={{
                    height: 44, borderRadius: 10, border: "1px dashed #d1d5db", background: "white",
                    color: "#374151", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                  }}>
                    {negSubmitting ? "업로드 중..." : "파일 업로드"}
                  </button>
                  <input ref={fileUploadRef} type="file" style={{ display: "none" }} onChange={handleFileUpload} />
                </>
              )}
              {isAuthor && (
                <div style={{ display: "flex", gap: 10 }}>
                  {uploadedFileUrl && (
                    <a href={uploadedFileUrl} target="_blank" rel="noopener noreferrer" style={{
                      flex: 1, height: 44, borderRadius: 10, border: "none",
                      background: "#111827", color: "white", fontSize: 14, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none",
                    }}>파일 다운로드</a>
                  )}
                  {commission.revision_count < 2 && (
                    <button onClick={handleRevision} disabled={negSubmitting} style={{
                      flex: 1, height: 44, borderRadius: 10, border: "1px solid #d1d5db", background: "white",
                      color: "#374151", fontSize: 14, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                    }}>
                      수정 요청 ({commission.revision_count}/2회)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── cancelled ── */}
          {negStatus === "cancelled" && (
            <div style={{ padding: "14px 16px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", fontSize: 14, color: "#991b1b", fontWeight: 600 }}>
              취소된 의뢰입니다.
              {commission.cancel_reason && (
                <div style={{ marginTop: 6, fontSize: 13, fontWeight: 400, color: "#dc2626" }}>
                  사유: {commission.cancel_reason}
                </div>
              )}
            </div>
          )}

          {/* 협의 제안 입력창 (pending 상태 판매자 제안) */}
          {proposeOpen && negStatus === "pending" && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, background: "white", marginTop: 12 }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input type="number" value={proposePrice} onChange={(e) => setProposePrice(e.target.value)}
                  placeholder="비용 (원)" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
                <input type="number" value={proposeDays} onChange={(e) => setProposeDays(e.target.value)}
                  placeholder="기간 (일)" style={{ flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", padding: "0 10px", fontSize: 13, outline: "none" }} />
              </div>
              <textarea value={proposeMsg} onChange={(e) => setProposeMsg(e.target.value)}
                placeholder="메시지 (선택)" rows={2}
                style={{ width: "100%", borderRadius: 8, border: "1px solid #d1d5db", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => handlePropose(true)} disabled={negSubmitting} style={{
                  flex: 1, height: 40, borderRadius: 8, border: "none",
                  background: negSubmitting ? "#d1d5db" : "#111827",
                  color: "white", fontSize: 13, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                }}>제안 전송</button>
                <button onClick={() => setProposeOpen(false)} style={{
                  flex: 1, height: 40, borderRadius: 8, border: "1px solid #d1d5db", background: "white",
                  color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>취소</button>
              </div>
            </div>
          )}

          {/* 취소 요청 */}
          {canCancel && negStatus !== "cancelled" && (
            <div style={{ marginTop: 16, borderTop: "1px solid #f3f4f6", paddingTop: 14 }}>
              {!cancelOpen ? (
                <button onClick={() => setCancelOpen(true)} style={{
                  height: 36, padding: "0 16px", borderRadius: 8,
                  border: "1px solid #fca5a5", background: "white",
                  color: "#dc2626", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>취소 요청</button>
              ) : (
                <div>
                  <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="취소 사유 (선택)" rows={2}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #fca5a5", padding: "8px 10px", fontSize: 13, resize: "vertical", boxSizing: "border-box", outline: "none", fontFamily: "inherit", marginBottom: 8 }} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={handleCancel} disabled={negSubmitting} style={{
                      flex: 1, height: 38, borderRadius: 8, border: "none",
                      background: negSubmitting ? "#d1d5db" : "#dc2626",
                      color: "white", fontSize: 13, fontWeight: 700, cursor: negSubmitting ? "not-allowed" : "pointer",
                    }}>확인</button>
                    <button onClick={() => setCancelOpen(false)} style={{
                      flex: 1, height: 38, borderRadius: 8, border: "1px solid #d1d5db", background: "white",
                      color: "#374151", fontSize: 13, fontWeight: 700, cursor: "pointer",
                    }}>닫기</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 결과물 링크 */}
      {commission.result_link && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>결과물</div>
          <a href={commission.result_link} target="_blank" rel="noopener noreferrer" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 18px", borderRadius: 10,
            background: "#111827", color: "white",
            textDecoration: "none", fontSize: 13, fontWeight: 700,
          }}>결과물 보기 →</a>
        </div>
      )}

      {/* 작성자 삭제 버튼 */}
      {isAuthor && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 36 }}>
          <button type="button" onClick={handleDelete} disabled={deleting} style={{
            padding: "8px 18px", borderRadius: 8,
            border: "1px solid #fca5a5", background: "white",
            color: "#dc2626", fontSize: 13, fontWeight: 700,
            cursor: deleting ? "not-allowed" : "pointer",
          }}>
            {deleting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      )}

      {/* 댓글 섹션 (공개 의뢰만) */}
      {!commission.is_private && (
        <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 28 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>
            댓글 {comments.length}개
          </div>
          {myId ? (
            <div style={{ marginBottom: 24 }}>
              <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)}
                placeholder="댓글을 입력하세요" rows={3}
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
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(comment.created_at)}</span>
                      {myId === comment.user_id && (
                        <button type="button" onClick={() => handleDeleteComment(comment.id)} style={{
                          background: "none", border: "none", padding: 0,
                          color: "#d1d5db", fontSize: 11, cursor: "pointer", fontWeight: 700,
                        }}>삭제</button>
                      )}
                    </div>
                  </div>
                  <div style={{ fontSize: 14, color: "#374151", marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {comment.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
