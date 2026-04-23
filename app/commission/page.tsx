"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError } from "../lib/toast";

const GOLD = "#c9a84c";

const STATUS_LABEL: Record<string, string> = {
  open: "의뢰중",
  in_progress: "작업중",
  completed: "완료",
};
const STATUS_COLOR: Record<string, string> = {
  open: "#2563eb",
  in_progress: "#d97706",
  completed: "#16a34a",
};
const STATUS_BG: Record<string, string> = {
  open: "#dbeafe",
  in_progress: "#fef3c7",
  completed: "#dcfce7",
};

type Tab = "public" | "private" | "mine" | "bookmarks";

type Commission = {
  id: string;
  title: string;
  images: string[];
  status: string;
  user_id: string;
  created_at: string;
  nickname: string;
  is_private: boolean;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "public", label: "공개의뢰" },
  { key: "private", label: "개인의뢰" },
  { key: "mine", label: "내 의뢰" },
  { key: "bookmarks", label: "즐겨찾기" },
];

export default function CommissionListPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("public");
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const token = getAccessToken();
    let uid: string | null = null;
    if (token) {
      setIsLoggedIn(true);
      const payload = decodeJwt(token) as any;
      uid = payload?.sub || null;
      setCurrentUserId(uid);
      if (uid) loadBookmarks(uid);
    }
    fetchCommissions("public", uid);
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

  const fetchCommissions = async (tab: Tab, uid: string | null) => {
    setLoading(true);
    try {
      let data: any[] = [];

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
          .select("id, title, images, status, user_id, created_at, is_private")
          .in("id", ids)
          .order("created_at", { ascending: false });
        if (error || !cData) { setCommissions([]); return; }
        data = cData;
      } else {
        let query = supabase
          .from("commissions")
          .select("id, title, images, status, user_id, created_at, is_private")
          .order("created_at", { ascending: false });

        if (tab === "public") {
          query = query.eq("is_private", false);
        } else if (tab === "private" && uid) {
          query = query.eq("is_private", true).or(`user_id.eq.${uid},target_seller_id.eq.${uid}`);
        } else if (tab === "mine" && uid) {
          query = query.eq("user_id", uid);
        }

        const { data: cData, error } = await query;
        if (error || !cData) { setCommissions([]); return; }
        data = cData;
      }

      const userIds = [...new Set(data.map((c: any) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nickname")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p: any) => { profileMap[p.id] = p.nickname || "익명"; });

      setCommissions(data.map((c: any) => ({ ...c, nickname: profileMap[c.user_id] || "익명" })));
    } catch {
      setCommissions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    if (!isLoggedIn && tab !== "public") return;
    fetchCommissions(tab, currentUserId);
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

  return (
    <div style={{
      maxWidth: 960, margin: "0 auto",
      padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
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
      ) : commissions.length === 0 ? (
        <div style={{ textAlign: "center", padding: "80px 0", color: "#9ca3af" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#6b7280" }}>아직 의뢰가 없습니다</div>
          {isLoggedIn && (
            <div style={{ fontSize: 14, marginTop: 6 }}>첫 번째로 의뢰를 등록해보세요!</div>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 20 }}>
          {commissions.map((c) => (
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
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: STATUS_COLOR[c.status] || "#374151",
                      background: STATUS_BG[c.status] || "#f3f4f6",
                      padding: "2px 9px", borderRadius: 999,
                    }}>
                      {STATUS_LABEL[c.status] || c.status}
                    </span>
                    <span style={{ fontSize: 11, color: "#9ca3af" }}>{formatDate(c.created_at)}</span>
                  </div>
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {c.title}
                  </div>
                  <div style={{ fontSize: 12, color: "#6b7280" }}>{c.nickname}</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
