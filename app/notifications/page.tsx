"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";
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

  useEffect(() => {
    fetchNotifications();
    window.dispatchEvent(new Event("notifications-reset"));
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      const userId = session.user.id;

      const { data: follows } = await supabase
        .from("follows")
        .select("*")
        .eq("following_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: convs } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
        .order("updated_at", { ascending: false })
        .limit(20);

      setFollowItems(follows || []);
      setConversationItems(convs || []);

      const ids = new Set<string>();

      (follows || []).forEach((item: FollowItem) => ids.add(item.follower_id));
      (convs || []).forEach((item: ConversationItem) => {
        ids.add(item.user1_id);
        ids.add(item.user2_id);
      });

      const idArray = Array.from(ids);
      if (idArray.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("*")
          .in("id", idArray);

        const nextMap: Record<string, ProfileItem> = {};
        (profileRows || []).forEach((row: ProfileItem) => {
          nextMap[row.id] = row;
        });
        setProfilesMap(nextMap);
      }
    } catch (error) {
      console.error("?Œë¦¼ ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨:", error);
    } finally {
      setLoading(false);
    }
  };

  const markConversationNotificationAsRead = async (conversationId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("link", `/messages?conversation=${conversationId}`)
        .eq("is_read", false);

      if (error) {
        console.error("?€???Œë¦¼ ?½ìŒ ì²˜ë¦¬ ?¤íŒ¨:", error);
        return;
      }

      window.dispatchEvent(new Event("notifications-updated"));
    } catch (error) {
      console.error("?€???Œë¦¼ ?½ìŒ ì²˜ë¦¬ ?¤ë¥˜:", error);
    }
  };

  const markFollowNotificationAsRead = async (followerId: string) => {
    try {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("type", "follow")
        .eq("link", `/seller/${followerId}`)
        .eq("is_read", false);

      if (error) {
        console.error("?”ë¡œ???Œë¦¼ ?½ìŒ ì²˜ë¦¬ ?¤íŒ¨:", error);
        return;
      }

      window.dispatchEvent(new Event("notifications-updated"));
    } catch (error) {
      console.error("?”ë¡œ???Œë¦¼ ?½ìŒ ì²˜ë¦¬ ?¤ë¥˜:", error);
    }
  };  

  return (
    <main
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "36px 20px 60px",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1
        style={{
          margin: 0,
          fontSize: 38,
          fontWeight: 900,
          color: "#111827",
        }}
      >
        ?Œë¦¼
      </h1>

      <p
        style={{
          margin: "10px 0 0",
          color: "#6b7280",
          fontSize: 15,
        }}
      >
        ?”ë¡œ?°ì? ?€???…ë°?´íŠ¸ë¥??•ì¸?????ˆìŠµ?ˆë‹¤.
      </p>

      {loading ? (
        <div style={{ marginTop: 24, color: "#6b7280" }}>ë¶ˆëŸ¬?¤ëŠ” ì¤?..</div>
      ) : (
        <div
          style={{
            marginTop: 24,
            display: "grid",
            gap: 16,
          }}
        >
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
              ???”ë¡œ??
            </div>

            {followItems.length === 0 ? (
              <div style={{ padding: 20, color: "#6b7280" }}>?”ë¡œ???Œë¦¼???†ìŠµ?ˆë‹¤.</div>
            ) : (
              followItems.map((item) => {
                const profile = profilesMap[item.follower_id];
                return (
                    <a
                      key={item.id}
                      href={`/seller/${item.follower_id}`}
                      onClick={async () => {
                        await markFollowNotificationAsRead(item.follower_id);
                      }}
                      style={{
                        padding: "14px 20px",
                        borderBottom: "1px solid #f8fafc",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        textDecoration: "none",
                        color: "inherit",
                      }}
                    >
                    <img
                      src={profile?.avatar_url || "/default-avatar.png"}
                      alt="follower"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid #e5e7eb",
                      }}
                    />

                    <div>
                      <div style={{ fontWeight: 900, color: "#111827" }}>
                        {profile?.nickname || "?¬ìš©??} ?˜ì´ ?Œì›?˜ì„ ?”ë¡œ?°í–ˆ?µë‹ˆ??
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
              ìµœê·¼ ?€???…ë°?´íŠ¸
            </div>

            {conversationItems.length === 0 ? (
              <div style={{ padding: 20, color: "#6b7280" }}>?€???Œë¦¼???†ìŠµ?ˆë‹¤.</div>
            ) : (
              conversationItems.map((item) => {
                const otherId = item.user1_id;
                const profile = profilesMap[otherId] || profilesMap[item.user2_id];

                return (
                    <a
                      key={item.id}
                      href={`/messages?conversation=${item.id}`}
                      onClick={async () => {
                        await markConversationNotificationAsRead(item.id);
                      }}
                      style={{
                      padding: "14px 20px",
                      borderBottom: "1px solid #f8fafc",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <img
                      src={profile?.avatar_url || "/default-avatar.png"}
                      alt="conv"
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: "50%",
                        objectFit: "cover",
                        border: "1px solid #e5e7eb",
                      }}
                    />

                    <div>
                      <div style={{ fontWeight: 900, color: "#111827" }}>
                        {item.model_title
                          ? `'${item.model_title}' ê´€???€?”ê? ?ˆìŠµ?ˆë‹¤.`
                          : "?ˆë¡œ???€???…ë°?´íŠ¸ê°€ ?ˆìŠµ?ˆë‹¤."}
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