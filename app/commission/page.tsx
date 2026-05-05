"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError } from "../lib/toast";

const GOLD = "#c9a84c";

const STATUS_LABEL: Record<string, string> = {
  open: "의뢰중", in_progress: "작업중", completed: "완료",
  pending: "의뢰중", negotiating: "협의중", payment: "결제중",
  working: "작업중", downloaded: "다운완료",
  rejected: "거절됨", cancelled: "취소됨",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#2563eb", in_progress: "#d97706", completed: "#16a34a",
  pending: "#2563eb", negotiating: "#7c3aed", payment: "#d97706",
  working: "#ea580c", downloaded: "#16a34a",
  rejected: "#dc2626", cancelled: "#6b7280",
};
const STATUS_BG: Record<string, string> = {
  open: "#dbeafe", in_progress: "#fef3c7", completed: "#dcfce7",
  pending: "#dbeafe", negotiating: "#ede9fe", payment: "#fef3c7",
  working: "#fff7ed", downloaded: "#dcfce7",
  rejected: "#fef2f2", cancelled: "#f3f4f6",
};

type Tab = "public" | "given" | "received" | "joined" | "bookmarks";

type Commission = {
  id: string;
  title: string;
  images: string[];
  status: string;
  user_id: string;
  created_at: string;
  nickname: string;
  is_private: boolean;
  target_seller_id?: string | null;
  seller_nickname?: string;
  seller_grade?: string | null;
  commission_results?: { count: number }[];
};

const TABS: { key: Tab; label: string }[] = [
  { key: "public",    label: "공개의뢰" },
  { key: "given",     label: "맡긴의뢰" },
  { key: "received",  label: "받은의뢰" },
  { key: "joined",    label: "참여의뢰" },
  { key: "bookmarks", label: "즐겨찾기" },
];

