"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import MentorNickname from "../../components/MentorNickname";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";
import { GOLD } from "@/lib/constants";
import { EmptyState } from "../../components/EmptyState";
import { getProfilesMap } from "../../lib/getProfile";

const GOLD_LIGHT = "#fdf6e3";
const PER_PAGE = 10;

type Tab = "mentoring" | "posts";

type Post = { id: string; title: string; status: string; created_at: string; comment_count?: number };
type Session = {
  id: string; title: string; status: string; price: number; created_at: string;
  role: "mentor" | "mentee";
  other_name: string;
  mentor_cad_id?: string;
};
type Subscription = {
  id: string;
  plan_type: string;
  status: string;
  expires_at: string;
  price: number;
  mentor_change_count: number;
  checklist_count: number;
  review_count: number;
  post_review_cad_count: number;
  role: "mentor" | "subscriber";
  other_name: string;
  mentor_id: string;
  is_mentor_suspended: boolean;
};

const PLAN_LABELS: Record<string, string> = { basic: "BASIC", pro: "PRO", master: "MASTER" };
const PLAN_LIMITS: Record<string, { checklist: number; review: number; postReviewCad: number; mentorChanges: number }> = {
  basic:  { checklist: 1, review: 1, postReviewCad: 1, mentorChanges: 1 },
  pro:    { checklist: 2, review: 2, postReviewCad: 2, mentorChanges: 2 },
  master: { checklist: 3, review: 3, postReviewCad: 3, mentorChanges: 3 },
};

function daysUntil(dateStr: string): number {
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function MyActivityPageWrapper() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <MyActivityPage />
    </Suspense>
  );
}

function MyActivityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = (searchParams.get("tab") as Tab | null) ?? "mentoring";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [isMentor, setIsMentor] = useState(false);
  const [subExpanded, setSubExpanded] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    const uid = payload?.sub ?? null;
    if (!uid) { router.push("/auth"); return; }
    setMyUserId(uid);
    loadAll(uid);
  }, []);

  const loadAll = async (uid: string) => {
    setLoading(true);
    const { data: mentorRow } = await supabase.from("cad_mentors").select("id").eq("user_id", uid).maybeSingle();
    setIsMentor(!!mentorRow);
    await Promise.all([loadPosts(uid), loadSessions(uid), loadSubscriptions(uid)]);
    setLoading(false);
  };

  const loadPosts = async (uid: string) => {
    const { data } = await supabase
      .from("cad_posts")
      .select("id, title, status, created_at")
      .eq("user_id", uid)
      .order("created_at", { ascending: false });
    if (!data) return;

    const postIds = data.map((p) => p.id);
    const { data: commentData } = await supabase
      .from("cad_post_comments")
      .select("post_id")
      .in("post_id", postIds)
      .is("parent_id", null);
    const countMap: Record<string, number> = {};
    (commentData ?? []).forEach((c: { post_id: string }) => {
      countMap[c.post_id] = (countMap[c.post_id] ?? 0) + 1;
    });
    setPosts(data.map((p) => ({ ...p, comment_count: countMap[p.id] ?? 0 })));
  };

  const loadSessions = async (uid: string) => {
    const { data: myMentor } = await supabase.from("cad_mentors").select("id").eq("user_id", uid).maybeSingle();
    const mentorId = myMentor?.id;

    const { data: asMentee } = await supabase
      .from("cad_mentoring_sessions")
      .select("id, title, status, price, created_at, mentor_id")
      .eq("mentee_id", uid)
      .order("created_at", { ascending: false });

    // 상대(멘토) 닉네임은 FK 임베딩 대신 cad_mentors → profiles_public 2단계로 조회한다.
    const menteeMentorIds = [...new Set((asMentee ?? []).map((s: any) => s.mentor_id).filter(Boolean))];
    const { data: menteeMentorRows } = menteeMentorIds.length > 0
      ? await supabase.from("cad_mentors").select("id, user_id").in("id", menteeMentorIds)
      : { data: [] as { id: string; user_id: string }[] };
    const menteeMentorProfiles = await getProfilesMap((menteeMentorRows ?? []).map((m: any) => m.user_id));
    const mentorNicknameByCadId: Record<string, string> = {};
    (menteeMentorRows ?? []).forEach((m: any) => {
      mentorNicknameByCadId[m.id] = menteeMentorProfiles[m.user_id]?.nickname ?? "멘토";
    });

    const mentee: Session[] = (asMentee ?? []).map((s: any) => ({
      id: s.id, title: s.title, status: s.status, price: s.price, created_at: s.created_at,
      role: "mentee", other_name: mentorNicknameByCadId[s.mentor_id] ?? "멘토", mentor_cad_id: s.mentor_id,
    }));

    let mentor: Session[] = [];
    if (mentorId) {
      const { data: asMentor } = await supabase
        .from("cad_mentoring_sessions")
        .select("id, title, status, price, created_at, mentee_id")
        .eq("mentor_id", mentorId)
        .order("created_at", { ascending: false });
      // 상대(멘티)는 profiles를 직접 참조하므로 profiles_public 배치 조회로 바로 가져온다.
      const menteeProfiles = await getProfilesMap((asMentor ?? []).map((s: any) => s.mentee_id));
      mentor = (asMentor ?? []).map((s: any) => ({
        id: s.id, title: s.title, status: s.status, price: s.price, created_at: s.created_at,
        role: "mentor", other_name: menteeProfiles[s.mentee_id]?.nickname ?? "멘티",
      }));
    }

    setSessions([...mentor, ...mentee].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const loadSubscriptions = async (uid: string) => {
    const { data: myMentor } = await supabase.from("cad_mentors").select("id").eq("user_id", uid).maybeSingle();
    const mentorId = myMentor?.id;

    const { data: asSubscriber } = await supabase
      .from("cad_subscriptions")
      .select("id, plan_type, status, expires_at, price, mentor_change_count, checklist_count, review_count, post_review_cad_count, mentor_id")
      .eq("subscriber_id", uid)
      .order("created_at", { ascending: false });

    // 상대(멘토) 닉네임/정지여부는 FK 임베딩 대신 cad_mentors → profiles_public 2단계로 조회한다.
    const subMentorIds = [...new Set((asSubscriber ?? []).map((s: any) => s.mentor_id).filter(Boolean))];
    const { data: subMentorRows } = subMentorIds.length > 0
      ? await supabase.from("cad_mentors").select("id, user_id, is_suspended").in("id", subMentorIds)
      : { data: [] as { id: string; user_id: string; is_suspended: boolean }[] };
    const subMentorProfiles = await getProfilesMap((subMentorRows ?? []).map((m: any) => m.user_id));
    const mentorInfoByCadId: Record<string, { nickname: string; is_suspended: boolean }> = {};
    (subMentorRows ?? []).forEach((m: any) => {
      mentorInfoByCadId[m.id] = { nickname: subMentorProfiles[m.user_id]?.nickname ?? "멘토", is_suspended: !!m.is_suspended };
    });

    const subscriber: Subscription[] = (asSubscriber ?? []).map((s: any) => ({
      id: s.id, plan_type: s.plan_type, status: s.status, expires_at: s.expires_at, price: s.price,
      mentor_change_count: s.mentor_change_count, checklist_count: s.checklist_count, review_count: s.review_count,
      post_review_cad_count: s.post_review_cad_count ?? 0, mentor_id: s.mentor_id,
      role: "subscriber", other_name: mentorInfoByCadId[s.mentor_id]?.nickname ?? "멘토", is_mentor_suspended: mentorInfoByCadId[s.mentor_id]?.is_suspended ?? false,
    }));

    let mentorSubs: Subscription[] = [];
    if (mentorId) {
      const { data: asMentor } = await supabase
        .from("cad_subscriptions")
        .select("id, plan_type, status, expires_at, price, mentor_change_count, checklist_count, review_count, post_review_cad_count, mentor_id, subscriber_id")
        .eq("mentor_id", mentorId)
        .order("created_at", { ascending: false });
      // 상대(수강생)는 profiles를 직접 참조하므로 profiles_public 배치 조회로 바로 가져온다.
      const subscriberProfiles = await getProfilesMap((asMentor ?? []).map((s: any) => s.subscriber_id));
      mentorSubs = (asMentor ?? []).map((s: any) => ({
        id: s.id, plan_type: s.plan_type, status: s.status, expires_at: s.expires_at, price: s.price,
        mentor_change_count: s.mentor_change_count, checklist_count: s.checklist_count, review_count: s.review_count,
        post_review_cad_count: s.post_review_cad_count ?? 0, mentor_id: s.mentor_id,
        role: "mentor", other_name: subscriberProfiles[s.subscriber_id]?.nickname ?? "수강생", is_mentor_suspended: false,
      }));
    }

    setSubscriptions([...subscriber, ...mentorSubs].sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime()));
  };

  const handleCancel = async (subId: string) => {
    if (!confirm("수강을 해지하시겠습니까? 만료일까지는 계속 이용 가능합니다.")) return;
    setCancelling(subId);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); setCancelling(null); return; }
    const res = await fetch("/api/cad-school/subscribe/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subscription_id: subId }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "해지 실패");
    else { showSuccess("수강이 해지되었습니다. 만료일까지 이용 가능합니다."); myUserId && loadSubscriptions(myUserId); }
    setCancelling(null);
  };

  const goTab = (t: Tab) => router.push(`?tab=${t}&page=1`);
  const goPage = (p: number) => router.replace(`?tab=${tab}&page=${p}`);

  const pagedSessions = sessions.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pagedPosts = posts.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;

  const activeSub = subscriptions.find((s) => s.role === "subscriber" && s.status === "active");
  const otherSubs = subscriptions.filter((s) => !(s.role === "subscriber" && s.status === "active"));

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>내 강의실</span>
      </div>

      {/* ── 수강 패키지 (탭 밖 고정) ── */}
      <section style={{ marginBottom: 32 }}>
        {isMentor ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 900, color: "#111827" }}>수강 패키지</h2>
            <button
              type="button"
              onClick={() => setSubExpanded((prev) => !prev)}
              style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, color: "#6b7280", padding: "2px 6px", borderRadius: 6, lineHeight: 1 }}
            >
              {subExpanded ? "▲ 접기" : "▼ 펼치기"}
            </button>
          </div>
        ) : (
          <SectionTitle>수강 패키지</SectionTitle>
        )}

        {activeSub && (
          <ActiveSubscriptionCard sub={activeSub} cancelling={cancelling} onCancel={handleCancel} />
        )}

        {!activeSub && (!isMentor || subExpanded) && (
          <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "48px 20px", textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>수강 중인 패키지가 없습니다</div>
            <Link href="/cad-school" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 24px", borderRadius: 12, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
              패키지 보기
            </Link>
          </div>
        )}

        {otherSubs.length > 0 && (
          <div style={{ marginTop: activeSub ? 16 : !isMentor || subExpanded ? 16 : 0, display: "grid", gap: 10 }}>
            {otherSubs.map((sub) => <OtherSubscriptionCard key={sub.id} sub={sub} />)}
          </div>
        )}
      </section>

      {/* ── 탭 내비게이션 ── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, background: "white", borderRadius: 14, padding: 5, border: "1px solid #e5e7eb" }}>
        {([["mentoring", "건별 멘토링"], ["posts", "내 질문"]] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => goTab(key)}
            style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: tab === key ? "#111827" : "transparent", color: tab === key ? "white" : "#6b7280", fontWeight: tab === key ? 800 : 600, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}
          >
            {label}
            {key === "mentoring" && sessions.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: tab === key ? "rgba(255,255,255,0.2)" : "#f3f4f6", color: tab === key ? "white" : "#6b7280", borderRadius: 10, padding: "1px 6px" }}>
                {sessions.length}
              </span>
            )}
            {key === "posts" && posts.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, background: tab === key ? "rgba(255,255,255,0.2)" : "#f3f4f6", color: tab === key ? "white" : "#6b7280", borderRadius: 10, padding: "1px 6px" }}>
                {posts.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── 탭 콘텐츠: 건별 멘토링 ── */}
      {tab === "mentoring" && (
        sessions.length === 0 ? (
          <EmptyState icon="💬" title="진행한 건별 멘토링이 없습니다" desc="유료 피드백 탭에서 멘토에게 질문해보세요." />
        ) : (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              {pagedSessions.map((s) => (
                <Link key={s.id} href={`/cad-school/session/${s.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.07)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <SessionStatusBadge status={s.status} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", background: "#dbeafe", padding: "2px 6px", borderRadius: 4 }}>
                            {s.role === "mentor" ? "멘토" : "멘티"}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{s.title}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>
                          {s.role === "mentee" && s.mentor_cad_id ? (
                            <MentorNickname mentorId={s.mentor_cad_id} nickname={s.other_name} isMentor={true} />
                          ) : (
                            s.other_name
                          )} · {timeAgo(s.created_at)}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", whiteSpace: "nowrap" }}>
                        {s.price.toLocaleString("ko-KR")}원
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination page={page} total={sessions.length} perPage={PER_PAGE} onPage={goPage} />
          </>
        )
      )}

      {/* ── 탭 콘텐츠: 내 질문 ── */}
      {tab === "posts" && (
        posts.length === 0 ? (
          <EmptyState icon="📝" title="등록한 질문이 없습니다" desc="자유 피드백 탭에서 첫 번째 질문을 올려보세요." />
        ) : (
          <>
            <div style={{ display: "grid", gap: 12 }}>
              {pagedPosts.map((p) => (
                <Link key={p.id} href={`/cad-school/${p.id}`} style={{ textDecoration: "none" }}>
                  <div
                    style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}
                    onMouseEnter={(e) => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.07)")}
                    onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                      <StatusBadge status={p.status === "open" ? "open" : "closed"} />
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{p.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>답변 {p.comment_count}개 · {timeAgo(p.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
            <Pagination page={page} total={posts.length} perPage={PER_PAGE} onPage={goPage} />
          </>
        )
      )}
    </main>
  );
}

// ── 페이지네이션 ────────────────────────────────────────────────
function Pagination({ page, total, perPage, onPage }: { page: number; total: number; perPage: number; onPage: (p: number) => void }) {
  const totalPages = Math.ceil(total / perPage);
  if (totalPages <= 1) return null;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  const pages: number[] = [];
  for (let i = start; i <= end; i++) pages.push(i);

  const btnBase: React.CSSProperties = { minWidth: 36, height: 36, borderRadius: 8, border: "1px solid #e5e7eb", background: "white", color: "#374151", fontWeight: 600, fontSize: 13, cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 8px" };
  const btnActive: React.CSSProperties = { ...btnBase, background: "#111827", color: "white", border: "1px solid #111827", fontWeight: 800 };
  const btnDisabled: React.CSSProperties = { ...btnBase, opacity: 0.35, cursor: "not-allowed" };

  return (
    <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 4, marginTop: 24 }}>
      <button onClick={() => onPage(page - 1)} disabled={page <= 1} style={page <= 1 ? btnDisabled : btnBase}>이전</button>

      {start > 1 && (
        <>
          <button onClick={() => onPage(1)} style={btnBase}>1</button>
          {start > 2 && <span style={{ color: "#9ca3af", padding: "0 2px" }}>…</span>}
        </>
      )}

      {pages.map((p) => (
        <button key={p} onClick={() => onPage(p)} style={p === page ? btnActive : btnBase}>{p}</button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span style={{ color: "#9ca3af", padding: "0 2px" }}>…</span>}
          <button onClick={() => onPage(totalPages)} style={btnBase}>{totalPages}</button>
        </>
      )}

      <button onClick={() => onPage(page + 1)} disabled={page >= totalPages} style={page >= totalPages ? btnDisabled : btnBase}>다음</button>
    </div>
  );
}

// ── 활성 구독 카드 ──────────────────────────────────────────────
function ActiveSubscriptionCard({ sub, cancelling, onCancel }: { sub: Subscription; cancelling: string | null; onCancel: (id: string) => void }) {
  const limits = PLAN_LIMITS[sub.plan_type] ?? PLAN_LIMITS.basic;
  const dLeft = daysUntil(sub.expires_at);
  const dLabel = dLeft > 0 ? `D-${dLeft}` : dLeft === 0 ? "D-Day" : "만료";
  const dColor = dLeft <= 3 ? "#dc2626" : "#374151";
  const dBg    = dLeft <= 3 ? "#fee2e2" : "#f3f4f6";

  return (
    <div style={{ background: GOLD_LIGHT, border: `2px solid ${GOLD}88`, borderRadius: 20, padding: "24px 26px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
            <span style={{ fontSize: 15, fontWeight: 900, color: GOLD, background: "white", border: `1px solid ${GOLD}66`, padding: "3px 10px", borderRadius: 8 }}>
              {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: dColor, background: dBg, padding: "3px 10px", borderRadius: 8 }}>
              {dLabel}
            </span>
            {sub.is_mentor_suspended && (
              <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "2px 6px", borderRadius: 4 }}>멘토 정지됨</span>
            )}
          </div>
          <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 2 }}>
            멘토: {sub.role === "subscriber" ? (
              <MentorNickname mentorId={sub.mentor_id} nickname={sub.other_name} isMentor={true} />
            ) : sub.other_name}
          </div>
          <div style={{ fontSize: 12, color: "#92681a" }}>만료일: {new Date(sub.expires_at).toLocaleDateString("ko-KR")}</div>
        </div>
        <Link
          href={`/cad-school/subscription/${sub.id}`}
          style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "12px 24px", borderRadius: 14, background: GOLD, color: "white", fontWeight: 900, fontSize: 15, textDecoration: "none", whiteSpace: "nowrap" }}
        >
          채팅방 바로가기 →
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 18 }}>
        <QuotaBar label="CAD수정"  remaining={sub.checklist_count}       total={limits.checklist}     color="#7c3aed" />
        <QuotaBar label="검수"     remaining={sub.review_count}          total={limits.review}        color="#b45309" />
        <QuotaBar label="검수+CAD" remaining={sub.post_review_cad_count} total={limits.postReviewCad} color="#0369a1" />
      </div>

      <div style={{ textAlign: "right" }}>
        <button
          onClick={() => onCancel(sub.id)}
          disabled={cancelling === sub.id}
          style={{ fontSize: 12, fontWeight: 600, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
        >
          {cancelling === sub.id ? "처리 중..." : "수강 해지"}
        </button>
      </div>
    </div>
  );
}

// ── 기타 구독 카드 ─────────────────────────────────────────────
function OtherSubscriptionCard({ sub }: { sub: Subscription }) {
  const isActive = sub.status === "active";
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 18px", opacity: isActive ? 1 : 0.65 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
            <SubStatusBadge status={sub.status} />
            <span style={{ fontSize: 11, fontWeight: 700, color: sub.role === "mentor" ? "#2563eb" : "#7c3aed", background: sub.role === "mentor" ? "#dbeafe" : "#ede9fe", padding: "2px 6px", borderRadius: 4 }}>
              {sub.role === "mentor" ? "멘토" : "수강생"}
            </span>
            <span style={{ fontSize: 13, fontWeight: 800, color: GOLD }}>{PLAN_LABELS[sub.plan_type] ?? sub.plan_type}</span>
          </div>
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 700 }}>
            {sub.role === "mentor" ? (
              `수강생: ${sub.other_name}`
            ) : (
              <>멘토: <MentorNickname mentorId={sub.mentor_id} nickname={sub.other_name} isMentor={true} /></>
            )}
          </div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
            만료일: {new Date(sub.expires_at).toLocaleDateString("ko-KR")}
          </div>
        </div>
        <Link href={`/cad-school/subscription/${sub.id}`} style={{ fontSize: 13, fontWeight: 800, color: "white", background: "#374151", padding: "8px 14px", borderRadius: 10, textDecoration: "none", whiteSpace: "nowrap" }}>
          채팅방 →
        </Link>
      </div>
    </div>
  );
}

// ── 공통 컴포넌트 ──────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 900, color: "#111827" }}>{children}</h2>;
}

function QuotaBar({ label, remaining, total, color }: { label: string; remaining: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
  const isEmpty = remaining <= 0;
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "10px 12px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 800, color: isEmpty ? "#dc2626" : "#374151" }}>{remaining}/{total}</span>
      </div>
      <div style={{ background: "#e5e7eb", borderRadius: 99, height: 6 }}>
        <div style={{ height: "100%", background: isEmpty ? "#dc2626" : color, width: `${pct}%`, borderRadius: 99, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  return status === "open"
    ? <span style={{ fontSize: 11, fontWeight: 800, color: "#16a34a", background: "#dcfce7", padding: "2px 7px", borderRadius: 5 }}>진행중</span>
    : <span style={{ fontSize: 11, fontWeight: 800, color: "#6b7280", background: "#f3f4f6", padding: "2px 7px", borderRadius: 5 }}>마감</span>;
}

function SessionStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    pending:   { label: "대기중", color: "#92400e", bg: "#fef3c7" },
    accepted:  { label: "진행중", color: "#1d4ed8", bg: "#dbeafe" },
    completed: { label: "완료",   color: "#166534", bg: "#dcfce7" },
    cancelled: { label: "취소됨", color: "#6b7280", bg: "#f3f4f6" },
  };
  const info = map[status] ?? { label: status, color: "#6b7280", bg: "#f3f4f6" };
  return <span style={{ fontSize: 11, fontWeight: 800, color: info.color, background: info.bg, padding: "2px 7px", borderRadius: 5 }}>{info.label}</span>;
}

function SubStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active:    { label: "이용중", color: "#1d4ed8", bg: "#dbeafe" },
    cancelled: { label: "해지됨", color: "#6b7280", bg: "#f3f4f6" },
    expired:   { label: "만료됨", color: "#9ca3af", bg: "#f3f4f6" },
  };
  const info = map[status] ?? { label: status, color: "#6b7280", bg: "#f3f4f6" };
  return <span style={{ fontSize: 11, fontWeight: 800, color: info.color, background: info.bg, padding: "2px 7px", borderRadius: 5 }}>{info.label}</span>;
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
