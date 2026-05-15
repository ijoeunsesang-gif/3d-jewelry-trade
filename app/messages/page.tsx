"use client";

import { FormEvent, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { sbFetch, sbAuthFetch, getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../lib/toast";
import type { ProfileItem } from "../lib/getProfile";
import GradeBadge from "../components/GradeBadge";
import { Grade } from "@/lib/grades";
import { Phone } from "lucide-react";

type ConversationItem = {
  id: string;
  user1_id: string;
  user2_id: string;
  model_id?: string | null;
  model_title?: string | null;
  model_thumbnail?: string | null;
  created_at: string;
  updated_at: string;
  deleted_by_user1?: boolean;
  deleted_by_user2?: boolean;
};

type MessageItem = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  image_url?: string | null;
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
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    initMessages();
  }, []);

  useEffect(() => {
    if (!messages || messages.length === 0) return;
    setTimeout(() => {
      if (chatContainerRef.current) {
        chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      }
    }, 100);
  }, [selectedConversationId, messages]);

  // 채팅창 밖으로 파일 드롭 시 브라우저가 파일 여는 것 방지
  useEffect(() => {
    const prevent = (e: DragEvent) => e.preventDefault();
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  useEffect(() => {
    if (queryConversationId) {
      setSelectedConversationId(queryConversationId);
      setMobileView("chat");
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

      const token = getAccessToken();
      if (!token) { setLoading(false); return; }
      const myId = (decodeJwt(token) as any)?.sub as string;
      setCurrentUserId(myId);

      // 중첩 and/or PostgREST 문법 대신 단순 or 쿼리로 교체 후 JS에서 소프트삭제 필터링
      // (seller 대화 model_id=null 포함 모든 대화 조회)
      const { data: convRows, error: convError } = await sbAuthFetch(
        "conversations",
        `?or=(user1_id.eq.${myId},user2_id.eq.${myId})&order=updated_at.desc`
      );

      if (convError) {
        console.error("대화 목록 불러오기 실패:", convError);
        setLoading(false);
        return;
      }

      const list = ((convRows || []) as ConversationItem[]).filter((conv) => {
        if (conv.user1_id === myId && conv.deleted_by_user1) return false;
        if (conv.user2_id === myId && conv.deleted_by_user2) return false;
        return true;
      });
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
        const { data: profileRows } = await sbFetch("profiles", `?select=id,nickname,avatar_url,bio,grade,phone_number&id=in.(${otherIds.join(",")})`);

        const nextMap: Record<string, ProfileItem> = {};
        (profileRows || []).forEach((row: ProfileItem) => {
          nextMap[row.id] = row;
        });
        setProfilesMap(nextMap);
      }
    } catch (error) {
      console.error("메시지 초기화 오류:", error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const deleteConversation = async (convId: string) => {
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;
    const column = conv.user1_id === currentUserId ? "deleted_by_user1" : "deleted_by_user2";

    setDeletingId(convId);
    try {
      await supabase
        .from("messages")
        .update({ is_read: true })
        .eq("conversation_id", convId)
        .eq("is_read", false);
      window.dispatchEvent(new Event("messages-updated"));

      const { error } = await supabase
        .from("conversations")
        .update({ [column]: true })
        .eq("id", convId);

      if (error) { showError("삭제에 실패했습니다."); return; }

      setConversations(prev => prev.filter(c => c.id !== convId));
      if (selectedConversationId === convId) {
        setSelectedConversationId("");
        setMessages([]);
      }
      showSuccess("대화가 삭제되었습니다.");
    } catch {
      showError("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
      setDeleteTargetId(null);
    }
  };

  const fetchMessages = async (conversationId: string) => {
    const { data, error } = await sbAuthFetch(
      "messages",
      `?conversation_id=eq.${conversationId}&order=created_at.asc`
    );

    if (error) {
      console.error("메시지 불러오기 실패:", error);
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
        console.error("메시지 읽음 처리 실패:", error);
        return;
      }

      window.dispatchEvent(new Event("messages-updated"));
    } catch (error) {
      console.error("메시지 읽음 처리 오류:", error);
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

  const uploadChatImage = async (file: File) => {
    if (!selectedConversationId || !currentUserId) return;
    if (!file.type.startsWith("image/")) {
      showError("이미지 파일만 첨부 가능합니다.");
      return;
    }
    setUploading(true);
    try {
      const token = getAccessToken();
      if (!token) { showError("로그인이 필요합니다."); return; }
      const path = `chat-images/${currentUserId}/${Date.now()}_${file.name}`;
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "thumbnails");
      form.append("path", path);
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "업로드 실패");
      }
      const { url } = await res.json();
      const { error: msgError } = await supabase.from("messages").insert({
        conversation_id: selectedConversationId,
        sender_id: currentUserId,
        content: null,
        image_url: url,
        is_read: false,
      });
      if (msgError) throw new Error(msgError.message);
      await fetchMessages(selectedConversationId);
      await initMessages(true);
      window.dispatchEvent(new Event("messages-updated"));
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
    } catch (err: any) {
      showError(err.message || "이미지 전송 실패");
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await uploadChatImage(file);
    e.target.value = "";
  };

  const handleImageDownload = (url: string, filename?: string) => {
    const ext = url.split(".").pop()?.split("?")[0] || "jpg";
    const name = filename || `chat-image.${ext}`;
    const proxyUrl = `/api/download-image?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(name)}`;
    const a = document.createElement("a");
    a.href = proxyUrl;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleChatDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };

  const handleChatDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleChatDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadChatImage(file);
  };

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
        console.error("메시지 전송 실패:", {
          message: messageError.message,
          details: messageError.details,
          hint: messageError.hint,
          code: messageError.code,
        });

        showError(`메시지 전송 실패: ${messageError.message || "알 수 없는 오류"}`);
        return;
      }

      const { error: updateConvError } = await supabase
        .from("conversations")
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedConversationId);

      if (updateConvError) {
        console.error("대화 업데이트 실패:", updateConvError);
      }

      setMessageText("");
      await fetchMessages(selectedConversationId);
      await initMessages(true);
      setTimeout(() => {
        chatContainerRef.current?.scrollTo({ top: chatContainerRef.current.scrollHeight, behavior: "smooth" });
      }, 100);
      window.dispatchEvent(new Event("messages-updated"));

      // 상대방에게 푸시 알림 (fire-and-forget)
      if (targetUserId) {
        const pushToken = getAccessToken();
        if (pushToken) {
          const senderName = profilesMap[currentUserId]?.nickname || "누군가";
          fetch("/api/push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${pushToken}` },
            body: JSON.stringify({
              user_id: targetUserId,
              category: "chat",
              payload: { title: `${senderName}의 새 메시지`, body: content.slice(0, 100), url: "/messages" },
            }),
          }).catch(() => {});
        }
      }
    } catch (error) {
      console.error("메시지 전송 오류:", error);
      showError("메시지 전송 중 오류가 발생했습니다.");
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
          문의함
        </h1>
        <p
          style={{
            margin: "10px 0 0",
            color: "#6b7280",
            fontSize: 15,
          }}
        >
          판매자와 구매자가 메시지를 주고받을 수 있습니다.
        </p>
      </div>

      <section
        className={`messages-layout${mobileView === "chat" ? " messages-mode-chat" : ""}`}
        style={{
          display: "grid",
          gridTemplateColumns: "320px 1fr",
          gap: 20,
          minHeight: 620,
        }}
      >
        <aside
          className="messages-list-panel"
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
            대화 목록
          </div>

          {loading ? (
            <div style={{ padding: 18, color: "#6b7280" }}>불러오는 중...</div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: 18, color: "#6b7280" }}>아직 대화가 없습니다.</div>
          ) : (
            conversations.map((conv) => {
              const otherId =
                conv.user1_id === currentUserId ? conv.user2_id : conv.user1_id;
              const otherProfile = profilesMap[otherId];

              return (
                <div key={conv.id} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={async () => {
                      setSelectedConversationId(conv.id);
                      setMobileView("chat");
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
                      background: selectedConversationId === conv.id ? "#e5e7eb" : "white",
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "12px 40px 12px 16px",
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
                      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>
                        {otherProfile?.nickname || "사용자"}
                      </div>
                      {conv.model_title && (
                        <div style={{ marginTop: 4, fontSize: 12, color: "#374151", fontWeight: 700 }}>
                          상품: {conv.model_title}
                        </div>
                      )}
                      <div style={{ marginTop: 4, fontSize: 12, color: "#6b7280" }}>
                        {new Date(conv.updated_at).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    title="대화 삭제"
                    onClick={() => setDeleteTargetId(conv.id)}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: 10,
                      transform: "translateY(-50%)",
                      width: 24,
                      height: 24,
                      borderRadius: "50%",
                      border: "none",
                      background: "rgba(0,0,0,0.06)",
                      color: "#9ca3af",
                      cursor: "pointer",
                      fontSize: 15,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    ×
                  </button>
                </div>
              );
            })
          )}
        </aside>

        <section
          className="messages-chat-panel"
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
                  <button
                    type="button"
                    className="messages-back-btn"
                    onClick={() => setMobileView("list")}
                  >
                    ← 목록
                  </button>
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
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 900, color: "#111827" }}>
                      {targetProfile.nickname || "사용자"}
                      {targetProfile.grade && <GradeBadge grade={targetProfile.grade as Grade} size="sm" />}
                    </div>
                    {targetProfile.phone_number && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                        <Phone size={11} color="#16a34a" strokeWidth={2.5} />
                        {targetProfile.phone_number}
                      </div>
                    )}
                    {!targetProfile.phone_number && (
                      <div style={{ fontSize: 12, color: "#6b7280" }}>대화 중</div>
                    )}
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
                        문의 상품
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
                        상품 보기
                      </a>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  className="messages-back-btn"
                  onClick={() => setMobileView("list")}
                >
                  ← 목록
                </button>
                <span style={{ fontWeight: 800, color: "#6b7280" }}>
                  대화를 선택하세요
                </span>
              </div>
            )}
          </div>

          <div
            ref={chatContainerRef}
            onDragOver={handleChatDragOver}
            onDragLeave={handleChatDragLeave}
            onDrop={handleChatDrop}
            style={{
              padding: 20,
              overflowY: "auto",
              background: "#f8fafc",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              position: "relative",
            }}
          >
            {dragOver && (
              <div style={{
                position: "absolute",
                inset: 0,
                background: "rgba(17,24,39,0.07)",
                border: "2px dashed #111827",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10,
                pointerEvents: "none",
              }}>
                <span style={{ fontSize: 15, fontWeight: 700, color: "#111827" }}>이미지를 여기에 놓으세요</span>
              </div>
            )}
            {uploading && (
              <div style={{ display: "flex", justifyContent: "center", padding: "8px 0", color: "#6b7280", fontSize: 13 }}>
                이미지 업로드 중...
              </div>
            )}
            {!selectedConversationId ? (
              <div style={{ color: "#6b7280" }}>왼쪽에서 대화를 선택하세요.</div>
            ) : messages.length === 0 ? (
              <div style={{ color: "#6b7280" }}>첫 메시지를 보내보세요.</div>
            ) : (
              messages.map((msg) => {
                const mine = msg.sender_id === currentUserId;
                const isImage = !!msg.image_url;

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: mine ? "flex-end" : "flex-start",
                    }}
                  >
                    {isImage ? (
                      <div style={{ maxWidth: "72%" }}>
                        <div style={{ position: "relative", display: "inline-block" }}>
                          <img
                            src={msg.image_url!}
                            alt="첨부 이미지"
                            onClick={() => setLightboxUrl(msg.image_url!)}
                            style={{
                              maxWidth: 220,
                              maxHeight: 220,
                              borderRadius: 14,
                              objectFit: "cover",
                              border: "1px solid #e5e7eb",
                              cursor: "pointer",
                              display: "block",
                            }}
                          />
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleImageDownload(msg.image_url!); }}
                            title="다운로드"
                            style={{
                              position: "absolute",
                              bottom: 6,
                              left: 6,
                              width: 26,
                              height: 26,
                              borderRadius: 7,
                              background: "rgba(0,0,0,0.5)",
                              border: "none",
                              color: "white",
                              cursor: "pointer",
                              fontSize: 13,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ⬇
                          </button>
                        </div>
                        <div style={{ marginTop: 4, fontSize: 11, opacity: 0.72, textAlign: mine ? "right" : "left" }}>
                          {new Date(msg.created_at).toLocaleString("ko-KR")}
                        </div>
                      </div>
                    ) : (
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
                    )}
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
            <button
              type="button"
              onClick={() => imageInputRef.current?.click()}
              disabled={uploading || !selectedConversationId}
              title="이미지 첨부"
              style={{
                flexShrink: 0,
                width: 44,
                height: 44,
                borderRadius: 12,
                border: "1px solid #d1d5db",
                background: "white",
                cursor: uploading || !selectedConversationId ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                fontWeight: 400,
                color: "#374151",
                opacity: uploading || !selectedConversationId ? 0.45 : 1,
              }}
            >
              +
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.gif"
              style={{ display: "none" }}
              onChange={handleImageSelect}
            />
            <input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="메시지를 입력하세요"
              style={{
                flex: 1,
                minWidth: 0,
                height: 54,
                borderRadius: 16,
                border: "1px solid #d1d5db",
                padding: "0 14px",
                outline: "none",
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />

            <button
              type="submit"
              disabled={sending || uploading || !selectedConversationId}
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
                cursor: sending || uploading || !selectedConversationId ? "not-allowed" : "pointer",
                opacity: sending || uploading || !selectedConversationId ? 0.6 : 1,
              }}
            >
              {sending ? "전송 중" : "보내기"}
            </button>
          </form>
        </section>
      </section>
      {deleteTargetId && (
        <div
          onClick={() => setDeleteTargetId(null)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
            zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "white", borderRadius: 20, padding: "28px 24px",
              width: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
              fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 8 }}>대화 삭제</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 1.6 }}>
              이 대화를 삭제하시겠습니까?<br />
              상대방의 대화 목록에는 영향이 없습니다.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: "1px solid #d1d5db", background: "white",
                  color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => deleteConversation(deleteTargetId)}
                disabled={deletingId === deleteTargetId}
                style={{
                  flex: 1, height: 44, borderRadius: 12,
                  border: "none", background: "#dc2626",
                  color: "white", fontSize: 14, fontWeight: 700,
                  cursor: deletingId === deleteTargetId ? "not-allowed" : "pointer",
                  opacity: deletingId === deleteTargetId ? 0.6 : 1,
                }}
              >
                {deletingId === deleteTargetId ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
      {lightboxUrl && (
        <div
          onClick={() => setLightboxUrl(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 10000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
          }}
        >
          <img
            src={lightboxUrl}
            alt="첨부 이미지"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: 16,
              objectFit: "contain",
            }}
          />
          <div style={{ display: "flex", gap: 12 }} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => handleImageDownload(lightboxUrl)}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                background: "white",
                color: "#111827",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
              }}
            >
              다운로드
            </button>
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              style={{
                padding: "10px 22px",
                borderRadius: 10,
                background: "rgba(255,255,255,0.18)",
                color: "white",
                fontWeight: 700,
                fontSize: 14,
                border: "none",
                cursor: "pointer",
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <MessagesContent />
    </Suspense>
  );
}