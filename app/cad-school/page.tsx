"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase-browser";
import GradeBadge from "../components/GradeBadge";
import { Grade } from "@/lib/grades";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";

type Tab = "feedback" | "session" | "subscription";

const TABS: { key: Tab; label: string; desc: string }[] = [
  { key: "feedback",     label: "자유 피드백",  desc: "포인트로 CAD 질문 · 전문가 답변" },
  { key: "session",      label: "건별 멘토링",  desc: "1:1 맞춤 멘토링 단건 의뢰" },
  { key: "subscription", label: "구독 플랜",    desc: "월정액으로 멘토와 집중 학습" },
];

type Post = {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
  comment_count: number;
};

type Mentor = {
  id: string;
  intro: string;
  avg_rating: number;
  total_ratings: number;
  response_rate: number;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

export default function CadSchoolPage() {
  const [tab, setTab] = useState<Tab>("feedback");
  const [posts, setPosts] = useState<Post[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMentors, setLoadingMentors] = useState(true);

  useEffect(() => {
    loadPosts();
    loadMentors();
  }, []);

  const loadPosts = async () => {
    setLoadingPosts(true);
    const { data } = await supabase
      .from("cad_posts")
      .select("id, title, content, status, created_at, profiles(nickname, avatar_url, grade)")
      .order("created_at", { ascending: false })
      .limit(30);

    if (data) {
      const postsWithCount = await Promise.all(
        (data as unknown as Omit<Post, "comment_count">[]).map(async (p) => {
          const { count } = await supabase
            .from("cad_post_comments")
            .select("*", { count: "exact", head: true })
            .eq("post_id", p.id)
            .is("parent_id", null);
          return { ...p, comment_count: count ?? 0 };
        })
      );
      setPosts(postsWithCount);
    }
    setLoadingPosts(false);
  };

  const loadMentors = async () => {
    setLoadingMentors(true);
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, intro, avg_rating, total_ratings, response_rate, profiles(nickname, avatar_url, grade)")
      .eq("is_active", true)
      .eq("is_suspended", false)
      .order("avg_rating", { ascending: false });

    if (data) setMentors(data as unknown as Mentor[]);
    setLoadingMentors(false);
  };

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 헤더 배너 */}
      <div style={{ background: "#111827", borderRadius: 22, padding: "32px 36px", marginBottom: 28, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, letterSpacing: 2, marginBottom: 8 }}>CAD SCHOOL</div>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 900, color: "white", lineHeight: 1.2 }}>캐드스쿨</h1>
          <p style={{ margin: "10px 0 0", fontSize: 14, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
            질문 · 피드백 · 1:1 멘토링까지<br />주얼리 CAD 실력을 키워보세요
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
          <div style={{ background: "rgba(201,168,76,0.15)", border: `1px solid ${GOLD}44`, borderRadius: 12, padding: "10px 16px", fontSize: 12, color: GOLD, fontWeight: 700, textAlign: "center", lineHeight: 1.7 }}>
            질문 등록 무료 · 답변 채택 시 포인트 지급
          </div>
          <Link href="/cad-school/my" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, background: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.8)", textDecoration: "none", fontSize: 12, fontWeight: 700 }}>
            내 활동 보기
          </Link>
        </div>
      </div>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "white", borderRadius: 16, padding: 6, border: "1px solid #e5e7eb" }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{ flex: 1, padding: "10px 8px", borderRadius: 12, border: "none", background: tab === t.key ? "#111827" : "transparent", color: tab === t.key ? "white" : "#6b7280", fontWeight: tab === t.key ? 800 : 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 설명 */}
      <div style={{ background: GOLD_LIGHT, border: `1px solid ${GOLD}55`, borderRadius: 12, padding: "10px 16px", fontSize: 13, color: "#92681a", fontWeight: 600, marginBottom: 20 }}>
        {TABS.find((t) => t.key === tab)?.desc}
      </div>

      {tab === "feedback"     && <FeedbackTab posts={posts} loading={loadingPosts} />}
      {tab === "session"      && <MentorTab mentors={mentors} loading={loadingMentors} />}
      {tab === "subscription" && <SubscriptionTab />}
    </main>
  );
}

