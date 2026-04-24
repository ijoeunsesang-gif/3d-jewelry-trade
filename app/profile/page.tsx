"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { sbFetch, sbAuthFetch, getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo, showSuccess } from "../lib/toast";
import GradeBadge from "../components/GradeBadge";
import { Grade, GRADE_CONFIG, gradeOrder } from "@/lib/grades";

type TabId = "basic" | "follow" | "seller" | "stats" | "grade";
type FollowProfile = { id: string; nickname: string; avatar_url: string | null; bio: string | null };
type PurchaseRow = { id: string; model_id: string; price: number; created_at: string };
type ModelRow = { id: string; title: string; thumbnail: string; thumbnail_path?: string | null; seller_id: string };
type PeriodType = "7days" | "30days" | "all" | "monthly";

const GOLD = "#c9a84c";
const DARK = "#111827";

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ["basic","follow","seller","stats","grade"].includes(t)) {
      setActiveTab(t as TabId);
    }
  }, []);

  // 로딩 상태
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sellerRegistering, setSellerRegistering] = useState(false);
  const [bizUploading, setBizUploading] = useState(false);

  // 계정 정보
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const initialEmailRef = useRef("");
  const [isSocialUser, setIsSocialUser] = useState(false);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  // 판매자 정보
  const [isSeller, setIsSeller] = useState(false);
  const [sellerAppliedAt, setSellerAppliedAt] = useState<string | null>(null);

  // 정산 정보
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [settlementEditing, setSettlementEditing] = useState(false);
  const [settlementSaving, setSettlementSaving] = useState(false);

  // 사업자 정보
  const [bizRegUrl, setBizRegUrl] = useState("");
  const [bizRegPreview, setBizRegPreview] = useState("");
  const [businessNumber, setBusinessNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [bizInfoOpen, setBizInfoOpen] = useState(false);

  // 팔로우
  const [following, setFollowing] = useState<FollowProfile[]>([]);
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const followLoadedRef = useRef(false);

  // 내 등급
  const [gradeInfo, setGradeInfo] = useState<{ grade: Grade; totalCount: number; totalAmount: number } | null>(null);
  const [gradeLoading, setGradeLoading] = useState(false);
  const gradeLoadedRef = useRef(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (activeTab === "follow" && userId && !followLoadedRef.current) {
      followLoadedRef.current = true;
      fetchFollowData(userId);
    }
  }, [activeTab, userId]);

  useEffect(() => {
    if (activeTab === "grade" && isSeller && userId && !gradeLoadedRef.current) {
      gradeLoadedRef.current = true;
      fetchGradeData(userId);
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
        setBankName(profile.bank_name || "");
        setAccountHolder(profile.account_holder || "");
        setAccountNumber(profile.account_number || "");
        setBusinessNumber(profile.business_number || "");
        setBusinessName(profile.business_name || "");
        setPhoneNumber(profile.phone_number || "");
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

  const fetchFollowData = async (uid: string) => {
    setFollowLoading(true);
    try {
      const [{ data: followingRows }, { data: followerRows }] = await Promise.all([
        supabase.from("follows").select("following_id").eq("follower_id", uid),
        supabase.from("follows").select("follower_id").eq("following_id", uid),
      ]);
      const followingIds = (followingRows || []).map((r: any) => r.following_id);
      const followerIds = (followerRows || []).map((r: any) => r.follower_id);
      const allIds = [...new Set([...followingIds, ...followerIds])];
      if (allIds.length === 0) { setFollowing([]); setFollowers([]); return; }
      const { data: profiles } = await supabase
        .from("profiles").select("id, nickname, avatar_url, bio").in("id", allIds);
      const map: Record<string, FollowProfile> = {};
      (profiles || []).forEach((p: any) => { map[p.id] = { id: p.id, nickname: p.nickname || "익명", avatar_url: p.avatar_url, bio: p.bio }; });
      setFollowing(followingIds.map((id: string) => map[id]).filter(Boolean));
      setFollowers(followerIds.map((id: string) => map[id]).filter(Boolean));
    } finally {
      setFollowLoading(false);
    }
  };

  const handleUnfollow = async (targetId: string) => {
    await supabase.from("follows").delete().eq("follower_id", userId).eq("following_id", targetId);
    setFollowing((prev) => prev.filter((p) => p.id !== targetId));
  };

  const fetchGradeData = async (uid: string) => {
    setGradeLoading(true);
    try {
      const { data } = await supabase
        .from("seller_stats")
        .select("current_grade, total_sales_count, total_sales_amount")
        .eq("user_id", uid)
        .maybeSingle();
      setGradeInfo({
        grade: ((data?.current_grade) || "sprout") as Grade,
        totalCount: data?.total_sales_count ?? 0,
        totalAmount: data?.total_sales_amount ?? 0,
      });
    } finally {
      setGradeLoading(false);
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
      const avatarForm = new FormData();
      avatarForm.append("file", file);
      avatarForm.append("bucket", "thumbnails");
      avatarForm.append("path", path);
      const avatarRes = await fetch("/api/upload", { method: "POST", body: avatarForm });
      if (!avatarRes.ok) { showError("이미지 업로드 실패"); return; }
      const { url } = await avatarRes.json();
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

      const coreFields = { nickname, bio, avatar_url: avatarUrl };
      const allFields = { ...coreFields, phone_number: phoneNumber || null };

      if (exists) {
        const { error } = await supabase.from("profiles").update(allFields).eq("id", userId);
        if (error) {
          console.error("프로필 저장 실패:", error.message, error);
          // phone_number 컬럼 미생성 시 기본 필드만 재시도
          const { error: fallbackError } = await supabase.from("profiles").update(coreFields).eq("id", userId);
          if (fallbackError) {
            console.error("프로필 저장 폴백 실패:", fallbackError.message);
            showError(fallbackError.message || "프로필 저장에 실패했습니다.");
            return;
          }
        }
      } else {
        const { error } = await supabase.from("profiles").insert({ id: userId, email, ...allFields });
        if (error) {
          console.error("프로필 저장 실패:", error.message, error);
          const { error: fallbackError } = await supabase.from("profiles").insert({ id: userId, email, ...coreFields });
          if (fallbackError) {
            console.error("프로필 저장 폴백 실패:", fallbackError.message);
            showError(fallbackError.message || "프로필 저장에 실패했습니다.");
            return;
          }
        }
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
    if (!bankName || !accountHolder || !accountNumber) {
      showError("예금주명, 은행명, 계좌번호는 필수 입력 항목입니다.");
      return;
    }
    setSellerRegistering(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase.from("profiles").update({
        role: "seller",
        seller_applied_at: now,
        bank_name: bankName,
        account_holder: accountHolder,
        account_number: accountNumber,
        business_number: businessNumber || null,
        business_name: businessName || null,
      }).eq("id", userId);
      if (error) throw error;
      setIsSeller(true);
      setSellerAppliedAt(now);
      showSuccess("판매자 등록이 완료되었습니다!");
    } catch (e: any) {
      showError(e.message || "등록 실패. 다시 시도해주세요.");
    } finally {
      setSellerRegistering(false);
    }
  };

  const handleSettlementSave = async () => {
    if (!bankName || !accountHolder || !accountNumber) {
      showError("예금주명, 은행명, 계좌번호는 필수 입력 항목입니다.");
      return;
    }
    setSettlementSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        bank_name: bankName,
        account_holder: accountHolder,
        account_number: accountNumber,
        business_number: businessNumber || null,
        business_name: businessName || null,
      }).eq("id", userId);
      if (error) throw error;
      setSettlementEditing(false);
      showSuccess("정산 정보가 저장되었습니다.");
    } catch (e: any) {
      showError(e.message || "저장 실패");
    } finally {
      setSettlementSaving(false);
    }
  };

  const handleBizLicenseUpload = async (file: File) => {
    if (!file || !userId) return;
    setBizRegPreview(URL.createObjectURL(file));
    setBizUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `business/${userId}/${Date.now()}.${ext}`;
      const form = new FormData();
      form.append("file", file);
      form.append("bucket", "thumbnails");
      form.append("path", path);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      if (!res.ok) throw new Error("업로드 실패");
      const { url } = await res.json();
      await supabase.from("profiles").update({ business_registration_url: url }).eq("id", userId);
      setBizRegUrl(url);
      showSuccess("사업자 등록증이 업로드되었습니다.");
    } catch (e: any) {
      showError(e.message || "업로드 실패");
    } finally {
      setBizUploading(false);
    }
  };

  const handleBizUpload = handleBizLicenseUpload;

  const tabs: { id: TabId; label: string; sellerOnly?: boolean }[] = [
    { id: "basic", label: "기본 정보" },
    { id: "grade", label: "내 등급", sellerOnly: true },
    { id: "follow", label: "팔로우" },
    { id: "seller", label: "판매자 등록" },
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
                <label style={labelStyle}>연락처 <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "1px 7px", borderRadius: 999 }}>선택</span></label>
                <input
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(formatPhoneNumber(e.target.value))}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                  style={inputStyle}
                />
                <p style={helperText}>판매자 페이지에 공개됩니다.</p>
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

          {/* 팔로우 탭 */}
          {activeTab === "follow" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
              <h2 style={sectionTitle}>팔로우</h2>
              {followLoading ? (
                <p style={{ color: "#6b7280", fontSize: 14 }}>불러오는 중...</p>
              ) : (
                <>
                  {/* 내가 팔로우한 판매자 */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                      내가 팔로우한 판매자 ({following.length})
                    </div>
                    {following.length === 0 ? (
                      <p style={{ fontSize: 14, color: "#9ca3af" }}>팔로우한 판매자가 없습니다.</p>
                    ) : (
                      following.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                          <img src={p.avatar_url || "/default-avatar.png"} alt={p.nickname}
                            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{p.nickname}</div>
                            {p.bio && (
                              <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {p.bio}
                              </div>
                            )}
                          </div>
                          <button type="button" onClick={() => handleUnfollow(p.id)} style={{
                            marginLeft: "auto", fontSize: 12, color: "#ef4444",
                            border: "1px solid #ef4444", borderRadius: 8,
                            padding: "4px 10px", background: "white", cursor: "pointer", flexShrink: 0,
                          }}>
                            팔로우 취소
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  {/* 구분선 */}
                  <div style={{ height: 1, background: "#e5e7eb" }} />

                  {/* 나를 팔로우한 유저 */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                      나를 팔로우한 유저 ({followers.length})
                    </div>
                    {followers.length === 0 ? (
                      <p style={{ fontSize: 14, color: "#9ca3af" }}>팔로워가 없습니다.</p>
                    ) : (
                      followers.map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f3f4f6" }}>
                          <img src={p.avatar_url || "/default-avatar.png"} alt={p.nickname}
                            style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
                          <div style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>{p.nickname}</div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* 판매자 등록 탭 */}
          {activeTab === "seller" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <h2 style={sectionTitle}>판매자 등록</h2>

              {/* ─ 안내문 패널 ─ */}
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* 수수료 표 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 8 }}>등급별 수수료</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                    {(["sprout","skilled","pro","master"] as const).map((g) => {
                      const cfg = GRADE_CONFIG[g];
                      return (
                        <div key={g} style={{ background: cfg.bg, borderRadius: 10, padding: "10px 8px", textAlign: "center" }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                          <div style={{ fontSize: 17, fontWeight: 900, color: cfg.color, marginTop: 2 }}>{Math.round(cfg.commission * 100)}%</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {/* 정산 주기 */}
                <div style={{ fontSize: 13, color: "#374151" }}>
                  <span style={{ fontWeight: 800 }}>정산 주기:</span> 매월 말일 기준 익월 10일 정산
                </div>
                {/* 업로드 주의사항 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 6 }}>업로드 주의사항</div>
                  <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 3 }}>
                    {[
                      "본인이 직접 제작한 3D 파일만 업로드 가능",
                      "타인의 저작물 무단 사용 및 도용 금지",
                      "상업적 사용이 가능한 파일만 등록",
                      "지원 포맷: STL / OBJ / 3DM",
                      "허위 정보 등록 시 판매자 자격 박탈",
                    ].map((t) => (
                      <li key={t} style={{ fontSize: 12, color: "#6b7280" }}>{t}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* ─ 승인 완료 → 정보 표시 ─ */}
              {isSeller && !settlementEditing && (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, alignSelf: "flex-start", background: "#dcfce7", color: "#16a34a", fontSize: 13, fontWeight: 700 }}>
                    ✓ 판매자 인증 완료
                  </div>

                  {/* 정산 정보 표시 */}
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", background: "white", display: "flex", flexDirection: "column", gap: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>정산 계좌</div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 14 }}>
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>예금주</span>
                      <span style={{ color: "#111827", fontWeight: 700 }}>{accountHolder || "—"}</span>
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>은행</span>
                      <span style={{ color: "#111827", fontWeight: 700 }}>{bankName || "—"}</span>
                      <span style={{ color: "#6b7280", fontWeight: 600 }}>계좌번호</span>
                      <span style={{ color: "#111827", fontWeight: 700, fontFamily: "monospace" }}>
                        {accountNumber ? `${bankName} ${maskAccount(accountNumber)}` : "—"}
                      </span>
                    </div>
                    <button type="button" onClick={() => setSettlementEditing(true)} style={{ ...actionBtn, marginTop: 4, alignSelf: "flex-start" }}>
                      정보 수정
                    </button>
                  </div>

                  {/* 사업자 정보 토글 */}
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden", background: "white" }}>
                    <button type="button" onClick={() => setBizInfoOpen((v) => !v)} style={{ width: "100%", padding: "14px 20px", background: "none", border: "none", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: 800, color: "#111827" }}>
                      <span>사업자 정보</span>
                      <span style={{ fontSize: 18, color: "#9ca3af" }}>{bizInfoOpen ? "▲" : "▼"}</span>
                    </button>
                    {bizInfoOpen && (
                      <div style={{ padding: "0 20px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 14 }}>
                          <span style={{ color: "#6b7280", fontWeight: 600 }}>사업자번호</span>
                          <span style={{ color: "#111827", fontWeight: 700, fontFamily: "monospace" }}>
                            {businessNumber ? maskBusinessNumber(businessNumber) : "—"}
                          </span>
                          <span style={{ color: "#6b7280", fontWeight: 600 }}>상호명</span>
                          <span style={{ color: "#111827", fontWeight: 700 }}>{businessName || "—"}</span>
                          <span style={{ color: "#6b7280", fontWeight: 600 }}>사업자등록증</span>
                          <span>
                            {bizRegUrl
                              ? <a href={bizRegUrl} target="_blank" rel="noopener noreferrer" style={{ color: GOLD, fontWeight: 700, textDecoration: "none", fontSize: 13 }}>보기</a>
                              : <span style={{ color: "#9ca3af" }}>—</span>}
                          </span>
                        </div>
                        <button type="button" onClick={() => { setSettlementEditing(true); setBizInfoOpen(false); }} style={{ ...actionBtn, alignSelf: "flex-start", marginTop: 4 }}>
                          정보 수정
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ─ 미신청 or 수정 모드 → 폼 ─ */}
              {(!isSeller || settlementEditing) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

                  {/* 정산 정보 섹션 */}
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", background: "white", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>정산 정보 <span style={{ fontSize: 11, color: "#ef4444" }}>필수</span></div>

                    <div style={fieldWrap}>
                      <label style={labelStyle}>예금주명</label>
                      <input
                        style={inputStyle}
                        placeholder="홍길동"
                        value={accountHolder}
                        onChange={(e) => setAccountHolder(e.target.value)}
                      />
                    </div>

                    <div style={fieldWrap}>
                      <label style={labelStyle}>은행명</label>
                      <select
                        style={{ ...inputStyle, cursor: "pointer" }}
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                      >
                        <option value="">은행 선택</option>
                        {["국민","신한","하나","우리","농협","기업","카카오","토스","SC제일","부산","대구","광주","전북","제주","새마을","신협","우체국"].map((b) => (
                          <option key={b} value={b + "은행"}>{b}은행</option>
                        ))}
                      </select>
                    </div>

                    <div style={fieldWrap}>
                      <label style={labelStyle}>계좌번호</label>
                      <input
                        style={inputStyle}
                        type="text"
                        inputMode="numeric"
                        placeholder="숫자만 입력 (예: 123456789012)"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                      />
                    </div>
                  </div>

                  {/* 사업자 정보 섹션 */}
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", background: "white", display: "flex", flexDirection: "column", gap: 16 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>사업자 정보 <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "1px 7px", borderRadius: 999 }}>선택</span></div>

                    <div style={fieldWrap}>
                      <label style={labelStyle}>사업자등록번호</label>
                      <input
                        style={inputStyle}
                        placeholder="000-00-00000"
                        value={businessNumber}
                        onChange={(e) => setBusinessNumber(formatBusinessNumber(e.target.value))}
                        maxLength={12}
                      />
                    </div>

                    <div style={fieldWrap}>
                      <label style={labelStyle}>상호명</label>
                      <input
                        style={inputStyle}
                        placeholder="회사명 또는 상호"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                      />
                    </div>

                    <div style={fieldWrap}>
                      <label style={labelStyle}>사업자등록증</label>
                      {(bizRegPreview || bizRegUrl) && (
                        <img src={bizRegPreview || bizRegUrl} alt="사업자 등록증" style={{ maxWidth: 280, borderRadius: 10, border: "1px solid #e5e7eb", marginBottom: 4 }} />
                      )}
                      <label style={{
                        height: 44, padding: "0 18px", borderRadius: 12,
                        border: "1px dashed #d1d5db", background: "#f8fafc",
                        color: "#374151", fontSize: 13, fontWeight: 700,
                        display: "inline-flex", alignItems: "center", alignSelf: "flex-start",
                        cursor: bizUploading ? "not-allowed" : "pointer",
                        opacity: bizUploading ? 0.6 : 1,
                      }}>
                        {bizUploading ? "업로드 중..." : bizRegUrl ? "재업로드" : "이미지 첨부"}
                        <input type="file" accept="image/*" style={{ display: "none" }} disabled={bizUploading}
                          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleBizLicenseUpload(f); }}
                        />
                      </label>
                      <p style={helperText}>JPG, PNG 이미지 파일</p>
                    </div>
                  </div>

                  {/* 제출 버튼 */}
                  {isSeller ? (
                    <div style={{ display: "flex", gap: 10 }}>
                      <button type="button" onClick={handleSettlementSave} disabled={settlementSaving}
                        style={{ ...actionBtn, opacity: settlementSaving ? 0.6 : 1, cursor: settlementSaving ? "not-allowed" : "pointer" }}>
                        {settlementSaving ? "저장 중..." : "저장"}
                      </button>
                      <button type="button" onClick={() => setSettlementEditing(false)}
                        style={{ height: 48, padding: "0 20px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                        취소
                      </button>
                    </div>
                  ) : (
                    <button type="button" onClick={handleSellerApply} disabled={sellerRegistering}
                      style={{ ...actionBtn, opacity: sellerRegistering ? 0.6 : 1, cursor: sellerRegistering ? "not-allowed" : "pointer" }}>
                      {sellerRegistering ? "신청 중..." : "판매자 신청하기"}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 내 등급 탭 (seller 전용) */}
          {activeTab === "grade" && isSeller && (
            <GradeTab gradeInfo={gradeInfo} gradeLoading={gradeLoading} />
          )}

          {/* 판매 통계 탭 (seller 전용) */}
          {activeTab === "stats" && isSeller && (
            <SalesTab userId={userId} />
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

/* ── 내 등급 탭 ── */
const GRADE_KEYS: Grade[] = ["sprout", "skilled", "pro", "master"];

const GRADE_STYLE: Record<Grade, { color: string; bg: string; border: string; label: string }> = {
  sprout:  { color: "#374151", bg: "#f9fafb", border: "#d1d5db", label: "입문" },
  skilled: { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", label: "숙련" },
  pro:     { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe", label: "프로" },
  master:  { color: "#b45309", bg: "#fffbeb", border: "#fde68a", label: "마스터" },
};

function GradeTab({
  gradeInfo,
  gradeLoading,
}: {
  gradeInfo: { grade: Grade; totalCount: number; totalAmount: number } | null;
  gradeLoading: boolean;
}) {
  const grade     = gradeInfo?.grade      ?? "sprout";
  const count     = gradeInfo?.totalCount  ?? 0;
  const amount    = gradeInfo?.totalAmount ?? 0;
  const cfg       = GRADE_CONFIG[grade];
  const orderIdx  = gradeOrder(grade);
  const nextGrade = orderIdx < 3 ? GRADE_KEYS[orderIdx + 1] : null;
  const nextCfg   = nextGrade ? GRADE_CONFIG[nextGrade] : null;

  const countPct  = nextCfg ? Math.min((count  / nextCfg.minSales)  * 100, 100) : 100;
  const amountPct = nextCfg ? Math.min((amount / nextCfg.minAmount) * 100, 100) : 100;
  const countLeft  = nextCfg ? Math.max(0, nextCfg.minSales  - count)  : 0;
  const amountLeft = nextCfg ? Math.max(0, nextCfg.minAmount - amount) : 0;

  if (gradeLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 style={sectionTitle}>내 등급</h2>
        <p style={{ color: "#6b7280", fontSize: 14 }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <h2 style={sectionTitle}>내 등급</h2>

      {/* 1. 현재 등급 */}
      <div style={{
        border: `1px solid ${cfg.bg === "#dcfce7" ? "#bbf7d0" : cfg.bg}`,
        borderRadius: 16,
        padding: "24px 24px",
        background: cfg.bg,
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}>
        <GradeBadge grade={grade} size="xl" />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 4 }}>
          {[
            { label: "수수료율", value: `${Math.round(cfg.commission * 100)}%` },
            { label: "총 판매 건수", value: `${count.toLocaleString("ko-KR")}건` },
            { label: "누적 판매 금액", value: `${amount.toLocaleString("ko-KR")}원` },
          ].map(({ label, value }) => (
            <div key={label} style={{
              background: "white",
              borderRadius: 12,
              padding: "14px 16px",
              border: "1px solid rgba(0,0,0,0.06)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. 다음 등급 진행도 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>다음 등급 진행도</div>

        {nextGrade && nextCfg ? (
          <>
            <div style={{
              fontSize: 13,
              color: "#374151",
              background: "#f9fafb",
              border: "1px solid #e5e7eb",
              borderRadius: 10,
              padding: "10px 14px",
              fontWeight: 600,
            }}>
              {GRADE_STYLE[nextGrade].label}까지{" "}
              {countLeft > 0 && <strong>{countLeft.toLocaleString("ko-KR")}건</strong>}
              {countLeft > 0 && amountLeft > 0 && ", "}
              {amountLeft > 0 && <strong>{Math.ceil(amountLeft / 10000).toLocaleString("ko-KR")}만원</strong>}
              {countLeft === 0 && amountLeft === 0
                ? " 달성 완료! (등급 갱신 대기 중)"
                : " 남았어요"}
            </div>

            <ProgressBar label="판매 건수" current={count} target={nextCfg.minSales} pct={countPct} color={cfg.color} />
            <ProgressBar label="판매 금액" current={Math.ceil(amount / 10000)} target={Math.ceil(nextCfg.minAmount / 10000)} unit="만원" pct={amountPct} color={cfg.color} />
          </>
        ) : (
          <div style={{
            textAlign: "center",
            padding: "28px 20px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 14,
            color: "#b45309",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: "-0.01em",
          }}>
            최고 등급 달성!
          </div>
        )}
      </div>

      {/* 3. 전체 등급 안내표 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>전체 등급 안내</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {GRADE_KEYS.map((g) => {
            const s = GRADE_STYLE[g];
            const c = GRADE_CONFIG[g];
            const isCurrent = g === grade;
            return (
              <div
                key={g}
                style={{
                  border: `1.5px solid ${isCurrent ? s.color : s.border}`,
                  borderRadius: 14,
                  padding: "16px 18px",
                  background: isCurrent ? s.bg : "white",
                  boxShadow: isCurrent ? `0 0 0 3px ${s.border}` : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{
                    fontWeight: 900,
                    fontSize: 15,
                    color: s.color,
                    letterSpacing: "-0.01em",
                  }}>
                    {s.label}
                  </span>
                  {isCurrent && (
                    <span style={{
                      fontSize: 10,
                      fontWeight: 800,
                      color: s.color,
                      background: "white",
                      border: `1px solid ${s.border}`,
                      borderRadius: 999,
                      padding: "2px 8px",
                      letterSpacing: "0.04em",
                    }}>
                      현재
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                  {c.minSales === 0
                    ? "기본 등급"
                    : `판매 ${c.minSales.toLocaleString()}건 + ${Math.ceil(c.minAmount / 10000).toLocaleString()}만원`}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>
                  수수료 {Math.round(c.commission * 100)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ label, current, target, pct, color, unit = "건" }: {
  label: string; current: number; target: number; pct: number; color: string; unit?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>
          {current.toLocaleString("ko-KR")} / {target.toLocaleString("ko-KR")}{unit}
        </span>
      </div>
      <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: `${pct}%`,
          borderRadius: 999,
          background: color,
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}

/* ── 판매 통계 탭 ── */
function SalesTab({ userId }: { userId: string }) {
  const [salesLoading, setSalesLoading] = useState(true);
  const [salesModels, setSalesModels] = useState<ModelRow[]>([]);
  const [salesPurchases, setSalesPurchases] = useState<PurchaseRow[]>([]);
  const [period, setPeriod] = useState<PeriodType>("7days");
  const salesLoadedRef = useRef(false);

  useEffect(() => {
    if (!userId || salesLoadedRef.current) return;
    salesLoadedRef.current = true;
    (async () => {
      try {
        setSalesLoading(true);
        const { data: myModels, error: modelError } = await sbAuthFetch("models", `?select=id,title,thumbnail,thumbnail_path,seller_id&seller_id=eq.${userId}`);
        if (modelError) { setSalesLoading(false); return; }
        setSalesModels((myModels as ModelRow[]) || []);
        const modelIds = ((myModels as ModelRow[]) || []).map((m) => m.id);
        if (modelIds.length === 0) { setSalesPurchases([]); setSalesLoading(false); return; }
        const { data: purchaseData, error: purchaseError } = await sbAuthFetch("purchases", `?select=id,model_id,price,created_at&model_id=in.(${modelIds.join(",")})&order=created_at.desc`);
        if (purchaseError) { setSalesLoading(false); return; }
        setSalesPurchases((purchaseData as PurchaseRow[]) || []);
      } catch (e) {
        console.error("판매 통계 불러오기 오류:", e);
      } finally {
        setSalesLoading(false);
      }
    })();
  }, [userId]);

  const filteredPurchases = useMemo(() => {
    if (period === "all" || period === "monthly") return salesPurchases;
    const days = period === "7days" ? 7 : 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    return salesPurchases.filter((row) => new Date(row.created_at) >= cutoff);
  }, [salesPurchases, period]);

  const modelMap = useMemo(() => {
    const map = new Map<string, ModelRow>();
    salesModels.forEach((m) => map.set(m.id, m));
    return map;
  }, [salesModels]);

  const totalSalesCount = filteredPurchases.length;
  const totalRevenue = filteredPurchases.reduce((sum, row) => sum + (row.price || 0), 0);
  const averagePrice = totalSalesCount > 0 ? Math.round(totalRevenue / totalSalesCount) : 0;

  const topModels = useMemo(() => {
    const grouped = new Map<string, { modelId: string; title: string; count: number; revenue: number }>();
    filteredPurchases.forEach((purchase) => {
      const model = modelMap.get(purchase.model_id);
      const current = grouped.get(purchase.model_id);
      if (current) { current.count += 1; current.revenue += purchase.price || 0; }
      else { grouped.set(purchase.model_id, { modelId: purchase.model_id, title: model?.title || "알 수 없는 모델", count: 1, revenue: purchase.price || 0 }); }
    });
    return Array.from(grouped.values()).sort((a, b) => b.revenue - a.revenue);
  }, [filteredPurchases, modelMap]);

  const chartData = useMemo(() => {
    if (period === "monthly") {
      const monthMap = new Map<string, { label: string; revenue: number; count: number }>();
      salesPurchases.forEach((row) => {
        const date = new Date(row.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const current = monthMap.get(key);
        if (current) { current.revenue += row.price || 0; current.count += 1; }
        else { monthMap.set(key, { label: key, revenue: row.price || 0, count: 1 }); }
      });
      return Array.from(monthMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }
    const chartDays = period === "30days" ? 10 : 7;
    const today = new Date();
    const result: { label: string; revenue: number; count: number }[] = [];
    for (let i = chartDays - 1; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const mm = String(date.getMonth() + 1).padStart(2, "0");
      const dd = String(date.getDate()).padStart(2, "0");
      const key = `${date.getFullYear()}-${mm}-${dd}`;
      const dayRows = filteredPurchases.filter((row) => row.created_at.slice(0, 10) === key);
      result.push({ label: `${mm}/${dd}`, revenue: dayRows.reduce((sum, row) => sum + (row.price || 0), 0), count: dayRows.length });
    }
    return result;
  }, [filteredPurchases, salesPurchases, period]);

  const maxRevenue = Math.max(...chartData.map((d) => d.revenue), 1);

  const getThumbUrl = (model?: ModelRow) => {
    if (!model) return "";
    if (model.thumbnail_path) return supabase.storage.from("thumbnails").getPublicUrl(model.thumbnail_path).data.publicUrl;
    return model.thumbnail || "";
  };

  if (salesLoading) {
    return <div style={{ padding: "20px 0" }}><p style={{ color: "#6b7280" }}>판매 통계 불러오는 중...</p></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 style={sectionTitle}>판매 통계</h2>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodType)}
          style={{ height: 38, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 10px", background: "white", fontWeight: 700, color: "#111827", outline: "none", fontSize: 13 }}
        >
          <option value="7days">최근 7일</option>
          <option value="30days">최근 30일</option>
          <option value="all">전체 기간</option>
          <option value="monthly">월별 보기</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }} className="sales-summary-grid">
        <SalesStatCard title="총 판매 수" value={`${totalSalesCount}건`} sub="선택한 기간 기준" />
        <SalesStatCard title="총 매출" value={`${totalRevenue.toLocaleString("ko-KR")}원`} sub="선택한 기간 기준" />
        <SalesStatCard title="평균 판매가" value={`${averagePrice.toLocaleString("ko-KR")}원`} sub="판매 1건당 평균" />
        <SalesStatCard title="등록 모델 수" value={`${salesModels.length}개`} sub="현재 등록된 모델" />
      </div>

      <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 6 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>{period === "monthly" ? "월별 매출 흐름" : "매출 흐름"}</div>
          <span style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{period === "monthly" ? "월 단위 집계" : "선택 기간 기준"}</span>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: period === "monthly" ? `repeat(${Math.max(chartData.length, 1)}, minmax(0, 1fr))` : "repeat(10, minmax(0, 1fr))",
          gap: 4,
          alignItems: "end",
          minHeight: 180,
        }}>
          {chartData.map((day, idx) => (
            <div key={day.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "end", gap: 5 }}>
              <div style={{ fontSize: 10, color: "#111827", fontWeight: 800, textAlign: "center", wordBreak: "keep-all" }}>
                {day.revenue > 0 ? `${day.revenue.toLocaleString("ko-KR")}원` : "-"}
              </div>
              <div style={{ width: "100%", maxWidth: 80, borderRadius: 12, background: "linear-gradient(180deg,#22c55e 0%,#16a34a 100%)", minHeight: 5, height: `${Math.max((day.revenue / maxRevenue) * 140, day.revenue > 0 ? 10 : 5)}px` }} />
              <div style={{ fontSize: 10, fontWeight: 800, color: "#111827", whiteSpace: "nowrap" }}>{idx % 2 === 0 ? day.label : ""}</div>
              <div style={{ fontSize: 10, color: "#6b7280" }}>{day.count}건</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="sales-two-col">
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white", padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>베스트셀러 모델</div>
          {topModels.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>아직 판매된 모델이 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {topModels.slice(0, 5).map((item, idx) => (
                <div key={item.modelId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #eef2f7" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: "#111827", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 12, flexShrink: 0 }}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{item.title}</div>
                    <div style={{ marginTop: 2, fontSize: 11, color: "#6b7280" }}>판매 {item.count}건</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 900, color: "#16a34a" }}>{item.revenue.toLocaleString("ko-KR")}원</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ border: "1px solid #e5e7eb", borderRadius: 18, background: "white", padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: "#111827", marginBottom: 12 }}>최근 판매 내역</div>
          {filteredPurchases.length === 0 ? (
            <p style={{ color: "#6b7280", fontSize: 13 }}>표시할 판매 내역이 없습니다.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {filteredPurchases.slice(0, 5).map((row) => {
                const model = modelMap.get(row.model_id);
                const thumb = getThumbUrl(model);
                return (
                  <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid #eef2f7" }}>
                    {thumb
                      ? <img src={thumb} alt={model?.title || "thumb"} style={{ width: 48, height: 48, borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
                      : <div style={{ width: 48, height: 48, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#f3f4f6", color: "#111827", fontWeight: 900, flexShrink: 0, fontSize: 11 }}>3D</div>
                    }
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#111827" }}>{model?.title || "알 수 없는 모델"}</div>
                      <div style={{ marginTop: 3, color: "#6b7280", fontSize: 11 }}>{new Date(row.created_at).toLocaleDateString("ko-KR")}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 900, color: "#111827" }}>{row.price.toLocaleString("ko-KR")}원</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 500px) {
          .sales-two-col { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

function SalesStatCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, background: "white", padding: "14px 16px" }}>
      <div style={{ color: "#6b7280", fontSize: 12, fontWeight: 700 }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 22, lineHeight: 1.1, fontWeight: 900, color: "#111827" }}>{value}</div>
      <div style={{ marginTop: 5, color: "#9ca3af", fontSize: 11 }}>{sub}</div>
    </div>
  );
}

/* ── 헬퍼 함수 ── */
function maskAccount(num: string) {
  const d = num.replace(/\D/g, "");
  if (d.length < 6) return num;
  const first = d.slice(0, 3);
  const last = d.slice(-3);
  const stars = "*".repeat(Math.min(d.length - 6, 8));
  return `${first}-${stars}-${last}`;
}

function maskBusinessNumber(num: string) {
  const d = num.replace(/\D/g, "");
  if (d.length !== 10) return num;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-****${d.slice(-1)}`;
}

function formatPhoneNumber(val: string) {
  const d = val.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 7) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

function formatBusinessNumber(val: string) {
  const d = val.replace(/\D/g, "").slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
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