export default function CommissionListPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("public");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  // 관리자 전용 필터 (맡긴의뢰 탭)
  const [adminSearch, setAdminSearch] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("");
  const [adminTypeFilter, setAdminTypeFilter] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    let uid: string | null = null;
    if (token) {
      setIsLoggedIn(true);
      const payload = decodeJwt(token) as any;
      uid = payload?.sub || null;
      setCurrentUserId(uid);
      if (uid) {
        loadBookmarks(uid);
        supabase.from("profiles").select("role").eq("id", uid).single()
          .then(({ data }) => setCurrentUserRole(data?.role || "user"));
      }
    }
    fetchCommissions("public", uid, null);
  }, []);

  const loadBookmarks = async (uid: string) => {
    const { data } = await supabase
      .from("commission_bookmarks")
      .select("commission_id")
      .eq("user_id", uid);
    if (data) {
      setBookmarkedIds(new Set(data.map((b: any) => b.commission_id)));
    }
  };

  const fetchCommissions = async (tab: Tab, uid: string | null, role: string | null) => {
    setLoading(true);
    try {
      let data: any[] = [];

      const BASE_SELECT = "id, title, images, status, user_id, created_at, is_private, target_seller_id, commission_results(count)";

      if (tab === "bookmarks") {
        if (!uid) { setCommissions([]); return; }
        const { data: bData } = await supabase
          .from("commission_bookmarks")
          .select("commission_id")
          .eq("user_id", uid);
        const ids = (bData || []).map((b: any) => b.commission_id);
        if (ids.length === 0) { setCommissions([]); return; }
        const { data: cData, error } = await supabase
          .from("commissions")
          .select(BASE_SELECT)
          .in("id", ids)
          .order("created_at", { ascending: false });
        if (error || !cData) { setCommissions([]); return; }
        data = cData;
      } else if (tab === "joined") {
        // 공개의뢰에서 내가 결과물 링크를 등록한 의뢰
        if (!uid) { setCommissions([]); return; }
        const { data: resultRows } = await supabase
          .from("commission_results")
          .select("commission_id")
          .eq("seller_id", uid);
        const ids = [...new Set((resultRows || []).map((r: any) => r.commission_id as string))];
        if (ids.length === 0) { setCommissions([]); return; }
        const { data: cData, error } = await supabase
          .from("commissions")
          .select(BASE_SELECT)
          .in("id", ids)
          .eq("is_private", false)
          .order("created_at", { ascending: false });
        if (error || !cData) { setCommissions([]); return; }
        data = cData;
      } else {
        let query = supabase
          .from("commissions")
          .select(BASE_SELECT)
          .order("created_at", { ascending: false });

        if (tab === "public") {
          query = query.eq("is_private", false);
        } else if (tab === "given") {
          // 관리자는 전체 조회, 일반 유저는 본인 의뢰만
          if (role !== "admin" && uid) query = query.eq("user_id", uid);
        } else if (tab === "received" && uid) {
          // 지목된 개인의뢰 + 판매자 미선택 개인의뢰, 단 본인이 올린 의뢰 제외
          query = query.eq("is_private", true).or(`target_seller_id.eq.${uid},target_seller_id.is.null`).neq("user_id", uid);
        }

        const { data: cData, error } = await query;
        if (error || !cData) { setCommissions([]); return; }
        data = cData;
      }

      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const sellerIds = [...new Set(
        data.filter((c: any) => c.is_private && c.target_seller_id).map((c: any) => c.target_seller_id)
      )];
      const allIds = [...new Set([...userIds, ...sellerIds])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname, grade")
        .in("id", allIds);

      const profileMap: Record<string, { nickname: string; grade: string | null }> = {};
      (profiles || []).forEach((p: any) => {
        profileMap[p.id] = { nickname: p.nickname || "익명", grade: p.grade || null };
      });

      setCommissions(data.map((c: any) => ({
        ...c,
        nickname: profileMap[c.user_id]?.nickname || "익명",
        seller_nickname: c.target_seller_id ? (profileMap[c.target_seller_id]?.nickname || "알 수 없음") : undefined,
        seller_grade: c.target_seller_id ? profileMap[c.target_seller_id]?.grade : undefined,
      })));
    } catch {
      setCommissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (!isLoggedIn && tab !== "public") return;
    fetchCommissions(tab, currentUserId, currentUserRole);
  };

  const toggleBookmark = async (e: React.MouseEvent, commissionId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isLoggedIn || !currentUserId) {
      showError("로그인이 필요합니다.");
      return;
    }
    if (bookmarkedIds.has(commissionId)) {
      await supabase
        .from("commission_bookmarks")
        .delete()
        .eq("user_id", currentUserId)
        .eq("commission_id", commissionId);
      setBookmarkedIds((prev) => { const n = new Set(prev); n.delete(commissionId); return n; });
    } else {
      await supabase
        .from("commission_bookmarks")
        .insert({ user_id: currentUserId, commission_id: commissionId });
      setBookmarkedIds((prev) => new Set(prev).add(commissionId));
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
  };

  const needsLogin = !isLoggedIn && activeTab !== "public";

  const STATUS_GROUP: Record<string, string[]> = {
    "의뢰중": ["pending", "open"],
    "결제중": ["payment"],
    "작업중": ["working", "in_progress"],
    "완료":   ["completed", "downloaded"],
    "취소":   ["cancelled", "rejected"],
  };

  const displayCommissions = (() => {
    const isAdminGiven = activeTab === "given" && currentUserRole === "admin";
    if (!isAdminGiven) return commissions;
    return commissions.filter((c) => {
      if (adminSearch) {
        const q = adminSearch.toLowerCase();
        if (!c.title.toLowerCase().includes(q) && !c.nickname.toLowerCase().includes(q)) return false;
      }
      if (adminStatusFilter) {
        const allowed = STATUS_GROUP[adminStatusFilter] ?? [];
        if (!allowed.includes(c.status)) return false;
      }
      if (adminTypeFilter === "공개의뢰" && c.is_private) return false;
      if (adminTypeFilter === "개인의뢰" && (!c.is_private || !c.target_seller_id)) return false;
      if (adminTypeFilter === "미지정의뢰" && (!c.is_private || c.target_seller_id)) return false;
      return true;
    });
  })();

  return (
    <div style={{
      maxWidth: 960, margin: "0 auto",
      padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <style>{`
        .cc-desc { font-size: 12px; color: #6b7280; line-height: 18px; height: 36px; overflow: hidden; display: flex; flex-direction: column; }
        @media (max-width: 640px) { .cc-desc { height: 54px; } }
        .cc-names { display: flex; flex-direction: row; align-items: baseline; gap: 4px; overflow: hidden; }
        @media (max-width: 640px) { .cc-names { flex-direction: column; gap: 0; } }
        .cc-name-part { display: flex; align-items: baseline; flex-shrink: 0; }
        .cc-name { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 75px; }
      `}</style>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#111827" }}>모델링 의뢰 게시판</h1>
          <p style={{ margin: "4px 0 0", fontSize: 14, color: "#6b7280" }}>원하는 3D 모델링을 판매자에게 의뢰하세요</p>
        </div>
        {isLoggedIn && (
          <Link href="/commission/new" style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "10px 18px", borderRadius: 10,
            background: GOLD, color: "white",
            textDecoration: "none", fontSize: 14, fontWeight: 700,
            flexShrink: 0,
          }}>
            + 의뢰 등록
          </Link>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "2px solid #e5e7eb" }}>
        {TABS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleTabChange(key)}
            style={{
              background: "none",
              border: "none",
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: activeTab === key ? "#111827" : "#6b7280",
              cursor: "pointer",
              borderBottom: activeTab === key ? "2px solid #111827" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 관리자 전용 필터 (맡긴의뢰 탭) */}
      {activeTab === "given" && currentUserRole === "admin" && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="제목 또는 의뢰자 닉네임 검색"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            style={{
              flex: "1 1 200px", height: 38, borderRadius: 10,
              border: "1.5px solid #e5e7eb", padding: "0 12px",
              fontSize: 14, outline: "none",
            }}
          />
          <select
            value={adminStatusFilter}
            onChange={(e) => setAdminStatusFilter(e.target.value)}
            style={{
              height: 38, borderRadius: 10, border: "1.5px solid #e5e7eb",
              padding: "0 10px", fontSize: 14, background: "white", cursor: "pointer",
            }}
          >
            <option value="">상태: 전체</option>
            {["의뢰중", "결제중", "작업중", "완료", "취소"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={adminTypeFilter}
            onChange={(e) => setAdminTypeFilter(e.target.value)}
            style={{
              height: 38, borderRadius: 10, border: "1.5px solid #e5e7eb",
              padding: "0 10px", fontSize: 14, background: "white", cursor: "pointer",
            }}
          >
            <option value="">타입: 전체</option>
            {["공개의뢰", "개인의뢰", "미지정의뢰"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      )}

      {needsLogin ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#6b7280" }}>로그인이 필요합니다</div>
        </div>
      ) : loading ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ borderRadius: 14, background: "#f3f4f6", height: 240 }} />
          ))}
        </div>
      ) : displayCommissions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#6b7280" }}>아직 의뢰가 없습니다</div>
          {isLoggedIn && (
            <div style={{ fontSize: 14, marginTop: 6 }}>첫 번째로 의뢰를 등록해보세요!</div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {displayCommissions.map((c) => (
            <Link key={c.id} href={`/commission/${c.id}`} style={{ textDecoration: "none" }}>
              <div
                style={{
                  borderRadius: 14, border: "1px solid #e5e7eb", background: "white",
                  overflow: "hidden", boxShadow: "0 2px 8px rgba(15,23,42,0.04)",
                  transition: "box-shadow 0.15s", position: "relative",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "0 6px 20px rgba(15,23,42,0.10)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.04)"; }}
              >
                {/* 북마크 버튼 */}
                <button
                  onClick={(e) => toggleBookmark(e, c.id)}
                  style={{
                    position: "absolute", top: 10, right: 10, zIndex: 1,
                    width: 32, height: 32, borderRadius: "50%",
                    background: "rgba(255,255,255,0.9)", border: "none",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    lineHeight: 1, padding: 0,
                    cursor: "pointer", fontSize: 20,
                    color: bookmarkedIds.has(c.id) ? "#f59e0b" : "#9ca3af",
                  }}
                >
                  {bookmarkedIds.has(c.id) ? "★" : "☆"}
                </button>

                {/* 썸네일 */}
                <div style={{ width: "100%", aspectRatio: "16/9", background: "#f8fafc", overflow: "hidden" }}>
                  {c.images && c.images[0] ? (
                    <img
                      src={c.images[0]}
                      alt={c.title}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                  ) : (
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#d1d5db", fontSize: 40,
                    }}>
                      📋
                    </div>
                  )}
                </div>

                {/* 카드 내용 */}
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {(() => {
                        const resultCount = c.commission_results?.[0]?.count ?? 0;
                        const showResultBadge = !c.is_private && c.status === "open" && resultCount >= 1;
                        return (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: showResultBadge ? "#16a34a" : (STATUS_COLOR[c.status] || "#374151"),
                            background: showResultBadge ? "#dcfce7" : (STATUS_BG[c.status] || "#f3f4f6"),
                            padding: "2px 9px", borderRadius: 999,
                          }}>
                            {showResultBadge ? `링크 ${resultCount}개` : (STATUS_LABEL[c.status] || c.status)}
                          </span>
                        );
                      })()}
                      {activeTab === "given" && (() => {
                        if (!c.is_private) return (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", background: "#dbeafe", padding: "2px 9px", borderRadius: 999 }}>
                            🌐 공개의뢰
                          </span>
                        );
                        if (c.target_seller_id) return (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#92400e", background: "#fef3c7", padding: "2px 9px", borderRadius: 999 }}>
                            👤 개인의뢰
                          </span>
                        );
                        return (
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#4b5563", background: "#f3f4f6", padding: "2px 9px", borderRadius: 999 }}>
                            👥 미지정의뢰
                          </span>
                        );
                      })()}
                    </div>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(c.created_at)}</span>
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.title}
                  </div>
                  {c.is_private && c.seller_nickname ? (() => {
                    const iAmRequester = c.user_id === currentUserId;
                    const iAmWorker = c.target_seller_id === currentUserId;
                    return (
                      <div className="cc-desc">
                        <div className="cc-names">
                          <span className="cc-name-part">
                            {iAmRequester
                              ? <strong style={{ fontWeight: 700, color: "#7c3aed" }}>내가</strong>
                              : <><span className="cc-name" style={{ color: "#374151" }}>{c.nickname}</span><span>님이</span></>}
                          </span>
                          <span className="cc-name-part">
                            {iAmWorker
                              ? <strong style={{ fontWeight: 700, color: "#7c3aed" }}>나에게</strong>
                              : <><span className="cc-name" style={{ color: "#374151" }}>{c.seller_nickname}</span><span>님에게</span></>}
                          </span>
                        </div>
                        <div>의뢰를 맡겼습니다.</div>
                      </div>
                    );
                  })() : (
                    <div className="cc-desc">
                      <div style={{ display: "flex", alignItems: "baseline", gap: 2, overflow: "hidden" }}>
                        <span className="cc-name" style={{ color: "#374151" }}>{c.nickname}</span>
                        <span>님이 의뢰를 했습니다.</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
