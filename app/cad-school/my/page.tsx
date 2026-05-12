"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";

const GOLD = "#c9a84c";
type MyTab = "posts" | "sessions" | "packages";

type Post = { id: string; title: string; status: string; created_at: string; comment_count?: number };
type Session = {
  id: string; title: string; status: string; price: number; created_at: string;
  role: "mentor" | "mentee";
  other_name: string;
};
type Package = {
  id: string; package_type: string; status: string; remaining_count: number; total_count: number;
  expires_at: string | null; price: number; created_at: string;
  role: "mentor" | "mentee";
  other_name: string;
};

export default function MyActivityPage() {
  const router = useRouter();
  const [tab, setTab] = useState<MyTab>("posts");
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);

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
    await Promise.all([loadPosts(uid), loadSessions(uid), loadPackages(uid)]);
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

  const loadPackages = async (uid: string) => {
    const { data: myMentor } = await supabase.from("cad_mentors").select("id").eq("user_id", uid).maybeSingle();
    const mentorId = myMentor?.id;

    const { data: asMentee } = await supabase
      .from("cad_packages")
      .select("id, package_type, status, remaining_count, total_count, expires_at, price, created_at, mentor:cad_mentors(profiles(nickname))")
      .eq("mentee_id", uid)
      .order("created_at", { ascending: false });

    const mentee: Package[] = (asMentee ?? []).map((p: unknown) => {
      const pkg = p as { id: string; package_type: string; status: string; remaining_count: number; total_count: number; expires_at: string | null; price: number; created_at: string; mentor: { profiles: { nickname: string } | null } | null };
      return { ...pkg, role: "mentee", other_name: pkg.mentor?.profiles?.nickname ?? "멘토" };
    });

    let mentor: Package[] = [];
    if (mentorId) {
      const { data: asMentor } = await supabase
        .from("cad_packages")
        .select("id, package_type, status, remaining_count, total_count, expires_at, price, created_at, mentee_profile:profiles!cad_packages_mentee_id_fkey(nickname)")
        .eq("mentor_id", mentorId)
        .order("created_at", { ascending: false });
      mentor = (asMentor ?? []).map((p: unknown) => {
        const pkg = p as { id: string; package_type: string; status: string; remaining_count: number; total_count: number; expires_at: string | null; price: number; created_at: string; mentee_profile: { nickname: string } | null };
        return { ...pkg, role: "mentor", other_name: pkg.mentee_profile?.nickname ?? "멘티" };
      });
    }

    setPackages([...mentor, ...mentee].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  const TABS: { key: MyTab; label: string; count: number }[] = [
    { key: "posts", label: "내 질문", count: posts.length },
    { key: "sessions", label: "건별 세션", count: sessions.length },
    { key: "packages", label: "패키지", count: packages.length },
  ];

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;

  return (
    <main style={{ maxWidth: 760, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>내 활동</span>
      </div>

      {/* 탭 */}
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

      {tab === "packages" && (
        <div>
          {packages.length === 0 ? (
            <EmptyState icon="📦" title="구매한 패키지가 없습니다" action={{ href: "/cad-school", label: "패키지 둘러보기" }} />
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {packages.map((p) => (
                <Link key={p.id} href={`/cad-school/package/${p.id}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 14, padding: "16px 18px", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <PackageStatusBadge status={p.status} />
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#2563eb", background: "#dbeafe", padding: "2px 6px", borderRadius: 4 }}>
                            {p.role === "mentor" ? "멘토" : "멘티"}
                          </span>
                          <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{p.package_type} 패키지</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>{p.other_name}</span>
                          <span style={{ fontSize: 12, color: "#111827", fontWeight: 700 }}>남은 횟수: {p.remaining_count}/{p.total_count}</span>
                          {p.expires_at && <span style={{ fontSize: 12, color: "#9ca3af" }}>만료: {new Date(p.expires_at).toLocaleDateString("ko-KR")}</span>}
                        </div>
                      </div>
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827", whiteSpace: "nowrap" }}>{p.price.toLocaleString("ko-KR")}원</div>
                    </div>
                    {/* 진행 바 */}
                    <div style={{ marginTop: 10, background: "#f3f4f6", borderRadius: 99, height: 4 }}>
                      <div style={{ height: "100%", background: GOLD, width: `${((p.total_count - p.remaining_count) / p.total_count) * 100}%`, borderRadius: 99 }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
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

function PackageStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active:    { label: "진행중", color: "#1d4ed8", bg: "#dbeafe" },
    exhausted: { label: "소진됨", color: "#dc2626", bg: "#fee2e2" },
    expired:   { label: "만료됨", color: "#6b7280", bg: "#f3f4f6" },
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
