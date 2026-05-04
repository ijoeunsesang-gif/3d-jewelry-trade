"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

const GOLD = "#c9a84c";

type AskPost = {
  id: string;
  title: string;
  is_solved: boolean;
  view_count: number;
  created_at: string;
  answer_count: number;
  nickname: string;
};

export default function AskPage() {
  const [posts, setPosts] = useState<AskPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [pointGuideOpen, setPointGuideOpen] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { setMyRole("guest"); return; }
    const uid = (decodeJwt(token) as any)?.sub as string;
    supabase.from("profiles").select("role").eq("id", uid).single()
      .then(({ data }) => setMyRole(data?.role || "user"));
  }, []);

  useEffect(() => {
    if (myRole === null) return;
    if (myRole !== "seller" && myRole !== "admin") return;
    fetchPosts();
  }, [myRole]);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("ask_posts")
      .select("id, title, is_solved, view_count, created_at, profiles(nickname)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      const postIds = (data as any[]).map((p) => p.id);
      const counts: Record<string, number> = {};
      if (postIds.length > 0) {
        const { data: answers } = await supabase
          .from("ask_answers")
          .select("post_id")
          .in("post_id", postIds);
        (answers || []).forEach((a: any) => {
          counts[a.post_id] = (counts[a.post_id] || 0) + 1;
        });
      }
      setPosts(
        (data as any[]).map((p) => ({
          id: p.id,
          title: p.title,
          is_solved: p.is_solved,
          view_count: p.view_count,
          created_at: p.created_at,
          nickname: (p.profiles as any)?.nickname || "익명",
          answer_count: counts[p.id] || 0,
        }))
      );
    }
    setLoading(false);
  };

  if (myRole !== null && myRole !== "seller" && myRole !== "admin") {
    return (
      <main style={{
        maxWidth: 640, margin: "0 auto", padding: "80px 20px",
        fontFamily: 'system-ui, sans-serif', textAlign: "center",
      }}>
        <div style={{ fontSize: 52, marginBottom: 16 }}>🔒</div>
        <h2 style={{ fontSize: 22, fontWeight: 900, color: "#111827", margin: "0 0 10px" }}>
          판매자만 이용 가능한 메뉴입니다
        </h2>
        <p style={{ color: "#6b7280", fontSize: 15, margin: "0 0 28px" }}>
          판매자 신청 후 이용해 주세요.
        </p>
        <Link href="/profile" style={{
          display: "inline-block", padding: "13px 30px",
          background: "#111827", color: GOLD, borderRadius: 12,
          fontWeight: 800, textDecoration: "none", fontSize: 15,
        }}>
          판매자 신청하기
        </Link>
      </main>
    );
  }

  const filtered = posts.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <main style={{
      maxWidth: 760, margin: "0 auto", padding: "32px 16px 96px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      {/* 헤더 */}
      <div style={{
        background: "#111827", borderRadius: 20, padding: "28px 24px",
        marginBottom: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 14,
      }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: "0.08em", marginBottom: 6 }}>
            SELLER Q&A
          </div>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, color: "white" }}>물어보기</h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "rgba(255,255,255,0.55)" }}>
            판매자끼리 질문하고 답변해요
          </p>
        </div>
        <Link href="/ask/new" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "12px 22px", borderRadius: 12,
          background: GOLD, color: "white", fontWeight: 800, fontSize: 15,
          textDecoration: "none", flexShrink: 0,
          boxShadow: "0 4px 14px rgba(201,168,76,0.4)",
        }}>
          ✏️ 질문하기
        </Link>
      </div>

      {/* 포인트 적립 안내 아코디언 */}
      <div style={{
        background: "#fdf8ec", border: "1px solid #f0d88a",
        borderRadius: 16, marginBottom: 16, overflow: "hidden",
      }}>
        <button
          onClick={() => setPointGuideOpen((v) => !v)}
          style={{
            width: "100%", padding: "14px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "transparent", border: "none", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: "#92400e" }}>
            💡 포인트 적립 안내
          </span>
          <span style={{
            fontSize: 18, color: GOLD,
            transform: pointGuideOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
          }}>▾</span>
        </button>
        {pointGuideOpen && (
          <div style={{ padding: "0 18px 18px", fontSize: 13, color: "#78350f", lineHeight: 1.9 }}>
            <div style={{ marginBottom: 10 }}>
              <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>적립 방법</strong>
              <div>• 답변 등록 (20자 이상): <strong style={{ color: GOLD }}>+5P</strong></div>
              <div>• 답변 채택: <strong style={{ color: GOLD }}>+20P</strong></div>
              <div>• 답변 좋아요 받기: <strong style={{ color: GOLD }}>+2P</strong></div>
            </div>
            <div style={{ marginBottom: 10 }}>
              <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>적립 제한</strong>
              <div>• 같은 질문에 첫 번째 답변만 포인트 지급</div>
              <div>• 해결된 질문(채택 완료)에 답변 시 포인트 미지급</div>
              <div>• 하루 최대 적립 한도: <strong>100P</strong></div>
              <div>• 포인트 유효기간: 적립일로부터 1년</div>
            </div>
            <div>
              <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>주의사항</strong>
              <div>• 복사/붙여넣기, 도배, 관련 없는 답변은 신고 대상</div>
              <div>• 신고 3회 이상 누적 시 포인트 회수 및 적립 차단</div>
              <div>• 차단 해제는 관리자에게 문의</div>
            </div>
          </div>
        )}
      </div>

      {/* 검색 */}
      <div style={{ position: "relative", marginBottom: 16 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="질문 검색..."
          style={{
            width: "100%", height: 48, borderRadius: 12,
            border: "1.5px solid #e5e7eb", padding: "0 16px 0 44px",
            fontSize: 15, outline: "none", boxSizing: "border-box",
            background: "white",
          }}
        />
        <span style={{
          position: "absolute", left: 14, top: "50%",
          transform: "translateY(-50%)", fontSize: 18, color: "#9ca3af",
        }}>🔍</span>
      </div>

      {/* 목록 */}
      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 15 }}>
          불러오는 중...
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af", fontSize: 15 }}>
          {search ? "검색 결과가 없습니다." : "아직 질문이 없습니다. 첫 질문을 등록해보세요!"}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((post) => (
            <Link key={post.id} href={`/ask/${post.id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "white", borderRadius: 14, padding: "18px 20px",
                border: "1px solid #e5e7eb", cursor: "pointer",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <span style={{
                    flexShrink: 0, padding: "3px 10px", borderRadius: 999,
                    fontSize: 12, fontWeight: 800,
                    background: post.is_solved ? "#dcfce7" : "#fefce8",
                    color: post.is_solved ? "#16a34a" : "#92400e",
                    border: `1px solid ${post.is_solved ? "#86efac" : "#fcd34d"}`,
                  }}>
                    {post.is_solved ? "✅ 해결됨" : "💬 미해결"}
                  </span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: "#111827", flex: 1, minWidth: 0 }}>
                    {post.title}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 14, marginTop: 10, fontSize: 13, color: "#9ca3af" }}>
                  <span>🙋 {post.nickname}</span>
                  <span>💬 {post.answer_count}</span>
                  <span>👁 {post.view_count}</span>
                  <span>{new Date(post.created_at).toLocaleDateString("ko-KR")}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
