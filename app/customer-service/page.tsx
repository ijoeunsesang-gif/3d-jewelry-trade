"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { showError, showSuccess } from "../lib/toast";

interface Notice {
  id: string;
  title: string;
  content: string;
  created_at: string;
}

const FAQ_LIST = [
  {
    q: "?Œì¼ ?•ì‹?€ ?´ë–¤ ê²ƒì´ ì§€?ë˜?˜ìš”?",
    a: "STL, OBJ, 3DM ?•ì‹??3D ëª¨ë¸ ?Œì¼ê³?ZIP, PDF ë³´ì¡° ?Œì¼??ì§€?í•©?ˆë‹¤.",
  },
  {
    q: "ê²°ì œ ???˜ë¶ˆ??ê°€?¥í•œê°€??",
    a: "?”ì????Œì¼ ?¹ì„±???¤ìš´ë¡œë“œ ?„ë£Œ ?„ì—???˜ë¶ˆ???´ë µ?µë‹ˆ?? ?Œì¼???¬ê°??ê²°í•¨???ˆì„ ê²½ìš° ê³ ê°?¼í„°ë¡?ë¬¸ì˜??ì£¼ì„¸??",
  },
  {
    q: "êµ¬ë§¤???Œì¼?€ ?´ë””???¤ìš´ë¡œë“œ?˜ë‚˜??",
    a: "?ë‹¨ ë©”ë‰´??'???¤ìš´ë¡œë“œ' ?˜ì´ì§€?ì„œ êµ¬ë§¤??ëª¨ë“  ?Œì¼???¤ìš´ë¡œë“œ?????ˆìŠµ?ˆë‹¤.",
  },
  {
    q: "ëª¨ë¸???…ë¡œ?œí•˜ê³??ë§¤?˜ë ¤ë©??´ë–»ê²??˜ë‚˜??",
    a: "ë¡œê·¸?????ë‹¨ MY ë©”ë‰´ ??'?…ë¡œ?? ?ì„œ ëª¨ë¸ ?Œì¼ê³??¸ë„¤???´ë?ì§€ë¥??±ë¡?˜ë©´ ì¦‰ì‹œ ?ë§¤ê°€ ?œì‘?©ë‹ˆ??",
  },
  {
    q: "?ë§¤ ?˜ìµ?€ ?¸ì œ ?•ì‚°?˜ë‚˜??",
    a: "ë§¤ì›” ë§ì¼ ê¸°ì??¼ë¡œ ?•ì‚°?˜ë©°, ?µì›” 15???´ë‚´???±ë¡??ê³„ì¢Œë¡??…ê¸ˆ?©ë‹ˆ?? ?ì„¸???´ìš©?€ 1:1 ë¬¸ì˜ë¡??°ë½??ì£¼ì„¸??",
  },
  {
    q: "?¤ë¥¸ ?¬ëŒ??ëª¨ë¸??ë¬´ë‹¨?¼ë¡œ ?¬ìš©?????ˆë‚˜??",
    a: "?„ë‹ˆ?? ?ë§¤??ëª¨ë¸???€?‘ê¶Œ?€ ???œì‘?ì—ê²??ˆìœ¼ë©? êµ¬ë§¤?ëŠ” ê°œì¸ ?¬ìš© ëª©ì ?¼ë¡œë§??´ìš©?????ˆìŠµ?ˆë‹¤.",
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
    if (!inqTitle.trim()) { showError("?œëª©???…ë ¥??ì£¼ì„¸??"); return; }
    if (!inqContent.trim()) { showError("?´ìš©???…ë ¥??ì£¼ì„¸??"); return; }
    if (!userId) { showError("ë¡œê·¸????ë¬¸ì˜?˜ì‹¤ ???ˆìŠµ?ˆë‹¤."); return; }

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
      showSuccess("ë¬¸ì˜ê°€ ?‘ìˆ˜?˜ì—ˆ?µë‹ˆ?? ë¹ ë¥¸ ?œì¼ ?´ì— ?µë??œë¦¬ê² ìŠµ?ˆë‹¤.");
      setInqTitle("");
      setInqContent("");
    } catch {
      showError("ë¬¸ì˜ ?„ì†¡ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.");
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
      <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, color: "#111827" }}>ê³ ê°?¼í„°</h1>
      <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 16 }}>
        ê³µì??¬í•­ ?•ì¸, ?ì£¼ ë¬»ëŠ” ì§ˆë¬¸, 1:1 ë¬¸ì˜ë¥??´ìš©?˜ì‹¤ ???ˆìŠµ?ˆë‹¤.
      </p>

      {/* ?€?€ ê³µì??¬í•­ ?€?€ */}
      <Section title="ê³µì??¬í•­">
        {notices.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 15, margin: 0 }}>?±ë¡??ê³µì??¬í•­???†ìŠµ?ˆë‹¤.</p>
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
                    {expandedNotice === n.id ? "?? : "+"}
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

      {/* ?€?€ FAQ ?€?€ */}
      <Section title="?ì£¼ ë¬»ëŠ” ì§ˆë¬¸ (FAQ)">
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
                  {openFaq === idx ? "?? : "+"}
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

      {/* ?€?€ 1:1 ë¬¸ì˜ ?€?€ */}
      <Section title="1:1 ë¬¸ì˜">
        {!userId ? (
          <div style={{
            padding: "28px 20px",
            background: "#f9fafb",
            borderRadius: 16,
            textAlign: "center",
            border: "1px solid #e5e7eb",
          }}>
            <p style={{ margin: 0, fontSize: 16, color: "#6b7280" }}>
              1:1 ë¬¸ì˜??ë¡œê·¸?????´ìš©?˜ì‹¤ ???ˆìŠµ?ˆë‹¤.
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
                ?œëª©
              </label>
              <input
                value={inqTitle}
                onChange={(e) => setInqTitle(e.target.value)}
                placeholder="ë¬¸ì˜ ?œëª©???…ë ¥?˜ì„¸??
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: "block", fontWeight: 800, fontSize: 15, color: "#111827", marginBottom: 8 }}>
                ?´ìš©
              </label>
              <textarea
                value={inqContent}
                onChange={(e) => setInqContent(e.target.value)}
                placeholder="ë¬¸ì˜ ?´ìš©???ì„¸???…ë ¥??ì£¼ì„¸??
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
              {submitting ? "?„ì†¡ ì¤?.." : "ë¬¸ì˜ ?„ì†¡"}
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
