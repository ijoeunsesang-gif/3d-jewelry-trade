"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { showError, showSuccess } from "../lib/toast";

interface Notice {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const FAQ_LIST = [
  {
    q: "파일 형식은 어떤 것이 지원되나요?",
    a: "STL, OBJ, 3DM 형식의 3D 모델 파일과 ZIP, PDF 보조 파일을 지원합니다.",
  },
  {
    q: "결제 후 환불이 가능한가요?",
    a: "디지털 파일 특성상 다운로드 완료 후에는 환불이 어렵습니다. 파일에 심각한 결함이 있을 경우 고객센터로 문의해 주세요.",
  },
  {
    q: "구매한 파일은 어디서 다운로드하나요?",
    a: "상단 메뉴의 '내 다운로드' 페이지에서 구매한 모든 파일을 다운로드할 수 있습니다.",
  },
  {
    q: "모델을 업로드하고 판매하려면 어떻게 하나요?",
    a: "로그인 후 상단 MY 메뉴 → '업로드' 에서 모델 파일과 썸네일 이미지를 등록하면 즉시 판매가 시작됩니다.",
  },
  {
    q: "판매 수익은 언제 정산되나요?",
    a: "매월 말일 기준으로 정산되며, 익월 15일 이내에 등록된 계좌로 입금됩니다. 자세한 내용은 1:1 문의로 연락해 주세요.",
  },
  {
    q: "다른 사람의 모델을 무단으로 사용할 수 있나요?",
    a: "아니요. 판매된 모델의 저작권은 원 제작자에게 있으며, 구매자는 개인 사용 목적으로만 이용할 수 있습니다.",
  },
];

export default function CustomerServicePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [expandedNotice, setExpandedNotice] = useState<string | null>(null);

  const [inqTitle, setInqTitle] = useState("");
  const [inqContent, setInqContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState("");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    fetchNotices();
    fetchUser();
  }, []);

  const fetchNotices = async () => {
    const { data } = await supabase
      .from("notices")
      .select("id, title, content, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotices(data || []);
  };

  const fetchUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUserEmail(session?.user?.email || "");
    setUserId(session?.user?.id || "");
  };

  const handleInquirySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!inqTitle.trim()) { showError("제목을 입력해 주세요."); return; }
    if (!inqContent.trim()) { showError("내용을 입력해 주세요."); return; }
    if (!userId) { showError("로그인 후 문의하실 수 있습니다."); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("inquiries").insert({
        user_id: userId,
        user_email: userEmail,
        title: inqTitle.trim(),
        content: inqContent.trim(),
        status: "pending",
      });
      if (error) throw error;
      showSuccess("문의가 접수되었습니다. 빠른 시일 내에 답변드리겠습니다.");
      setInqTitle("");
      setInqContent("");
    } catch {
      showError("문의 전송 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  return (
    <main style={{
      maxWidth: 860,
      margin: "0 auto",
      padding: "36px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, color: "#111827" }}>고객센터</h1>
      <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 16 }}>
        공지사항 확인, 자주 묻는 질문, 1:1 문의를 이용하실 수 있습니다.
      </p>

      {/* ── 공지사항 ── */}
      <Section title="공지사항">
        {notices.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 15, margin: 0 }}>등록된 공지사항이 없습니다.</p>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {notices.map((n) => (
              <div
                key={n.id}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: 16,
                  overflow: "hidden",
                  background: "white",
                }}
              >
                <button
                  type="button"
                  onClick={() => setExpandedNotice(expandedNotice === n.id ? null : n.id)}
                  style={{
                    width: "100%", display: "flex", alignItems: "center",
                    justifyContent: "space-between", gap: 12,
                    padding: "16px 20px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{n.title}</div>
                    <div style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>{formatDate(n.created_at)}</div>
                  </div>
                  <span style={{ fontSize: 22, color: "#9ca3af", flexShrink: 0 }}>
                    {expandedNotice === n.id ? "−" : "+"}
                  </span>
                </button>
                {expandedNotice === n.id && (
                  <div style={{
                    padding: "0 20px 18px",
                    fontSize: 15, color: "#374151", lineHeight: 1.7,
                    borderTop: "1px solid #f3f4f6",
                    whiteSpace: "pre-wrap",
                  }}>
                    {n.content}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── FAQ ── */}
      <Section title="자주 묻는 질문 (FAQ)">
        <div style={{ display: "grid", gap: 10 }}>
          {FAQ_LIST.map((item, idx) => (
            <div
              key={idx}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                overflow: "hidden",
                background: "white",
              }}
            >
              <button
                type="button"
                onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                style={{
                  width: "100%", display: "flex", alignItems: "center",
                  justifyContent: "space-between", gap: 12,
                  padding: "16px 20px", background: "none", border: "none",
                  cursor: "pointer", textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>Q. {item.q}</span>
                <span style={{ fontSize: 22, color: "#9ca3af", flexShrink: 0 }}>
                  {openFaq === idx ? "−" : "+"}
                </span>
              </button>
              {openFaq === idx && (
                <div style={{
                  padding: "0 20px 18px",
                  fontSize: 15, color: "#374151", lineHeight: 1.7,
                  borderTop: "1px solid #f3f4f6",
                }}>
                  A. {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* ── 1:1 문의 ── */}
      <Section title="1:1 문의">
        {!userId ? (
          <div style={{
            padding: "28px 20px",
            background: "#f9fafb",
            borderRadius: 16,
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}>
            <p style={{ margin: 0, fontSize: 16, color: "#6b7280" }}>
              1:1 문의는 로그인 후 이용하실 수 있습니다.
            </p>
          </div>
        ) : (
          <form
            onSubmit={handleInquirySubmit}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 20,
              padding: "24px 20px",
              background: "white",
              display: "grid",
              gap: 16,
            }}
          >
            <div>
              <label style={{ display: "block", fontWeight: 800, fontSize: 15, color: "#111827", marginBottom: 8 }}>
                제목
              </label>
              <input
                value={inqTitle}
                onChange={(e) => setInqTitle(e.target.value)}
                placeholder="문의 제목을 입력하세요"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 800, fontSize: 15, color: "#111827", marginBottom: 8 }}>
                내용
              </label>
              <textarea
                value={inqContent}
                onChange={(e) => setInqContent(e.target.value)}
                placeholder="문의 내용을 자세히 입력해 주세요"
                rows={6}
                style={{ ...inputStyle, height: "auto", padding: "14px", resize: "vertical" }}
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{
                height: 54, borderRadius: 16, border: "none",
                background: "#111827", color: "white",
                fontWeight: 900, fontSize: 17, cursor: "pointer",
              }}
            >
              {submitting ? "전송 중..." : "문의 전송"}
            </button>
          </form>
        )}
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 40 }}>
      <h2 style={{ margin: "0 0 16px", fontSize: 26, fontWeight: 900, color: "#111827" }}>{title}</h2>
      {children}
    </section>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 52,
  borderRadius: 14,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  outline: "none",
  fontSize: 15,
  boxSizing: "border-box",
  fontFamily: "inherit",
};
