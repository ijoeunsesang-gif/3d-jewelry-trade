"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { sbFetch, sbAuthFetch, getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo, showSuccess } from "../lib/toast";

type TabId = "basic" | "seller" | "business" | "stats";

const GOLD = "#c9a84c";
const DARK = "#111827";

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  // 로딩 상태
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sellerRegistering, setSellerRegistering] = useState(false);
  const [bizUploading, setBizUploading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  // 계정 정보
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const initialEmailRef = useRef("");
  const [isSocialUser, setIsSocialUser] = useState(false);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  // 판매자 정보
  const [isSeller, setIsSeller] = useState(false);
  const [sellerAppliedAt, setSellerAppliedAt] = useState<string | null>(null);

  // 사업자 등록
  const [bizRegUrl, setBizRegUrl] = useState("");
  const [bizRegPreview, setBizRegPreview] = useState("");

  // 판매 통계
  const [productCount, setProductCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [monthlyCount, setMonthlyCount] = useState(0);
  const statsLoadedRef = useRef(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === "stats" && isSeller && userId && !statsLoadedRef.current) {
      statsLoadedRef.current = true;
      fetchSellerStats(userId);
    }
  }, [activeTab, isSeller, userId]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const token = getAccessToken();
      if (!token) {
        showInfo("로그인이 필요합니다.");
        router.push("/auth");
        return;
      }
      const payload = decodeJwt(token) as any;
      const uid = payload?.sub as string;
      const email_ = (payload?.email || "") as string;
      setUserId(uid);

      const { data: userData } = await supabase.auth.getUser();
      const identities = userData?.user?.identities ?? [];
      setIsSocialUser(identities.some((id: any) => id.provider !== "email"));

      const finalEmail = email_ || userData?.user?.email || identities[0]?.identity_data?.email || "";
      setEmail(finalEmail);
      initialEmailRef.current = finalEmail;

      const { data: profileArr } = await sbFetch("profiles", `?id=eq.${uid}&limit=1`);
      const profile = (profileArr as any[])?.[0] ?? null;

      if (profile) {
        setNickname(profile.nickname || "");
        setBio(profile.bio || "");
        setAvatarUrl(profile.avatar_url || "");
        setPreviewUrl(profile.avatar_url || "");
        setIsSeller(profile.role === "seller");
        setSellerAppliedAt(profile.seller_applied_at || null);
        setBizRegUrl(profile.business_registration_url || "");
      } else {
        const defaultNickname = email_?.split("@")[0] || "user";
        await supabase.from("profiles").insert({ id: uid, email: email_ || "", nickname: defaultNickname, bio: "", avatar_url: "" });
        setNickname(defaultNickname);
      }
    } catch (e) {
      console.error("프로필 페이지 오류:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerStats = async (uid: string) => {
    setStatsLoading(true);
    try {
      const { data: models } = await sbAuthFetch("models", `?select=id&seller_id=eq.${uid}`);
      const modelIds = ((models as any[]) || []).map((m: any) => m.id);
      setProductCount(modelIds.length);
      if (modelIds.length === 0) return;

      const { data: purchases } = await sbAuthFetch(
        "purchases",
        `?select=id,created_at&model_id=in.(${modelIds.join(",")})`
      );
      const rows = (purchases as any[]) || [];
      setSalesCount(rows.length);
      const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      setMonthlyCount(rows.filter((r: any) => r.created_at >= monthStart).length);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      setPreviewUrl(URL.createObjectURL(file));
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `avatars/${userId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("thumbnails").upload(path, file, { upsert: true });
      if (error) { showError(`이미지 업로드 실패: ${error.message}`); return; }
      const url = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      setAvatarUrl(url);
      setPreviewUrl(url);
    } catch {
      showError("프로필 이미지 처리 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      const { data: existingArr } = await sbFetch("profiles", `?select=id&id=eq.${userId}&limit=1`);
      const exists = (existingArr as any[])?.[0];
      if (exists) {
        const { error } = await supabase.from("profiles").update({ nickname, bio, avatar_url: avatarUrl }).eq("id", userId);
        if (error) { showError("프로필 저장에 실패했습니다."); return; }
      } else {
        const { error } = await supabase.from("profiles").insert({ id: userId, email, nickname, bio, avatar_url: avatarUrl });
        if (error) { showError("프로필 저장에 실패했습니다."); return; }
      }

      if (email.trim() && email !== initialEmailRef.current) {
        if (isSocialUser) { showError("소셜 로그인 계정은 이메일을 변경할 수 없습니다."); return; }
        const { data: session } = await supabase.auth.getSession();
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${session?.session?.access_token}`,
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          showError(err?.message || "이메일 변경에 실패했습니다."); return;
        }
        showInfo("이메일 변경 확인 메일이 발송되었습니다.");
      }

      showSuccess("프로필이 저장되었습니다.");
      window.dispatchEvent(new Event("messages-updated"));
      window.location.reload();
    } catch {
      showError("프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const handleSellerApply = async () => {
    setSellerRegistering(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("profiles").update({ seller_applied_at: now }).eq("id", userId);
      if (error) throw error;
      setSellerAppliedAt(now);
      showSuccess("신청이 완료되었습니다. 검토 후 연락드립니다.");
    } catch (e: any) {
      showError(e.message || "신청 실패. 다시 시도해주세요.");
    } finally {
      setSellerRegistering(false);
    }
  };

  const handleBizUpload = async (file: File, previewSrc: string) => {
    if (!file || !userId) return;
    setBizRegPreview(previewSrc);
    setBizUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `business/${userId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("thumbnails").upload(path, file, { upsert: true });
      if (error) throw new Error("사업자 등록증 업로드 실패");
      const url = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      await supabase.from("profiles").update({ business_registration_url: url }).eq("id", userId);
      setBizRegUrl(url);
      showSuccess("사업자 등록증이 업로드되었습니다.");
    } catch (e: any) {
      showError(e.message || "업로드 실패");
    } finally {
      setBizUploading(false);
    }
  };

  const tabs: { id: TabId; label: string; sellerOnly?: boolean }[] = [
    { id: "basic", label: "기본 정보" },
    { id: "seller", label: "판매자 등록" },
    { id: "business", label: "사업자 등록" },
    { id: "stats", label: "판매 통계", sellerOnly: true },
  ];

  if (loading) {
    return (
      <main style={pageWrap}>
        <p style={{ color: "#6b7280" }}>정보를 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: DARK }}>내 정보</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>계정 정보 및 판매자 설정을 관리합니다.</p>
      </div>

      <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>

        {/* ── 왼쪽 사이드바 ── */}
        <aside style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 20, position: "sticky", top: 88 }}>
          {/* 프로필 이미지 + 업로드 */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ position: "relative" }}>
              <img
                src={previewUrl || "/default-avatar.png"}
                alt="profile"
                style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "2px solid #e5e7eb", display: "block" }}
              />
            </div>
            <label style={{
              height: 34, padding: "0 14px", borderRadius: 10,
              background: DARK, color: "white",
              display: "inline-flex", alignItems: "center",
              cursor: uploading ? "not-allowed" : "pointer",
              fontWeight: 700, fontSize: 12, opacity: uploading ? 0.6 : 1,
            }}>
              {uploading ? "업로드 중..." : "이미지 업로드"}
              <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
            </label>
            {isSeller && (
              <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "3px 10px", borderRadius: 999 }}>
                ✓ 판매자
              </span>
            )}
          </div>

          <div style={{ height: 1, background: "#e5e7eb", marginBottom: 14 }} />

          {/* 탭 버튼 목록 */}
          <nav className="profile-tabs-nav" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tabs.filter((t) => !t.sellerOnly || isSeller).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  width: "100%", textAlign: "left",
                  padding: "10px 14px", borderRadius: 10, border: "none",
                  background: activeTab === tab.id ? DARK : "white",
                  color: activeTab === tab.id ? "white" : "#374151",
                  fontWeight: 700, fontSize: 14, cursor: "pointer",
                  transition: "background 0.15s, color 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* ── 오른쪽 콘텐츠 영역 ── */}
        <section style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 28, minHeight: 360 }}>

          {/* 기본 정보 탭 */}
          {activeTab === "basic" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={sectionTitle}>기본 정보</h2>

              <div style={fieldWrap}>
                <label style={labelStyle}>이메일</label>
                <input
                  value={email}
                  onChange={(e) => !isSocialUser && setEmail(e.target.value)}
                  readOnly={isSocialUser}
                  placeholder={isSocialUser ? "이메일 없음" : "이메일 입력"}
                  style={{ ...inputStyle, ...(isSocialUser ? { background: "#f3f4f6", cursor: "not-allowed", opacity: 0.6 } : {}) }}
                />
                {isSocialUser && <p style={helperText}>카카오/구글 계정은 이메일 변경 불가</p>}
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>닉네임</label>
                <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="닉네임 입력" style={inputStyle} />
              </div>

              <div style={fieldWrap}>
                <label style={labelStyle}>소개글</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="소개를 입력하세요" style={textareaStyle} />
              </div>

              <button type="button" onClick={handleSave} disabled={saving} style={{ ...actionBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
                {saving ? "저장 중..." : "저장하기"}
              </button>
            </div>
          )}

          {/* 판매자 등록 탭 */}
          {activeTab === "seller" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={sectionTitle}>판매자 등록</h2>

              {isSeller ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, alignSelf: "flex-start", background: "#dcfce7", color: "#16a34a", fontSize: 13, fontWeight: 700 }}>
                  ✓ 판매자 인증 완료
                </span>
              ) : sellerAppliedAt ? (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, alignSelf: "flex-start", background: "#fef3c7", color: "#d97706", fontSize: 13, fontWeight: 700 }}>
                  ⏳ 심사 중입니다.
                </span>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <p style={{ margin: 0, fontSize: 14, color: "#374151" }}>
                    판매자 등록을 신청하면 검토 후 승인됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={handleSellerApply}
                    disabled={sellerRegistering}
                    style={{ ...actionBtn, opacity: sellerRegistering ? 0.6 : 1, cursor: sellerRegistering ? "not-allowed" : "pointer" }}
                  >
                    {sellerRegistering ? "신청 중..." : "판매자 신청하기"}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* 사업자 등록 탭 */}
          {activeTab === "business" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={sectionTitle}>사업자 등록</h2>

              {(bizRegPreview || bizRegUrl) && (
                <img
                  src={bizRegPreview || bizRegUrl}
                  alt="사업자 등록증"
                  style={{ maxWidth: 340, borderRadius: 12, border: "1px solid #e5e7eb" }}
                />
              )}

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
                {bizRegUrl && !bizRegPreview && (
                  <a href={bizRegUrl} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
                    🔗 등록증 보기
                  </a>
                )}
                <label style={{
                  height: 46, padding: "0 20px", borderRadius: 12,
                  border: bizRegUrl ? "1px solid #d1d5db" : "1px dashed #d1d5db",
                  background: bizRegUrl ? "white" : "#f8fafc",
                  color: "#374151", fontSize: 14, fontWeight: 700,
                  display: "inline-flex", alignItems: "center",
                  cursor: bizUploading ? "not-allowed" : "pointer",
                  opacity: bizUploading ? 0.6 : 1,
                }}>
                  {bizUploading ? "업로드 중..." : bizRegUrl ? "재업로드" : "사업자 등록증 업로드"}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    disabled={bizUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleBizUpload(f, URL.createObjectURL(f));
                    }}
                  />
                </label>
              </div>
              {!bizRegUrl && !bizRegPreview && (
                <p style={helperText}>JPG, PNG 등 이미지 파일을 업로드해주세요.</p>
              )}
            </div>
          )}

          {/* 판매 통계 탭 (seller 전용) */}
          {activeTab === "stats" && isSeller && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 style={sectionTitle}>판매 통계</h2>
              {statsLoading ? (
                <p style={{ color: "#6b7280", fontSize: 14 }}>통계를 불러오는 중...</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                  <StatCard label="등록 상품" value={productCount} unit="개" />
                  <StatCard label="총 판매" value={salesCount} unit="건" />
                  <StatCard label="이번 달" value={monthlyCount} unit="건" highlight />
                </div>
              )}
            </div>
          )}

        </section>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .profile-grid {
            grid-template-columns: 1fr !important;
          }
          .profile-tabs-nav {
            flex-direction: row !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch;
            padding-bottom: 4px;
            gap: 6px !important;
          }
          .profile-tabs-nav button {
            flex-shrink: 0;
          }
        }
      `}</style>
    </main>
  );
}

