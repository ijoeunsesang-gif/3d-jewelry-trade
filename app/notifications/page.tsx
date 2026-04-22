"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, sbAuthFetch, sbFetch, decodeJwt } from "@/lib/supabase-fetch";
import type { ProfileItem } from "../lib/getProfile";

type FollowItem = {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
};

type ConversationItem = {
  id: string;
  user1_id: string;
  user2_id: string;
  model_id?: string | null;
  model_title?: string | null;
  model_thumbnail?: string | null;
  updated_at: string;
};

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true);
  const [followItems, setFollowItems] = useState<FollowItem[]>([]);
  const [conversationItems, setConversationItems] = useState<ConversationItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileItem>>({});
  const [unreadLinks, setUnreadLinks] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    fetchNotifications();
    window.dispatchEvent(new Event("notifications-reset"));
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const token = getAccessToken();
      if (!token) { setLoading(false); return; }
      const uid = (decodeJwt(token) as any)?.sub as string;
      setUserId(uid);

      const [followsRes, convsRes, notifRes] = await Promise.all([
        sbAuthFetch("follows", `?following_id=eq.${uid}&order=created_at.desc&limit=20`),
        sbAuthFetch("conversations", `?or=(user1_id.eq.${uid},user2_id.eq.${uid})&order=updated_at.desc&limit=20`),
        sbAuthFetch("notifications", `?user_id=eq.${uid}&select=link,is_read&is_read=eq.false`),
      ]);

      const follows = (followsRes.data as FollowItem[]) || [];
      const convs = (convsRes.data as ConversationItem[]) || [];
      const unreadNotifs = (notifRes.data as { link: string; is_read: boolean }[]) || [];

      setFollowItems(follows);
      setConversationItems(convs);
      setUnreadLinks(new Set(unreadNotifs.map((n) => n.link)));

      const ids = new Set<string>();
      follows.forEach((item) => ids.add(item.follower_id));
      convs.forEach((item) => { ids.add(item.user1_id); ids.add(item.user2_id); });

      const idArray = Array.from(ids);
      if (idArray.length > 0) {
        const { data: profileRows } = await sbFetch("profiles", `?id=in.(${idArray.join(",")})`);
        const nextMap: Record<string, ProfileItem> = {};
        (profileRows || []).forEach((row: ProfileItem) => { nextMap[row.id] = row; });
        setProfilesMap(nextMap);
      }
    } catch (e) {
      console.error("알림 불러오기 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (link: string) => {
    setUnreadLinks((prev) => {
      const next = new Set(prev);
      next.delete(link);
      return next;
    });
  };

  const markConversationNotificationAsRead = async (conversationId: string) => {
    const link = `/messages?conversation=${conversationId}`;
    markAsRead(link);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("link", link)
      .eq("is_read", false);
    window.dispatchEvent(new Event("notifications-updated"));
  };

  const markFollowNotificationAsRead = async (followerId: string) => {
    const link = `/seller/${followerId}`;
    markAsRead(link);
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("type", "follow")
      .eq("link", link)
      .eq("is_read", false);
    window.dispatchEvent(new Event("notifications-updated"));
  };

  const markAllAsRead = async () => {
    if (!userId || unreadLinks.size === 0) return;
    setMarkingAll(true);
    try {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      setUnreadLinks(new Set());
      window.dispatchEvent(new Event("notifications-updated"));
    } catch (e) {
      console.error("전체 읽음 처리 실패:", e);
    } finally {
      setMarkingAll(false);
    }
  };

  const unreadCount = unreadLinks.size;

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "36px 20px 60px",
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 38, fontWeight: 900, color: "#111827" }}>알림</h1>
          <p style={{ margin: "10px 0 0", color: "#6b7280", fontSize: 15 }}>
            팔로우와 대화 업데이트를 확인할 수 있습니다.
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll}
            style={{
              flexShrink: 0,
              marginTop: 6,
              height: 38,
              padding: "0 16px",
              borderRadius: 10,
              border: "1px solid #d1d5db",
              background: "white",
              color: "#374151",
              fontSize: 13,
              fontWeight: 700,
              cursor: markingAll ? "not-allowed" : "pointer",
              opacity: markingAll ? 0.6 : 1,
            }}
          >
            {markingAll ? "처리 중..." : `전체 읽음 처리 (${unreadCount})`}
          </button>
        )}
      </div>

      {loading ? (
        <div style={{ marginTop: 24, color: "#6b7280" }}>불러오는 중...</div>
      ) : (
        <div style={{ marginTop: 24, display: "grid", gap: 16 }}>
          {/* 팔로우 섹션 */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              background: "white",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #f3f4f6",
                fontWeight: 900,
                color: "#111827",
              }}
            >
              새 팔로우
            </div>

            {followItems.length === 0 ? (
              <div style={{ padding: 20, color: "#6b7280" }}>팔로우 알림이 없습니다.</div>
            ) : (
              followItems.map((item) => {
                const profile = profilesMap[item.follower_id];
                const link = `/seller/${item.follower_id}`;
                const isUnread = unreadLinks.has(link);
                return (
                  <a
                    key={item.id}
                    href={link}
                    onClick={async () => { await markFollowNotificationAsRead(item.follower_id); }}
                    style={{
                      position: "relative",
                      padding: "14px 20px",
                      borderBottom: "1px solid #f8fafc",
                      borderLeft: isUnread ? "4px solid #f59e0b" : "4px solid transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textDecoration: "none",
                      color: "inherit",
                      background: isUnread ? "#fffbeb" : "white",
                      opacity: isUnread ? 1 : 0.6,
                      transition: "background 0.15s",
                    }}
                  >
                    {isUnread && (
                      <span
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 16,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#3b82f6",
                        }}
                      />
                    )}
                    <img
                      src={profile?.avatar_url || "/default-avatar.png"}
                      alt="follower"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid #e5e7eb",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: isUnread ? 700 : 400, color: "#111827" }}>
                        {profile?.nickname || "사용자"} 님이 회원님을 팔로우했습니다.
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        {new Date(item.created_at).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </a>
                );
              })
            )}
          </section>

          {/* 대화 섹션 */}
          <section
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              background: "white",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid #f3f4f6",
                fontWeight: 900,
                color: "#111827",
              }}
            >
              최근 대화 업데이트
            </div>

            {conversationItems.length === 0 ? (
              <div style={{ padding: 20, color: "#6b7280" }}>대화 알림이 없습니다.</div>
            ) : (
              conversationItems.map((item) => {
                const otherId = item.user1_id;
                const profile = profilesMap[otherId] || profilesMap[item.user2_id];
                const link = `/messages?conversation=${item.id}`;
                const isUnread = unreadLinks.has(link);
                return (
                  <a
                    key={item.id}
                    href={link}
                    onClick={async () => { await markConversationNotificationAsRead(item.id); }}
                    style={{
                      position: "relative",
                      padding: "14px 20px",
                      borderBottom: "1px solid #f8fafc",
                      borderLeft: isUnread ? "4px solid #f59e0b" : "4px solid transparent",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textDecoration: "none",
                      color: "inherit",
                      background: isUnread ? "#fffbeb" : "white",
                      opacity: isUnread ? 1 : 0.6,
                      transition: "background 0.15s",
                    }}
                  >
                    {isUnread && (
                      <span
                        style={{
                          position: "absolute",
                          top: 12,
                          right: 16,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: "#3b82f6",
                        }}
                      />
                    )}
                    <img
                      src={profile?.avatar_url || "/default-avatar.png"}
                      alt="conv"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid #e5e7eb",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: isUnread ? 700 : 400, color: "#111827" }}>
                        {item.model_title
                          ? `'${item.model_title}' 관련 대화가 있습니다.`
                          : "새로운 대화 업데이트가 있습니다."}
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
                        {new Date(item.updated_at).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </a>
                );
              })
            )}
          </section>
        </div>
      )}
    </main>
  );
}
