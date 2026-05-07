"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

interface Notice {
  id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

export default function NoticeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchNotice = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notices?id=eq.${id}&select=*&limit=1`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
          }
        );
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setNotice(data[0]);
        } else {
          setNotFound(true);
        }
      } catch (e) {
        console.error("[notice detail] 조회 실패:", e);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchNotice();
  }, [id]);

  if (loading) {
    return (
      <main style={mainStyle}>
        <div style={{ padding: "80px 0", textAlign: "center", color: "#9ca3af" }}>
          불러오는 중...
        </div>
      </main>
    );
  }

  if (notFound || !notice) {
    return (
      <main style={mainStyle}>
        <div style={{ padding: "80px 0", textAlign: "center", color: "#9ca3af", fontSize: 15 }}>
          존재하지 않는 공지사항입니다.
        </div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button onClick={() => router.push("/notice")} style={backBtnStyle}>
            ← 목록으로
          </button>
        </div>
      </main>
    );
  }

  const isEdited =
    new Date(notice.updated_at).getTime() - new Date(notice.created_at).getTime() > 5000;

  return (
    <main style={mainStyle}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        {notice.is_pinned && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: "#d97706",
              background: "#fef3c7",
              padding: "3px 10px",
              borderRadius: 999,
              marginBottom: 10,
            }}
          >
            📌 중요 공지
          </span>
        )}
        <h1 style={{ fontSize: 24, fontWeight: 900, color: "#111827", margin: "0 0 10px" }}>
          {notice.title}
        </h1>
        <div style={{ display: "flex", gap: 14, fontSize: 13, color: "#9ca3af" }}>
          <span>{new Date(notice.created_at).toLocaleDateString("ko-KR")}</span>
          {isEdited && (
            <span>(수정됨: {new Date(notice.updated_at).toLocaleDateString("ko-KR")})</span>
          )}
        </div>
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", marginBottom: 28 }} />

      {/* 본문 */}
      <div
        style={{
          fontSize: 15,
          lineHeight: 1.9,
          color: "#374151",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          minHeight: 120,
        }}
      >
        {notice.content}
      </div>

      <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "36px 0 24px" }} />

      <button onClick={() => router.push("/notice")} style={backBtnStyle}>
        ← 목록으로
      </button>
    </main>
  );
}

const mainStyle: React.CSSProperties = {
  maxWidth: 760,
  margin: "48px auto",
  padding: "0 20px 80px",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  color: "#111827",
};

const backBtnStyle: React.CSSProperties = {
  height: 38,
  padding: "0 18px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "white",
  color: "#374151",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};
