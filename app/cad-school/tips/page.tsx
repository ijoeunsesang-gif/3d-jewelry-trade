"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import MentorNickname from "../../components/MentorNickname";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showInfo } from "../../lib/toast";

const GOLD = "#c9a84c";
const GOLD_LIGHT = "#fdf6e3";
const PER_PAGE = 10;

const CAD_TABS = [
  { key: "feedback",      label: "자유 피드백",        href: "/cad-school?tab=feedback" },
  { key: "paid-feedback", label: "유료 피드백",        href: "/cad-school?tab=paid-feedback" },
  { key: "mission",       label: "미션 게시판",        href: "/cad-school?tab=mission" },
  { key: "tips",          label: "멘토 팁/노하우",      href: "/cad-school/tips" },
  { key: "subscription",  label: "1:1 멘토(유료)",      href: "/cad-school?tab=subscription" },
];

const CURRENT_YEAR = new Date().getFullYear();

type Tip = {
  id: string;
  title: string;
  content: string;
  images: string[];
  like_count: number;
  bookmark_count: number;
  comment_count: number;
  created_at: string;
  mentor: {
    id: string;
    avg_rating: number;
    career_start_year: number | null;
    profiles: { nickname: string | null; avatar_url: string | null } | null;
  } | null;
};

export default function TipsPageWrapper() {
  return (
    <Suspense fallback={null}>
      <TipsPage />
    </Suspense>
  );
}

function TipsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page   = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const search = searchParams.get("search") ?? "";

  const [tips, setTips]       = useState<Tip[]>([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchInput, setSearchInput] = useState(search);
  const [isMentor, setIsMentor] = useState(false);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      const uid = payload?.sub ?? null;
      setMyUserId(uid);
      if (uid) {
        supabase.from("cad_mentors").select("id").eq("user_id", uid).eq("is_active", true).maybeSingle()
          .then(({ data }) => { if (data) setIsMentor(true); });
      }
    }
  }, []);

  useEffect(() => {
    loadTips();
  }, [page, search]);

  const loadTips = async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    const res = await fetch(`/api/cad-school/tips?${params}`);
    const d = await res.json();
    setTips(d.tips ?? []);
    setTotal(d.total ?? 0);
    setLoading(false);
  };

  const doSearch = () => {
    const p = new URLSearchParams();
    if (searchInput.trim()) p.set("search", searchInput.trim());
    p.set("page", "1");
    router.push(`/cad-school/tips?${p}`);
  };

  const totalPages = Math.ceil(total / PER_PAGE);

  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 페이지 타이틀 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#111827", lineHeight: 1.2 }}>캐드스쿨</h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "#6b7280" }}>질문 · 피드백 · 1:1 멘토링</p>
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
        <span style={{ padding: "8px 16px", borderRadius: 10, background: "#c9a84c", color: "white", fontWeight: 800, fontSize: 13, whiteSpace: "nowrap" }}>내 강의실 바로가기 →</span>
      </Link>

      {/* 탭 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, background: "white", borderRadius: 16, padding: 6, border: "1px solid #e5e7eb", overflowX: "auto" }}>
        {CAD_TABS.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: 12,
              background: t.key === "tips" ? "#111827" : "transparent",
              color: t.key === "tips" ? "white" : "#6b7280",
              fontWeight: t.key === "tips" ? 800 : 600,
              fontSize: 13,
              textDecoration: "none",
              whiteSpace: "nowrap",
              textAlign: "center",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* 헤더: 검색 + 글쓰기 */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, alignItems: "center" }}>
        <div style={{ flex: 1, display: "flex", gap: 8 }}>
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
            placeholder="제목 또는 내용 검색..."
            style={{ flex: 1, padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 14, outline: "none", fontFamily: "inherit" }}
          />
          <button
            onClick={doSearch}
            style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: "#111827", color: "white", fontWeight: 700, fontSize: 13, cursor: "pointer" }}
          >
            검색
          </button>
        </div>
        {isMentor && (
          <Link
            href="/cad-school/tips/new"
            style={{ padding: "10px 18px", borderRadius: 12, border: "none", background: GOLD, color: "white", fontWeight: 800, fontSize: 13, textDecoration: "none", whiteSpace: "nowrap" }}
          >
            + 팁 작성
          </Link>
        )}
      </div>

      {/* 검색 결과 표시 */}
      {search && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 13, color: "#6b7280" }}>"{search}" 검색 결과 {total}건</span>
          <Link href="/cad-school/tips" style={{ fontSize: 12, color: "#9ca3af", textDecoration: "none", background: "#f3f4f6", borderRadius: 6, padding: "2px 8px" }}>× 초기화</Link>
        </div>
      )}

      {/* 팁 목록 */}
      {loading ? (
        <div style={{ padding: "60px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>불러오는 중...</div>
      ) : tips.length === 0 ? (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 18, padding: "60px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 14 }}>💡</div>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 6 }}>아직 팁이 없습니다</div>
          <div style={{ fontSize: 13, color: "#9ca3af" }}>{isMentor ? "첫 번째 팁을 작성해보세요!" : "멘토들이 팁을 공유하면 여기서 확인할 수 있어요"}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {tips.map((tip) => <TipCard key={tip.id} tip={tip} />)}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 28, flexWrap: "wrap" }}>
          {page > 1 && (
            <PageBtn label="←" href={buildHref(page - 1, search)} />
          )}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .reduce<(number | "...")[]>((acc, p, i, arr) => {
              if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push("...");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} style={{ padding: "8px 6px", fontSize: 14, color: "#9ca3af" }}>…</span>
              ) : (
                <PageBtn key={p} label={String(p)} href={buildHref(p as number, search)} active={p === page} />
              )
            )}
          {page < totalPages && (
            <PageBtn label="→" href={buildHref(page + 1, search)} />
          )}
        </div>
      )}
    </main>
  );
}

