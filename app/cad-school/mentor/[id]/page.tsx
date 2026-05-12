"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabase-browser";
import GradeBadge from "../../../components/GradeBadge";
import { Grade } from "@/lib/grades";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo } from "../../../lib/toast";

const GOLD = "#c9a84c";

type FileItem = { name: string; url: string; ext: string };

type Mentor = {
  id: string;
  intro: string;
  per_session_price: number;
  package_5_price: number;
  package_10_price: number;
  daily_limit: number;
  user_id: string;
  profiles: { nickname: string | null; avatar_url: string | null; grade: string | null } | null;
};

export default function MentorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string | null>(null);

  // Session request form
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      const payload = decodeJwt(token) as { sub?: string } | null;
      setMyUserId(payload?.sub ?? null);
    }
    loadMentor();
  }, [id]);

  const loadMentor = async () => {
    const { data } = await supabase
      .from("cad_mentors")
      .select("id, intro, per_session_price, package_5_price, package_10_price, daily_limit, user_id, profiles(nickname, avatar_url, grade)")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (!data) { router.push("/cad-school"); return; }
    setMentor(data as unknown as Mentor);
    setLoading(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    if (files.length + selected.length > 5) { showError("파일은 최대 5개까지 첨부할 수 있습니다."); return; }
    setUploading(true);
    for (const file of selected) {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const path = `cad-school/sessions/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const fd = new FormData();
      fd.append("file", file); fd.append("bucket", "thumbnails"); fd.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
      const data = await res.json();
      if (data.url) setFiles((prev) => [...prev, { name: file.name, url: data.url, ext }]);
      else showError(`업로드 실패: ${data.error || file.name}`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const requestPayment = async (type: "session" | "package5" | "package10") => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (!mentor) return;

    if (myUserId === mentor.user_id) { showError("본인의 멘토링은 의뢰할 수 없습니다."); return; }

    const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY;
    if (!clientKey) { showError("결제 설정이 올바르지 않습니다."); return; }

    let price = 0;
    let orderName = "";
    let packageType: "5회" | "10회" | null = null;
    let totalCount = 0;

    if (type === "session") {
      if (!title.trim()) { showError("멘토링 제목을 입력해주세요."); return; }
      if (!description.trim()) { showError("멘토링 내용을 입력해주세요."); return; }
      price = mentor.per_session_price;
      orderName = `[캐드스쿨] ${mentor.profiles?.nickname ?? "멘토"} 건별 멘토링`;
    } else if (type === "package5") {
      price = mentor.package_5_price;
      orderName = `[캐드스쿨] ${mentor.profiles?.nickname ?? "멘토"} 5회 패키지`;
      packageType = "5회"; totalCount = 5;
    } else {
      price = mentor.package_10_price;
      orderName = `[캐드스쿨] ${mentor.profiles?.nickname ?? "멘토"} 10회 패키지`;
      packageType = "10회"; totalCount = 10;
    }

    if (price < 100) { showError("결제 금액이 올바르지 않습니다."); return; }

    setPaying(true);
    try {
      if (!(window as { TossPayments?: unknown }).TossPayments) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://js.tosspayments.com/v2/standard";
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
      }

      const payload = decodeJwt(token) as { sub?: string; email?: string } | null;
      const orderId = `cad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      localStorage.setItem("pendingCadPayment", JSON.stringify({
        type,
        mentorId: mentor.id,
        menteeId: payload?.sub,
        price,
        packageType,
        totalCount,
        title: title.trim(),
        description: description.trim(),
        files,
        orderId,
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tossPayments = (window as any).TossPayments(clientKey);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const widgets = tossPayments.widgets({ customerKey: "ANONYMOUS" }) as any;
      await widgets.setAmount({ currency: "KRW", value: price });
      await widgets.requestPayment({
        orderId,
        orderName,
        successUrl: `${window.location.origin}/cad-school/payment/success`,
        failUrl: `${window.location.origin}/cad-school/payment/fail`,
        customerEmail: payload?.email ?? "",
        customerName: mentor.profiles?.nickname ?? "멘티",
      });
    } catch (e) {
      console.error("결제 실패:", e);
    } finally {
      setPaying(false);
    }
  };

  if (loading) return <main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>;
  if (!mentor) return null;

  const isMyMentor = myUserId === mentor.user_id;

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <Link href="/cad-school" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 캐드스쿨</Link>
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>멘토 프로필</span>
      </div>

      {/* 멘토 프로필 */}
      <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "28px 28px", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <Avatar url={mentor.profiles?.avatar_url} size={72} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{mentor.profiles?.nickname ?? "멘토"}</span>
              {mentor.profiles?.grade && <GradeBadge grade={mentor.profiles.grade as Grade} size="md" />}
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
              {mentor.intro || "소개글이 없습니다."}
            </p>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {mentor.per_session_price > 0 && <PricePill label="건별" price={mentor.per_session_price} color="#2563eb" />}
              {mentor.package_5_price > 0 && <PricePill label="5회 패키지" price={mentor.package_5_price} color="#16a34a" />}
              {mentor.package_10_price > 0 && <PricePill label="10회 패키지" price={mentor.package_10_price} color="#92681a" />}
            </div>
          </div>
          {isMyMentor && (
            <Link
              href="/cad-school/mentor/register"
              style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 14px", textDecoration: "none" }}
            >
              정보 수정
            </Link>
          )}
        </div>
      </div>

      {!isMyMentor && (
        <>
          {/* 건별 멘토링 */}
          {mentor.per_session_price > 0 && (
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px 28px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 4 }}>건별 멘토링</div>
                  <div style={{ fontSize: 13, color: "#6b7280" }}>1회 CAD 파일 피드백 · 최대 {mentor.daily_limit}일 마감</div>
                </div>
                <div style={{ fontSize: 20, fontWeight: 900, color: "#2563eb" }}>{mentor.per_session_price.toLocaleString("ko-KR")}원</div>
              </div>

              {!showForm ? (
                <button
                  onClick={() => setShowForm(true)}
                  style={btnStyle("#2563eb")}
                >
                  의뢰하기
                </button>
              ) : (
                <div>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="멘토링 제목 (예: 링 CAD 디테일 피드백 요청)"
                    style={{ ...inputStyle, marginBottom: 10 }}
                  />
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="어떤 피드백이 필요한지 자세히 설명해주세요."
                    rows={4}
                    style={{ ...inputStyle, resize: "vertical", marginBottom: 10 }}
                  />
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
                    {files.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: "#f3f4f6", borderRadius: 8, padding: "3px 8px", fontSize: 12 }}>
                        <span>{["jpg","jpeg","png","webp","gif"].includes(f.ext) ? "🖼" : "📎"}</span>
                        <span style={{ maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        <button onClick={() => setFiles((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af" }}>×</button>
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ fontSize: 12, color: "#6b7280", background: "#f3f4f6", border: "none", borderRadius: 8, padding: "5px 10px", cursor: "pointer" }}
                    >
                      {uploading ? "업로드 중..." : "📎 CAD 파일 첨부"}
                    </button>
                    <input ref={fileInputRef} type="file" multiple accept=".jpg,.jpeg,.png,.webp,.gif,.stl,.obj,.3dm" style={{ display: "none" }} onChange={handleFileChange} />
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => setShowForm(false)} style={{ ...btnStyle("#6b7280"), flex: 0 as unknown as number | undefined, padding: "11px 20px" }}>취소</button>
                    <button
                      onClick={() => requestPayment("session")}
                      disabled={paying || uploading}
                      style={btnStyle("#2563eb")}
                    >
                      {paying ? "결제 중..." : `결제하기 · ${mentor.per_session_price.toLocaleString("ko-KR")}원`}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 패키지 멘토링 */}
          {(mentor.package_5_price > 0 || mentor.package_10_price > 0) && (
            <div style={{ background: "white", border: "1px solid #e5e7eb", borderRadius: 20, padding: "24px 28px", marginBottom: 16 }}>
              <div style={{ fontSize: 17, fontWeight: 900, color: "#111827", marginBottom: 16 }}>패키지 멘토링</div>
              <div style={{ display: "grid", gridTemplateColumns: mentor.package_5_price > 0 && mentor.package_10_price > 0 ? "1fr 1fr" : "1fr", gap: 12 }}>
                {mentor.package_5_price > 0 && (
                  <PackageCard
                    label="5회 패키지"
                    desc="집중 5회 피드백"
                    price={mentor.package_5_price}
                    color="#16a34a"
                    bg="#f0fdf4"
                    paying={paying}
                    onBuy={() => requestPayment("package5")}
                  />
                )}
                {mentor.package_10_price > 0 && (
                  <PackageCard
                    label="10회 패키지"
                    desc="심화 10회 멘토링"
                    price={mentor.package_10_price}
                    color="#92681a"
                    bg="#fdf6e3"
                    paying={paying}
                    onBuy={() => requestPayment("package10")}
                  />
                )}
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function PackageCard({ label, desc, price, color, bg, paying, onBuy }: {
  label: string; desc: string; price: number; color: string; bg: string; paying: boolean; onBuy: () => void;
}) {
  return (
    <div style={{ background: bg, border: `1px solid ${color}33`, borderRadius: 16, padding: "18px 20px" }}>
      <div style={{ fontSize: 16, fontWeight: 900, color, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 12, color, opacity: 0.8, marginBottom: 12 }}>{desc}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color, marginBottom: 14 }}>{price.toLocaleString("ko-KR")}원</div>
      <button onClick={onBuy} disabled={paying} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", background: color, color: "white", fontWeight: 800, fontSize: 13, cursor: paying ? "not-allowed" : "pointer" }}>
        {paying ? "결제 중..." : "구매하기"}
      </button>
    </div>
  );
}

function PricePill({ label, price, color }: { label: string; price: number; color: string }) {
  return (
    <span style={{ fontSize: 12, fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}44`, borderRadius: 8, padding: "3px 10px" }}>
      {label} {price.toLocaleString("ko-KR")}원
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

const btnStyle = (bg: string): React.CSSProperties => ({
  flex: 1, width: "100%", padding: "12px", borderRadius: 12, border: "none", background: bg, color: "white", fontWeight: 800, fontSize: 14, cursor: "pointer",
});

const inputStyle: React.CSSProperties = { width: "100%", padding: "11px 14px", borderRadius: 10, border: "1px solid #d1d5db", fontSize: 15, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
