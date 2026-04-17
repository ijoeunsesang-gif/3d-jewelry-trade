"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../lib/toast";

interface Inquiry {
  id: string;
  user_email: string;
  title: string;
  content: string;
  status: string;
  answer: string | null;
  created_at: string;
  answered_at: string | null;
}

const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "";

export default function AdminPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "answered">("all");

  useEffect(() => {
    checkAdmin();
  }, []);

  const checkAdmin = async () => {
    const token = getAccessToken();
    const email = token ? ((decodeJwt(token) as any)?.email || "") : "";
    if (!email || email !== ADMIN_EMAIL) {
      router.replace("/");
      return;
    }
    setAuthorized(true);
    setLoading(false);
    fetchInquiries();
  };

  const fetchInquiries = async () => {
    const { data } = await supabase
      .from("inquiries")
      .select("*")
      .order("created_at", { ascending: false });
    setInquiries(data || []);
  };

  const handleReply = async (id: string) => {
    const answer = (replyText[id] || "").trim();
    if (!answer) { showError("답변 내용을 입력하세요."); return; }
    setSubmitting(id);
    try {
      const { error } = await supabase
        .from("inquiries")
        .update({ answer, status: "answered", answered_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      showSuccess("답변이 등록되었습니다.");
      setReplyText((prev) => ({ ...prev, [id]: "" }));
      fetchInquiries();
    } catch {
      showError("답변 저장 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(null);
    }
  };

  const filtered = inquiries.filter((inq) => {
    if (filter === "pending") return inq.status === "pending";
    if (filter === "answered") return inq.status === "answered";
    return true;
  });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("ko-KR", {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  if (loading) {
    return (
      <main style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "60vh" }}>
        <p style={{ color: "#6b7280", fontSize: 16 }}>권한 확인 중...</p>
      </main>
    );
  }

  if (!authorized) return null;

  return (
    <main style={{
      maxWidth: 960,
      margin: "0 auto",
      padding: "36px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <h1 style={{ margin: 0, fontSize: 36, fontWeight: 900, color: "#111827" }}>관리자 페이지</h1>
      <p style={{ margin: "8px 0 0", color: "#6b7280", fontSize: 15 }}>1:1 문의 관리</p>

      {/* 필터 */}
      <div style={{ display: "flex", gap: 8, marginTop: 28, flexWrap: "wrap" }}>
        {(["all", "pending", "answered"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            style={{
              height: 40, padding: "0 18px", borderRadius: 999,
              border: "1px solid #d1d5db", cursor: "pointer",
              fontWeight: 700, fontSize: 14,
              background: filter === f ? "#111827" : "white",
              color: filter === f ? "white" : "#374151",
            }}
          >
            {{ all: "전체", pending: "미답변", answered: "답변완료" }[f]}
            {f !== "all" && (
              <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.75 }}>
                ({inquiries.filter((i) => i.status === f).length})
              </span>
            )}
            {f === "all" && (
              <span style={{ marginLeft: 6, fontSize: 12, opacity: 0.75 }}>
                ({inquiries.length})
              </span>
            )}
          </button>
        ))}
        <button
          type="button"
          onClick={fetchInquiries}
          style={{
            height: 40, padding: "0 18px", borderRadius: 999,
            border: "1px solid #d1d5db", cursor: "pointer",
            fontWeight: 700, fontSize: 14,
            background: "white", color: "#374151",
            marginLeft: "auto",
          }}
        >
          새로고침
        </button>
      </div>

      {/* 문의 목록 */}
      <div style={{ display: "grid", gap: 12, marginTop: 20 }}>
        {filtered.length === 0 && (
          <p style={{ color: "#9ca3af", fontSize: 15 }}>문의가 없습니다.</p>
        )}
        {filtered.map((inq) => (
          <div
            key={inq.id}
            style={{
              border: `1px solid ${inq.status === "pending" ? "#fbbf24" : "#e5e7eb"}`,
              borderRadius: 18,
              overflow: "hidden",
              background: "white",
            }}
          >
            {/* 헤더 */}
            <button
              type="button"
              onClick={() => setExpanded(expanded === inq.id ? null : inq.id)}
              style={{
                width: "100%", display: "flex", alignItems: "center",
                justifyContent: "space-between", gap: 12,
                padding: "16px 20px", background: "none", border: "none",
                cursor: "pointer", textAlign: "left",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", height: 24,
                    padding: "0 10px", borderRadius: 999, fontSize: 12, fontWeight: 700,
                    background: inq.status === "pending" ? "#fef3c7" : "#d1fae5",
                    color: inq.status === "pending" ? "#92400e" : "#065f46",
                  }}>
                    {inq.status === "pending" ? "미답변" : "답변완료"}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inq.title}
                  </span>
                </div>
                <div style={{ marginTop: 6, fontSize: 13, color: "#9ca3af" }}>
                  {inq.user_email} · {formatDate(inq.created_at)}
                </div>
              </div>
              <span style={{ fontSize: 22, color: "#9ca3af", flexShrink: 0 }}>
                {expanded === inq.id ? "−" : "+"}
              </span>
            </button>

            {/* 상세 */}
            {expanded === inq.id && (
              <div style={{ padding: "0 20px 20px", borderTop: "1px solid #f3f4f6" }}>
                {/* 문의 내용 */}
                <div style={{
                  marginTop: 16, padding: 16,
                  background: "#f9fafb", borderRadius: 12,
                  fontSize: 15, color: "#374151", lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                }}>
                  {inq.content}
                </div>

                {/* 기존 답변 */}
                {inq.answer && (
                  <div style={{
                    marginTop: 12, padding: 16,
                    background: "#ecfdf5", borderRadius: 12,
                    fontSize: 15, color: "#065f46", lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                  }}>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 6 }}>
                      답변 · {inq.answered_at ? formatDate(inq.answered_at) : ""}
                    </div>
                    {inq.answer}
                  </div>
                )}

                {/* 답변 입력 */}
                <div style={{ marginTop: 16, display: "grid", gap: 10 }}>
                  <textarea
                    value={replyText[inq.id] || ""}
                    onChange={(e) => setReplyText((prev) => ({ ...prev, [inq.id]: e.target.value }))}
                    placeholder={inq.answer ? "답변을 수정하려면 입력하세요" : "답변을 입력하세요"}
                    rows={4}
                    style={{
                      width: "100%", borderRadius: 12, border: "1px solid #d1d5db",
                      padding: "12px 14px", fontSize: 15, outline: "none",
                      resize: "vertical", boxSizing: "border-box", fontFamily: "inherit",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => handleReply(inq.id)}
                    disabled={submitting === inq.id}
                    style={{
                      height: 48, borderRadius: 12, border: "none",
                      background: "#111827", color: "white",
                      fontWeight: 800, fontSize: 16, cursor: "pointer",
                    }}
                  >
                    {submitting === inq.id ? "저장 중..." : inq.answer ? "답변 수정" : "답변 등록"}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
