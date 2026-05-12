"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../../../lib/toast";

const GOLD = "#c9a84c";
type FileItem = { name: string; url: string; ext: string };

type Package = {
  id: string;
  package_type: string;
  total_count: number;
  remaining_count: number;
  price: number;
  status: string;
  expires_at: string | null;
  mentor_id: string;
  mentee_id: string;
  mentor: { user_id: string; profiles: { nickname: string | null; avatar_url: string | null } | null } | null;
  mentee_profile: { nickname: string | null; avatar_url: string | null } | null;
};

type ChatMsg = {
  id: string;
  content: string;
  files: FileItem[];
  is_answer_complete: boolean;
  created_at: string;
  sender_id: string;
  profiles: { nickname: string | null; avatar_url: string | null } | null;
};

export default function PackageChatPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [pkg, setPkg] = useState<Package | null>(null);
  const [chats, setChats] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [markingComplete, setMarkingComplete] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      setMyUserId(payload?.sub ?? null);
    }
    loadData();
  }, [id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chats]);

  const loadData = async () => {
    setLoading(true);
    const { data: pkgData } = await supabase
      .from("cad_packages")
      .select("id, package_type, total_count, remaining_count, price, status, expires_at, mentor_id, mentee_id, mentor:cad_mentors(user_id, profiles(nickname, avatar_url)), mentee_profile:profiles!cad_packages_mentee_id_fkey(nickname, avatar_url)")
      .eq("id", id)
      .single();

    if (!pkgData) { router.push("/cad-school/my"); return; }
    setPkg(pkgData as unknown as Package);

    const { data: chatData } = await supabase
      .from("cad_package_chats")
      .select("id, content, files, is_answer_complete, created_at, sender_id, profiles(nickname, avatar_url)")
      .eq("package_id", id)
      .order("created_at", { ascending: true });

    setChats((chatData ?? []) as unknown as ChatMsg[]);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (files.length + selected.length > 5) { showError("파일은 최대 5개까지 첨부 가능합니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/packages/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const d = await res.json();
      if (d.url) setFiles((prev) => [...prev, { name: file.name, url: d.url, ext }]);
      else showError(`업로드 실패: ${d.error || file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const sendMessage = async (isComplete = false) => {
    if (!content.trim() && files.length === 0) { showError("내용을 입력하거나 파일을 첨부해주세요."); return; }
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (!pkg) return;

    if (isComplete && pkg.remaining_count <= 0) { showError("남은 횟수가 없습니다."); return; }

    setSending(true);

    const { error: insertErr } = await supabase.from("cad_package_chats").insert({
      package_id: id,
      sender_id: myUserId,
      content: content.trim(),
      files,
      is_answer_complete: isComplete,
    });

    if (insertErr) { showError(insertErr.message); setSending(false); return; }

    if (isComplete) {
      const newRemaining = Math.max(0, pkg.remaining_count - 1);
      const newStatus = newRemaining <= 0 ? "exhausted" : "active";
      await supabase.from("cad_packages").update({ remaining_count: newRemaining, status: newStatus }).eq("id", id);
      showSuccess(`답변 완료! 남은 횟수: ${newRemaining}회`);
    }

    setContent("");
    setFiles([]);
    setSending(false);
    loadData();
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  if (!pkg) return null;

  const isMentor = pkg.mentor?.user_id === myUserId;
  const isActive = pkg.status === "active";
  const usedCount = pkg.total_count - pkg.remaining_count;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', height: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <Link href="/cad-school/my" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 내 활동</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>{pkg.package_type} 패키지</span>
      </div>

      {/* 패키지 상태 바 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "14px 18px", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 20 }}>
            <ParticipantInfo label="멘토" nickname={pkg.mentor?.profiles?.nickname} avatar={pkg.mentor?.profiles?.avatar_url} />
            <ParticipantInfo label="멘티" nickname={pkg.mentee_profile?.nickname} avatar={pkg.mentee_profile?.avatar_url} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>남은 횟수</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: pkg.remaining_count > 0 ? "#111827" : "#dc2626" }}>
                {pkg.remaining_count} / {pkg.total_count}
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 12, color: "#6b7280" }}>상태</div>
              <StatusBadge status={pkg.status} />
            </div>
          </div>
        </div>
        <div style={{ marginTop: 10, background: "#f3f4f6", borderRadius: 99, height: 6, overflow: "hidden" }}>
          <div style={{ height: "100%", background: GOLD, width: `${(usedCount / pkg.total_count) * 100}%`, borderRadius: 99, transition: "width 0.3s" }} />
        </div>
      </div>

      {/* 채팅 영역 */}
      <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e5e7eb", borderRadius: 16, background: "#f9fafb", padding: "16px", marginBottom: 12, minHeight: 300 }}>
        {chats.length === 0 ? (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: "40px 0" }}>
            대화를 시작해보세요!
          </div>
        ) : (
          chats.map((msg) => (
            <ChatBubble key={msg.id} msg={msg} isMe={msg.sender_id === myUserId} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 영역 */}
      {isActive ? (
        <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 16, padding: "14px 16px" }}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="메시지를 입력하세요..."
            rows={3}
            style={{ width: "100%", padding: "10px 12px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit", resize: "none", marginBottom: 10 }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div style={{ display: "flex", gap: 8, flex: 1, flexWrap: "wrap" }}>
              {files.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "3px 8px", fontSize: 12 }}>
                  <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                  <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                  <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>×</button>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()} style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}>
                {uploading ? "업로드 중..." : "📎 파일"}
              </button>
              <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm" style={{ display: "none" }} onChange={handleFileChange} />
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => sendMessage(false)} disabled={sending || uploading} style={{ padding: "8px 18px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                전송
              </button>
              {isMentor && (
                <button onClick={() => sendMessage(true)} disabled={sending || uploading || pkg.remaining_count <= 0} style={{ padding: "8px 18px", borderRadius: 10, border: "none", background: GOLD, color: "white", fontWeight: 800, fontSize: 13, cursor: "pointer" }}>
                  답변 완료 (-1회)
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ background: "#f3f4f6", borderRadius: 16, padding: "16px", textAlign: "center", fontSize: 13, color: "#6b7280" }}>
          {pkg.status === "exhausted" ? "횟수가 모두 소진되었습니다." : "패키지가 만료되었습니다."}
        </div>
      )}
    </main>
  );
}

function ChatBubble({ msg, isMe }: { msg: ChatMsg; isMe: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: isMe ? "row-reverse" : "row", gap: 8, marginBottom: 14 }}>
      {!isMe && (
        msg.profiles?.avatar_url ? (
          <img src={msg.profiles.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#e5e7eb", flexShrink: 0 }} />
        )
      )}
      <div style={{ maxWidth: "70%", display: "flex", flexDirection: "column", alignItems: isMe ? "flex-end" : "flex-start", gap: 4 }}>
        {!isMe && <span style={{ fontSize: 11, color: "#6b7280", fontWeight: 600 }}>{msg.profiles?.nickname ?? "익명"}</span>}
        {msg.is_answer_complete && (
          <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, background: "#fffbeb", border: `1px solid ${GOLD}44`, borderRadius: 6, padding: "2px 8px" }}>✓ 답변 완료</div>
        )}
        {msg.content && (
          <div style={{ background: isMe ? "#111827" : "white", color: isMe ? "white" : "#111827", borderRadius: isMe ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontSize: 14, lineHeight: 1.6, border: "1px solid #e5e7eb", whiteSpace: "pre-wrap" }}>
            {msg.content}
          </div>
        )}
        {msg.files.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {msg.files.map((f, i) => <FileAttachment key={i} file={f} />)}
          </div>
        )}
        <span style={{ fontSize: 11, color: "#9ca3af" }}>{timeAgo(msg.created_at)}</span>
      </div>
    </div>
  );
}

function FileAttachment({ file }: { file: FileItem }) {
  const isImage = ["jpg","jpeg","png","webp","gif"].includes(file.ext);
  if (isImage) return <a href={file.url} target="_blank" rel="noreferrer"><img src={file.url} alt={file.name} style={{ height: 80, borderRadius: 8, border: "1px solid #e5e7eb", objectFit: "cover" }} /></a>;
  return (
    <a href={file.url} download={file.name} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f3f4f6", borderRadius: 8, padding: "6px 12px", fontSize: 12, color: "#374151", textDecoration: "none" }}>📎 {file.name}</a>
  );
}

function ParticipantInfo({ label, nickname, avatar }: { label: string; nickname?: string | null; avatar?: string | null }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{label}</span>
      {avatar ? <img src={avatar} alt="" style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} /> : <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#f3f4f6" }} />}
      <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{nickname ?? "익명"}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string }> = {
    active:   { label: "진행중",  color: "#16a34a" },
    exhausted:{ label: "소진됨",  color: "#dc2626" },
    expired:  { label: "만료됨",  color: "#6b7280" },
  };
  const info = map[status] ?? { label: status, color: "#6b7280" };
  return <span style={{ fontSize: 13, fontWeight: 800, color: info.color }}>{info.label}</span>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(dateStr).toLocaleDateString("ko-KR");
}
