"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

const GOLD = "#c9a84c";

type JobPost = {
  id: string;
  user_id: string;
  title: string;
  is_recruiting: boolean;
  is_closed: boolean;
  created_at: string;
  nickname: string;
};

export default function JobsPage() {
  const [posts, setPosts] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRecruiting, setIsRecruiting] = useState(true);
  const [search, setSearch] = useState("");
  const [myId, setMyId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const uid = (decodeJwt(token) as any)?.sub as string;
      setMyId(uid);
    }
  }, []);

  useEffect(() => {
    fetchPosts(isRecruiting);
  }, [isRecruiting]);

  const fetchPosts = async (recruiting: boolean) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("job_posts")
      .select("id, user_id, title, is_recruiting, is_closed, created_at, profiles(nickname)")
      .eq("is_recruiting", recruiting)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setPosts(
        (data as any[]).map((p) => ({
          ...p,
          nickname: (p.profiles as any)?.nickname || "익명",
        }))
      );
    }
    setLoading(false);
  };

  const filtered = search.trim()
    ? posts.filter((p) => p.title.toLowerCase().includes(search.trim().toLowerCase()))
    : posts;

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  return (
    <main style={{
      maxWidth: 760, margin: "0 auto", padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>구인구직</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>3D 주얼리 분야 구인·구직 정보를 공유하세요</p>
        </div>
        <Link href="/jobs/new" style={{
          display: "inline-flex", alignItems: "center",
          padding: "10px 18px", borderRadius: 10,
          background: "#111827", color: GOLD,
          textDecoration: "none", fontSize: 14, fontWeight: 700, flexShrink: 0,
        }}>
          + 글 등록
        </Link>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid #e5e7eb" }}>
        {[{ label: "구인", value: true }, { label: "구직", value: false }].map(({ label, value }) => (
          <button
            key={label}
            onClick={() => { setIsRecruiting(value); setSearch(""); }}
            style={{
              background: "none", border: "none", padding: "10px 24px",
              fontSize: 15, fontWeight: 700, cursor: "pointer",
              color: isRecruiting === value ? "#111827" : "#6b7280",
              borderBottom: isRecruiting === value ? `2px solid ${GOLD}` : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <input
        type="text"
        placeholder="제목 검색"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: "100%", height: 42, borderRadius: 10,
          border: "1.5px solid #e5e7eb", padding: "0 14px",
          fontSize: 14, outline: "none", boxSizing: "border-box",
          marginBottom: 16,
        }}
      />

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>불러오는 중...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
          <div style={{ fontWeight: 700 }}>게시글이 없습니다</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((post) => (
            <Link key={post.id} href={`/jobs/${post.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "white", borderRadius: 14,
                border: "1px solid #e5e7eb", padding: "16px 20px",
                opacity: post.is_closed ? 0.55 : 1,
                transition: "box-shadow 0.15s",
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.09)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.04)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  {post.is_closed && (
                    <span style={{
                      fontSize: 11, fontWeight: 800, color: "#6b7280",
                      background: "#f3f4f6", border: "1px solid #d1d5db",
                      padding: "2px 8px", borderRadius: 999,
                    }}>마감</span>
                  )}
                  <span style={{
                    fontSize: 11, fontWeight: 800,
                    color: post.is_recruiting ? "#1d4ed8" : "#92400e",
                    background: post.is_recruiting ? "#dbeafe" : "#fef3c7",
                    padding: "2px 8px", borderRadius: 999,
                  }}>{post.is_recruiting ? "구인" : "구직"}</span>
                  <span style={{
                    fontSize: 15, fontWeight: 700, color: "#111827",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>{post.title}</span>
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", display: "flex", gap: 12 }}>
                  <span>{post.nickname}</span>
                  <span>{formatDate(post.created_at)}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
