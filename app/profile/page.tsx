"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase-browser";
import { sbFetch, sbAuthFetch, getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo, showSuccess } from "../lib/toast";
import GradeBadge from "../components/GradeBadge";
import Image from "next/image";
import AvatarImage from "../components/AvatarImage";
import { Grade, GRADE_CONFIG, gradeOrder, MentorGrade, MENTOR_GRADE_CONFIG, calcMentorGrade, mentorGradeOrder } from "@/lib/grades";
import { Phone } from "lucide-react";
import { compressThumbnail } from "@/lib/imageCompression";
import { getModelThumbnailUrl } from "@/lib/imageUrl";
import { GOLD } from "@/lib/constants";

type TabId = "basic" | "follow" | "seller" | "mentor" | "stats" | "grade" | "points" | "users";
type UserListSubTab = "sellers" | "mentors" | "all";
type UserListItem = { id: string; nickname: string | null; avatar_url: string | null; grade: Grade | null; mentor_grade?: string };
type FollowProfile = { id: string; nickname: string; avatar_url: string | null; bio: string | null; grade?: string | null; phone_number?: string | null };
type PurchaseRow = { id: string; model_id: string; price: number; created_at: string };
type ModelRow = { id: string; title: string; thumbnail: string; thumbnail_path?: string | null; seller_id: string };
type PeriodType = "7days" | "30days" | "all" | "monthly";

const DARK = "#111827";