function buildHref(p: number, search: string) {
  const params = new URLSearchParams({ page: String(p) });
  if (search) params.set("search", search);
  return `/cad-school/tips?${params}`;
}

function PageBtn({ label, href, active }: { label: string; href: string; active?: boolean }) {
  return (
    <Link
      href={href}
      style={{
        padding: "8px 14px", borderRadius: 10,
        background: active ? "#111827" : "white",
        color: active ? "white" : "#374151",
        border: active ? "none" : "1px solid #e5e7eb",
        fontWeight: active ? 800 : 600, fontSize: 14,
        textDecoration: "none",
      }}
    >
      {label}
    </Link>
  );
}

function TipCard({ tip }: { tip: Tip }) {
  const mentor = tip.mentor;
  const careerYrs = mentor?.career_start_year ? CURRENT_YEAR - mentor.career_start_year : null;

  return (
    <Link href={`/cad-school/tips/${tip.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{ background: "white", border: "1.5px solid #e5e7eb", borderRadius: 18, padding: "18px 20px", cursor: "pointer", transition: "border-color 0.15s, box-shadow 0.15s" }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.borderColor = "#111827"; el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)"; }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.borderColor = "#e5e7eb"; el.style.boxShadow = "none"; }}
      >
        {/* 제목 */}
        <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 10, lineHeight: 1.4 }}>{tip.title}</div>

        {/* 미리보기 텍스트 */}
        <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.6, marginBottom: 14, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {tip.content}
        </div>

        {/* 이미지 썸네일 */}
        {tip.images.length > 0 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {tip.images.slice(0, 3).map((url, i) => (
              <img key={i} src={url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", border: "1px solid #e5e7eb" }} />
            ))}
            {tip.images.length > 3 && (
              <div style={{ width: 56, height: 56, borderRadius: 8, background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                +{tip.images.length - 3}
              </div>
            )}
          </div>
        )}

        {/* 하단: 멘토 정보 + 통계 */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Avatar url={mentor?.profiles?.avatar_url} size={28} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#374151" }}>
                <MentorNickname
                  mentorId={mentor?.id ?? ""}
                  nickname={mentor?.profiles?.nickname ?? "멘토"}
                  isMentor={!!mentor?.id}
                />
              </span>
              {careerYrs !== null && (
                <span style={{ fontSize: 11, color: "#9ca3af", background: "#f3f4f6", borderRadius: 4, padding: "1px 5px" }}>경력 {careerYrs}년</span>
              )}
              {mentor && mentor.avg_rating > 0 && (
                <span style={{ fontSize: 11, color: GOLD, fontWeight: 700 }}>★ {mentor.avg_rating.toFixed(1)}</span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Stat icon="❤️" count={tip.like_count} />
            <Stat icon="🔖" count={tip.bookmark_count} />
            <Stat icon="💬" count={tip.comment_count} />
            <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(tip.created_at)}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Stat({ icon, count }: { icon: string; count: number }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 12, color: "#6b7280" }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      {count}
    </span>
  );
}

function Avatar({ url, size }: { url?: string | null; size: number }) {
  return url ? (
    <img src={url} alt="avatar" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.5, flexShrink: 0, color: "#9ca3af" }}>👤</div>
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