// ─ 구독 플랜 탭 ────────────────────────────────────────────
const PLANS = [
  {
    key: "basic",
    label: "BASIC",
    price: 19900,
    badge: null,
    features: [
      "멘토 1명 지정 (월 1회 교체 가능)",
      "질문 무제한",
      "STL 업로드 월 3개",
      "첨삭 월 2회",
      "실무 검수 월 2회",
      "답변 48시간 내 (주말·연휴 제외)",
    ],
    style: { bg: "white", border: "#e5e7eb", titleColor: "#111827", badgeBg: "", badgeText: "" },
  },
  {
    key: "pro",
    label: "PRO",
    price: 39900,
    badge: "추천",
    features: [
      "멘토 1명 지정 (월 2회 교체 가능)",
      "질문 무제한",
      "STL 업로드 월 10개",
      "첨삭 월 5회",
      "실무 검수 월 5회",
      "답변 36시간 내 (주말·연휴 제외)",
    ],
    style: { bg: GOLD_LIGHT, border: GOLD, titleColor: "#92400e", badgeBg: GOLD, badgeText: "white" },
  },
  {
    key: "master",
    label: "MASTER",
    price: 79000,
    badge: "프리미엄",
    features: [
      "멘토 1명 지정 (월 3회 교체 가능)",
      "질문 무제한",
      "STL 업로드 무제한",
      "첨삭 월 10회",
      "실무 검수 월 10회",
      "답변 24시간 내 (주말·연휴 제외)",
    ],
    style: { bg: "#111827", border: "#374151", titleColor: "white", badgeBg: "rgba(255,255,255,0.15)", badgeText: "rgba(255,255,255,0.9)" },
  },
] as const;

function SubscriptionTab() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>구독 플랜</h2>
        <Link href="/cad-school/mentor/register" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, background: "#111827", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
          🎓 멘토 등록
        </Link>
      </div>

      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px", marginBottom: 24, fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
        💡 월정액으로 멘토를 지정하고 집중적으로 학습하세요.
        멘토 수익의 80%가 멘토에게 지급됩니다.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 12 }}>
        {PLANS.map((plan) => {
          const isMaster = plan.key === "master";
          const featureColor = isMaster ? "rgba(255,255,255,0.75)" : "#6b7280";
          const checkColor = isMaster ? GOLD : "#16a34a";
          const dividerColor = isMaster ? "rgba(255,255,255,0.1)" : "#e5e7eb";
          return (
            <div
              key={plan.key}
              style={{ background: plan.style.bg, border: `1.5px solid ${plan.style.border}`, borderRadius: 20, padding: "24px 22px 22px", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}
            >
              {plan.badge && (
                <div style={{ position: "absolute", top: 16, right: 16, background: plan.style.badgeBg, color: plan.style.badgeText, fontSize: 11, fontWeight: 800, padding: "3px 10px", borderRadius: 20 }}>
                  {plan.badge}
                </div>
              )}
              <div style={{ fontSize: 13, fontWeight: 800, color: plan.style.titleColor, letterSpacing: 2, marginBottom: 6, opacity: 0.7 }}>{plan.label}</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: plan.style.titleColor, marginBottom: 4 }}>
                {plan.price.toLocaleString("ko-KR")}원
              </div>
              <div style={{ fontSize: 12, color: featureColor, marginBottom: 18 }}>/ 월</div>
              <div style={{ borderTop: `1px solid ${dividerColor}`, marginBottom: 16 }} />
              <ul style={{ margin: "0 0 20px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: featureColor, lineHeight: 1.5 }}>
                    <span style={{ color: checkColor, flexShrink: 0, fontWeight: 900, fontSize: 14 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/cad-school/subscribe/${plan.key}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 46, borderRadius: 14,
                  background: isMaster ? GOLD : plan.key === "pro" ? "#92400e" : "#111827",
                  color: "white", fontWeight: 900, fontSize: 14, textDecoration: "none",
                }}
              >
                구독하기
              </Link>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 12, color: "#9ca3af", textAlign: "center", marginTop: 8 }}>
        * 구독 취소 시 만료일까지 서비스가 유지됩니다. 멘토 수익의 80%가 멘토에게 지급됩니다.
      </p>
    </div>
  );
}

// ─ 자유 피드백 탭 ───────────────────────────────────────────
function FeedbackTab({ posts, loading }: { posts: Post[]; loading: boolean }) {
  const [showModal, setShowModal] = useState(false);
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>자유 피드백 게시판</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button type="button" onClick={() => setShowModal(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 10, border: `1px solid ${GOLD}88`, background: GOLD_LIGHT, color: "#92681a", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
            💡 포인트 상세설명
          </button>
          <Link href="/cad-school/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, background: GOLD, color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
            ✏️ 질문하기
          </Link>
        </div>
      </div>

      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
        💡 질문 등록 무료 · 답변 등록 시 <strong style={{ color: "#111827" }}>+50P</strong> · 채택 시 <strong style={{ color: GOLD }}>+300P</strong> · 일 최대 <strong style={{ color: "#111827" }}>1,000P</strong> / 월 최대 <strong style={{ color: "#111827" }}>10,000P</strong>
      </div>

      {loading ? <LoadingState /> : posts.length === 0 ? (
        <EmptyState icon="💬" title="아직 게시글이 없습니다" desc="첫 번째 질문을 올려보세요!" />
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {posts.map((post) => <PostCard key={post.id} post={post} />)}
        </div>
      )}

      {showModal && <PointInfoModal onClose={() => setShowModal(false)} />}
    </div>
  );
}

function PointInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 1000, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, padding: "28px 28px 24px", maxWidth: 420, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>캐드스쿨 포인트 안내</div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
        </div>
        <div style={{ background: "#fdf8ec", border: "1px solid #f0d88a", borderRadius: 16, padding: "16px 18px", fontSize: 13, color: "#78350f", lineHeight: 2 }}>
          <Section title="적립 방법">
            <Row icon="✅">답변 등록: 답변 1건당 <Gold>50P</Gold> 적립</Row>
            <Row icon="⭐">베스트 답변 채택: 채택 1건당 <Gold>300P</Gold> 적립</Row>
            <Row icon="🛒">모델 구매 시: 결제금액의 <Gold>2%</Gold> 자동 적립</Row>
            <Row icon="📅">일일 최대 적립 한도: <Gold>1,000P</Gold></Row>
            <Row icon="📌">월 최대 적립 한도: <Gold>10,000P</Gold></Row>
          </Section>
          <Section title="사용 방법">
            <Row icon="🛍️">모델 구매 시 포인트 사용 가능</Row>
            <Row icon="💳">1P = 1원</Row>
          </Section>
          <Section title="유의사항" last>
            <Row icon="❗">질문 등록은 무료입니다</Row>
            <Row icon="❗">캐드스쿨 포인트 일일 한도는 1,000P, 월 한도는 10,000P입니다</Row>
            <Row icon="❗">포인트는 모델 구매 시 최대 50% 사용 가능합니다</Row>
          </Section>
        </div>
        <button onClick={onClose} style={{ marginTop: 18, width: "100%", padding: "12px", borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>확인</button>
      </div>
    </div>
  );
}

function Section({ title, children, last }: { title: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div style={{ marginBottom: last ? 0 : 12 }}>
      <strong style={{ display: "block", marginBottom: 2, color: "#92400e" }}>{title}</strong>
      {children}
    </div>
  );
}
function Row({ icon, children }: { icon: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 6 }}><span>{icon}</span><span>{children}</span></div>;
}
function Gold({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: GOLD }}>{children}</strong>;
}

