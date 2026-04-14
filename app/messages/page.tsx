"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { showError, showSuccess } from "../lib/toast";
import type { ProfileItem } from "../lib/getProfile";

type ConversationItem = {
  id: string;
  user1_id: string;
  user2_id: string;
  model_id?: string | null;
  model_title?: string | null;
  model_thumbnail?: string | null;
  created_at: string;
  updated_at: string;
};

type MessageItem = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  is_read?: boolean;
};

function MessagesContent() {
  const searchParams = useSearchParams();
  const queryConversationId = searchParams.get("conversation") || "";

  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState("");
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [profilesMap, setProfilesMap] = useState<Record<string, ProfileItem>>({});
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    initMessages();
  }, []);

  useEffect(() => {
    if (queryConversationId) {
      setSelectedConversationId(queryConversationId);
    }
  }, [queryConversationId]);

  useEffect(() => {
    if (!selectedConversationId) return;

    fetchMessages(selectedConversationId);

    if (currentUserId) {
      markConversationAsRead(selectedConversationId, currentUserId);
    }

    const channel = supabase
      .channel(`messages-${selectedConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedConversationId}`,
        },
        () => {
          fetchMessages(selectedConversationId);
          if (currentUserId) {
            markConversationAsRead(selectedConversationId, currentUserId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedConversationId, currentUserId]);

  const initMessages = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLoading(false);
        return;
      }

      const myId = session.user.id;
      setCurrentUserId(myId);

      const { data: convRows, error: convError } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${myId},user2_id.eq.${myId}`)
        .order("updated_at", { ascending: false });

      if (convError) {
        console.error("?€??ëª©ë¡ ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨:", convError);
        setLoading(false);
        return;
      }

      const list = (convRows || []) as ConversationItem[];
      setConversations(list);

      if (!selectedConversationId && list.length > 0) {
        setSelectedConversationId(queryConversationId || list[0].id);
      }

      const otherIds = Array.from(
        new Set(
          list.map((conv) => (conv.user1_id === myId ? conv.user2_id : conv.user1_id))
        )
      );

      if (otherIds.length > 0) {
        const { data: profileRows } = await supabase
          .from("profiles")
          .select("*")
          .in("id", otherIds);

        const nextMap: Record<string, ProfileItem> = {};
        (profileRows || []).forEach((row: ProfileItem) => {
          nextMap[row.id] = row;
        });
        setProfilesMap(nextMap);
      }
    } catch (error) {
      console.error("ë©”ì‹œì§€ ì´ˆê¸°???¤ë¥˜:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("ë©”ì‹œì§€ ë¶ˆëŸ¬?¤ê¸° ?¤íŒ¨:", error);
      return;
    }

    setMessages((data || []) as MessageItem[]);
  };

  const markConversationAsRead = async (conversationId: string, myId: string) => {
    try {
      const { error } = await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", conversationId)
        .eq("is_read", false)
        .neq("sender_id", myId);

      if (error) {
        console.error("ë©”ì‹œì§€ ?½ìŒ ì²˜ë¦¬ ?¤íŒ¨:", error);
        return;
      }

      window.dispatchEvent(new Event("messages-updated"));
    } catch (error) {
      console.error("ë©”ì‹œì§€ ?½ìŒ ì²˜ë¦¬ ?¤ë¥˜:", error);
    }
  };  

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedConversationId) || null,
    [conversations, selectedConversationId]
  );

  const targetUserId = selectedConversation
    ? selectedConversation.user1_id === currentUserId
      ? selectedConversation.user2_id
      : selectedConversation.user1_id
    : "";

  const targetProfile = targetUserId ? profilesMap[targetUserId] : null;

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();

    if (!selectedConversationId || !messageText.trim() || !currentUserId) return;

    try {
      setSending(true);

      const content = messageText.trim();

      const { error: messageError } = await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        sender_id: currentUserId,
        content,
        is_read: false,
      });

      if (messageError) {
        console.error("ë©”ì‹œì§€ ?„ì†¡ ?¤íŒ¨:", {
          message: messageError.message,
          details: messageError.details,
          hint: messageError.hint,
          code: messageError.code,
        });

        showError(`ë©”ì‹œì§€ ?„ì†¡ ?¤íŒ¨: ${messageError.message || "?????†ëŠ” ?¤ë¥˜"}`);
        return;
      }

      const { error: updateConvError } = await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedConversationId);

      if (updateConvError) {
        console.error("?€???…ë°?´íŠ¸ ?¤íŒ¨:", updateConvError);
      }

      setMessageText("");
      await fetchMessages(selectedConversationId);
      await initMessages(true);
      window.dispatchEvent(new Event("messages-updated"));
    } catch (error) {
      console.error("ë©”ì‹œì§€ ?„ì†¡ ?¤ë¥˜:", error);
      showError("ë©”ì‹œì§€ ?„ì†¡ ì¤??¤ë¥˜ê°€ ë°œìƒ?ˆìŠµ?ˆë‹¤.");
    } finally {
      setSending(false);
    }
  };

  return (
    <main
      className="messages-main"
      style={{
        maxWidth: 1240,
        margin: "0 auto",
        padding: "32px 20px 60px",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: 0,
            fontSize: 38,
            fontWeight: 900,
            color: "#111827",
          }}
        >
          ë¬¸ì˜??
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            color: "#6b7280",
            fontSize: 15,
          }}
        >
          ?ë§¤?ì? êµ¬ë§¤?ê? ë©”ì‹œì§€ë¥?ì£¼ê³ ë°›ì„ ???ˆìŠµ?ˆë‹¤.
        </p>
      </div>

      <section
        className="messages-layout"
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 20,
          minHeight: 620,
        }}
      >
        <aside
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            background: "white",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: 58,
              padding: "0 18px",
              display: "flex",
              alignItems: "center",
              borderBottom: "1px solid #f3f4f6",
              fontWeight: 900,
              color: "#111827",
            }}
          >
            ?€??ëª©ë¡
          </div>

          {loading ? (
            <div style={{ padding: 18, color: "#6b7280" }}>ë¶ˆëŸ¬?¤ëŠ” ì¤?..</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 18, color: "#6b7280" }}>?„ì§ ?€?”ê? ?†ìŠµ?ˆë‹¤.</div>
          ) : (
            conversations.map((conv) => {
              const otherId =
                conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
              const otherProfile = profilesMap[otherId];

              return (
              <button
                key={conv.id}
                type="button"
                onClick={async () => {
                  setSelectedConversationId(conv.id);

                  if (currentUserId) {
                    await markConversationAsRead(conv.id, currentUserId);
                  }
                }}
                  style={{
                    width: "100%",
                    minHeight: 90,
                    border: "none",
                    borderBottom: "1px solid #f3f4f6",
                    borderLeft: selectedConversationId === conv.id ? "3px solid #111827" : "3px solid transparent",
                    background:
                      selectedConversationId === conv.id ? "#e5e7eb" : "white",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 16px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <img
                    src={otherProfile?.avatar_url || "/default-avatar.png"}
                    alt="profile"
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1px solid #e5e7eb",
                      flexShrink: 0,
                    }}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 900,
                        color: "#111827",
                      }}
                    >
                      {otherProfile?.nickname || "?¬ìš©??}
                    </div>

                    {conv.model_title && (
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 12,
                          color: "#374151",
                          fontWeight: 700,
                        }}
                      >
                        ?í’ˆ: {conv.model_title}
                      </div>
                    )}

                    <div
                      style={{
                        marginTop: 4,
                        fontSize: 12,
                        color: "#6b7280",
                      }}
                    >
                      {new Date(conv.updated_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </aside>

        <section
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            background: "white",
            display: "grid",
            gridTemplateRows: "auto 1fr auto",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid #f3f4f6",
            }}
          >
            {targetProfile ? (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <img
                    src={targetProfile.avatar_url || "/default-avatar.png"}
                    alt="target"
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "1px solid #e5e7eb",
                    }}
                  />

                  <div>
                    <div style={{ fontWeight: 900, color: "#111827" }}>
                      {targetProfile.nickname || "?¬ìš©??}
                    </div>
                    <div style={{ fontSize: 12, color: "#6b7280" }}>
                      ?€??ì¤?
                    </div>
                  </div>
                </div>

                {selectedConversation?.model_title && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 16,
                      border: "1px solid #e5e7eb",
                      background: "#f8fafc",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                    }}
                  >
                    {selectedConversation.model_thumbnail ? (
                      <img
                        src={selectedConversation.model_thumbnail}
                        alt="model"
                        style={{
                          width: 54,
                          height: 54,
                          borderRadius: 12,
                          objectFit: "cover",
                          border: "1px solid #e5e7eb",
                        }}
                      />
                    ) : null}

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#6b7280",
                          fontWeight: 800,
                        }}
                      >
                        ë¬¸ì˜ ?í’ˆ
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 15,
                          color: "#111827",
                          fontWeight: 900,
                        }}
                      >
                        {selectedConversation.model_title}
                      </div>
                    </div>

                    {selectedConversation.model_id && (
                      <a
                        href={`/models/${selectedConversation.model_id}`}
                        style={{
                          marginLeft: "auto",
                          height: 40,
                          padding: "0 14px",
                          borderRadius: 12,
                          background: "#111827",
                          color: "white",
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          fontWeight: 800,
                        }}
                      >
                        ?í’ˆ ë³´ê¸°
                      </a>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontWeight: 800, color: "#6b7280" }}>
                ?€?”ë? ? íƒ?˜ì„¸??
              </div>
            )}
          </div>

          <div
            style={{
              padding: 20,
              overflowY: "auto",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {!selectedConversationId ? (
              <div style={{ color: "#6b7280" }}>?¼ìª½?ì„œ ?€?”ë? ? íƒ?˜ì„¸??</div>
            ) : messages.length === 0 ? (
              <div style={{ color: "#6b7280" }}>ì²?ë©”ì‹œì§€ë¥?ë³´ë‚´ë³´ì„¸??</div>
            ) : (
              messages.map((msg) => {
                const mine = msg.sender_id === currentUserId;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: mine ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "72%",
                        padding: "12px 14px",
                        borderRadius: 18,
                        background: mine ? "#111827" : "white",
                        color: mine ? "white" : "#111827",
                        border: mine ? "none" : "1px solid #e5e7eb",
                        boxShadow: mine
                          ? "none"
                          : "0 4px 14px rgba(15,23,42,0.04)",
                        lineHeight: 1.7,
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      <div style={{ fontSize: 14 }}>{msg.content}</div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 11,
                          opacity: 0.72,
                        }}
                      >
                        {new Date(msg.created_at).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <form
            onSubmit={handleSendMessage}
            className="messages-input-row"
            style={{
              borderTop: "1px solid #f3f4f6",
              padding: 12,
              display: "flex",
              gap: 10,
              alignItems: "center",
              width: "100%",
              boxSizing: "border-box",
              overflow: "hidden",
            }}
          >
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="ë©”ì‹œì§€ë¥??…ë ¥?˜ì„¸??
              style={{
                flex: 1,
                minWidth: 0,
                height: 54,
                borderRadius: 16,
                border: "1px solid #d1d5db",
                padding: "0 14px",
                outline: "none",
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              disabled={sending || !selectedConversationId}
              style={{
                flexShrink: 0,
                width: 90,
                height: 54,
                borderRadius: 16,
                border: "none",
                background: "#111827",
                color: "white",
                fontWeight: 900,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              {sending ? "?„ì†¡" : "ë³´ë‚´ê¸?}
            </button>
          </form>
        </section>
      </section>
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>ë¶ˆëŸ¬?¤ëŠ” ì¤?..</main>}>
      <MessagesContent />
    </Suspense>
  );
}