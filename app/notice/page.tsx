"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Notice {
  id: string;
  title: string;
  is_pinned: boolean;
  created_at: string;
}

export default function NoticePage() {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNotices = async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/notices?select=id,title,is_pinned,created_at&order=is_pinned.desc,created_at.desc`,
          {
            headers: {
              apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!}`,
            },
          }
        );
        const data = await res.json();
        if (!res.ok) {
          console.error("[notices] 응답 오류:", data);
          setNotices([]);
          return;
        }
        setNotices(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error("[notices] 조회 실패:", e);
        setNotices([]);
      } finally {
        setLoading(false);
      }
    };
    fetchNotices();
  }, []);

  return (
    <main
      style={{
        maxWidth: 760,
        margin: "48px auto",
        padding: "0 20px 80px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: "#111827",
      }}
    >
      <h1 style={{ fontSize: 26, fontWeight: 900, marginBottom: 6 }}>공지사항</h1>
      <p style={{ color: "#9ca3af", fontSize: 14, marginBottom: 32 }}>
        서비스 관련 중요 안내를 확인하세요.
      </p>

      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#9ca3af" }}>
          불러오는 중...
        </div>
      ) : notices.length === 0 ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#9ca3af", fontSize: 15 }}>
          등록된 공지사항이 없습니다.
        </div>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {notices.map((notice, idx) => {
            const isPinned = notice.is_pinned;
            const isLastPinned =
              isPinned && (!notices[idx + 1] || !notices[idx + 1].is_pinned);
            return (
              <li key={notice.id}>
                <Link
                  href={`/notice/${notice.id}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px 4px",
                      borderBottom: isLastPinned
                        ? "2px solid #e5e7eb"
                        : "1px solid #f3f4f6",
                      background: isPinned ? "#fffbeb" : "white",
                      gap: 12,
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isPinned ? "#fef3c7" : "#f9fafb";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isPinned ? "#fffbeb" : "white";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {isPinned && (
                        <span style={{ fontSize: 16, flexShrink: 0 }}>📌</span>
                      )}
                      <span
                        style={{
                          fontSize: 15,
                          fontWeight: isPinned ? 800 : 600,
                          color: "#111827",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {notice.title}
                      </span>
                    </div>
                    <span style={{ fontSize: 13, color: "#9ca3af", flexShrink: 0 }}>
                      {new Date(notice.created_at).toLocaleDateString("ko-KR")}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