// ─ 건별 멘토링 탭 ───────────────────────────────────────────
function MentorTab({ mentors, loading }: { mentors: Mentor[]; loading: boolean }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>멘토 목록</h2>
        <Link href="/cad-school/mentor/register" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 12, background: "#111827", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none" }}>
          🎓 멘토 등록
        </Link>
      </div>
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 18px", marginBottom: 20, fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
        💡 멘토를 선택해 1:1 멘토링을 의뢰하세요. 멘토가 수락하면 파일을 공유하고 피드백을 받을 수 있습니다.
      </div>
      {loading ? <LoadingState /> : mentors.length === 0 ? (
        <EmptyState icon="🎓" title="등록된 멘토가 없습니다" desc="첫 번째 멘토로 등록해보세요!" />
      ) : (
        <div style={{ display: "grid", gap: 14 }}>
          {mentors.map((m) => <MentorCard key={m.id} mentor={m} />)}
        </div>
      )}
    </div>
  );
}

function MentorCard({ mentor }: { mentor: Mentor }) {
  return (
    <Link href={`/cad-school/mentor/${mentor.id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "18px 20px", cursor: "pointer", transition: "box-shadow 0.15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <Avatar url={mentor.profiles?.avatar_url} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{mentor.profiles?.nickname ?? "멘토"}</span>
              {mentor.profiles?.grade && <GradeBadge grade={mentor.profiles.grade as Grade} size="sm" />}
              {mentor.avg_rating > 0 && (
                <span style={{ fontSize: 12, color: GOLD, fontWeight: 700 }}>★ {mentor.avg_rating.toFixed(1)}</span>
              )}
            </div>
            <p style={{ margin: "0 0 8px", fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{mentor.intro || "소개글이 없습니다."}</p>
            {mentor.response_rate > 0 && (
              <span style={{ fontSize: 12, color: "#6b7280" }}>답변률 {mentor.response_rate.toFixed(0)}%</span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/cad-school/${post.id}`} style={{ textDecoration: "none" }}>
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.15s" }}
        onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
        onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              {post.status === "closed"
                ? <span style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", background: "#f3f4f6", padding: "2px 8px", borderRadius: 6 }}>마감</span>
                : <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", background: "#dcfce7", padding: "2px 8px", borderRadius: 6 }}>진행중</span>
              }
              <span style={{ fontSize: 16, fontWeight: 800, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</span>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.content}</p>
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", textAlign: "right", flexShrink: 0 }}>
            <div>💬 {post.comment_count}</div>
            <div style={{ marginTop: 4 }}>{timeAgo(post.created_at)}</div>
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar url={post.profiles?.avatar_url} size={20} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>{post.profiles?.nickname ?? "익명"}</span>
          {post.profiles?.grade && <GradeBadge grade={post.profiles.grade as Grade} size="sm" />}
        </div>
      </div>
    </Link>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <img src={url} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, color: "#9ca3af" }}>👤</div>
  );
}

function LoadingState() {
  return <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "60px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>불러오는 중...</div>;
}

function EmptyState({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "60px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 14 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: "#9ca3af" }}>{desc}</div>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}일 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}
