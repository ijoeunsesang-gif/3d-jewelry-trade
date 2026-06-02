"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError } from "../../lib/toast";
import GradeBadge from "@/app/components/GradeBadge";
import AvatarImage from "@/app/components/AvatarImage";
import { Grade } from "@/lib/grades";

const GOLD = "#c9a84c";

const CHOSUNG_ALL = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_GROUP = ['ㄱ','ㄱ','ㄴ','ㄷ','ㄷ','ㄹ','ㅁ','ㅂ','ㅂ','ㅅ','ㅅ','ㅇ','ㅈ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const CHOSUNG_DISPLAY = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const ALL_INDEX_KEYS = [
  ...CHOSUNG_DISPLAY,
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
];

function getSellerIndexKey(nickname: string): string {
  if (!nickname) return '#';
  const ch = nickname[0];
  const code = ch.charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) {
    return CHOSUNG_GROUP[Math.floor((code - 0xAC00) / 588)];
  }
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  return '#';
}

const MAX_IMAGES = 5;

const inputStyle: React.CSSProperties = {
  height: 48, borderRadius: 12, border: "1px solid #d1d5db",
  padding: "0 14px", fontSize: 14, width: "100%",
  boxSizing: "border-box", outline: "none",
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

type SellerProfile = { id: string; nickname: string; avatar_url: string | null; grade: Grade };

function CommissionNewInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const typeParam = searchParams.get("type");
  const [isPrivate, setIsPrivate] = useState(typeParam === "private");

  // 개인 의뢰 전용
  const [sellerTab, setSellerTab] = useState<"all" | "followed">("all");
  const [allSellers, setAllSellers] = useState<SellerProfile[]>([]);
  const [followedSellers, setFollowedSellers] = useState<SellerProfile[]>([]);
  const [allSellersLoaded, setAllSellersLoaded] = useState(false);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [selectedSeller, setSelectedSeller] = useState<SellerProfile | null>(null);
  const [allSellerSearch, setAllSellerSearch] = useState("");
  const [followedSellerSearch, setFollowedSellerSearch] = useState("");
  const [desiredPrice, setDesiredPrice] = useState<number | null>(null);
  const [priceInput, setPriceInput] = useState("");
  const [desiredDays, setDesiredDays] = useState("");
  const [commissionType, setCommissionType] = useState<"지목" | "공개모집">("지목");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const sellerItemRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});
  const priceInputRef = useRef<HTMLInputElement>(null);

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
    const token = getAccessToken();
    if (!token) { router.replace("/auth"); return; }
    const payload = decodeJwt(token) as any;
    const uid = payload?.sub || null;
    setUserId(uid);
    if (uid) loadFollowedSellers(uid);
  }, []);

  const loadFollowedSellers = async (uid: string) => {
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", uid);
    if (!follows || follows.length === 0) {
      console.log("[팔로우 판매자] 팔로우 없음");
      return;
    }
    const ids = follows.map((f: any) => f.following_id);
    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url, grade")
      .in("id", ids)
      .eq("role", "seller")
      .neq("role", "admin")
      .neq("id", uid)
      .eq("is_seller_banned", false)
      .is("deleted_at", null);
    console.log("[팔로우 판매자] 쿼리 결과:", profiles, "에러:", error);
    setFollowedSellers((profiles || []).map((p: any) => ({
      id: p.id,
      nickname: p.nickname || "익명",
      avatar_url: p.avatar_url,
      grade: (p.grade as Grade) || "sprout",
    })));
  };

  const loadAllSellers = async () => {
    if (allSellersLoaded) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url, grade")
      .eq("role", "seller")
      .neq("role", "admin")
      .neq("id", userId)
      .eq("is_seller_banned", false)
      .is("deleted_at", null)
      .order("nickname", { ascending: true });
    console.log("[전체 판매자] 쿼리 결과:", data, "에러:", error);
    setAllSellers((data || []).map((p: any) => ({
      id: p.id,
      nickname: p.nickname || "익명",
      avatar_url: p.avatar_url,
      grade: (p.grade as Grade) || "sprout",
    })));
    setAllSellersLoaded(true);
  };

  const handleTabChange = (tab: "all" | "followed") => {
    setSellerTab(tab);
    if (tab === "all") loadAllSellers();
  };

  // 개인 의뢰로 전환 시 전체 판매자 목록 즉시 로드
  useEffect(() => {
    if (isPrivate && sellerTab === "all") loadAllSellers();
  }, [isPrivate]);

  useEffect(() => {
    const el = priceInputRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1000 : -1000;
      const newVal = Math.max(5000, (desiredPrice || 0) + delta);
      setDesiredPrice(newVal);
      setPriceInput(newVal.toLocaleString('ko-KR'));
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [desiredPrice]);

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/,/g, '');
    if (raw === '' || (!isNaN(Number(raw)) && Number(raw) >= 0)) {
      const num = raw === '' ? null : Number(raw);
      setDesiredPrice(num);
      setPriceInput(num !== null ? num.toLocaleString('ko-KR') : '');
    }
  };

  const handleSelectSeller = (s: SellerProfile) => {
    setSelectedSellerId(s.id);
    setSelectedSeller(s);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (imageFiles.length >= MAX_IMAGES) return;
    const dropped = Array.from(e.dataTransfer.files);
    const files = dropped.filter(f => f.type.startsWith("image/"));
    if (dropped.length > 0 && files.length === 0) {
      showError("이미지 파일만 업로드 가능합니다.");
      return;
    }
    const toAdd = files.slice(0, MAX_IMAGES - imageFiles.length);
    if (toAdd.length === 0) return;
    setImageFiles(prev => [...prev, ...toAdd]);
    setPreviews(prev => [...prev, ...toAdd.map(f => URL.createObjectURL(f))]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const remaining = MAX_IMAGES - imageFiles.length;
    const toAdd = files.slice(0, remaining);
    setImageFiles((prev) => [...prev, ...toAdd]);
    setPreviews((prev) => [...prev, ...toAdd.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!title.trim()) { showError("제목을 입력해주세요."); return; }
    if (isPrivate && commissionType === "지목" && !selectedSellerId) { showError("판매자를 선택해주세요."); return; }
    if (!userId) { router.replace("/auth"); return; }

    setSubmitting(true);
    try {
      const imageUrls: string[] = [];
      const now = Date.now();
      for (let i = 0; i < imageFiles.length; i++) {
        const file = imageFiles[i];
        const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `commissions/${userId}/${now}-${i}.${ext}`;
        const imgForm = new FormData();
        imgForm.append("file", file);
        imgForm.append("bucket", "thumbnails");
        imgForm.append("path", path);
        const imgRes = await fetch("/api/upload", { method: "POST", body: imgForm });
        if (!imgRes.ok) throw new Error("이미지 업로드 실패");
        const { url } = await imgRes.json();
        imageUrls.push(url);
      }

      const insertPayload: Record<string, any> = {
        user_id: userId,
        title: title.trim(),
        description: description.trim(),
        images: imageUrls,
        status: isPrivate ? "pending" : "open",
        is_private: isPrivate,
      };
      if (isPrivate) {
        insertPayload.commission_type = commissionType;
        insertPayload.desired_price = desiredPrice ?? null;
        insertPayload.desired_days = desiredDays ? parseInt(desiredDays) : null;
        insertPayload.negotiation_count = 0;
        if (commissionType === "지목") {
          insertPayload.target_seller_id = selectedSellerId;
        }
      }

      const { data, error } = await supabase
        .from("commissions").insert(insertPayload).select("id").single();
      if (error) throw error;

      if (isPrivate && selectedSellerId) {
        await fetch("/api/commission/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: selectedSellerId,
            type: "private_commission",
            title: "개인의뢰 제안",
            link: `/commission/${data.id}`,
          }),
        });
        window.dispatchEvent(new Event("notifications-updated"));
      }

      router.push(`/commission/${data.id}`);
    } catch (e: any) {
      showError(e.message || "의뢰 등록 실패. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  // 파생 계산값 — 훅(useMemo) 포함이므로 얼리 리턴 이전에 선언
  const currentSearch = sellerTab === "all" ? allSellerSearch : followedSellerSearch;
  const baseList = sellerTab === "all" ? allSellers : followedSellers;
  const displayedSellers = currentSearch.trim()
    ? baseList.filter((s) => s.nickname.includes(currentSearch.trim()))
    : baseList;

  const indexKeySet = useMemo(
    () => new Set(displayedSellers.map(s => getSellerIndexKey(s.nickname))),
    [displayedSellers]
  );

  const scrollToIndexKey = (key: string) => {
    const firstSeller = displayedSellers.find(s => getSellerIndexKey(s.nickname) === key);
    if (!firstSeller) return;
    const el = sellerItemRefs.current[firstSeller.id];
    const container = listContainerRef.current;
    if (!el || !container) return;
    container.scrollBy({ top: el.getBoundingClientRect().top - container.getBoundingClientRect().top, behavior: 'smooth' });
  };

  if (!userId) return null;

  return (
    <div style={{
      maxWidth: 640, margin: "0 auto",
      padding: "32px 20px 80px",
      fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <h1 style={{ margin: "0 0 28px", fontSize: 22, fontWeight: 800, color: "#111827" }}>의뢰 등록</h1>

      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {/* 제목 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            제목 <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="의뢰 제목을 입력하세요"
            style={inputStyle}
            maxLength={100}
          />
        </div>

        {/* 공개 여부 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 8 }}>
            공개 여부
          </label>
          <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #d1d5db", width: "fit-content" }}>
            <button type="button" onClick={() => setIsPrivate(false)} style={{
              padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
              background: !isPrivate ? "#111827" : "white", color: !isPrivate ? "white" : "#374151",
            }}>
              공개 의뢰
            </button>
            <button type="button" onClick={() => setIsPrivate(true)} style={{
              padding: "10px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer", border: "none",
              borderLeft: "1px solid #d1d5db",
              background: isPrivate ? "#111827" : "white", color: isPrivate ? "white" : "#374151",
            }}>
              개인 의뢰
            </button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#9ca3af" }}>
            {isPrivate ? "나와 판매자만 볼 수 있습니다." : "누구나 볼 수 있습니다."}
          </p>
          {isPrivate && (
            <div style={{
              backgroundColor: "#fef9c3", border: "1px solid #fde047", borderRadius: 8,
              padding: "12px 16px", fontSize: 13, color: "#854d0e", marginTop: 10,
            }}>
              ⚠️ 결제 후 작업이 시작되면 의뢰를 삭제할 수 없습니다. 신중하게 의뢰해 주세요.
            </div>
          )}
        </div>

        {/* 개인 의뢰 전용 섹션 */}
        {isPrivate && (
          <>
            {/* 의뢰 방식 선택 */}
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                의뢰 방식 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {([
                  { value: "지목", label: "판매자 지목", desc: "특정 판매자에게 직접 의뢰" },
                  { value: "공개모집", label: "공개 모집", desc: "여러 판매자가 견적 신청, 내가 선택" },
                ] as const).map(({ value, label, desc }) => (
                  <div
                    key={value}
                    onClick={() => setCommissionType(value)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: 12,
                      padding: "12px 16px", borderRadius: 12, cursor: "pointer",
                      border: `1.5px solid ${commissionType === value ? "#111827" : "#d1d5db"}`,
                      background: commissionType === value ? "#f9fafb" : "white",
                      transition: "border-color 0.12s, background 0.12s",
                    }}
                  >
                    <span style={{
                      marginTop: 2, width: 16, height: 16, borderRadius: "50%", flexShrink: 0,
                      border: `2px solid ${commissionType === value ? "#111827" : "#9ca3af"}`,
                      background: commissionType === value ? "#111827" : "white",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {commissionType === value && (
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: "white", display: "block" }} />
                      )}
                    </span>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 판매자 선택 (지목 방식) */}
            {commissionType === "지목" && (
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, background: "#fafafa" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                판매자 선택 <span style={{ color: "#dc2626" }}>*</span>
              </label>

              {/* 선택된 판매자 표시 */}
              {selectedSeller && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 14px", borderRadius: 10, marginBottom: 14,
                  background: "#f0fdf4", border: "1.5px solid #16a34a",
                }}>
                  <AvatarImage avatarUrl={selectedSeller.avatar_url} nickname={selectedSeller.nickname} size={36} border="none" />
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>{selectedSeller.nickname}</span>
                    <GradeBadge grade={selectedSeller.grade} size="sm" />
                  </div>
                  <span style={{ marginLeft: "auto", fontSize: 12, color: "#16a34a", fontWeight: 700 }}>✓ 선택됨</span>
                </div>
              )}

              {/* 탭 버튼 */}
              <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
                <button
                  type="button"
                  onClick={() => handleTabChange("all")}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid",
                    borderColor: sellerTab === "all" ? "#111827" : "#d1d5db",
                    background: sellerTab === "all" ? "#111827" : "white",
                    color: sellerTab === "all" ? "white" : "#374151",
                    transition: "all 0.12s",
                  }}
                >
                  판매자 선택
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange("followed")}
                  style={{
                    flex: 1, padding: "10px 0", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    cursor: "pointer", border: "1.5px solid",
                    borderColor: sellerTab === "followed" ? "#111827" : "#d1d5db",
                    background: sellerTab === "followed" ? "#111827" : "white",
                    color: sellerTab === "followed" ? "white" : "#374151",
                    transition: "all 0.12s",
                  }}
                >
                  팔로우한 판매자
                </button>
              </div>

              {/* 검색창 */}
              <input
                type="text"
                placeholder="판매자 닉네임 검색"
                value={sellerTab === "all" ? allSellerSearch : followedSellerSearch}
                onChange={(e) =>
                  sellerTab === "all"
                    ? setAllSellerSearch(e.target.value)
                    : setFollowedSellerSearch(e.target.value)
                }
                style={{
                  width: "100%", padding: "8px 12px", marginBottom: 10,
                  border: "1px solid #d1d5db", borderRadius: 8, fontSize: 16,
                  outline: "none", boxSizing: "border-box",
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              />

              {/* 판매자 목록 */}
              {displayedSellers.length === 0 ? (
                <div style={{ fontSize: 13, color: "#9ca3af", padding: "16px 0", textAlign: "center" }}>
                  {currentSearch.trim()
                    ? "검색 결과가 없습니다."
                    : sellerTab === "followed" ? "팔로우한 판매자가 없습니다." : "등록된 판매자가 없습니다."}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 4, alignItems: "flex-start" }}>
                  {/* 판매자 목록 */}
                  <div ref={listContainerRef} style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, maxHeight: 300, overflowY: "auto" }}>
                    {displayedSellers.map((s) => (
                      <div
                        key={s.id}
                        ref={(el) => { sellerItemRefs.current[s.id] = el; }}
                        onClick={() => handleSelectSeller(s)}
                        style={{
                          display: "flex", alignItems: "center", gap: 12,
                          padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                          border: selectedSellerId === s.id ? "2px solid #111827" : "1px solid #e5e7eb",
                          background: selectedSellerId === s.id ? "#f3f4f6" : "white",
                          transition: "all 0.12s",
                        }}
                      >
                        <AvatarImage avatarUrl={s.avatar_url} nickname={s.nickname} size={40} border="none" />
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{s.nickname}</span>
                          <GradeBadge grade={s.grade} size="sm" />
                        </div>
                        {selectedSellerId === s.id && (
                          <span style={{ marginLeft: "auto", fontSize: 12, color: "#111827", fontWeight: 700 }}>✓</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 자음/알파벳 인덱스 바 */}
                  <div style={{
                    display: "flex", flexDirection: "column", alignItems: "center",
                    width: 28, flexShrink: 0,
                    maxHeight: 300, overflowY: "auto",
                  }}>
                    {ALL_INDEX_KEYS.map(key => {
                      const hasMatch = indexKeySet.has(key);
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => scrollToIndexKey(key)}
                          disabled={!hasMatch}
                          style={{
                            width: "100%", padding: "3px 0", fontSize: 14, lineHeight: 1,
                            border: "none", background: "none",
                            cursor: hasMatch ? "pointer" : "default",
                            color: hasMatch ? "#374151" : "#e5e7eb",
                            fontWeight: 700,
                            textAlign: "center", flexShrink: 0,
                          }}
                        >
                          {key}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            )}

            {/* 공개 모집 안내 */}
            {commissionType === "공개모집" && (
              <div style={{
                padding: "16px 18px", borderRadius: 14,
                border: "1.5px dashed #a5b4fc", background: "#eef2ff",
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#3730a3", marginBottom: 6 }}>
                  판매자를 모집합니다
                </div>
                <div style={{ fontSize: 13, color: "#4338ca", lineHeight: 1.6 }}>
                  의뢰가 등록되면 판매자들이 가격과 기간을 제안합니다.<br />
                  제안을 검토한 뒤 원하는 판매자를 직접 선택하세요.
                </div>
              </div>
            )}

            {/* 희망 비용/기간 */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  희망 비용 (원)
                </label>
                <input
                  ref={priceInputRef}
                  type="text"
                  inputMode="numeric"
                  value={priceInput}
                  onChange={handlePriceChange}
                  placeholder="최소 5,000원"
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  희망 작업기간 (일)
                </label>
                <input
                  type="number"
                  value={desiredDays}
                  onChange={(e) => setDesiredDays(e.target.value)}
                  placeholder="예: 7"
                  min={1}
                  style={inputStyle}
                />
              </div>
            </div>
          </>
        )}

        {/* 설명 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="의뢰 내용을 자세히 설명해주세요&#10;(원하는 스타일, 사이즈, 참고 자료 등)"
            style={{ ...inputStyle, height: 160, padding: "12px 14px", resize: "vertical" }}
            maxLength={2000}
          />
          <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "right", marginTop: 4 }}>
            {description.length} / 2000
          </div>
        </div>

        {/* 이미지 업로드 */}
        <div>
          <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
            참고 이미지 (최대 {MAX_IMAGES}장)
          </label>
          <div
            onDragOver={(e) => { e.preventDefault(); if (imageFiles.length < MAX_IMAGES) setIsDragging(true); }}
            onDragEnter={(e) => { e.preventDefault(); if (imageFiles.length < MAX_IMAGES) setIsDragging(true); }}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setIsDragging(false); }}
            onDrop={handleDrop}
            style={{
              display: "flex", flexWrap: "wrap", gap: 10,
              padding: 8, borderRadius: 12,
              border: isDragging ? `2px dashed ${GOLD}` : "2px dashed transparent",
              background: isDragging ? "#fdf6e3" : "transparent",
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            {previews.map((src, i) => (
              <div key={i} style={{ position: "relative", width: 100, height: 100, flexShrink: 0 }}>
                <img src={src} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb" }} />
                <button type="button" onClick={() => removeImage(i)} style={{
                  position: "absolute", top: -7, right: -7,
                  width: 22, height: 22, borderRadius: "50%",
                  background: "#dc2626", color: "white", border: "none",
                  cursor: "pointer", fontSize: 11, fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>✕</button>
              </div>
            ))}
            {imageFiles.length < MAX_IMAGES && (
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{
                width: 100, height: 100, borderRadius: 10,
                border: "1px dashed #d1d5db",
                background: isDragging ? "rgba(201,168,76,0.08)" : "#f8fafc",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: isDragging ? GOLD : "#9ca3af", fontSize: 11, gap: 4,
                transition: "color 0.15s, background 0.15s",
              }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
                <span>{isDragging ? "여기에 놓기" : "이미지 추가"}</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={handleImageChange} />
        </div>

        {/* 버튼 */}
        <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
          <button type="button" onClick={() => router.back()} style={{
            flex: 1, height: 48, borderRadius: 12, border: "1px solid #d1d5db", background: "white",
            color: "#374151", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            취소
          </button>
          <button type="button" onClick={handleSubmit} disabled={submitting} style={{
            flex: 2, height: 48, borderRadius: 12, border: "none",
            background: submitting ? "#d1d5db" : GOLD,
            color: "white", fontSize: 14, fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
          }}>
            {submitting ? "등록 중..." : "의뢰 등록"}
          </button>
        </div>

      </div>
    </div>
  );
}

export default function CommissionNewPage() {
  return (
    <Suspense fallback={<div style={{ padding: "60px 20px", textAlign: "center", color: "#9ca3af" }}>로딩 중...</div>}>
      <CommissionNewInner />
    </Suspense>
  );
}
