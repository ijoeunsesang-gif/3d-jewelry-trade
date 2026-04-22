"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { sbFetch, sbAuthFetch, getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo, showSuccess } from "../lib/toast";

const GOLD = "#c9a84c";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const initialEmailRef = useRef("");
  const [isSocialUser, setIsSocialUser] = useState(false);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  // 판매자 관련 상태
  const [isSeller, setIsSeller] = useState(false);
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankHolder, setBankHolder] = useState("");
  const [existingBankName, setExistingBankName] = useState("");
  const [existingBankAccount, setExistingBankAccount] = useState("");
  const [existingBankHolder, setExistingBankHolder] = useState("");
  const [bizRegUrl, setBizRegUrl] = useState("");
  const [bizRegFile, setBizRegFile] = useState<File | null>(null);
  const [bizRegPreview, setBizRegPreview] = useState("");
  const [sellerRegistering, setSellerRegistering] = useState(false);

  // 판매 통계 (seller 전용)
  const [productCount, setProductCount] = useState(0);
  const [salesCount, setSalesCount] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);

  useEffect(() => {
    fetchProfile();
  }, []);

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
      const userId_ = payload?.sub as string;
      const email_ = (payload?.email || "") as string;
      setUserId(userId_);

      const { data: userData } = await supabase.auth.getUser();
      const identities = userData?.user?.identities ?? [];
      const social = identities.some((id: any) => id.provider !== "email");
      setIsSocialUser(social);

      const finalEmail =
        email_ || userData?.user?.email || identities[0]?.identity_data?.email || "";
      setEmail(finalEmail);
      initialEmailRef.current = finalEmail;

      const { data: _profileArr, error } = await sbFetch(
        "profiles",
        `?id=eq.${userId_}&limit=1`
      );
      const profile = (_profileArr as any[])?.[0] ?? null;

      if (error) console.error("프로필 불러오기 실패:", error);

      if (profile) {
        setNickname(profile.nickname || "");
        setBio(profile.bio || "");
        setAvatarUrl(profile.avatar_url || "");
        setPreviewUrl(profile.avatar_url || "");
        const seller = profile.role === "seller";
        setIsSeller(seller);
        setExistingBankName(profile.bank_name || "");
        setExistingBankAccount(profile.bank_account || "");
        setExistingBankHolder(profile.bank_holder || "");
        setBizRegUrl(profile.business_registration_url || "");
        if (seller) fetchSellerStats(userId_);
      } else {
        const defaultNickname = email_?.split("@")[0] || "user";
        await supabase.from("profiles").insert({
          id: userId_, email: email_ || "", nickname: defaultNickname, bio: "", avatar_url: "",
        });
        setNickname(defaultNickname);
      }
    } catch (e) {
      console.error("프로필 페이지 오류:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSellerStats = async (uid: string) => {
    const { data: products } = await sbAuthFetch(
      "products",
      `?select=id&seller_id=eq.${uid}`
    );
    const productIds = ((products as any[]) || []).map((p: any) => p.id);
    setProductCount(productIds.length);
    if (productIds.length === 0) return;

    const { data: purchaseData } = await sbAuthFetch(
      "purchases",
      `?select=id,price&model_id=in.(${productIds.join(",")})`
    );
    const rows = (purchaseData as any[]) || [];
    setSalesCount(rows.length);
    setTotalRevenue(rows.reduce((sum: number, r: any) => sum + (r.price || 0), 0));
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;
    setUploading(true);
    try {
      setPreviewUrl(URL.createObjectURL(file));
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `avatars/${userId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("thumbnails")
        .upload(filePath, file, { upsert: true });
      if (uploadError) { showError(`이미지 업로드 실패: ${uploadError.message}`); return; }
      const publicUrl = supabase.storage.from("thumbnails").getPublicUrl(filePath).data.publicUrl;
      setAvatarUrl(publicUrl);
      setPreviewUrl(publicUrl);
    } catch {
      showError("프로필 이미지 처리 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleBizRegChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBizRegFile(file);
    setBizRegPreview(URL.createObjectURL(file));
  };

  const handleSellerRegister = async () => {
    if (!bankName.trim() || !bankAccount.trim() || !bankHolder.trim()) {
      showError("은행명, 계좌번호, 예금주를 모두 입력해주세요.");
      return;
    }
    setSellerRegistering(true);
    try {
      let uploadedBizUrl = "";
      if (bizRegFile) {
        const ext = bizRegFile.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `business/${userId}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("thumbnails")
          .upload(path, bizRegFile, { upsert: true });
        if (upErr) throw new Error("사업자 등록증 업로드 실패");
        uploadedBizUrl = supabase.storage.from("thumbnails").getPublicUrl(path).data.publicUrl;
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          role: "seller",
          bank_name: bankName.trim(),
          bank_account: bankAccount.trim(),
          bank_holder: bankHolder.trim(),
          business_registration_url: uploadedBizUrl || null,
          seller_registered_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      setIsSeller(true);
      setExistingBankName(bankName.trim());
      setExistingBankAccount(bankAccount.trim());
      setExistingBankHolder(bankHolder.trim());
      if (uploadedBizUrl) setBizRegUrl(uploadedBizUrl);
      showSuccess("판매자 등록이 완료되었습니다!");
      fetchSellerStats(userId);
    } catch (e: any) {
      showError(e.message || "판매자 등록 실패. 다시 시도해주세요.");
    } finally {
      setSellerRegistering(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!userId) return;
      setSaving(true);

      const { data: _existingArr } = await sbFetch("profiles", `?select=id&id=eq.${userId}&limit=1`);
      const existing = (_existingArr as any[])?.[0] ?? null;

      if (existing) {
        const { error } = await supabase.from("profiles")
          .update({ nickname, bio, avatar_url: avatarUrl })
          .eq("id", userId);
        if (error) { showError("프로필 저장에 실패했습니다."); return; }
      } else {
        const { error } = await supabase.from("profiles").insert({ id: userId, email, nickname, bio, avatar_url: avatarUrl });
        if (error) { showError("프로필 저장에 실패했습니다."); return; }
      }

      if (email.trim() && email !== initialEmailRef.current) {
        if (isSocialUser) { showError("소셜 로그인 계정은 이메일을 변경할 수 없습니다."); return; }
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${accessToken}`,
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

  const maskAccount = (account: string) => {
    if (!account || account.length <= 4) return account;
    return "***-****-" + account.slice(-4);
  };

  if (loading) {
    return (
      <main style={pageWrap}>
        <p style={{ color: "#6b7280" }}>정보를 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      {/* 페이지 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={pageTitle}>내 정보</h1>
        <p style={pageDesc}>계정 정보 및 판매자 설정을 관리합니다.</p>
      </div>

      {/* 프로필 카드 */}
      <section style={cardWrap} className="profile-card-wrap">
        <div style={avatarSection}>
          <img src={previewUrl || "/default-avatar.png"} alt="profile" style={avatarImg} />
          <label style={uploadBtn}>
            {uploading ? "업로드 중..." : "이미지 업로드"}
            <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
          </label>
        </div>

        <div style={formSection}>
          <div style={fieldWrap}>
            <label style={labelStyle}>이메일</label>
            <input
              value={email}
              onChange={(e) => !isSocialUser && setEmail(e.target.value)}
              placeholder={isSocialUser ? "이메일 없음" : "이메일 입력"}
              readOnly={isSocialUser}
              style={{ ...inputStyle, ...(isSocialUser ? { background: "#f3f4f6", cursor: "not-allowed", opacity: 0.6 } : {}) }}
            />
            {isSocialUser && (
              <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>카카오/구글 계정은 이메일 변경 불가</p>
            )}
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>닉네임</label>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="닉네임 입력"
              style={inputStyle}
            />
          </div>

          <div style={fieldWrap}>
            <label style={labelStyle}>소개글</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="소개를 입력하세요"
              style={textareaStyle}
            />
          </div>

          {/* ── 구분선 ── */}
          <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />

          {/* ── 판매자 등록 섹션 ── */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 14 }}>판매자 등록</div>

            {isSeller ? (
              /* 등록 완료 상태 */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "6px 14px", borderRadius: 999,
                  background: "#dcfce7", color: "#16a34a",
                  fontSize: 13, fontWeight: 700, alignSelf: "flex-start",
                }}>
                  ✓ 판매자 인증 완료
                </div>
                <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.8, background: "#f8fafc", borderRadius: 10, padding: "12px 14px" }}>
                  <div><span style={{ color: "#6b7280" }}>은행</span>&nbsp;&nbsp;{existingBankName || "-"}</div>
                  <div><span style={{ color: "#6b7280" }}>계좌</span>&nbsp;&nbsp;{maskAccount(existingBankAccount)}</div>
                  <div><span style={{ color: "#6b7280" }}>예금주</span>&nbsp;{existingBankHolder || "-"}</div>
                </div>
                {bizRegUrl && (
                  <a href={bizRegUrl} target="_blank" rel="noopener noreferrer" style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    color: GOLD, fontSize: 13, fontWeight: 700, textDecoration: "none",
                  }}>
                    🔗 사업자 등록증 보기
                  </a>
                )}
              </div>
            ) : (
              /* 등록 폼 */
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={fieldWrap}>
                  <label style={subLabelStyle}>은행명</label>
                  <input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="예: 국민은행"
                    style={inputStyle}
                  />
                </div>
                <div style={fieldWrap}>
                  <label style={subLabelStyle}>계좌번호</label>
                  <input
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    placeholder="계좌번호 입력"
                    style={inputStyle}
                  />
                </div>
                <div style={fieldWrap}>
                  <label style={subLabelStyle}>예금주</label>
                  <input
                    value={bankHolder}
                    onChange={(e) => setBankHolder(e.target.value)}
                    placeholder="예금주 입력"
                    style={inputStyle}
                  />
                </div>
                <div style={fieldWrap}>
                  <label style={subLabelStyle}>사업자 등록증 (선택)</label>
                  {bizRegPreview && (
                    <img
                      src={bizRegPreview}
                      alt="사업자 등록증 미리보기"
                      style={{ width: "100%", maxWidth: 240, borderRadius: 10, border: "1px solid #e5e7eb", objectFit: "cover" }}
                    />
                  )}
                  <label style={{ ...uploadBtn, background: "#f3f4f6", color: "#374151", fontSize: 13, width: "fit-content" }}>
                    {bizRegFile ? bizRegFile.name : "이미지 선택"}
                    <input type="file" accept="image/*" onChange={handleBizRegChange} style={{ display: "none" }} />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={handleSellerRegister}
                  disabled={sellerRegistering}
                  style={{
                    height: 46, borderRadius: 12, border: "none",
                    background: sellerRegistering ? "#d1d5db" : GOLD,
                    color: "white", fontSize: 14, fontWeight: 700,
                    cursor: sellerRegistering ? "not-allowed" : "pointer",
                    marginTop: 4,
                  }}
                >
                  {sellerRegistering ? "등록 중..." : "판매자 등록하기"}
                </button>
              </div>
            )}
          </div>

          {/* ── 구분선 ── */}
          <div style={{ height: 1, background: "#e5e7eb", margin: "8px 0" }} />

          {/* 저장/뒤로가기 버튼 */}
          <div style={buttonRow}>
            <button type="button" onClick={handleSave} disabled={saving} style={primaryBtn}>
              {saving ? "저장 중..." : "저장하기"}
            </button>
            <button type="button" onClick={() => router.back()} style={secondaryBtn}>
              뒤로가기
            </button>
          </div>
        </div>
      </section>

      {/* ── 판매 통계 (seller 전용) ── */}
      {isSeller && (
        <section style={{ marginTop: 24 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827", marginBottom: 14 }}>판매 통계</div>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 16,
          }}>
            <StatCard label="등록 상품" value={productCount} unit="개" />
            <StatCard label="총 판매 건수" value={salesCount} unit="건" />
            <StatCard
              label="총 매출"
              value={totalRevenue.toLocaleString()}
              unit="원"
              highlight
            />
          </div>
        </section>
      )}
    </main>
  );
}

function StatCard({ label, value, unit, highlight }: { label: string; value: string | number; unit: string; highlight?: boolean }) {
  return (
    <div style={{
      border: "1px solid #e5e7eb", borderRadius: 16, background: "white",
      padding: "20px 20px 18px", display: "flex", flexDirection: "column", gap: 6,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 900, color: highlight ? GOLD : "#111827" }}>{value}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#9ca3af" }}>{unit}</span>
      </div>
    </div>
  );
}

/* ── 스타일 상수 ── */
const pageWrap: React.CSSProperties = {
  maxWidth: 1100, margin: "0 auto", padding: "32px 20px 60px",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
const pageTitle: React.CSSProperties = { margin: 0, fontSize: 40, fontWeight: 900, color: "#111827" };
const pageDesc: React.CSSProperties = { margin: "10px 0 0", color: "#6b7280", fontSize: 15, lineHeight: 1.7 };
const cardWrap: React.CSSProperties = {
  display: "grid", gridTemplateColumns: "280px 1fr", gap: 24,
  border: "1px solid #e5e7eb", borderRadius: 28, background: "white", padding: 24,
};
const avatarSection: React.CSSProperties = { display: "flex", flexDirection: "column", alignItems: "center", gap: 16 };
const avatarImg: React.CSSProperties = { width: 160, height: 160, borderRadius: "50%", objectFit: "cover", border: "1px solid #e5e7eb" };
const uploadBtn: React.CSSProperties = {
  height: 44, padding: "0 18px", borderRadius: 14, background: "#111827",
  color: "white", display: "inline-flex", alignItems: "center", cursor: "pointer", fontWeight: 800,
};
const formSection: React.CSSProperties = { display: "grid", gap: 16 };
const fieldWrap: React.CSSProperties = { display: "grid", gap: 8 };
const labelStyle: React.CSSProperties = { fontSize: 14, fontWeight: 800, color: "#111827" };
const subLabelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: "#374151" };
const inputStyle: React.CSSProperties = {
  height: 48, borderRadius: 14, border: "1px solid #d1d5db", padding: "0 14px",
  outline: "none", fontSize: 14, width: "100%", boxSizing: "border-box",
};
const textareaStyle: React.CSSProperties = {
  minHeight: 140, borderRadius: 16, border: "1px solid #d1d5db", padding: 14,
  outline: "none", fontSize: 14, resize: "vertical", width: "100%", boxSizing: "border-box",
  fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
};
const buttonRow: React.CSSProperties = { display: "flex", gap: 12, marginTop: 8 };
const primaryBtn: React.CSSProperties = {
  height: 48, padding: "0 18px", borderRadius: 14, border: "none",
  background: "#111827", color: "white", fontWeight: 900, cursor: "pointer",
};
const secondaryBtn: React.CSSProperties = {
  height: 48, padding: "0 18px", borderRadius: 14,
  border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer",
};
