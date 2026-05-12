"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../lib/toast";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";

type MyTab = "posts" | "sessions" | "subscriptions";

type Post = { id: string; title: string; status: string; created_at: string; comment_count?: number };
type Session = {
  id: string; title: string; status: string; price: number; created_at: string;
  role: "mentor" | "mentee";
  other_name: string;
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
  stl_upload_count: number;
  role: "mentor" | "subscriber";
  other_name: string;
  mentor_id: string;
  is_mentor_suspended: boolean;
};

const PLAN_LABELS: Record<string, string> = { basic: "BASIC", pro: "PRO", master: "MASTER" };
const PLAN_LIMITS: Record<string, { stl: number; checklist: number; review: number; mentorChanges: number }> = {
  basic:  { stl: 3,    checklist: 2,  review: 2,  mentorChanges: 1 },
  pro:    { stl: 10,   checklist: 5,  review: 5,  mentorChanges: 2 },
  master: { stl: 9999, checklist: 10, review: 10, mentorChanges: 3 },
};

export default function MyActivityPage() {
  const router = useRouter();
  const [tab, setTab] = useState<MyTab>("posts");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [cancelling, setCancelling] = useState<string | null>(null);

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
    const withCount = await Promise.all(
      data.map(async (p) => {
        const { count } = await supabase.from("cad_post_comments").select("*", { count: "exact", head: true }).eq("post_id", p.id);
        return { ...p, comment_count: count ?? 0 };
      })
    );
    setPosts(withCount);
  };

  const loadSessions = async (uid: string) => {
    const { data: myMentor } = await supabase.from("cad_mentors").select("id").eq("user_id", uid).maybeSingle();
    const mentorId = myMentor?.id;

    const { data: asMentee } = await supabase
      .from("cad_mentoring_sessions")
      .select("id, title, status, price, created_at, mentor:cad_mentors(profiles(nickname))")
      .eq("mentee_id", uid)
      .order("created_at", { ascending: false });

    const mentee: Session[] = (asMentee ?? []).map((s: unknown) => {
      const sess = s as { id: string; title: string; status: string; price: number; created_at: string; mentor: { profiles: { nickname: string } | null } | null };
      return { id: sess.id, title: sess.title, status: sess.status, price: sess.price, created_at: sess.created_at, role: "mentee", other_name: sess.mentor?.profiles?.nickname ?? "멘토" };
    });

    let mentor: Session[] = [];
    if (mentorId) {
      const { data: asMentor } = await supabase
        .from("cad_mentoring_sessions")
        .select("id, title, status, price, created_at, mentee_profile:profiles!cad_mentoring_sessions_mentee_id_fkey(nickname)")
        .eq("mentor_id", mentorId)
        .order("created_at", { ascending: false });
      mentor = (asMentor ?? []).map((s: unknown) => {
        const sess = s as { id: string; title: string; status: string; price: number; created_at: string; mentee_profile: { nickname: string } | null };
        return { id: sess.id, title: sess.title, status: sess.status, price: sess.price, created_at: sess.created_at, role: "mentor", other_name: sess.mentee_profile?.nickname ?? "멘티" };
      });
    }

    setSessions([...mentor, ...mentee].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const loadSubscriptions = async (uid: string) => {
    const { data: myMentor } = await supabase.from("cad_mentors").select("id").eq("user_id", uid).maybeSingle();
    const mentorId = myMentor?.id;

    const { data: asSubscriber } = await supabase
      .from("cad_subscriptions")
      .select("id, plan_type, status, expires_at, price, mentor_change_count, checklist_count, review_count, stl_upload_count, mentor_id, mentor:cad_mentors(user_id, is_suspended, profiles(nickname))")
      .eq("subscriber_id", uid)
      .order("created_at", { ascending: false });

    const subscriber: Subscription[] = (asSubscriber ?? []).map((s: unknown) => {
      const sub = s as {
        id: string; plan_type: string; status: string; expires_at: string; price: number;
        mentor_change_count: number; checklist_count: number; review_count: number; stl_upload_count: number; mentor_id: string;
        mentor: { user_id: string; is_suspended: boolean; profiles: { nickname: string } | null } | null;
      };
      return {
        id: sub.id, plan_type: sub.plan_type, status: sub.status, expires_at: sub.expires_at, price: sub.price,
        mentor_change_count: sub.mentor_change_count, checklist_count: sub.checklist_count, review_count: sub.review_count, stl_upload_count: sub.stl_upload_count, mentor_id: sub.mentor_id,
        role: "subscriber", other_name: sub.mentor?.profiles?.nickname ?? "멘토", is_mentor_suspended: sub.mentor?.is_suspended ?? false,
      };
    });

    let mentorSubs: Subscription[] = [];
    if (mentorId) {
      const { data: asMentor } = await supabase
        .from("cad_subscriptions")
        .select("id, plan_type, status, expires_at, price, mentor_change_count, checklist_count, review_count, stl_upload_count, mentor_id, subscriber_profile:profiles!cad_subscriptions_subscriber_id_fkey(nickname)")
        .eq("mentor_id", mentorId)
        .order("created_at", { ascending: false });
      mentorSubs = (asMentor ?? []).map((s: unknown) => {
        const sub = s as {
          id: string; plan_type: string; status: string; expires_at: string; price: number;
          mentor_change_count: number; checklist_count: number; review_count: number; stl_upload_count: number; mentor_id: string;
          subscriber_profile: { nickname: string } | null;
        };
        return {
          id: sub.id, plan_type: sub.plan_type, status: sub.status, expires_at: sub.expires_at, price: sub.price,
          mentor_change_count: sub.mentor_change_count, checklist_count: sub.checklist_count, review_count: sub.review_count, stl_upload_count: sub.stl_upload_count, mentor_id: sub.mentor_id,
          role: "mentor", other_name: sub.subscriber_profile?.nickname ?? "구독자", is_mentor_suspended: false,
        };
      });
    }

    setSubscriptions([...subscriber, ...mentorSubs].sort((a, b) => new Date(b.expires_at).getTime() - new Date(a.expires_at).getTime()));
  };

  const handleCancel = async (subId: string) => {
    if (!confirm("구독을 해지하시겠습니까? 만료일까지는 계속 이용 가능합니다.")) return;
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
    else { showSuccess("구독이 해지되었습니다. 만료일까지 이용 가능합니다."); myUserId && loadSubscriptions(myUserId); }
    setCancelling(null);
  };

  const TABS: { key: MyTab; label: string; count: number }[] = [
    { key: "posts", label: "내 질문", count: posts.length },
    { key: "sessions", label: "건별 세션", count: sessions.length },
    { key: "subscriptions", label: "구독", count: subscriptions.length },
  ];

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>내 활동</span>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "white", borderRadius: 16, padding: 6, border: "1px solid #e5e7eb" }}>
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)} style={{
            flex: 1, padding: "10px 8px", borderRadius: 12, border: "none",
            background: tab === t.key ? "#111827" : "transparent",
            color: tab === t.key ? "white" : "#6b7280",
            fontWeight: tab === t.key ? 800 : 600, fontSize: 13, cursor: "pointer",
          }}>
            {t.label} {t.count > 0 && <span style={{ fontSize: 11, opacity: 0.7 }}>({t.count})</span>}
          </button>
        ))}
      </div>

      {tab === "posts" && (
        <div>
          {posts.length === 0 ? (
            <EmptyState icon="💬" title="등록한 질문이 없습니다" action={{ href: "/cad-school/new", label: "질문하기" }} />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {posts.map((p) => (
                <Link key={p.id} href={`/cad-school/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <StatusBadge status={p.status === "open" ? "open" : "closed"} />
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{p.title}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>답변 {p.comment_count}개 · {timeAgo(p.created_at)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "sessions" && (
        <div>
          {sessions.length === 0 ? (
            <EmptyState icon="🎓" title="진행중인 세션이 없습니다" action={{ href: "/cad-school", label: "멘토 찾기" }} />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {sessions.map((s) => (
                <Link key={s.id} href={`/cad-school/session/${s.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <SessionStatusBadge status={s.status} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", background: "#dbeafe", padding: "2px 6px", borderRadius: 4 }}>
                            {s.role === "mentor" ? "멘토" : "멘티"}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{s.title}</span>
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af" }}>{s.other_name} · {timeAgo(s.created_at)}</div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", whiteSpace: "nowrap" }}>{s.price.toLocaleString("ko-KR")}원</div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "subscriptions" && (
        <div>
          {subscriptions.length === 0 ? (
            <EmptyState icon="📋" title="구독 내역이 없습니다" action={{ href: "/cad-school", label: "구독 플랜 보기" }} />
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              {subscriptions.map((sub) => {
                const limits = PLAN_LIMITS[sub.plan_type] ?? PLAN_LIMITS.basic;
                const isActive = sub.status === "active";
                const isSubscriber = sub.role === "subscriber";
                return (
                  <div key={sub.id} style={{ background: "white", border: `1px solid ${isActive ? "#e5e7eb" : "#f3f4f6"}`, borderRadius: 18, padding: "20px 22px", opacity: isActive ? 1 : 0.7 }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <SubStatusBadge status={sub.status} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: sub.role === "mentor" ? "#2563eb" : "#7c3aed", background: sub.role === "mentor" ? "#dbeafe" : "#ede9fe", padding: "2px 6px", borderRadius: 4 }}>
                            {sub.role === "mentor" ? "멘토" : "구독자"}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 900, color: GOLD, background: GOLD_LIGHT, padding: "2px 8px", borderRadius: 6 }}>
                            {PLAN_LABELS[sub.plan_type] ?? sub.plan_type}
                          </span>
                          {isSubscriber && sub.is_mentor_suspended && (
                            <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "2px 6px", borderRadius: 4 }}>멘토 정지됨</span>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: "#374151", fontWeight: 700 }}>
                          {isSubscriber ? `멘토: ${sub.other_name}` : `구독자: ${sub.other_name}`}
                        </div>
                        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                          만료일: {new Date(sub.expires_at).toLocaleDateString("ko-KR")} · {sub.price.toLocaleString("ko-KR")}원/월
                        </div>
                      </div>

                      <Link href={`/cad-school/subscription/${sub.id}`} style={{ fontSize: 13, fontWeight: 800, color: "white", background: "#111827", padding: "8px 16px", borderRadius: 10, textDecoration: "none", whiteSpace: "nowrap" }}>
                        채팅방 →
                      </Link>
                    </div>

                    {/* 쿼터 바 (구독자 전용) */}
                    {isSubscriber && isActive && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 14 }}>
                        <MiniQuotaBar label="첨삭" used={sub.checklist_count} total={limits.checklist} color="#7c3aed" />
                        <MiniQuotaBar label="검수" used={sub.review_count} total={limits.review} color="#b45309" />
                        {limits.stl < 9999
                          ? <MiniQuotaBar label="STL" used={sub.stl_upload_count} total={limits.stl} color="#0369a1" />
                          : <div style={{ fontSize: 11, color: "#16a34a", fontWeight: 700, padding: "4px 0" }}>STL 무제한</div>}
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    {isSubscriber && isActive && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => handleCancel(sub.id)}
                          disabled={cancelling === sub.id}
                          style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "7px 14px", cursor: "pointer" }}>
                          {cancelling === sub.id ? "처리 중..." : "구독 해지"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function MiniQuotaBar({ label, used, total, color }: { label: string; used: number; total: number; color: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 10, color: used >= total ? "#dc2626" : "#374151", fontWeight: 700 }}>{used}/{total}</span>
      </div>
      <div style={{ background: "#e5e7eb", borderRadius: 99, height: 4 }}>
        <div style={{ height: "100%", background: pct >= 100 ? "#dc2626" : color, width: `${pct}%`, borderRadius: 99 }} />
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

function EmptyState({ icon, title, action }: { icon: string; title: string; action: { href: string; label: string } }) {
  return (
    <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "48px 20px", textAlign: "center" }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 16 }}>{title}</div>
      <Link href={action.href} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 24px", borderRadius: 12, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
        {action.label}
      </Link>
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
