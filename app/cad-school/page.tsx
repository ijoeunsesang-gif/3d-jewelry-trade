"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import GradeBadge from "../components/GradeBadge";
import ReputationBadge from "../components/ReputationBadge";
import MentorNickname from "../components/MentorNickname";
import { Grade } from "@/lib/grades";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess, showInfo } from "../lib/toast";
import { GOLD } from "@/lib/constants";
import { EmptyState } from "../components/EmptyState";
import Image from "next/image";

const GOLD_LIGHT = "#fdf6e3";
const PER_PAGE = 10;

type Tab = "feedback" | "paid-feedback" | "mission" | "tips" | "subscription";

const TABS: { key: Tab; label: string; href?: string }[] = [
  { key: "feedback",      label: "자유 피드백" },
  { key: "paid-feedback", label: "유료 피드백" },
  { key: "mission",       label: "미션 게시판" },
  { key: "tips",          label: "멘토 팁/노하우",      href: "/cad-school/tips" },
  { key: "subscription",  label: "1:1 멘토(유료)" },
];

type Post = {
  id: string;
  title: string;
  content: string;
  status: string;
  created_at: string;
  user_id: string;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
  comment_count: number;
};

type Mentor = {
  id: string;
  user_id: string;
  intro: string;
  career_start_year: number | null;
  avg_rating: number;
  total_ratings: number;
  response_rate: number;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null; reputation_scores?: { score: number }[] | null } | null;
};

type MySubscription = {
  id: string;
  plan_type: string;
  status: string;
  expires_at: string | null;
  cad_revision_remaining: number | null;
  review_remaining: number | null;
  combo_remaining: number | null;
  mentor: { nickname: string | null } | null;
};

type MySession = {
  id: string;
  title: string | null;
  status: string;
  mentor_id: string;
  mentee_id: string;
  mentor_profile: { nickname: string | null } | null;
};

type MyActivePost = {
  id: string;
  title: string;
  status: string;
  comment_count: number;
};

const CURRENT_YEAR = new Date().getFullYear();

export default function CadSchoolPageWrapper() {
  return (
    <Suspense fallback={null}>
      <CadSchoolPage />
    </Suspense>
  );
}

function CadSchoolPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "feedback";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const [posts, setPosts] = useState<Post[]>([]);
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingMentors, setLoadingMentors] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  const [mySubscriptions, setMySubscriptions] = useState<MySubscription[]>([]);
  const [mySessions, setMySessions] = useState<MySession[]>([]);
  const [myActivePosts, setMyActivePosts] = useState<MyActivePost[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isMentor, setIsMentor] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    let uid: string | null = null;
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      uid = payload?.sub ?? null;
      setMyUserId(uid);
    }
    loadPosts();
    loadMentors();
    if (uid) {
      loadMyDashboard(uid);
      supabase.from("cad_mentors").select("id").eq("user_id", uid).eq("is_active", true).maybeSingle()
        .then(({ data }) => { if (data) setIsMentor(true); });
      supabase.from("profiles").select("role").eq("id", uid).maybeSingle()
        .then(({ data }) => { if (data?.role === "admin") setIsAdmin(true); });
    }
  }, []);

  const loadMyDashboard = async (uid: string) => {
    setLoadingDashboard(true);

    const [subRes, sessionRes] = await Promise.all([
      supabase
        .from("cad_subscriptions")
        .select("id, plan_type, status, expires_at, cad_revision_remaining, review_remaining, combo_remaining, mentor:profiles!mentor_id(nickname)")
        .eq("subscriber_id", uid)
        .eq("status", "active"),
      supabase
        .from("cad_mentoring_sessions")
        .select("id, title, status, mentor_id, mentee_id, mentor_profile:profiles!mentor_id(nickname)")
        .or(`mentee_id.eq.${uid},mentor_id.eq.${uid}`)
        .in("status", ["pending", "accepted"]),
    ]);

    if (subRes.data) {
      setMySubscriptions(subRes.data as unknown as MySubscription[]);
    }
    if (sessionRes.data) {
      setMySessions(sessionRes.data as unknown as MySession[]);
    }

    // 내 open 질문 중 답변이 달린 것
    const { data: myPostsData } = await supabase
      .from("cad_posts")
      .select("id, title, status")
      .eq("user_id", uid)
      .eq("status", "open")
      .limit(10);

    if (myPostsData && myPostsData.length > 0) {
      const postIds = myPostsData.map((p) => p.id);
      const { data: commentData } = await supabase
        .from("cad_post_comments")
        .select("post_id")
        .in("post_id", postIds)
        .is("parent_id", null);

      const countMap: Record<string, number> = {};
      (commentData ?? []).forEach((c: { post_id: string }) => {
        countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1;
      });

      setMyActivePosts(
        myPostsData
          .map((p) => ({ ...p, comment_count: countMap[p.id] ?? 0 }))
          .filter((p) => p.comment_count > 0)
      );
    }

    setLoadingDashboard(false);
  };

  const loadPosts = async () => {
    setLoadingPosts(true);
    const { data } = await supabase
      .from("cad_posts")
      .select("id, title, content, status, created_at, user_id, profiles(nickname, avatar_url, grade)")
      .order("created_at", { ascending: false });

    if (data) {
      const postList = data as unknown as Omit<Post, "comment_count">[];
      const postIds = postList.map((p) => p.id);

      const { data: commentData } = await supabase
        .from("cad_post_comments")
        .select("post_id")
        .in("post_id", postIds)
        .is("parent_id", null);

      const countMap: Record<string, number> = {};
      (commentData ?? []).forEach((c: { post_id: string }) => {
        countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1;
      });

      setPosts(postList.map((p) => ({ ...p, comment_count: countMap[p.id] ?? 0 })));
    }
    setLoadingPosts(false);
  };

  const loadMentors = async () => {
    setLoadingMentors(true);
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, user_id, intro, career_start_year, avg_rating, total_ratings, response_rate, profiles(nickname, avatar_url, grade)")
      .eq("is_active", true)
      .eq("is_suspended", false)
      .order("avg_rating", { ascending: false });

    if (data) setMentors(data as unknown as Mentor[]);
    setLoadingMentors(false);
  };

  const mentorUserIdToMentorId = mentors.reduce<Record<string, string>>((acc, m) => {
    acc[m.user_id] = m.id;
    return acc;
  }, {});

  const hasDashboard =
    myUserId !== null &&
    !loadingDashboard &&
    (mySubscriptions.length > 0 || mySessions.length > 0 || myActivePosts.length > 0);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 페이지 타이틀 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>캐드스쿨</h1>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>질문 · 피드백 · 1:1 멘토링</p>
        </div>
        <button type="button" onClick={() => setShowModal(true)} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 14px", borderRadius: 10, border: `1px solid ${GOLD}88`, background: GOLD_LIGHT, color: "#92681a", fontWeight: 700, fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
          💡 포인트 상세설명
        </button>
      </div>

      {/* 내 강의실 배너 */}
      <Link
        href="/cad-school/my"
        onClick={(e) => { if (!myUserId) { e.preventDefault(); showInfo("로그인 후 이용 가능합니다."); } }}
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 18px", borderRadius: 14, background: GOLD_LIGHT, border: `1px solid ${GOLD}66`, textDecoration: "none", marginBottom: 20 }}
      >
        <span style={{ fontSize: 15, fontWeight: 700, color: "#92681a" }}>
          📚 내 강의실 — 진행중인 수강·세션을 확인하세요
        </span>
        <span style={{ padding: "8px 16px", borderRadius: 10, background: "#c9a84c", color: "white", fontWeight: 800, fontSize: 13, border: "none", whiteSpace: "nowrap" }}>내 강의실 바로가기 →</span>
      </Link>

      {/* 내 강의실 섹션 */}
      {hasDashboard && (
        <MyDashboard
          subscriptions={mySubscriptions}
          sessions={mySessions}
          activePosts={myActivePosts}
        />
      )}

      {/* 탭 */}
      <style>{`
        .cad-tabs::-webkit-scrollbar { display: none; }
        .cad-tabs { scrollbar-width: none; -ms-overflow-style: none; overflow-x: auto; }
        .cad-tabs-wrapper::after {
          content: '';
          position: absolute;
          top: 0; right: 0; bottom: 0;
          width: 48px;
          background: linear-gradient(to right, transparent, white);
          border-radius: 0 16px 16px 0;
          pointer-events: none;
          z-index: 1;
        }
        @media (min-width: 769px) {
          .cad-tab-row { display: contents; }
        }
        @media (max-width: 768px) {
          .cad-tabs { flex-direction: column; overflow-x: visible !important; gap: 4px !important; }
          .cad-tab-row { display: flex; justify-content: center; gap: 8px; }
          .cad-tabs-wrapper::after { display: none; }
          .cad-svc-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <div className="cad-tabs-wrapper" style={{ position: "relative", marginBottom: 24 }}>
        <div className="cad-tabs" style={{ display: "flex", gap: 8, background: "white", borderRadius: 16, padding: 6, border: "1px solid #e5e7eb" }}>
          {/* 1행: 자유 피드백 / 미션 게시판 / 멘토 팁/노하우 */}
          <div className="cad-tab-row">
            {TABS.filter(t => ["feedback", "mission", "tips"].includes(t.key)).map((t) =>
              t.href ? (
                <Link key={t.key} href={t.href} style={{ flexShrink: 0, padding: "10px 8px", borderRadius: 12, background: "transparent", color: "#6b7280", fontWeight: 600, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap", textAlign: "center", transition: "all 0.15s" }}>
                  {t.label}
                </Link>
              ) : (
                <button key={t.key} type="button" onClick={() => router.push(`?tab=${t.key}&page=1`)} style={{ flexShrink: 0, padding: "10px 8px", borderRadius: 12, border: "none", background: tab === t.key ? "#111827" : "transparent", color: tab === t.key ? "white" : "#6b7280", fontWeight: tab === t.key ? 800 : 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  {t.label}
                </button>
              )
            )}
          </div>
          {/* 2행: 유료 피드백 / 1:1 멘토(유료) */}
          <div className="cad-tab-row">
            {TABS.filter(t => ["paid-feedback", "subscription"].includes(t.key)).map((t) =>
              t.href ? (
                <Link key={t.key} href={t.href} style={{ flexShrink: 0, padding: "10px 8px", borderRadius: 12, background: "transparent", color: "#6b7280", fontWeight: 600, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap", textAlign: "center", transition: "all 0.15s" }}>
                  {t.label}
                </Link>
              ) : (
                <button key={t.key} type="button" onClick={() => router.push(`?tab=${t.key}&page=1`)} style={{ flexShrink: 0, padding: "10px 8px", borderRadius: 12, border: "none", background: tab === t.key ? "#111827" : "transparent", color: tab === t.key ? "white" : "#6b7280", fontWeight: tab === t.key ? 800 : 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap" }}>
                  {t.label}
                </button>
              )
            )}
          </div>
        </div>
      </div>

{tab === "feedback"      && <FeedbackTab posts={posts} loading={loadingPosts} myUserId={myUserId} isAdmin={isAdmin} onDeleted={loadPosts} page={page} onPage={(p) => router.replace(`?tab=feedback&page=${p}`)} mentorUserIdToMentorId={mentorUserIdToMentorId} />}
      {tab === "paid-feedback" && <PaidFeedbackTab mentors={mentors} loadingMentors={loadingMentors} myUserId={myUserId} />}
      {tab === "mission"       && <MissionTab isMentor={isMentor} page={page} onPage={(p) => router.replace(`?tab=mission&page=${p}`)} />}
      {tab === "subscription"  && <PaidServiceTab />}

      {showModal && <PointInfoModal onClose={() => setShowModal(false)} />}
    </main>
  );
}

// ─ 내 강의실 섹션 ─────────────────────────────────────────────
function MyDashboard({
  subscriptions,
  sessions,
  activePosts,
}: {
  subscriptions: MySubscription[];
  sessions: MySession[];
  activePosts: MyActivePost[];
}) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 900, color: "#111827" }}>내 강의실</h2>
        <Link href="/cad-school/my" style={{ fontSize: 13, color: GOLD, fontWeight: 700, textDecoration: "none" }}>
          전체보기 →
        </Link>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {subscriptions.map((sub) => (
          <div key={sub.id} style={{ background: GOLD_LIGHT, border: `1.5px solid ${GOLD}66`, borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, marginBottom: 4 }}>
                수강 패키지 · {sub.plan_type?.toUpperCase()}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                멘토: {sub.mentor?.nickname ?? "—"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 12, flexWrap: "wrap" }}>
                {sub.expires_at && (
                  <span>만료일: {new Date(sub.expires_at).toLocaleDateString("ko-KR")}</span>
                )}
                {sub.cad_revision_remaining != null && <span>CAD수정 {sub.cad_revision_remaining}회</span>}
                {sub.review_remaining != null && <span>검수 {sub.review_remaining}회</span>}
                {sub.combo_remaining != null && <span>검수+CAD {sub.combo_remaining}회</span>}
              </div>
            </div>
            <Link href={`/cad-school/subscription/${sub.id}`} style={{ padding: "9px 18px", borderRadius: 12, background: GOLD, color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
              채팅방 바로가기
            </Link>
          </div>
        ))}

        {sessions.map((s) => (
          <div key={s.id} style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", marginBottom: 4 }}>건별 멘토링</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 }}>
                {s.title ?? "제목 없음"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 10, alignItems: "center" }}>
                <span>멘토: {s.mentor_profile?.nickname ?? "—"}</span>
                <SessionStatusBadge status={s.status} />
              </div>
            </div>
            <Link href={`/cad-school/session/${s.id}`} style={{ padding: "9px 18px", borderRadius: 12, background: "#111827", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
              세션 보기
            </Link>
          </div>
        ))}

        {activePosts.map((p) => (
          <div key={p.id} style={{ background: "white", border: "1.5px solid #dcfce7", borderRadius: 16, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 800, color: "#16a34a", marginBottom: 4 }}>새 답변</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{p.title}</div>
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>답변 {p.comment_count}개</div>
            </div>
            <Link href={`/cad-school/${p.id}`} style={{ padding: "9px 18px", borderRadius: 12, background: "#111827", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}>
              확인하기
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:  { label: "대기중", color: "#92681a", bg: GOLD_LIGHT },
    accepted: { label: "진행중", color: "#16a34a", bg: "#dcfce7" },
    closed:   { label: "완료",   color: "#6b7280", bg: "#f3f4f6" },
  };
  const s = map[status] ?? { label: status, color: "#6b7280", bg: "#f3f4f6" };
  return (
    <span style={{ fontSize: 11, fontWeight: 800, color: s.color, background: s.bg, borderRadius: 6, padding: "2px 7px" }}>
      {s.label}
    </span>
  );
}

// ─ 서비스 정의 ─────────────────────────────────────────────────
type FileItem = { name: string; url: string; ext: string };

type ServiceDef = {
  key: string;
  label: string;
  price: number;
  icon: string;
  description: string;
  hint: string;
  accept: string;
  acceptHint: string;
};

const SIMPLE_SERVICES: ServiceDef[] = [
  {
    key: "image_review",
    label: "이미지 검토",
    price: 3000,
    icon: "🖼",
    description: "작업 중인 디자인 이미지를 보내주시면 방향성, 비율, 디테일 등을 검토해드립니다.",
    hint: "💡 치수, 특정 부위, 방향성 등 질문할 부분을 구체적으로 적어주셔야 정확한 답변을 받으실 수 있습니다.",
    accept: "image/*",
    acceptHint: "이미지 파일만 첨부 가능",
  },
  {
    key: "file_review",
    label: "파일 검토",
    price: 5000,
    icon: "📂",
    description: "CAD 파일을 직접 열어 구조적 문제, 수정 필요 부분을 확인하고 피드백해드립니다.",
    hint: "💡 어떤 부분이 궁금한지 구체적으로 적어주시면 더 정확한 검토가 가능합니다.",
    accept: ".3dm,.stl,.obj",
    acceptHint: "3DM, STL, OBJ 첨부 가능",
  },
  {
    key: "file_edit",
    label: "파일 부분 수정",
    price: 10000,
    icon: "✏️",
    description: "간단한 부분 수정이 필요할 때 멘토가 직접 파일을 수정해서 전달해드립니다.",
    hint: "💡 정확한 부분을 알려주셔야 만족할 만한 결과물이 나옵니다.",
    accept: ".3dm",
    acceptHint: "3DM만 첨부 가능",
  },
];

const EXPERT_SERVICES: ServiceDef[] = [
  {
    key: "cad_revision",
    label: "CAD수정 질문",
    price: 19900,
    icon: "🔧",
    description: "멘토가 파일을 직접 수정해드립니다. 복잡한 구조 변경, 디테일 작업 등 전문적인 수정이 필요할 때 이용하세요.",
    hint: "💡 완성품으로의 전체 수정이 필요하신 경우 검수+CAD수정을 이용해주세요.",
    accept: ".3dm",
    acceptHint: "3DM만 첨부 가능",
  },
  {
    key: "review",
    label: "실무 검수 질문",
    price: 29900,
    icon: "🔍",
    description: "실제 제작/판매 가능 여부를 전문적으로 컨펌해드립니다. 출력, 주조, 세팅 등 실무 관점에서 꼼꼼히 검토합니다.",
    hint: "💡 검수 요청 시 제작 방법(출력/주조 등), 소재, 사이즈를 함께 알려주시면 더 정확한 검수가 가능합니다.",
    accept: ".3dm,.stl,.obj",
    acceptHint: "3DM, STL, OBJ 첨부 가능",
  },
  {
    key: "review_cad",
    label: "검수+CAD수정 질문",
    price: 49900,
    icon: "⚡",
    description: "실무 검수 후 수정까지 한 번에 해드립니다. 검수에서 발견된 문제를 바로 수정해서 완성본을 전달해드립니다.",
    hint: "💡 가장 완성도 높은 결과물이 필요할 때 추천드립니다.",
    accept: ".3dm",
    acceptHint: "3DM만 첨부 가능",
  },
];

function ServiceCard({ svc, onClick }: { svc: ServiceDef; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{ background: "#f8fafc", border: "1.5px solid #e5e7eb", borderRadius: 16, padding: "18px 16px", cursor: "pointer", textAlign: "left", transition: "border-color 0.15s", width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start" }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#111827")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#e5e7eb")}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 10, gap: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 17 }}>{svc.icon}</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{svc.label}</span>
        </div>
        <span style={{ fontSize: 13, fontWeight: 900, color: "#2563eb", flexShrink: 0 }}>{svc.price.toLocaleString("ko-KR")}원</span>
      </div>
      <div style={{ fontSize: 12, color: "#374151", lineHeight: 1.6, marginBottom: 10 }}>{svc.description}</div>
      <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{svc.hint}</div>
    </button>
  );
}

// ─ 유료 피드백 탭 ─────────────────────────────────────────────
function PaidFeedbackTab({ mentors, loadingMentors, myUserId }: { mentors: Mentor[]; loadingMentors: boolean; myUserId: string | null }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedSvc, setSelectedSvc] = useState<ServiceDef | null>(null);
  const [innerMentorTab, setInnerMentorTab] = useState<"used" | "all">("used");
  const [mentorSearch, setMentorSearch] = useState("");
  const [usedMentors, setUsedMentors] = useState<Mentor[]>([]);
  const [loadingUsed, setLoadingUsed] = useState(false);
  const [selectedMentor, setSelectedMentor] = useState<Mentor | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    if (!selectedSvc || !myUserId) return;
    setLoadingUsed(true);
    (async () => {
      const { data } = await supabase
        .from("cad_mentoring_sessions")
        .select("mentor_id, created_at")
        .eq("mentee_id", myUserId)
        .order("created_at", { ascending: false });
      if (!data || data.length === 0) { setUsedMentors([]); setLoadingUsed(false); return; }
      const seen = new Set<string>();
      const uniqueIds: string[] = [];
      for (const row of data) {
        if (!seen.has(row.mentor_id)) { seen.add(row.mentor_id); uniqueIds.push(row.mentor_id); }
      }
      const matched = uniqueIds.map(id => mentors.find(m => m.id === id)).filter(Boolean) as Mentor[];
      setUsedMentors(matched);
      setLoadingUsed(false);
    })();
  }, [selectedSvc, myUserId, mentors]);

  const openModal = (svc: ServiceDef) => {
    setSelectedSvc(svc);
    setInnerMentorTab("used");
    setMentorSearch("");
    setSelectedMentor(null);
    setTitle("");
    setDescription("");
    setFiles([]);
    setPaying(false);
  };

  const closeModal = () => setSelectedSvc(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (files.length + selected.length > 5) { showError("파일은 최대 5개까지 첨부 가능합니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/sessions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
      else showError(`업로드 실패: ${d.error || file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const requestPayment = async () => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (!selectedSvc || !selectedMentor) return;
    if (myUserId === selectedMentor.user_id) { showError("본인의 멘토링은 질문할 수 없습니다."); return; }
    if (!title.trim()) { showError("질문 제목을 입력해주세요."); return; }
    if (!description.trim()) { showError("질문 내용을 입력해주세요."); return; }

    const payload = decodeJwt(token) as { sub?: string } | null;
    const orderId = `cad-session-${Date.now()}`;

    localStorage.setItem("pendingCadPayment", JSON.stringify({
      type: "session",
      sessionType: selectedSvc.key,
      mentorId: selectedMentor.id,
      menteeId: payload?.sub,
      price: selectedSvc.price,
      title: title.trim(),
      description: description.trim(),
      files,
      orderId,
      orderName: `[캐드스쿨] ${selectedSvc.label}`,
    }));

    setPaying(true);
    router.push("/cad-school/payment");
  };

  const inputCss: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", marginBottom: 10 };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>유료 피드백</h2>
        <span style={{ fontSize: 13, color: "#6b7280" }}>서비스를 선택하고 멘토에게 질문하세요</span>
      </div>

      {/* 간단 피드백 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 10 }}>
          <span style={{ background: "#f3f4f6", borderRadius: 6, padding: "2px 8px" }}>간단 피드백</span>
        </div>
        <div className="cad-svc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {SIMPLE_SERVICES.map((svc) => <ServiceCard key={svc.key} svc={svc} onClick={() => openModal(svc)} />)}
        </div>
      </div>

      {/* 전문 질문 */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 10 }}>
          <span style={{ background: GOLD_LIGHT, color: "#92681a", borderRadius: 6, padding: "2px 8px", border: `1px solid ${GOLD}44` }}>전문 질문</span>
        </div>
        <div className="cad-svc-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {EXPERT_SERVICES.map((svc) => <ServiceCard key={svc.key} svc={svc} onClick={() => openModal(svc)} />)}
        </div>
      </div>

      {/* 질문 모달 */}
      {selectedSvc && (
        <div onClick={closeModal} style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 24, maxWidth: 768, width: "100%", minHeight: 600, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>

            {/* 모달 헤더 */}
            <div style={{ padding: "18px 24px 14px", borderBottom: "1px solid #e5e7eb", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20 }}>{selectedSvc.icon}</span>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#111827" }}>{selectedSvc.label} 질문</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#2563eb" }}>{selectedSvc.price.toLocaleString("ko-KR")}원</div>
                </div>
              </div>
              <button onClick={closeModal} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af", lineHeight: 1, padding: "0 4px" }}>×</button>
            </div>

            {/* 본문: 좌우 2단 */}
            <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

              {/* 좌측: 멘토 선택 */}
              <div style={{ width: "40%", borderRight: "1px solid #e5e7eb", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                {/* 검색창 */}
                <div style={{ padding: "14px 14px 8px" }}>
                  <input
                    value={mentorSearch}
                    onChange={(e) => setMentorSearch(e.target.value)}
                    placeholder="멘토 이름으로 검색"
                    style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 13, outline: "none", boxSizing: "border-box", fontFamily: "inherit" }}
                  />
                </div>
                {/* 탭 */}
                <div style={{ display: "flex", gap: 3, margin: "0 14px 10px", background: "#f3f4f6", borderRadius: 10, padding: 3 }}>
                  {(["used", "all"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setInnerMentorTab(t)}
                      style={{ flex: 1, padding: "7px", borderRadius: 8, border: "none", background: innerMentorTab === t ? "white" : "transparent", fontWeight: innerMentorTab === t ? 800 : 600, fontSize: 12, cursor: "pointer", color: innerMentorTab === t ? "#111827" : "#6b7280", boxShadow: innerMentorTab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none", transition: "all 0.15s" }}
                    >
                      {t === "used" ? "이용한 멘토" : "전체 멘토"}
                    </button>
                  ))}
                </div>
                {/* 멘토 목록 */}
                <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
                  {innerMentorTab === "used" ? (
                    loadingUsed ? (
                      <div style={{ padding: "30px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>불러오는 중...</div>
                    ) : usedMentors.length === 0 ? (
                      <div style={{ padding: "28px 0", textAlign: "center" }}>
                        <div style={{ fontSize: 32, marginBottom: 8 }}>🎓</div>
                        <div style={{ fontSize: 13, color: "#374151", fontWeight: 700, marginBottom: 4 }}>이용한 멘토가 없습니다</div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 12 }}>전체 멘토 탭에서 선택해보세요</div>
                        <button onClick={() => setInnerMentorTab("all")} style={{ fontSize: 12, color: "#2563eb", background: "none", border: "1px solid #bfdbfe", borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>전체 멘토 보기</button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {usedMentors
                          .filter((m) => !mentorSearch || (m.profiles?.nickname ?? "").includes(mentorSearch))
                          .map((m) => {
                            const careerYrs = m.career_start_year ? CURRENT_YEAR - m.career_start_year : null;
                            const isSelected = selectedMentor?.id === m.id;
                            return (
                              <div
                                key={m.id}
                                onClick={() => setSelectedMentor(m)}
                                style={{ background: isSelected ? "#eff6ff" : "#f8fafc", border: `1.5px solid ${isSelected ? "#3b82f6" : "#e5e7eb"}`, borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "left", width: "100%", transition: "border-color 0.15s", boxSizing: "border-box" }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#111827"; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#e5e7eb"; }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <Avatar url={m.profiles?.avatar_url} size={34} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                                        <MentorNickname
                                          mentorId={m.id}
                                          nickname={m.profiles?.nickname ?? "멘토"}
                                          isMentor={true}
                                          inModal={true}
                                          onSelectMentor={(data) => setSelectedMentor(data as unknown as Mentor)}
                                        />
                                      </span>
                                      {careerYrs !== null && <span style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", borderRadius: 4, padding: "1px 5px" }}>경력 {careerYrs}년</span>}
                                      {m.avg_rating > 0 && <span style={{ fontSize: 10, color: GOLD, fontWeight: 700 }}>★ {m.avg_rating.toFixed(1)}</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.intro || "소개글 없음"}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )
                  ) : (
                    loadingMentors ? (
                      <div style={{ padding: "30px 0", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>불러오는 중...</div>
                    ) : mentors.length === 0 ? (
                      <div style={{ padding: "24px 0", textAlign: "center", color: "#6b7280", fontSize: 13 }}>등록된 멘토가 없습니다</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {mentors
                          .filter((m) => !mentorSearch || (m.profiles?.nickname ?? "").includes(mentorSearch))
                          .map((m, i) => {
                            const careerYrs = m.career_start_year ? CURRENT_YEAR - m.career_start_year : null;
                            const isSelected = selectedMentor?.id === m.id;
                            const isRecommended = i < 3;
                            return (
                              <div
                                key={m.id}
                                onClick={() => setSelectedMentor(m)}
                                style={{ background: isSelected ? "#eff6ff" : "#f8fafc", border: `1.5px solid ${isSelected ? "#3b82f6" : "#e5e7eb"}`, borderRadius: 12, padding: "10px 12px", cursor: "pointer", textAlign: "left", width: "100%", transition: "border-color 0.15s", boxSizing: "border-box" }}
                                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#111827"; }}
                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.borderColor = "#e5e7eb"; }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <Avatar url={m.profiles?.avatar_url} size={34} />
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2, flexWrap: "wrap" }}>
                                      <span style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>
                                        <MentorNickname
                                          mentorId={m.id}
                                          nickname={m.profiles?.nickname ?? "멘토"}
                                          isMentor={true}
                                          inModal={true}
                                          onSelectMentor={(data) => setSelectedMentor(data as unknown as Mentor)}
                                        />
                                      </span>
                                      {careerYrs !== null && <span style={{ fontSize: 10, color: "#6b7280", background: "#f3f4f6", borderRadius: 4, padding: "1px 5px" }}>경력 {careerYrs}년</span>}
                                      {m.avg_rating > 0 && <span style={{ fontSize: 10, color: GOLD, fontWeight: 700 }}>★ {m.avg_rating.toFixed(1)}</span>}
                                      {isRecommended && <span style={{ fontSize: 10, fontWeight: 800, color: "#16a34a", background: "#dcfce7", borderRadius: 4, padding: "1px 5px" }}>추천</span>}
                                    </div>
                                    <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.intro || "소개글 없음"}</div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )
                  )}
                </div>
              </div>

              {/* 우측: 질문 입력 */}
              <div style={{ width: "60%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
                  {/* 선택된 멘토 */}
                  {selectedMentor ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 12, padding: "10px 14px", marginBottom: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Avatar url={selectedMentor.profiles?.avatar_url} size={32} />
                        <span style={{ fontSize: 14, fontWeight: 700, color: "#0c4a6e" }}>{selectedMentor.profiles?.nickname ?? "멘토"}</span>
                      </div>
                      <button onClick={() => setSelectedMentor(null)} style={{ fontSize: 12, color: "#6b7280", background: "none", border: "1px solid #d1d5db", borderRadius: 8, padding: "4px 10px", cursor: "pointer" }}>변경</button>
                    </div>
                  ) : (
                    <div style={{ background: "#f8fafc", border: "1.5px dashed #d1d5db", borderRadius: 12, padding: "14px", marginBottom: 14, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>
                      ← 왼쪽에서 멘토를 선택해주세요
                    </div>
                  )}

                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="질문 제목 (예: 링 CAD 디테일 피드백 요청)"
                    style={inputCss}
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="어떤 피드백이 필요한지 자세히 설명해주세요."
                    rows={5}
                    style={{ ...inputCss, resize: "vertical" }}
                  />

                  {/* 파일 첨부 */}
                  <div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
                      {files.map((f, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "3px 8px", fontSize: 12 }}>
                          <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                          <span style={{ maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                          <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "5px 10px", cursor: uploading ? "not-allowed" : "pointer" }}
                      >
                        {uploading ? "업로드 중..." : "📎 파일 첨부"}
                      </button>
                      <input ref={fileInputRef} type="file" multiple accept={selectedSvc.accept} style={{ display: "none" }} onChange={handleFileChange} />
                    </div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>허용 형식: {selectedSvc.acceptHint}</div>
                  </div>
                </div>

                {/* 하단 고정 버튼 */}
                <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, flexShrink: 0 }}>
                  <button onClick={closeModal} style={{ padding: "12px 20px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    취소
                  </button>
                  <button
                    onClick={requestPayment}
                    disabled={paying || uploading || !selectedMentor}
                    style={{ flex: 1, padding: "12px", borderRadius: 12, border: "none", background: paying || uploading || !selectedMentor ? "#d1d5db" : "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: paying || uploading || !selectedMentor ? "not-allowed" : "pointer" }}
                  >
                    {paying ? "결제 중..." : `질문하기 · ${selectedSvc.price.toLocaleString("ko-KR")}원`}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─ 1:1 멘토 서비스(유료) 탭 (수강 패키지) ─────────────────────
function PaidServiceTab() {
  return <SubscriptionSection />;
}

// ─ 수강 패키지 섹션 ────────────────────────────────────────────
const PLANS = [
  {
    key: "basic",
    label: "BASIC",
    price: 39900,
    period: "7일 수강",
    badge: null,
    features: [
      "멘토 1명 지정 (주 1회 교체 가능)",
      "질문 무제한",
      "CAD수정 주 1회",
      "실무 검수 주 1회",
      "검수+CAD수정 주 1회",
      "답변 48시간 내 (주말·연휴 제외)",
    ],
    style: { bg: "white", border: "#e5e7eb", titleColor: "#111827", badgeBg: "", badgeText: "" },
  },
  {
    key: "pro",
    label: "PRO",
    price: 69900,
    period: "7일 수강",
    badge: "추천",
    features: [
      "멘토 2명 지정 (주 2회 교체 가능)",
      "질문 무제한",
      "CAD수정 주 2회",
      "실무 검수 주 2회",
      "검수+CAD수정 주 2회",
      "답변 36시간 내 (주말·연휴 제외)",
    ],
    style: { bg: GOLD_LIGHT, border: GOLD, titleColor: "#92400e", badgeBg: GOLD, badgeText: "white" },
  },
  {
    key: "master",
    label: "MASTER",
    price: 99900,
    period: "7일 수강",
    badge: "프리미엄",
    features: [
      "멘토 3명 지정 (주 3회 교체 가능)",
      "질문 무제한",
      "CAD수정 주 3회",
      "실무 검수 주 3회",
      "검수+CAD수정 주 3회",
      "답변 24시간 내 (주말·연휴 제외)",
    ],
    style: { bg: "#111827", border: "#374151", titleColor: "white", badgeBg: "rgba(255,255,255,0.15)", badgeText: "rgba(255,255,255,0.9)" },
  },
] as const;

function SubscriptionSection() {
  const [showPlanDetail, setShowPlanDetail] = useState(false);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 900, color: "#111827" }}>수강 패키지</h2>
        <span style={{ fontSize: 13, color: "#6b7280" }}>멘토를 지정하고 집중 학습하세요</span>
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
              <div style={{ fontSize: 12, color: featureColor, marginBottom: 18 }}>{plan.period}</div>
              <div style={{ borderTop: `1px solid ${dividerColor}`, marginBottom: 16 }} />
              <ul style={{ margin: "0 0 12px", padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 9, flex: 1 }}>
                {plan.features.map((f, i) => (
                  <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: featureColor, lineHeight: 1.5 }}>
                    <span style={{ color: checkColor, flexShrink: 0, fontWeight: 900, fontSize: 14 }}>✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={(e) => { e.preventDefault(); setShowPlanDetail(true); }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#fdf6e3"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                style={{ width: "100%", padding: "8px", borderRadius: 8, border: "1px solid #c9a84c", color: "#c9a84c", background: "transparent", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 10 }}
              >
                📋 이용권 상세 안내 보기
              </button>
              <Link
                href={`/cad-school/subscribe/${plan.key}`}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center",
                  height: 46, borderRadius: 14,
                  background: isMaster ? GOLD : plan.key === "pro" ? "#92400e" : "#111827",
                  color: "white", fontWeight: 900, fontSize: 14, textDecoration: "none",
                }}
              >
                수강하기
              </Link>
            </div>
          );
        })}
      </div>
      {showPlanDetail && <PlanDetailModal onClose={() => setShowPlanDetail(false)} />}
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", marginTop: 12, fontSize: 12, color: "#6b7280", lineHeight: 1.9 }}>
        <div>⚠️ 범위를 초과하는 수정은 추가 비용이 발생할 수 있습니다.</div>
        <div>⚠️ 복잡한 구조 변경은 별도 상담 후 진행됩니다.</div>
        <div style={{ marginTop: 4 }}>* 1회성 결제이며, 만료일까지 서비스가 유지됩니다.</div>
      </div>
    </div>
  );
}

// ─ 미션 게시판 탭 ─────────────────────────────────────────────
type Mission = {
  id: string;
  title: string;
  description: string;
  difficulty: "easy" | "normal" | "hard";
  created_at: string;
  mentor: { id: string; profiles: { nickname: string | null } | null } | null;
  submission_count?: number;
};

const DIFF_MAP: Record<string, { label: string; color: string; bg: string }> = {
  easy:   { label: "초급", color: "#16a34a", bg: "#dcfce7" },
  normal: { label: "중급", color: "#ea580c", bg: "#fff7ed" },
  hard:   { label: "고급", color: "#dc2626", bg: "#fef2f2" },
};

function MissionTab({ isMentor, page, onPage }: { isMentor: boolean; page: number; onPage: (p: number) => void }) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("cad_missions")
        .select("id, title, description, difficulty, created_at, mentor:cad_mentors(id, profiles(nickname))")
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (data && data.length > 0) {
        const ids = data.map((m: { id: string }) => m.id);
        const { data: subData } = await supabase
          .from("cad_mission_submissions")
          .select("mission_id")
          .in("mission_id", ids);
        const countMap: Record<string, number> = {};
        (subData ?? []).forEach((s: { mission_id: string }) => {
          countMap[s.mission_id] = (countMap[s.mission_id] ?? 0) + 1;
        });
        setMissions((data as unknown as Mission[]).map((m) => ({ ...m, submission_count: countMap[m.id] ?? 0 })));
      } else {
        setMissions([]);
      }
      setLoading(false);
    })();
  }, []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>미션 게시판</h2>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6b7280" }}>멘토가 출제한 CAD 미션에 도전하고 포인트를 받으세요</p>
        </div>
        {isMentor && (
          <Link href="/cad-school/mission/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 12, background: "#111827", color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none", flexShrink: 0 }}>
            ✏️ 미션 등록
          </Link>
        )}
      </div>

      {loading ? <LoadingState /> : missions.length === 0 ? (
        <EmptyState icon="🎯" title="등록된 미션이 없습니다" desc="멘토가 출제한 미션이 이곳에 표시됩니다." />
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {missions.slice((page - 1) * PER_PAGE, page * PER_PAGE).map((m) => {
              const diff = DIFF_MAP[m.difficulty] ?? DIFF_MAP.normal;
              return (
                <Link key={m.id} href={`/cad-school/mission/${m.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "18px 20px", cursor: "pointer", transition: "box-shadow 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 800, color: diff.color, background: diff.bg, padding: "2px 8px", borderRadius: 6 }}>{diff.label}</span>
                        </div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.title}</div>
                        <p style={{ margin: 0, fontSize: 13, color: "#6b7280", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{m.description}</p>
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "right", flexShrink: 0 }}>
                        <div>📎 {m.submission_count ?? 0}개 제출</div>
                        <div style={{ marginTop: 4 }}>{timeAgo(m.created_at)}</div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>
                      멘토: <MentorNickname
                        mentorId={m.mentor?.id ?? ""}
                        nickname={m.mentor?.profiles?.nickname ?? "멘토"}
                        isMentor={!!m.mentor?.id}
                      />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
          <CadPagination page={page} total={missions.length} perPage={PER_PAGE} onPage={onPage} />
        </>
      )}
    </div>
  );
}

// ─ 자유 피드백 탭 ─────────────────────────────────────────────
function FeedbackTab({ posts, loading, myUserId, isAdmin, onDeleted, page, onPage, mentorUserIdToMentorId }: { posts: Post[]; loading: boolean; myUserId: string | null; isAdmin: boolean; onDeleted: () => void; page: number; onPage: (p: number) => void; mentorUserIdToMentorId: Record<string, string> }) {
  const paged = posts.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "8px 12px", marginBottom: 20, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.8 }}>
          💡 질문 하루 5회 무료 · 답변 시 <strong style={{ color: "#111827" }}>+50P</strong> · 채택 시 <strong style={{ color: GOLD }}>+300P</strong> · 일 최대 <strong style={{ color: "#111827" }}>1,000P</strong> / 월 최대 <strong style={{ color: "#111827" }}>10,000P</strong>
        </span>
        <Link href="/cad-school/new" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px", borderRadius: 12, background: GOLD, color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none", flexShrink: 0 }}>
          ✏️ 질문하기
        </Link>
      </div>

      {loading ? <LoadingState /> : posts.length === 0 ? (
        <EmptyState icon="💬" title="아직 게시글이 없습니다" desc="첫 번째 질문을 올려보세요!" />
      ) : (
        <>
          <div style={{ display: "grid", gap: 12 }}>
            {paged.map((post) => <PostCard key={post.id} post={post} myUserId={myUserId} isAdmin={isAdmin} onDeleted={onDeleted} mentorUserIdToMentorId={mentorUserIdToMentorId} />)}
          </div>
          <CadPagination page={page} total={posts.length} perPage={PER_PAGE} onPage={onPage} />
        </>
      )}
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
            <Row icon="🛒">모델 구매 시: 결제금액의 <Gold>2%</Gold> 자동 적립</Row>
            <Row icon="✅">답변 등록: 답변 1건당 <Gold>+50P</Gold></Row>
            <Row icon="⭐">베스트 답변 채택: 채택 1건당 <Gold>+300P</Gold></Row>
            <Row icon="📌">적립 한도: 일일 <Gold>1,000P</Gold> / 월 <Gold>10,000P</Gold></Row>
          </Section>
          <Section title="사용 방법">
            <Row icon="💳">모델 구매 시 포인트 사용 가능 (1P = 1원)</Row>
            <Row icon="💳">최대 결제금액의 <Gold>50%</Gold>까지 사용 가능</Row>
          </Section>
          <Section title="유의사항" last>
            <Row icon="❗">질문 등록은 하루 5회 무료입니다</Row>
            <Row icon="❗">포인트 적립 한도: 일일 <Gold>1,000P</Gold> / 월 <Gold>10,000P</Gold></Row>
          </Section>
        </div>
        <button onClick={onClose} style={{ marginTop: 18, width: "100%", padding: "12px", borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>확인</button>
      </div>
    </div>
  );
}

function PlanDetailModal({ onClose }: { onClose: () => void }) {
  const divider = <div style={{ borderTop: "1px solid #e5e7eb", margin: "20px 0" }} />;
  const sectionTitle = (text: string) => (
    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 8 }}>{text}</div>
  );
  const desc = (text: string) => (
    <p style={{ margin: "0 0 8px", fontSize: 13, color: "#374151", lineHeight: 1.7 }}>{text}</p>
  );
  const ul = (items: string[]) => (
    <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
      {items.map((item, i) => <li key={i}>{item}</li>)}
    </ul>
  );
  const warn = (text: string) => (
    <div style={{ fontSize: 12, color: "#b45309", marginTop: 6 }}>⚠ {text}</div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "white", borderRadius: 20, padding: 32, maxWidth: 480, width: "100%", maxHeight: "80vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", position: "relative" }}>
        <button onClick={onClose} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#9ca3af", lineHeight: 1 }}>×</button>
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 900, color: "#111827" }}>이용권 상세 안내</h2>

        <div>
          {sectionTitle("질문 무제한이란?")}
          {desc("채팅방에서 횟수 제한 없이 자유롭게 질문할 수 있습니다. 단, 답변은 패키지별 기준 시간 내에 이루어지며 실시간 응답이 아닐 수 있습니다.")}
          {ul([
            "BASIC: 48시간 이내 답변 (주말·연휴 제외)",
            "PRO: 36시간 이내 답변 (주말·연휴 제외)",
            "MASTER: 24시간 이내 답변 (주말·연휴 제외)",
          ])}
        </div>

        {divider}

        <div>
          {sectionTitle("CAD수정이란?")}
          {desc("수강생이 작업한 CAD 파일을 멘토가 직접 수정 후 전달하는 서비스입니다.")}
          {ul([
            "지원 파일: 3DM (라이노 전용 · 직접 수정 가능)",
            "STL/OBJ (형상 파일 · 수정 불가, 피드백만 제공)",
            "수정 범위: 형태 교정, 치수 조정, 구조 개선 등",
          ])}
        </div>

        {divider}

        <div>
          {sectionTitle("실무 검수란?")}
          {desc("완성된 CAD 파일이 실제 제작/판매/출력 가능한지 멘토가 확인해드리는 서비스입니다.")}
          {ul([
            "체크 항목: 출력 가능 여부, 비율·두께, 실무 적합성 등",
            "결과: 통과 또는 수정 필요 피드백 제공",
          ])}
        </div>

        {divider}

        <div>
          {sectionTitle("검수+CAD수정이란?")}
          {desc("검수 후 문제 발견 시 멘토가 직접 수정까지 진행하는 서비스입니다.")}
          {ul([
            "3DM 파일만 직접 수정 가능 (STL/OBJ는 검수 피드백만)",
            "가장 완성도 높은 결과물을 받을 수 있는 옵션",
          ])}
        </div>

        {divider}

        <div>
          {sectionTitle("멘토 교체란?")}
          {desc("수강 중 멘토가 맞지 않을 경우 패키지별 횟수만큼 교체할 수 있습니다.")}
          {ul([
            "BASIC: 주 1회 교체 가능",
            "PRO: 주 2회 교체 가능",
            "MASTER: 주 3회 교체 가능",
          ])}
          {warn("멘토 교체 시 이미 사용한 CAD수정·검수 횟수는 초기화되지 않습니다.")}
          {warn("새 멘토와의 채팅은 교체 후 새로 시작됩니다.")}
        </div>

        {divider}

        <div>
          {sectionTitle("환불 정책")}
          {ul([
            "수강 시작 후 멘토와 첫 대화 이전: 전액 환불 가능",
            "첫 대화 이후: 디지털 서비스 특성상 환불이 불가합니다",
            "단, 멘토 귀책사유(48시간 초과 무응답 등)로 인한 경우: 전액 환불 가능",
            "환불 문의: 고객센터를 통해 접수해주세요",
          ])}
        </div>

        <button onClick={onClose} style={{ marginTop: 24, width: "100%", padding: "12px", borderRadius: 14, border: "none", background: "#111827", color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>확인</button>
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

function PostCard({ post, myUserId, isAdmin, onDeleted, mentorUserIdToMentorId }: { post: Post; myUserId: string | null; isAdmin: boolean; onDeleted: () => void; mentorUserIdToMentorId: Record<string, string> }) {
  const [deleting, setDeleting] = useState(false);
  const isMyPost = myUserId === post.user_id;
  const canDelete = (isMyPost && post.comment_count === 0) || isAdmin;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("게시물을 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) return;
    const token = getAccessToken();
    if (!token) return;
    setDeleting(true);
    const res = await fetch(`/api/cad-school/post/${post.id}/delete`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) { showError(data.error || "삭제 실패"); setDeleting(false); return; }
    showSuccess("게시물이 삭제되었습니다.");
    onDeleted();
  };

  return (
    <Link href={`/cad-school/${post.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "16px 20px", cursor: "pointer", transition: "box-shadow 0.15s" }}
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
            <p style={{ margin: 0, fontSize: 13, color: "#6b7280", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{post.content}</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", textAlign: "right" }}>
              <div>💬 {post.comment_count}</div>
              <div style={{ marginTop: 4 }}>{timeAgo(post.created_at)}</div>
            </div>
            {canDelete && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "3px 8px", cursor: deleting ? "not-allowed" : "pointer" }}
              >
                {deleting ? "삭제 중" : "삭제"}
              </button>
            )}
          </div>
        </div>
        <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 6 }}>
          <Avatar url={post.profiles?.avatar_url} size={20} />
          <span style={{ fontSize: 12, color: "#6b7280" }}>
            <MentorNickname
              mentorId={mentorUserIdToMentorId[post.user_id] ?? ""}
              nickname={post.profiles?.nickname ?? "익명"}
              isMentor={!!mentorUserIdToMentorId[post.user_id]}
            />
          </span>
          {post.profiles?.grade && <GradeBadge grade={post.profiles.grade as Grade} size="sm" />}
        </div>
      </div>
    </Link>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <Image src={url} alt="avatar" width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, color: "#9ca3af" }}>👤</div>
  );
}

function LoadingState() {
  return <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "60px 20px", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>불러오는 중...</div>;
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

// ─ 페이지네이션 ────────────────────────────────────────────────
function CadPagination({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const base: React.CSSProperties = { minWidth: 36, height: 36, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px" };
  const active: React.CSSProperties = { ...base, background: "#111827", color: "white", border: "1px solid #111827", fontWeight: 800 };
  const disabled: React.CSSProperties = { ...base, opacity: 0.35, cursor: "not-allowed" };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 24 }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={page <= 1 ? disabled : base}>이전</button>

      {start > 1 && (
        <>
          <button onClick={() => onPage(1)} style={base}>1</button>
          {start > 2 && <span style={{ color: "#9ca3af", padding: "0 2px" }}>…</span>}
        </>
      )}

      {pages.map((p) => (
        <button key={p} onClick={() => onPage(p)} style={p === page ? active : base}>{p}</button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span style={{ color: "#9ca3af", padding: "0 2px" }}>…</span>}
          <button onClick={() => onPage(totalPages)} style={base}>{totalPages}</button>
        </>
      )}

      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={page >= totalPages ? disabled : base}>다음</button>
    </div>
  );
}