export default function ProfilePage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("basic");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ["basic","follow","seller","mentor","stats","grade"].includes(t)) {
      setActiveTab(t as TabId);
    }
  }, []);

  // 로딩 상태
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sellerRegistering, setSellerRegistering] = useState(false);
  const [bizUploading, setBizUploading] = useState(false);
  const [isSellerBanned, setIsSellerBanned] = useState(false);
  const [reinstateStatus, setReinstateStatus] = useState<"대기" | "승인" | "거부" | null>(null);
  const [reinstateReason, setReinstateReason] = useState("");
  const [reinstateRequesting, setReinstateRequesting] = useState(false);

  // 계정 정보
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const initialEmailRef = useRef("");
  const [isSocialUser, setIsSocialUser] = useState(false);
  const [nickname, setNickname] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [accountError, setAccountError] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  // 유저 목록 탭
  const [userListSubTab, setUserListSubTab] = useState<UserListSubTab>("sellers");
  const [userListSearch, setUserListSearch] = useState("");
  const [userListLoading, setUserListLoading] = useState(false);
  const [sellersList, setSellersList] = useState<UserListItem[]>([]);
  const [mentorsList, setMentorsList] = useState<UserListItem[]>([]);
  const [allUsersList, setAllUsersList] = useState<UserListItem[]>([]);

  // 판매자 정보
  const [isSeller, setIsSeller] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // 멘토 정보
  const [isMentor, setIsMentor] = useState(false);

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

  // 연락 수단 (판매자/멘토 공용)
  const [opentalkUrl, setOpentalkUrl] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  // 팔로우
  const [following, setFollowing] = useState<FollowProfile[]>([]);
  const [followers, setFollowers] = useState<FollowProfile[]>([]);
  const [followLoading, setFollowLoading] = useState(false);
  const followLoadedRef = useRef(false);

  // 내 등급
  const [grade, setGrade] = useState<Grade | null>(null);
  const [gradeInfo, setGradeInfo] = useState<{ grade: Grade; totalCount: number; totalAmount: number } | null>(null);
  const [mentorGradeInfo, setMentorGradeInfo] = useState<{ grade: MentorGrade; completedCount: number; avgRating: number } | null>(null);
  const [gradeLoading, setGradeLoading] = useState(false);
  const gradeLoadedRef = useRef(false);

  // 회원탈퇴
  const [withdrawStep, setWithdrawStep] = useState<0 | 1 | 2>(0);
  const [withdrawInput, setWithdrawInput] = useState("");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

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
    if (activeTab === "grade" && (isSeller || isMentor) && userId && !gradeLoadedRef.current) {
      gradeLoadedRef.current = true;
      fetchGradeData(userId);
    }
  }, [activeTab, isSeller, isMentor, userId]);

  const handleWithdraw = async () => {
    setWithdrawing(true);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/user/delete", {
        method: "POST",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: withdrawReason.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || "탈퇴 처리 중 오류가 발생했습니다.");
        return;
      }
      await supabase.auth.signOut();
      router.replace("/");
    } catch {
      showError("탈퇴 처리 중 오류가 발생했습니다.");
    } finally {
      setWithdrawing(false);
    }
  };

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
        setGrade((profile.grade as Grade) || null);
        setIsSeller(profile.role === "seller");
        setIsAdmin(profile.role === "admin");
        const banned = profile.is_seller_banned || false;
        setIsSellerBanned(banned);
        if (banned) {
          const { data: latestReq } = await supabase
            .from("seller_reinstate_requests")
            .select("status")
            .eq("seller_id", uid)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          setReinstateStatus((latestReq?.status as "대기" | "승인" | "거부") || null);
        }
        setBizRegUrl(profile.business_registration_url || "");
        setBankName(profile.bank_name || "");
        setAccountHolder(profile.account_holder || "");
        setAccountNumber(profile.account_number || "");
        setBusinessNumber(profile.business_number || "");
        setBusinessName(profile.business_name || "");
        setPhoneNumber(profile.phone_number || "");
        setOpentalkUrl(profile.opentalk_url || "");
        setContactPhone(profile.contact_phone || "");
      } else {
        const defaultNickname = email_?.split("@")[0] || "user";
        await supabase.from("profiles").insert({ id: uid, email: email_ || "", nickname: defaultNickname, bio: "", avatar_url: "" });
        setNickname(defaultNickname);
      }

      // 멘토 등록 여부 확인
      const { data: mentorRow } = await supabase
        .from("cad_mentors")
        .select("id")
        .eq("user_id", uid)
        .maybeSingle();
      setIsMentor(!!mentorRow);
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
        .from("profiles").select("id, nickname, avatar_url, bio, grade, phone_number").in("id", allIds);
      const map: Record<string, FollowProfile> = {};
      (profiles || []).forEach((p: any) => { map[p.id] = { id: p.id, nickname: p.nickname || "익명", avatar_url: p.avatar_url, bio: p.bio, grade: p.grade, phone_number: p.phone_number }; });
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
      const fetches: Promise<void>[] = [];

      if (isSeller) {
        fetches.push((async () => {
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
        })());
      }

      if (isMentor) {
        fetches.push((async () => {
          const { data } = await supabase
            .from("cad_mentors")
            .select("mentor_grade, completed_count, avg_rating")
            .eq("user_id", uid)
            .maybeSingle();
          const completedCount = data?.completed_count ?? 0;
          const avgRating = data?.avg_rating ?? 0;
          const grade = calcMentorGrade(completedCount, avgRating);
          setMentorGradeInfo({
            grade: ((data?.mentor_grade) || grade) as MentorGrade,
            completedCount,
            avgRating,
          });
        })());
      }

      await Promise.all(fetches);
    } finally {
      setGradeLoading(false);
    }
  };

  const handleAvatarChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userId) return;

    // 클라이언트 검증
    const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!ALLOWED_TYPES.includes(file.type)) {
      showError("JPG, PNG, WEBP, GIF 이미지만 업로드 가능합니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showError("이미지 파일은 5MB 이하만 업로드 가능합니다.");
      return;
    }

    setUploading(true);
    try {
      setPreviewUrl(URL.createObjectURL(file));

      // getAccessToken()은 만료 토큰을 그대로 반환하므로 getSession() 사용
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) { showError("로그인이 필요합니다."); return; }

      const compressedFile = await compressThumbnail(file);
      const ext = compressedFile.type === "image/webp" ? "webp" : (file.name.split(".").pop()?.toLowerCase() || "png");
      const path = `avatars/${userId}-${Date.now()}.${ext}`;
      const avatarForm = new FormData();
      avatarForm.append("file", compressedFile);
      avatarForm.append("bucket", "thumbnails");
      avatarForm.append("path", path);

      const avatarRes = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: avatarForm,
      });

      if (!avatarRes.ok) {
        const errJson = await avatarRes.json().catch(() => ({}));
        console.error("프로필 이미지 업로드 실패:", avatarRes.status, errJson);
        showError(`이미지 업로드 실패: ${errJson.error || avatarRes.status}`);
        return;
      }

      const { url } = await avatarRes.json();
      setAvatarUrl(url);
      setPreviewUrl(url);

      // 즉시 DB 반영 — 저장 버튼 없이도 이미지 변경 적용
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: url })
        .eq("id", userId);
      if (dbErr) {
        console.error("avatar_url DB 저장 실패:", dbErr);
        showError("이미지 업로드 완료, DB 저장 실패");
        return;
      }
      showSuccess("프로필 이미지가 변경되었습니다.");
    } catch (err) {
      console.error("프로필 이미지 처리 오류:", err);
      showError("프로필 이미지 처리 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;
    if (phoneNumber && !/^01[016789]-\d{3,4}-\d{4}$/.test(phoneNumber)) {
      setPhoneError("올바른 휴대폰 번호 형식이 아닙니다. (예: 010-1234-5678)");
      return;
    }
    setPhoneError("");
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
    if (isAdmin) return;
    if (!bankName || !accountHolder || !accountNumber) {
      showError("예금주명, 은행명, 계좌번호는 필수 입력 항목입니다.");
      return;
    }
    const acctDigits = accountNumber.replace(/\D/g, "");
    if (acctDigits.length < 10 || acctDigits.length > 14) {
      setAccountError("올바른 계좌번호를 입력해주세요. (숫자만 10~14자리)");
      return;
    }
    const trimmedOpentalkUrl = opentalkUrl.trim();
    const trimmedContactPhone = contactPhone.trim();
    if (!trimmedOpentalkUrl && !trimmedContactPhone) {
      showError("원활한 소통을 위해 전화번호 또는 오픈톡 URL 중 하나는 필수입니다.");
      return;
    }
    if (trimmedContactPhone && !isValidContactPhone(trimmedContactPhone)) {
      showError("올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)");
      return;
    }
    if (trimmedOpentalkUrl && !isValidContactUrl(trimmedOpentalkUrl)) {
      showError("올바른 URL을 입력해주세요.");
      return;
    }
    setAccountError("");
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
        opentalk_url: trimmedOpentalkUrl || null,
        contact_phone: trimmedContactPhone ? formatPhoneNumber(trimmedContactPhone) : null,
      }).eq("id", userId);
      if (error) throw error;
      setIsSeller(true);
      showSuccess("판매자 등록이 완료되었습니다!");
    } catch (e: any) {
      showError(e.message || "등록 실패. 다시 시도해주세요.");
    } finally {
      setSellerRegistering(false);
    }
  };

  const handleReinstateRequest = async () => {
    if (!reinstateReason.trim()) { showError("신청 사유를 입력해주세요."); return; }
    setReinstateRequesting(true);
    try {
      const token = getAccessToken();
      const res = await fetch("/api/seller/reinstate-request", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reinstateReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "신청 실패"); return; }
      setReinstateStatus("대기");
      setReinstateReason("");
      showSuccess("재등록 신청이 완료되었습니다. 관리자 검토 후 승인됩니다.");
    } catch {
      showError("재등록 신청 중 오류가 발생했습니다.");
    } finally {
      setReinstateRequesting(false);
    }
  };

  const handleSettlementSave = async () => {
    if (!bankName || !accountHolder || !accountNumber) {
      showError("예금주명, 은행명, 계좌번호는 필수 입력 항목입니다.");
      return;
    }
    const acctDigits = accountNumber.replace(/\D/g, "");
    if (acctDigits.length < 10 || acctDigits.length > 14) {
      setAccountError("올바른 계좌번호를 입력해주세요. (숫자만 10~14자리)");
      return;
    }
    setAccountError("");
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
      const token = getAccessToken();
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
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

  // 유저 목록 로드
  useEffect(() => {
    if (activeTab !== "users") return;
    fetchUserList(userListSubTab);
  }, [activeTab, userListSubTab]);

  const fetchUserList = async (sub: UserListSubTab) => {
    setUserListLoading(true);
    try {
      if (sub === "sellers") {
        const { data } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url, grade")
          .eq("role", "seller")
          .is("deleted_at", null)
          .eq("is_seller_banned", false)
          .order("created_at", { ascending: false });
        setSellersList((data || []).map((u: any) => ({ ...u, grade: u.grade as Grade | null })));
      } else if (sub === "mentors") {
        const { data } = await supabase
          .from("cad_mentors")
          .select("user_id, mentor_grade, profiles(id, nickname, avatar_url)")
          .eq("is_active", true)
          .eq("is_suspended", false);
        setMentorsList((data || []).map((m: any) => ({
          id: m.user_id,
          nickname: (m.profiles as any)?.nickname ?? "—",
          avatar_url: (m.profiles as any)?.avatar_url ?? null,
          grade: null,
          mentor_grade: m.mentor_grade ?? "normal",
        })));
      } else {
        const { data } = await supabase
          .from("profiles")
          .select("id, nickname, avatar_url, grade")
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .limit(200);
        setAllUsersList((data || []).map((u: any) => ({ ...u, grade: u.grade as Grade | null })));
      }
    } catch (e) {
      console.error("유저 목록 조회 실패:", e);
    } finally {
      setUserListLoading(false);
    }
  };

  const tabs: { id: TabId; label: string; sellerOnly?: boolean; mentorOrSeller?: boolean }[] = [
    { id: "basic", label: "기본 정보" },
    { id: "grade", label: "내 등급", mentorOrSeller: true },
    { id: "follow", label: "팔로우" },
    { id: "seller", label: isSeller ? "판매자 정보" : "판매자 등록" },
    { id: "mentor", label: isMentor ? "멘토 정보" : "멘토 등록" },
    { id: "stats", label: "판매 통계", sellerOnly: true },
    { id: "points", label: "포인트" },
    { id: "users", label: "유저 목록" },
  ];

  if (loading) {
    return (
      <main style={pageWrap}>
        <p style={{ color: "#6b7280" }}>정보를 불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="pf-wrap" style={pageWrap}>
      <div className="pf-page-header" style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: DARK }}>내 정보</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>계정 정보 및 판매자 설정을 관리합니다.</p>
      </div>

      <div className="profile-grid" style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 24, alignItems: "start" }}>

        {/* ── 왼쪽 사이드바 ── */}
        <aside className="profile-aside" style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 20, position: "sticky", top: 88 }}>
          {/* 프로필 이미지 + 닉네임 + 업로드 */}
          <div className="profile-avatar-section" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div className="profile-avatar-img-wrap" style={{ position: "relative", flexShrink: 0 }}>
              <AvatarImage avatarUrl={previewUrl} nickname={nickname} size={96} border="2px solid #e5e7eb" />
            </div>
            <div className="profile-avatar-right" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
              <div className="profile-avatar-name" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
                <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>{nickname || "닉네임"}</span>
                {grade && <GradeBadge grade={grade} size="sm" />}
                {isSeller && !isSellerBanned && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", background: "#dcfce7", padding: "3px 10px", borderRadius: 999 }}>
                    ✓ 판매자
                  </span>
                )}
                {isSellerBanned && (
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#dc2626", background: "#fee2e2", padding: "3px 10px", borderRadius: 999 }}>
                    ✗ 판매자 정지
                  </span>
                )}
              </div>
              <div className="profile-avatar-info" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <label style={{
                  height: 28, padding: "0 10px", borderRadius: 8,
                  background: DARK, color: "white",
                  display: "inline-flex", alignItems: "center",
                  cursor: uploading ? "not-allowed" : "pointer",
                  fontWeight: 700, fontSize: 11, opacity: uploading ? 0.6 : 1,
                }}>
                  {uploading ? "업로드 중..." : "이미지 업로드 & 변경"}
                  <input type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                </label>
              </div>
            </div>
          </div>

          <div className="profile-divider" style={{ height: 1, background: "#e5e7eb", marginBottom: 14 }} />

          {/* 탭 버튼 목록 */}
          <nav className="profile-tabs-nav" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tabs.filter((t) => (!t.sellerOnly || isSeller) && (!t.mentorOrSeller || isSeller || isMentor)).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`pf-tab-btn${activeTab === tab.id ? " pf-tab-btn--active" : ""}`}
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
        <section className="profile-section-card" style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", padding: 28, minHeight: 360 }}>

          {/* 기본 정보 탭 */}
          {activeTab === "basic" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <h2 className="pf-section-title" style={sectionTitle}>기본 정보</h2>

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
                  onChange={(e) => { setPhoneNumber(formatPhoneNumber(e.target.value)); setPhoneError(""); }}
                  placeholder="010-0000-0000"
                  inputMode="numeric"
                  style={{ ...inputStyle, ...(phoneError ? { borderColor: "#ef4444" } : {}) }}
                />
                {phoneError
                  ? <p style={{ margin: 0, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{phoneError}</p>
                  : <p style={helperText}>판매자 페이지에 공개됩니다.</p>
                }
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
              <h2 className="pf-section-title" style={sectionTitle}>팔로우</h2>
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
                          <AvatarImage avatarUrl={p.avatar_url} nickname={p.nickname} size={40} onClick={() => router.push(`/seller/${p.id}`)} />
                          <div
                            style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                            onClick={() => router.push(`/seller/${p.id}`)}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, color: "#111827" }}>
                              {p.nickname}
                              {p.grade && <GradeBadge grade={p.grade as Grade} size="sm" />}
                            </div>
                            {p.phone_number && (
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                <Phone size={11} color="#16a34a" strokeWidth={2.5} />
                                {p.phone_number}
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
                        <div
                          key={p.id}
                          onClick={() => router.push(`/seller/${p.id}`)}
                          style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
                        >
                          <AvatarImage avatarUrl={p.avatar_url} nickname={p.nickname} size={40} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 14, color: "#111827" }}>
                              {p.nickname}
                              {p.grade && <GradeBadge grade={p.grade as Grade} size="sm" />}
                            </div>
                            {p.phone_number && (
                              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, display: "flex", alignItems: "center", gap: 4 }}>
                                <Phone size={11} color="#16a34a" strokeWidth={2.5} />
                                {p.phone_number}
                              </div>
                            )}
                          </div>
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
              <h2 className="pf-section-title" style={sectionTitle}>판매자 등록</h2>

              {/* ─ 정지 안내 ─ */}
              {isSellerBanned && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#dc2626" }}>
                    계정이 정지되었습니다. 관리자에게 문의하세요.
                  </div>

                  {reinstateStatus === "대기" && (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 999, alignSelf: "flex-start", background: "#fef3c7", color: "#92400e", fontSize: 13, fontWeight: 700 }}>
                      재등록 신청 검토 중
                    </div>
                  )}

                  {reinstateStatus === "거부" && (
                    <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#92400e", fontWeight: 600 }}>
                      이전 재등록 신청이 거부되었습니다. 사유를 보완하여 다시 신청할 수 있습니다.
                    </div>
                  )}

                  {(reinstateStatus === null || reinstateStatus === "거부") && (
                    <>
                      <p style={{ margin: 0, fontSize: 13, color: "#6b7280" }}>
                        재등록 신청 사유를 작성해주세요. 관리자 검토 후 승인됩니다.
                      </p>
                      <textarea
                        value={reinstateReason}
                        onChange={(e) => setReinstateReason(e.target.value)}
                        placeholder="재등록 신청 사유를 입력해주세요. (예: 향후 판매 규정을 준수하겠습니다.)"
                        rows={3}
                        style={{
                          width: "100%", borderRadius: 10, border: "1px solid #fecaca",
                          padding: "10px 12px", fontSize: 13, outline: "none",
                          resize: "vertical", boxSizing: "border-box",
                          fontFamily: "inherit", background: "white",
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleReinstateRequest}
                        disabled={reinstateRequesting}
                        style={{
                          height: 44, padding: "0 20px", borderRadius: 12, border: "none",
                          background: "#dc2626", color: "white", fontWeight: 700, fontSize: 14,
                          cursor: reinstateRequesting ? "not-allowed" : "pointer",
                          opacity: reinstateRequesting ? 0.7 : 1,
                          alignSelf: "flex-start",
                        }}
                      >
                        {reinstateRequesting ? "신청 중..." : "재등록 신청"}
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* ─ 안내문 패널 ─ */}
              <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {/* 수수료 표 */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: "#374151", marginBottom: 8 }}>등급별 수수료</div>
                  <div className="grade-fee-grid" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
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
                    {!isSellerBanned && (
                      <button type="button" onClick={() => setSettlementEditing(true)} style={{ ...actionBtn, marginTop: 4, alignSelf: "flex-start" }}>
                        정보 수정
                      </button>
                    )}
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

              {/* ─ 연락 수단 ─ */}
              {isSeller && (
                <ContactChannelsSection
                  userId={userId}
                  opentalkUrl={opentalkUrl}
                  contactPhone={contactPhone}
                  onSaved={(o, p) => { setOpentalkUrl(o); setContactPhone(p); }}
                />
              )}

              {/* ─ 미신청 or 수정 모드 → 폼 ─ */}
              {(!isSeller || settlementEditing) && !isSellerBanned && (
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
                        style={{ ...inputStyle, ...(accountError ? { borderColor: "#ef4444" } : {}) }}
                        type="text"
                        inputMode="numeric"
                        placeholder="숫자만 입력 (예: 123456789012)"
                        value={accountNumber}
                        onChange={(e) => { setAccountNumber(e.target.value.replace(/\D/g, "")); setAccountError(""); }}
                      />
                      {accountError && <p style={{ margin: 0, fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{accountError}</p>}
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

                  {/* 연락 수단 섹션 (최초 등록 시) */}
                  {!isSeller && (
                    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", background: "white", display: "flex", flexDirection: "column", gap: 16 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>연락 수단 <span style={{ fontSize: 11, color: "#ef4444" }}>필수</span></div>
                      <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
                        원활한 소통을 위해 오픈톡 또는 연락처 중 하나는 필수입니다.
                      </p>
                      <div style={fieldWrap}>
                        <label style={labelStyle}>카카오 오픈톡방 URL</label>
                        <input style={inputStyle} placeholder="https://open.kakao.com/o/..." value={opentalkUrl} onChange={(e) => setOpentalkUrl(e.target.value)} />
                      </div>
                      <div style={fieldWrap}>
                        <label style={labelStyle}>휴대폰 번호</label>
                        <input style={inputStyle} placeholder="010-1234-5678" value={contactPhone} onChange={(e) => setContactPhone(formatPhoneNumber(e.target.value))} />
                      </div>
                    </div>
                  )}

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
                  ) : !isAdmin ? (
                    <button type="button" onClick={handleSellerApply} disabled={sellerRegistering}
                      style={{ ...actionBtn, opacity: sellerRegistering ? 0.6 : 1, cursor: sellerRegistering ? "not-allowed" : "pointer" }}>
                      {sellerRegistering ? "신청 중..." : "판매자 신청하기"}
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          )}

          {/* 멘토등록 탭 */}
          {activeTab === "mentor" && (
            <MentorTab
              userId={userId}
              isSeller={isSeller}
              isMentor={isMentor}
              setIsMentor={setIsMentor}
              opentalkUrl={opentalkUrl}
              contactPhone={contactPhone}
              onContactSaved={(o, p) => { setOpentalkUrl(o); setContactPhone(p); }}
            />
          )}

          {/* 내 등급 탭 */}
          {activeTab === "grade" && (isSeller || isMentor) && (
            <GradeTab
              gradeInfo={gradeInfo}
              gradeLoading={gradeLoading}
              isSeller={isSeller}
              isMentor={isMentor}
              mentorGradeInfo={mentorGradeInfo}
            />
          )}

          {/* 판매 통계 탭 (seller 전용) */}
          {activeTab === "stats" && isSeller && (
            <SalesTab userId={userId} />
          )}

          {/* 포인트 탭 */}
          {activeTab === "points" && (
            <PointsTab userId={userId} isSeller={isSeller} isAdmin={isAdmin} />
          )}

          {/* 유저 목록 탭 */}
          {activeTab === "users" && (() => {
            const SUB_TABS: { id: UserListSubTab; label: string }[] = [
              { id: "sellers", label: "판매자" },
              { id: "mentors", label: "멘토" },
              { id: "all",     label: "유저" },
            ];
            const currentList =
              userListSubTab === "sellers" ? sellersList :
              userListSubTab === "mentors" ? mentorsList : allUsersList;
            const q = userListSearch.trim().toLowerCase();
            const filtered = q
              ? currentList.filter(u => (u.nickname || "").toLowerCase().includes(q))
              : currentList;

            return (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={sectionTitle}>유저 목록</h2>

                {/* 서브탭 */}
                <div style={{ display: "flex", gap: 8 }}>
                  {SUB_TABS.map(t => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => { setUserListSubTab(t.id); setUserListSearch(""); }}
                      style={{
                        height: 36, padding: "0 16px", borderRadius: 10, border: "none",
                        background: userListSubTab === t.id ? DARK : "#f3f4f6",
                        color: userListSubTab === t.id ? "white" : "#374151",
                        fontWeight: 700, fontSize: 13, cursor: "pointer",
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* 검색창 */}
                <input
                  value={userListSearch}
                  onChange={e => setUserListSearch(e.target.value)}
                  placeholder="닉네임 검색"
                  style={{
                    height: 42, borderRadius: 10, border: "1px solid #d1d5db",
                    padding: "0 14px", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box",
                  }}
                />

                {/* 목록 */}
                {userListLoading ? (
                  <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px 0" }}>불러오는 중...</p>
                ) : filtered.length === 0 ? (
                  <p style={{ color: "#9ca3af", textAlign: "center", padding: "32px 0" }}>
                    {q ? "검색 결과가 없습니다." : "목록이 없습니다."}
                  </p>
                ) : (
                  <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, overflow: "hidden" }}>
                    {filtered.map((u, idx) => (
                      <div
                        key={u.id}
                        onClick={() => router.push(`/seller/${u.id}`)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "12px 16px", cursor: "pointer",
                          borderBottom: idx < filtered.length - 1 ? "1px solid #f3f4f6" : "none",
                          background: "white", transition: "background 0.1s",
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f9fafb")}
                        onMouseLeave={e => (e.currentTarget.style.background = "white")}
                      >
                        <AvatarImage avatarUrl={u.avatar_url} nickname={u.nickname} size={40} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{u.nickname || "—"}</span>
                          {u.grade && <GradeBadge grade={u.grade} size="sm" />}
                          {u.mentor_grade && (() => {
                            const cfg = MENTOR_GRADE_CONFIG[u.mentor_grade as MentorGrade];
                            if (!cfg) return null;
                            return (
                              <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color, background: cfg.bg, padding: "2px 8px", borderRadius: 999, border: `1px solid ${cfg.border}` }}>
                                {cfg.label}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 12, color: "#9ca3af" }}>
                  {filtered.length}명 표시 중{userListSubTab === "all" && currentList.length >= 200 ? " (최대 200명)" : ""}
                </p>
              </div>
            );
          })()}

        </section>
      </div>

      <style>{`
        @media (max-width: 768px) {
          /* ── 전체 래퍼 ── */
          .pf-wrap {
            padding: 0 16px 80px !important;
            overflow-x: hidden !important;
            max-width: 100vw !important;
            box-sizing: border-box !important;
          }
          .pf-page-header {
            padding-top: 16px !important;
            margin-bottom: 16px !important;
          }
          .pf-page-header h1 { font-size: 22px !important; }

          /* ── 그리드 ── */
          .profile-grid {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
            width: 100% !important;
            overflow-x: hidden !important;
          }

          /* ── 사이드바 ── */
          .profile-aside {
            border-radius: 14px !important;
            padding: 16px !important;
            position: static !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }

          /* ── 프로필 이미지: 모바일 가로 배치 ── */
          .profile-avatar-section {
            flex-direction: row !important;
            align-items: center !important;
            gap: 14px !important;
            margin-bottom: 12px !important;
          }
          .profile-avatar-img-wrap img {
            width: 72px !important;
            height: 72px !important;
          }
          .profile-avatar-right {
            align-items: flex-start !important;
          }
          .profile-avatar-info {
            display: flex !important;
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 6px !important;
          }

          /* ── 구분선 ── */
          .profile-divider { margin: 8px 0 10px !important; }

          /* ── 탭 2열 그리드 ── */
          .profile-tabs-nav {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            gap: 8px !important;
            overflow-x: visible !important;
            padding-bottom: 0 !important;
            max-width: 100% !important;
          }
          .pf-tab-btn {
            width: 100% !important;
            height: 40px !important;
            text-align: center !important;
            padding: 0 6px !important;
            font-size: 13px !important;
            white-space: normal !important;
            line-height: 1.3 !important;
            border-radius: 10px !important;
          }
          .pf-tab-btn--active {
            background: #c9a84c !important;
            color: white !important;
          }

          /* ── 콘텐츠 카드 ── */
          .profile-section-card {
            border-radius: 14px !important;
            padding: 16px !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
          }
          .pf-section-title { display: none !important; }

          /* ── 내부 그리드 ── */
          .grade-fee-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .grade-stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .points-container { overflow-x: auto !important; max-width: 100% !important; }

          /* ── 입력 필드 ── */
          .pf-wrap input,
          .pf-wrap select,
          .pf-wrap textarea {
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>

      {/* 회원탈퇴 버튼 */}
      <div style={{ marginTop: 40, textAlign: "center" }}>
        <button
          type="button"
          onClick={() => setWithdrawStep(1)}
          style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#9ca3af", textDecoration: "underline" }}
        >
          회원탈퇴
        </button>
      </div>

      {/* 회원탈퇴 모달 */}
      {withdrawStep > 0 && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(0,0,0,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: 20,
        }} onClick={() => { setWithdrawStep(0); setWithdrawInput(""); setWithdrawReason(""); }}>
          <div
            style={{ background: "white", borderRadius: 20, padding: 28, width: "100%", maxWidth: 420, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 1단계: 경고 */}
            {withdrawStep === 1 && (
              <>
                <h3 style={{ margin: "0 0 14px", fontSize: 18, fontWeight: 800, color: "#111827" }}>회원 탈퇴</h3>
                <p style={{ margin: "0 0 10px", fontSize: 14, color: "#374151", lineHeight: 1.65 }}>
                  회원 탈퇴 시 모든 데이터가 삭제되며 복구할 수 없습니다.<br />
                  구매한 모델 다운로드 권한도 사라집니다.
                </p>
                {isSeller && (
                  <div style={{ padding: "10px 14px", borderRadius: 10, background: "#fef9c3", border: "1px solid #fde047", fontSize: 13, color: "#854d0e", marginBottom: 10 }}>
                    ⚠️ 판매자 등록이 해제되며 등록된 모델은 비공개 처리됩니다.
                  </div>
                )}
                <p style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, color: "#111827" }}>
                  정말 탈퇴하시겠습니까?
                </p>
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => { setWithdrawStep(0); setWithdrawInput(""); setWithdrawReason(""); }} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #d1d5db", background: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#374151" }}>
                    취소
                  </button>
                  <button type="button" onClick={() => setWithdrawStep(2)} style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: "#374151", color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                    확인
                  </button>
                </div>
              </>
            )}

            {/* 2단계: 확인 텍스트 입력 */}
            {withdrawStep === 2 && (
              <>
                <h3 style={{ margin: "0 0 10px", fontSize: 18, fontWeight: 800, color: "#111827" }}>탈퇴 확인</h3>
                <p style={{ margin: "0 0 14px", fontSize: 13, color: "#6b7280" }}>
                  아래 입력란에 <strong style={{ color: "#111827" }}>탈퇴합니다</strong>를 입력하세요.
                </p>
                <textarea
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="탈퇴 사유를 입력해주세요. (선택)"
                  rows={3}
                  style={{ width: "100%", borderRadius: 10, border: "1px solid #d1d5db", padding: "10px 14px", fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 12, resize: "none", color: "#374151" }}
                />
                <input
                  type="text"
                  value={withdrawInput}
                  onChange={(e) => setWithdrawInput(e.target.value)}
                  placeholder="탈퇴합니다"
                  autoFocus
                  style={{ width: "100%", height: 44, borderRadius: 10, border: "1px solid #d1d5db", padding: "0 14px", fontSize: 14, outline: "none", boxSizing: "border-box", marginBottom: 16 }}
                />
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => { setWithdrawStep(0); setWithdrawInput(""); setWithdrawReason(""); }} style={{ flex: 1, height: 44, borderRadius: 12, border: "1px solid #d1d5db", background: "white", fontWeight: 700, fontSize: 14, cursor: "pointer", color: "#374151" }}>
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handleWithdraw}
                    disabled={withdrawInput !== "탈퇴합니다" || withdrawing}
                    style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: withdrawInput === "탈퇴합니다" ? "#dc2626" : "#e5e7eb", color: "white", fontWeight: 700, fontSize: 14, cursor: withdrawInput === "탈퇴합니다" && !withdrawing ? "pointer" : "not-allowed" }}
                  >
                    {withdrawing ? "처리 중..." : "최종 탈퇴"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}

/* ── 내 등급 탭 ── */
const GRADE_KEYS: Grade[] = ["sprout", "skilled", "pro", "master"];
const MENTOR_GRADE_KEYS: MentorGrade[] = ["normal", "certified", "pro", "master"];

const GRADE_STYLE: Record<Grade, { color: string; bg: string; border: string; label: string }> = {
  sprout:  { color: "#374151", bg: "#f9fafb", border: "#d1d5db", label: "셀러" },
  skilled: { color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe", label: "인증셀러" },
  pro:     { color: "#6d28d9", bg: "#f5f3ff", border: "#ddd6fe", label: "프로셀러" },
  master:  { color: "#b45309", bg: "#fffbeb", border: "#fde68a", label: "파트너" },
};

function GradeTab({
  gradeInfo,
  gradeLoading,
  isSeller,
  isMentor,
  mentorGradeInfo,
}: {
  gradeInfo: { grade: Grade; totalCount: number; totalAmount: number } | null;
  gradeLoading: boolean;
  isSeller: boolean;
  isMentor: boolean;
  mentorGradeInfo: { grade: MentorGrade; completedCount: number; avgRating: number } | null;
}) {
  if (gradeLoading) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <h2 className="pf-section-title" style={sectionTitle}>내 등급</h2>
        <p style={{ color: "#6b7280", fontSize: 14 }}>불러오는 중...</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>
      <h2 className="pf-section-title" style={sectionTitle}>내 등급</h2>

      {/* ── 판매자 등급 섹션 ── */}
      {isSeller && <SellerGradeSection gradeInfo={gradeInfo} />}

      {/* ── 멘토 등급 섹션 ── */}
      {isMentor && <MentorGradeSection mentorGradeInfo={mentorGradeInfo} />}
    </div>
  );
}

/* ── 판매자 등급 섹션 ── */
function SellerGradeSection({
  gradeInfo,
}: {
  gradeInfo: { grade: Grade; totalCount: number; totalAmount: number } | null;
}) {
  const grade     = gradeInfo?.grade      ?? "sprout";
  const count     = gradeInfo?.totalCount  ?? 0;
  const amount    = gradeInfo?.totalAmount ?? 0;
  const cfg       = GRADE_CONFIG[grade];
  const orderIdx  = gradeOrder(grade);
  const nextGrade = orderIdx < 3 ? GRADE_KEYS[orderIdx + 1] : null;
  const nextCfg   = nextGrade ? GRADE_CONFIG[nextGrade] : null;

  const countPct   = nextCfg ? Math.min((count  / nextCfg.minSales)  * 100, 100) : 100;
  const amountPct  = nextCfg ? Math.min((amount / nextCfg.minAmount) * 100, 100) : 100;
  const countLeft  = nextCfg ? Math.max(0, nextCfg.minSales  - count)  : 0;
  const amountLeft = nextCfg ? Math.max(0, nextCfg.minAmount - amount) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", borderLeft: "3px solid #111827", paddingLeft: 10 }}>판매자 등급</div>

      {/* 현재 등급 카드 */}
      <div style={{
        border: `1px solid ${cfg.bg === "#dcfce7" ? "#bbf7d0" : cfg.bg}`,
        borderRadius: 16, padding: "24px", background: cfg.bg,
        display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
      }}>
        <GradeBadge grade={grade} size="xl" />
        <div className="grade-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 4, width: "100%" }}>
          {[
            { label: "수수료율", value: `${Math.round(cfg.commission * 100)}%` },
            { label: "총 판매 건수", value: `${count.toLocaleString("ko-KR")}건` },
            { label: "누적 판매 금액", value: `${amount.toLocaleString("ko-KR")}원` },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 다음 등급 진행도 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>다음 등급 진행도</div>
        {nextGrade && nextCfg ? (
          <>
            <div style={{ fontSize: 13, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontWeight: 600 }}>
              {GRADE_STYLE[nextGrade].label}까지{" "}
              {countLeft > 0 && <strong>{countLeft.toLocaleString("ko-KR")}건</strong>}
              {countLeft > 0 && amountLeft > 0 && ", "}
              {amountLeft > 0 && <strong>{Math.ceil(amountLeft / 10000).toLocaleString("ko-KR")}만원</strong>}
              {countLeft === 0 && amountLeft === 0 ? " 달성 완료! (등급 갱신 대기 중)" : " 남았어요"}
            </div>
            <ProgressBar label="판매 건수" current={count} target={nextCfg.minSales} pct={countPct} color={cfg.color} />
            <ProgressBar label="판매 금액" current={Math.ceil(amount / 10000)} target={Math.ceil(nextCfg.minAmount / 10000)} unit="만원" pct={amountPct} color={cfg.color} />
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "28px 20px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, color: "#b45309", fontWeight: 800, fontSize: 16 }}>
            최고 등급 달성!
          </div>
        )}
      </div>

      {/* 전체 등급 안내 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>전체 등급 안내</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {GRADE_KEYS.map((g) => {
            const s = GRADE_STYLE[g];
            const c = GRADE_CONFIG[g];
            const isCurrent = g === grade;
            return (
              <div key={g} style={{ border: `1.5px solid ${isCurrent ? s.color : s.border}`, borderRadius: 14, padding: "16px 18px", background: isCurrent ? s.bg : "white", boxShadow: isCurrent ? `0 0 0 3px ${s.border}` : "none", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: s.color }}>{s.label}</span>
                  {isCurrent && <span style={{ fontSize: 10, fontWeight: 800, color: s.color, background: "white", border: `1px solid ${s.border}`, borderRadius: 999, padding: "2px 8px" }}>현재</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                  {c.minSales === 0 ? "기본 등급" : `판매 ${c.minSales.toLocaleString()}건 + ${Math.ceil(c.minAmount / 10000).toLocaleString()}만원`}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color }}>수수료 {Math.round(c.commission * 100)}%</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── 멘토 등급 섹션 ── */
function MentorGradeSection({
  mentorGradeInfo,
}: {
  mentorGradeInfo: { grade: MentorGrade; completedCount: number; avgRating: number } | null;
}) {
  const grade         = mentorGradeInfo?.grade         ?? "normal";
  const completedCount = mentorGradeInfo?.completedCount ?? 0;
  const avgRating      = mentorGradeInfo?.avgRating      ?? 0;
  const cfg            = MENTOR_GRADE_CONFIG[grade];
  const orderIdx       = mentorGradeOrder(grade);
  const nextGrade      = orderIdx < 3 ? MENTOR_GRADE_KEYS[orderIdx + 1] : null;
  const nextCfg        = nextGrade ? MENTOR_GRADE_CONFIG[nextGrade] : null;

  const completedPct  = nextCfg ? Math.min((completedCount / nextCfg.minCompleted) * 100, 100) : 100;
  const completedLeft = nextCfg ? Math.max(0, nextCfg.minCompleted - completedCount) : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", borderLeft: "3px solid #c9a84c", paddingLeft: 10 }}>멘토 등급</div>

      {/* 현재 멘토 등급 카드 */}
      <div style={{ border: `1px solid ${cfg.border}`, borderRadius: 16, padding: "24px", background: cfg.bg, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        <div style={{ fontSize: 26, fontWeight: 900, color: cfg.color, letterSpacing: "-0.02em" }}>{cfg.label}</div>
        <div className="grade-stats-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginTop: 4, width: "100%" }}>
          {[
            { label: "수수료율", value: `${Math.round(cfg.commission * 100)}%` },
            { label: "완료 건수", value: `${completedCount.toLocaleString("ko-KR")}건` },
            { label: "평균 평점", value: avgRating > 0 ? `★ ${avgRating.toFixed(1)}` : "-" },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "white", borderRadius: 12, padding: "14px 16px", border: "1px solid rgba(0,0,0,0.06)", textAlign: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 6, letterSpacing: "0.04em" }}>{label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: "#111827" }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 다음 등급 진행도 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>다음 등급 진행도</div>
        {nextGrade && nextCfg ? (
          <>
            <div style={{ fontSize: 13, color: "#374151", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", fontWeight: 600 }}>
              {nextCfg.label}까지{" "}
              {completedLeft > 0
                ? <><strong>완료 {completedLeft}건</strong> + <strong>평점 {nextCfg.minRating} 이상</strong> 남았어요</>
                : " 완료 건수 달성! (평점 조건 확인 중)"}
            </div>
            <ProgressBar label="완료 건수" current={completedCount} target={nextCfg.minCompleted} pct={completedPct} color={cfg.color} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>평균 평점</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#6b7280" }}>{avgRating > 0 ? avgRating.toFixed(1) : "0"} / {nextCfg.minRating}</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${nextCfg.minRating > 0 ? Math.min((avgRating / nextCfg.minRating) * 100, 100) : 0}%`, borderRadius: 999, background: cfg.color, transition: "width 0.5s ease" }} />
              </div>
            </div>
          </>
        ) : (
          <div style={{ textAlign: "center", padding: "28px 20px", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 14, color: "#b45309", fontWeight: 800, fontSize: 16 }}>
            최고 멘토 등급 달성!
          </div>
        )}
      </div>

      {/* 전체 멘토 등급 안내 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#374151" }}>전체 멘토 등급 안내</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12 }}>
          {MENTOR_GRADE_KEYS.map((g) => {
            const c = MENTOR_GRADE_CONFIG[g];
            const isCurrent = g === grade;
            return (
              <div key={g} style={{ border: `1.5px solid ${isCurrent ? c.color : c.border}`, borderRadius: 14, padding: "16px 18px", background: isCurrent ? c.bg : "white", boxShadow: isCurrent ? `0 0 0 3px ${c.border}` : "none", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontWeight: 900, fontSize: 15, color: c.color }}>{c.label}</span>
                  {isCurrent && <span style={{ fontSize: 10, fontWeight: 800, color: c.color, background: "white", border: `1px solid ${c.border}`, borderRadius: 999, padding: "2px 8px" }}>현재</span>}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                  {c.minCompleted === 0
                    ? "기본 등급"
                    : `완료 ${c.minCompleted}건 이상 + 평점 ${c.minRating} 이상`}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: c.color }}>수수료 {Math.round(c.commission * 100)}%</div>
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

  const getThumbUrl = (model?: ModelRow) =>
    model ? getModelThumbnailUrl(model) : "";

  if (salesLoading) {
    return <div style={{ padding: "20px 0" }}><p style={{ color: "#6b7280" }}>판매 통계 불러오는 중...</p></div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <h2 className="pf-section-title" style={sectionTitle}>판매 통계</h2>
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
                      ? <Image src={thumb} alt={model?.title || "thumb"} width={48} height={48} style={{ borderRadius: 10, objectFit: "cover", flexShrink: 0, border: "1px solid #e5e7eb" }} />
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

/* ── 연락 수단 (판매자/멘토 공용) ── */
function ContactChannelsSection({
  userId,
  opentalkUrl,
  contactPhone,
  onSaved,
}: {
  userId: string;
  opentalkUrl: string;
  contactPhone: string;
  onSaved: (opentalkUrl: string, contactPhone: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(opentalkUrl);
  const [phone, setPhone] = useState(contactPhone);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setUrl(opentalkUrl);
    setPhone(contactPhone);
  }, [opentalkUrl, contactPhone]);

  const handleSave = async () => {
    const trimmedUrl = url.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedUrl && !trimmedPhone) {
      showError("원활한 소통을 위해 전화번호 또는 오픈톡 URL 중 하나는 필수입니다.");
      return;
    }
    if (trimmedPhone && !isValidContactPhone(trimmedPhone)) {
      showError("올바른 휴대폰 번호를 입력해주세요. (예: 010-1234-5678)");
      return;
    }
    if (trimmedUrl && !isValidContactUrl(trimmedUrl)) {
      showError("올바른 URL을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("profiles").update({
        opentalk_url: trimmedUrl || null,
        contact_phone: trimmedPhone ? formatPhoneNumber(trimmedPhone) : null,
      }).eq("id", userId);
      if (error) throw error;
      onSaved(trimmedUrl, trimmedPhone ? formatPhoneNumber(trimmedPhone) : "");
      setEditing(false);
      showSuccess("연락 수단이 저장되었습니다.");
    } catch (e: any) {
      showError(e.message || "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "18px 20px", background: "white", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: "#111827" }}>연락 수단</div>
      <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.6 }}>
        원활한 소통을 위해 오픈톡 또는 연락처 중 하나는 필수입니다.
      </p>

      {!editing ? (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 14 }}>
            <span style={{ color: "#6b7280", fontWeight: 600 }}>오픈톡 URL</span>
            <span style={{ color: "#111827", fontWeight: 700, wordBreak: "break-all" }}>{opentalkUrl || "—"}</span>
            <span style={{ color: "#6b7280", fontWeight: 600 }}>휴대폰 번호</span>
            <span style={{ color: "#111827", fontWeight: 700 }}>{contactPhone || "—"}</span>
          </div>
          <button type="button" onClick={() => setEditing(true)} style={{ ...actionBtn, alignSelf: "flex-start" }}>
            {opentalkUrl || contactPhone ? "정보 수정" : "등록하기"}
          </button>
        </>
      ) : (
        <>
          <div style={fieldWrap}>
            <label style={labelStyle}>카카오 오픈톡방 URL</label>
            <input style={inputStyle} placeholder="https://open.kakao.com/o/..." value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div style={fieldWrap}>
            <label style={labelStyle}>휴대폰 번호</label>
            <input style={inputStyle} placeholder="010-1234-5678" value={phone} onChange={(e) => setPhone(formatPhoneNumber(e.target.value))} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button type="button" onClick={handleSave} disabled={saving} style={{ ...actionBtn, opacity: saving ? 0.6 : 1, cursor: saving ? "not-allowed" : "pointer" }}>
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              type="button"
              onClick={() => { setUrl(opentalkUrl); setPhone(contactPhone); setEditing(false); }}
              style={{ height: 48, padding: "0 20px", borderRadius: 12, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              취소
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 멘토등록 탭 ── */
const PLAN_LABELS: Record<string, string> = { basic: "BASIC", pro: "PRO", master: "MASTER" };

type MentorData = {
  id: string;
  intro: string;
  avg_rating: number;
  total_ratings: number;
  response_rate: number;
  is_active: boolean;
  is_suspended: boolean;
  warning_count: number;
};
type MentorSub = {
  id: string;
  plan_type: string;
  status: string;
  started_at: string | null;
  expires_at: string;
  checklist_count: number;
  review_count: number;
  subscriber_profile: { nickname: string | null } | null;
};
type MentorWarning = {
  id: string;
  reason: string;
  warning_type: string;
  created_at: string;
};

function MentorTab({ userId, isSeller, isMentor, setIsMentor, opentalkUrl, contactPhone, onContactSaved }: { userId: string; isSeller: boolean; isMentor: boolean; setIsMentor: (v: boolean) => void; opentalkUrl: string; contactPhone: string; onContactSaved: (opentalkUrl: string, contactPhone: string) => void }) {
  const [mentorData, setMentorData] = useState<MentorData | null>(null);
  const [subscriptions, setSubscriptions] = useState<MentorSub[]>([]);
  const [warnings, setWarnings] = useState<MentorWarning[]>([]);
  const [tabLoading, setTabLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!userId || loadedRef.current) return;
    loadedRef.current = true;
    loadMentorData();
  }, [userId]);

  const loadMentorData = async () => {
    setTabLoading(true);
    const { data: mentor } = await supabase
      .from("cad_mentors")
      .select("id, intro, avg_rating, total_ratings, response_rate, is_active, is_suspended, warning_count")
      .eq("user_id", userId)
      .maybeSingle();

    if (mentor) {
      setMentorData(mentor as MentorData);

      const [{ data: subs }, { data: warns }] = await Promise.all([
        supabase
          .from("cad_subscriptions")
          .select("id, plan_type, status, started_at, expires_at, checklist_count, review_count, subscriber_profile:profiles!cad_subscriptions_subscriber_id_fkey(nickname)")
          .eq("mentor_id", mentor.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("cad_mentor_warnings")
          .select("id, reason, warning_type, created_at")
          .eq("mentor_id", mentor.id)
          .order("created_at", { ascending: false }),
      ]);

      setSubscriptions((subs ?? []) as unknown as MentorSub[]);
      setWarnings((warns ?? []) as MentorWarning[]);
    }
    setTabLoading(false);
  };

  const handleToggleActive = async () => {
    if (!mentorData) return;
    const token = getAccessToken();
    if (!token) { showError("로그인이 필요합니다."); return; }
    setToggling(true);
    const newActive = !mentorData.is_active;
    const res = await fetch("/api/cad-school/mentor", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: newActive }),
    });
    const d = await res.json();
    if (!res.ok) showError(d.error ?? "변경 실패");
    else {
      setMentorData((prev) => prev ? { ...prev, is_active: newActive } : prev);
      showSuccess(newActive ? "멘토 활동이 재개되었습니다." : "멘토 활동이 일시중지되었습니다.");
    }
    setToggling(false);
  };

  if (tabLoading) return <div style={{ padding: "20px 0", color: "#6b7280" }}>불러오는 중...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <h2 className="pf-section-title" style={sectionTitle}>멘토 등록</h2>

      {/* 멘토 상세 설명 접이식 */}
      <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px", marginBottom: 8 }}>
        <div
          onClick={() => setShowGuide(!showGuide)}
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}
        >
          <span style={{ fontWeight: 700, fontSize: 14, color: "#111827" }}>📋 멘토 상세 설명</span>
          <span style={{ fontSize: 12, color: "#6b7280" }}>{showGuide ? "접기 ▲" : "펼치기 ▼"}</span>
        </div>
        {showGuide && (
          <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>수익 구조</div>
              <p style={{ margin: 0, fontSize: 13, color: "#6b7280", lineHeight: 1.8 }}>
                수익은 멘토 등급에 따라 차등 지급됩니다.{" "}
                <a href="/profile?tab=grade" style={{ color: "#2563eb", fontWeight: 700, textDecoration: "none" }}>내 등급 페이지에서 확인하세요.</a>
              </p>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>제공 서비스</div>
              <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
                <li>CAD수정: 수강생 3DM 파일 직접 수정 후 전달 (STL/OBJ는 피드백만 가능)</li>
                <li>실무 검수: 제작/판매/출력 가능 여부 컨펌</li>
                <li>검수+CAD수정: 검수 후 직접 수정까지 진행 (3DM만 가능)</li>
              </ul>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>답변 시간 기준</div>
              <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
                <li>BASIC 수강생: 48시간 이내</li>
                <li>PRO 수강생: 36시간 이내</li>
                <li>MASTER 수강생: 24시간 이내</li>
                <li>주말·연휴 제외</li>
              </ul>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb" }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>주의사항</div>
              <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 13, color: "#6b7280", lineHeight: 2 }}>
                <li>불성실한 답변 시 경고 누적 → 활동 정지될 수 있습니다</li>
                <li>추후 멘토 등록 조건이 변경될 수 있습니다</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* 설명 섹션 */}
      <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.9 }}>
        멘토는 캐드스쿨에서 수강생들의 질문에 답변하고 멘토링을 제공하는 전문가입니다.
        <strong> CAD수정</strong>은 수강생의 파일을 멘토가 직접 수정 후 반환하는 방식이며,
        <strong> 실무 검수</strong>는 판매/출력 가능 여부를 컨펌해주는 방식입니다.
        수익은 멘토 등급에 따라 차등 지급됩니다.
      </div>

      <div style={{ background: "#fdf6e3", border: "1px solid #c9a84c66", borderRadius: 12, padding: "12px 16px", fontSize: 13, color: "#92681a", lineHeight: 1.8 }}>
        💡 현재는 <strong>판매자로 등록된 회원</strong>이라면 누구나 멘토 활동이 가능합니다.
      </div>

      <div style={{ background: "#fef9c3", border: "1px solid #fde047", borderRadius: 12, padding: "10px 16px", fontSize: 12, color: "#854d0e" }}>
        ⚠️ 추후 멘토 등록 조건이 변경될 수 있습니다.
      </div>

      {/* 미등록 상태 */}
      {!isMentor && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {!isSeller && (
            <div style={{ fontSize: 13, color: "#dc2626", fontWeight: 600 }}>
              판매자 등록 후 멘토 활동이 가능합니다.
            </div>
          )}
          <a
            href={isSeller ? "/cad-school/mentor/register" : "#"}
            onClick={!isSeller ? (e) => e.preventDefault() : undefined}
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              height: 48, padding: "0 24px", borderRadius: 12, border: "none",
              background: isSeller ? "#111827" : "#e5e7eb",
              color: isSeller ? "white" : "#9ca3af",
              fontWeight: 800, fontSize: 14, textDecoration: "none",
              cursor: isSeller ? "pointer" : "not-allowed",
              alignSelf: "flex-start",
            }}
          >
            🎓 멘토 등록하기
          </a>
        </div>
      )}

      {/* 등록 상태 */}
      {isMentor && mentorData && (
        <>
          {/* 멘토 정보 카드 */}
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 16, padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: mentorData.is_active ? "#16a34a" : "#6b7280", background: mentorData.is_active ? "#dcfce7" : "#f3f4f6", padding: "2px 10px", borderRadius: 999 }}>
                {mentorData.is_active ? "✓ 활동중" : "일시중지"}
              </span>
              {mentorData.is_suspended && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "2px 10px", borderRadius: 999 }}>활동정지</span>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              <InfoStat label="평균 평점" value={`★ ${mentorData.avg_rating.toFixed(1)}`} />
              <InfoStat label="평가 수" value={`${mentorData.total_ratings}건`} />
              <InfoStat label="답변률" value={`${mentorData.response_rate?.toFixed(0) ?? 0}%`} />
            </div>

            {mentorData.intro && (
              <div style={{ fontSize: 13, color: "#374151", lineHeight: 1.7, background: "#f9fafb", borderRadius: 10, padding: "12px 14px" }}>
                {mentorData.intro}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/cad-school/mentor/register" style={{ display: "inline-flex", alignItems: "center", height: 40, padding: "0 18px", borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#374151", fontWeight: 700, fontSize: 13, textDecoration: "none" }}>
                정보 수정
              </a>
              <button
                onClick={handleToggleActive}
                disabled={toggling || mentorData.is_suspended}
                style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "none", background: mentorData.is_active ? "#fef3c7" : "#111827", color: mentorData.is_active ? "#92400e" : "white", fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: (toggling || mentorData.is_suspended) ? 0.6 : 1 }}>
                {toggling ? "변경 중..." : mentorData.is_active ? "활동 일시중지" : "활동 재개"}
              </button>
            </div>
          </div>

          {/* 연락 수단 */}
          <ContactChannelsSection
            userId={userId}
            opentalkUrl={opentalkUrl}
            contactPhone={contactPhone}
            onSaved={onContactSaved}
          />

          {/* 진행 중인 구독 목록 */}
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: "#111827", marginBottom: 12 }}>진행 중인 구독</div>
            {subscriptions.filter((s) => s.status === "active").length === 0 ? (
              <div style={{ background: "#f9fafb", borderRadius: 12, padding: "28px 20px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                아직 구독자가 없습니다.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 10 }}>
                {subscriptions.filter((s) => s.status === "active").map((s) => (
                  <div key={s.id} style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 800, fontSize: 14, color: "#111827" }}>{s.subscriber_profile?.nickname ?? "구독자"}</span>
                        <span style={{ fontSize: 11, fontWeight: 800, color: GOLD, background: "#fdf6e3", padding: "1px 8px", borderRadius: 5 }}>
                          {PLAN_LABELS[s.plan_type] ?? s.plan_type}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>
                        만료: {new Date(s.expires_at).toLocaleDateString("ko-KR")} · CAD수정 {s.checklist_count}회 · 검수 {s.review_count}회
                      </div>
                    </div>
                    <a href={`/cad-school/subscription/${s.id}`} style={{ fontSize: 13, fontWeight: 800, color: "white", background: "#111827", padding: "8px 14px", borderRadius: 9, textDecoration: "none", whiteSpace: "nowrap" }}>
                      채팅방 입장
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 경고 내역 */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>경고 내역</span>
              <span style={{
                fontSize: 12, fontWeight: 800, padding: "2px 10px", borderRadius: 999,
                color: mentorData.warning_count >= 3 ? "#dc2626" : mentorData.warning_count >= 1 ? "#d97706" : "#6b7280",
                background: mentorData.warning_count >= 3 ? "#fee2e2" : mentorData.warning_count >= 1 ? "#fef3c7" : "#f3f4f6",
              }}>
                총 {mentorData.warning_count}회
              </span>
            </div>
            {warnings.length === 0 ? (
              <div style={{ background: "#f9fafb", borderRadius: 12, padding: "20px", textAlign: "center", fontSize: 13, color: "#9ca3af" }}>
                경고 내역이 없습니다.
              </div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {warnings.map((w) => (
                  <div key={w.id} style={{ border: "1px solid #fecaca", borderRadius: 12, padding: "12px 16px", background: "#fff5f5" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 800, color: "#dc2626", background: "#fee2e2", padding: "1px 7px", borderRadius: 4 }}>
                        {w.warning_type === "late_response" ? "답변지연" : w.warning_type}
                      </span>
                      <span style={{ fontSize: 11, color: "#9ca3af" }}>{new Date(w.created_at).toLocaleDateString("ko-KR")}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#374151" }}>{w.reason}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function InfoStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#f9fafb", borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 900, color: "#111827" }}>{value}</div>
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

const PHONE_REGEX = /^01[016789]-?\d{3,4}-?\d{4}$/;

function isValidContactPhone(val: string) {
  return PHONE_REGEX.test(val);
}

function isValidContactUrl(val: string) {
  if (!/^https?:\/\//i.test(val)) return false;
  try {
    new URL(val);
    return true;
  } catch {
    return false;
  }
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

/* ── 포인트 탭 ── */
type PointRow = {
  id: string;
  amount: number;
  reason: string;
  reference_id: string | null;
  expires_at: string | null;
  created_at: string;
};

function PointsTab({ userId, isSeller, isAdmin }: { userId: string; isSeller: boolean; isAdmin: boolean }) {
    const [rows, setRows] = useState<PointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideOpen, setGuideOpen] = useState(false);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!userId || loadedRef.current) return;
    loadedRef.current = true;
    (async () => {
      const { data } = await sbAuthFetch(
        "points",
        `?user_id=eq.${userId}&order=created_at.desc&limit=50`
      );
      setRows((data as PointRow[]) || []);
      setLoading(false);
    })();
  }, [userId]);

  if (loading) {
    return <p style={{ color: "#6b7280", padding: "20px 0" }}>포인트 정보를 불러오는 중...</p>;
  }

  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  // 유효 포인트만 합산 (만료 제외)
  const effectiveBalance = rows.reduce((sum, r) => {
    if (r.expires_at && new Date(r.expires_at) <= now) return sum;
    return sum + r.amount;
  }, 0);

  // 30일 내 만료 예정 포인트 (플러스 항목만)
  const expiringSoon = rows.reduce((sum, r) => {
    if (!r.expires_at) return sum;
    const exp = new Date(r.expires_at);
    if (exp > now && exp <= thirtyDaysLater && r.amount > 0) return sum + r.amount;
    return sum;
  }, 0);

  // 최근 10건 표시용 - 잔액 누적 계산 (오래된 순 → 최신 순으로 누적 후 역순)
  const recent10 = [...rows].slice(0, 10);
  // 전체 기준 누적 잔액 계산 (오래된 것부터)
  const chronological = [...rows].reverse();
  const balanceMap: Record<string, number> = {};
  let running = 0;
  for (const r of chronological) {
    if (r.expires_at && new Date(r.expires_at) <= now) continue;
    running += r.amount;
    balanceMap[r.id] = running;
  }

  return (
    <div style={{ padding: "4px 0" }}>
      <h2 className="pf-section-title" style={sectionTitle}>포인트</h2>

      {/* 보유 포인트 카드 */}
      <div style={{
        background: "#111827", borderRadius: 18, padding: "24px 22px",
        marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", fontWeight: 600, marginBottom: 6 }}>
            현재 보유 포인트
          </div>
          <div style={{ fontSize: 36, fontWeight: 900, color: GOLD }}>
            {effectiveBalance.toLocaleString("ko-KR")} P
          </div>
        </div>
        {expiringSoon > 0 && (
          <div style={{
            padding: "10px 16px", borderRadius: 12,
            background: "#fef3c7", border: "1px solid #fcd34d",
            fontSize: 14, fontWeight: 700, color: "#92400e",
          }}>
            ⚠️ 30일 내 만료 예정: {expiringSoon.toLocaleString("ko-KR")} P
          </div>
        )}
      </div>

      {/* 포인트 적립 안내 아코디언 */}
      <div style={{
        background: "#fdf8ec", border: "1px solid #f0d88a",
        borderRadius: 16, marginBottom: 20, overflow: "hidden",
      }}>
        <button
          onClick={() => setGuideOpen((v) => !v)}
          style={{
            width: "100%", padding: "14px 18px",
            display: "flex", justifyContent: "space-between", alignItems: "center",
            background: "transparent", border: "none", cursor: "pointer",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 800, color: "#92400e" }}>
            💡 포인트 적립 안내
          </span>
          <span style={{
            fontSize: 18, color: GOLD,
            transform: guideOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s",
            display: "inline-block",
          }}>▾</span>
        </button>
        {guideOpen && (
          <div style={{ padding: "0 18px 18px", fontSize: 13, color: "#78350f", lineHeight: 1.9 }}>
            {/* 적립 방법 */}
            <div style={{ marginBottom: 10 }}>
              <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>적립 방법</strong>
              <div>• 모델 구매: <strong style={{ color: GOLD }}>결제금액의 2% 자동 적립</strong></div>
              {(isSeller || isAdmin) && (
                <>
                  <div>• 캐드스쿨 답변 등록 (20자 이상): <strong style={{ color: GOLD }}>+50P</strong></div>
                  <div>• 캐드스쿨 베스트 답변 채택: <strong style={{ color: GOLD }}>+300P</strong></div>
                </>
              )}
            </div>
            {/* 사용 방법 */}
            <div style={{ marginBottom: 10 }}>
              <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>사용 방법</strong>
              <div>• 모델 구매 시 최대 결제금액의 <strong>50%</strong>까지 사용 가능</div>
              <div>• 1포인트 = 1원 할인</div>
            </div>
            {/* 적립 제한 (판매자/관리자만) */}
            {(isSeller || isAdmin) && (
              <div style={{ marginBottom: 10 }}>
                <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>적립 제한</strong>
                <div>• 일일 최대 적립: <strong>1,000P</strong></div>
                <div>• 월 최대 적립: <strong>10,000P</strong></div>
                <div>• 포인트 유효기간: 적립일로부터 1년</div>
              </div>
            )}
            {/* 안내사항 (구매자) */}
            {!isSeller && !isAdmin && (
              <div style={{ marginBottom: 10 }}>
                <strong style={{ display: "block", marginBottom: 4, color: "#92400e" }}>안내사항</strong>
                <div>• 포인트 유효기간: 적립일로부터 1년</div>
                <div>• 만료 30일 전 알림 표시</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 포인트 내역 */}
      <h3 style={{ fontSize: 15, fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>
        포인트 내역 (최근 10건)
      </h3>

      {recent10.length === 0 ? (
        <div style={{ padding: "32px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          포인트 내역이 없습니다.
        </div>
      ) : (
        <div className="points-container" style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 14, overflow: "hidden", border: "1px solid #e5e7eb" }}>
          {/* 헤더 */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr auto auto",
            gap: 8, padding: "10px 16px",
            background: "#f9fafb", fontSize: 12, fontWeight: 700, color: "#6b7280",
          }}>
            <span>일시</span>
            <span>내용</span>
            <span style={{ textAlign: "right" }}>포인트</span>
            <span style={{ textAlign: "right", minWidth: 70 }}>잔액</span>
          </div>
          {recent10.map((r) => {
            const isExpired = r.expires_at ? new Date(r.expires_at) <= now : false;
            const isPlus = r.amount > 0;
            return (
              <div key={r.id} style={{
                display: "grid", gridTemplateColumns: "1fr 1fr auto auto",
                gap: 8, padding: "12px 16px",
                background: isExpired ? "#fafafa" : "white",
                borderTop: "1px solid #f3f4f6",
                opacity: isExpired ? 0.5 : 1,
              }}>
                <span style={{ fontSize: 13, color: "#6b7280" }}>
                  {new Date(r.created_at).toLocaleDateString("ko-KR")}
                </span>
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>
                  {r.reason}
                  {isExpired && <span style={{ marginLeft: 6, fontSize: 11, color: "#9ca3af" }}>(만료)</span>}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 800, textAlign: "right",
                  color: isPlus ? "#16a34a" : "#dc2626",
                  minWidth: 60,
                }}>
                  {isPlus ? "+" : ""}{r.amount.toLocaleString("ko-KR")}P
                </span>
                <span style={{ fontSize: 13, color: "#374151", fontWeight: 700, textAlign: "right", minWidth: 70 }}>
                  {balanceMap[r.id] !== undefined
                    ? balanceMap[r.id].toLocaleString("ko-KR") + "P"
                    : "-"}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