function StatCard({ label, value, unit, highlight }: { label: string; value: number; unit: string; highlight?: boolean }) {
  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 14, padding: 20,
      display: "flex", flexDirection: "column", alignItems: "center",
      textAlign: "center", gap: 8, background: "white",
    }}>
      <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 700 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: highlight ? GOLD : "#111827" }}>{value}</span>
        <span style={{ fontSize: 13, color: "#9ca3af", fontWeight: 700 }}>{unit}</span>
      </div>
    </div>
  );
}

/* ── 스타일 상수 ── */
const pageWrap: React.CSSProperties = {
  maxWidth: 1100, margin: "0 auto", padding: "32px 20px 60px",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
const sectionTitle: React.CSSProperties = { margin: "0 0 4px", fontSize: 17, fontWeight: 800, color: "#111827" };
const fieldWrap: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8 };
const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#374151" };
const helperText: React.CSSProperties = { margin: 0, fontSize: 12, color: "#9ca3af" };
const inputStyle: React.CSSProperties = {
  height: 48, borderRadius: 12, border: "1px solid #d1d5db", padding: "0 14px",
  outline: "none", fontSize: 14, width: "100%", boxSizing: "border-box",
};
const textareaStyle: React.CSSProperties = {
  minHeight: 140, borderRadius: 12, border: "1px solid #d1d5db", padding: "12px 14px",
  outline: "none", fontSize: 14, resize: "vertical", width: "100%", boxSizing: "border-box",
  fontFamily: 'system-ui, -apple-system, sans-serif',
};
const actionBtn: React.CSSProperties = {
  height: 48, padding: "0 24px", borderRadius: 12, border: "none",
  background: "#111827", color: "white", fontWeight: 700, fontSize: 14,
  cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center",
  alignSelf: "flex-start",
};
