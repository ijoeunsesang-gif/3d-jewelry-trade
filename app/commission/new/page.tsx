"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError } from "../../lib/toast";

const GOLD = "#c9a84c";
const MAX_IMAGES = 5;

const inputStyle: React.CSSProperties = {
  height: 48, borderRadius: 12, border: "1px solid #d1d5db",
  padding: "0 14px", fontSize: 14, width: "100%",
  boxSizing: "border-box", outline: "none",
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

type SellerProfile = { id: string; nickname: string; avatar_url: string | null };

export default function CommissionNewPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [isPrivate, setIsPrivate] = useState(false);

  // 개인 의뢰 전용
  const [sellerSearch, setSellerSearch] = useState("");
  const [searchResults, setSearchResults] = useState<SellerProfile[]>([]);
  const [followedSellers, setFollowedSellers] = useState<SellerProfile[]>([]);
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [desiredPrice, setDesiredPrice] = useState("");
  const [desiredDays, setDesiredDays] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (!follows || follows.length === 0) return;
    const ids = follows.map((f: any) => f.following_id);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, nickname, avatar_url, role")
      .in("id", ids)
      .eq("role", "seller");
    setFollowedSellers((profiles || []).map((p: any) => ({
      id: p.id, nickname: p.nickname || "익명", avatar_url: p.avatar_url,
    })));
  };

  useEffect(() => {
    if (!isPrivate) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!sellerSearch.trim()) { setSearchResults([]); return; }
    searchTimer.current = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("id, nickname, avatar_url")
        .eq("role", "seller")
        .ilike("nickname", `%${sellerSearch.trim()}%`)
        .limit(10);
      setSearchResults((data || []).map((p: any) => ({
        id: p.id, nickname: p.nickname || "익명", avatar_url: p.avatar_url,
      })));
      setSearchLoading(false);
    }, 300);
  }, [sellerSearch, isPrivate]);

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
    if (isPrivate && !selectedSellerId) { showError("판매자를 선택해주세요."); return; }
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
        status: "open",
        is_private: isPrivate,
      };
      if (isPrivate) {
        insertPayload.target_seller_id = selectedSellerId;
        insertPayload.desired_price = desiredPrice ? parseInt(desiredPrice) : null;
        insertPayload.desired_days = desiredDays ? parseInt(desiredDays) : null;
        insertPayload.negotiation_status = "pending";
        insertPayload.negotiation_count = 0;
      }

      const { data, error } = await supabase
        .from("commissions").insert(insertPayload).select("id").single();
      if (error) throw error;

      if (isPrivate && selectedSellerId) {
        const { error: notifError } = await supabase.from("notifications").insert({
          user_id: selectedSellerId,
          type: "private_commission",
          message: "새 개인 의뢰: 새 개인 의뢰가 도착했습니다.",
          link: `/commission/${data.id}`,
          is_read: false,
        });
        if (notifError) console.error("알림 insert 실패:", notifError);
        window.dispatchEvent(new Event("notifications-updated"));
      }

      router.push(`/commission/${data.id}`);
    } catch (e: any) {
      showError(e.message || "의뢰 등록 실패. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!userId) return null;

  const displayedSellers = sellerSearch.trim() ? searchResults : followedSellers;

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
        </div>

        {/* 개인 의뢰 전용 섹션 */}
        {isPrivate && (
          <>
            {/* 판매자 선택 */}
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 14, padding: 18, background: "#fafafa" }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                판매자 선택 <span style={{ color: "#dc2626" }}>*</span>
              </label>
              <input
                type="text"
                value={sellerSearch}
                onChange={(e) => setSellerSearch(e.target.value)}
                placeholder="판매자 닉네임 검색"
                style={{ ...inputStyle, marginBottom: 12 }}
              />

              {!sellerSearch.trim() && followedSellers.length > 0 && (
                <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, fontWeight: 600 }}>
                  팔로우한 판매자
                </div>
              )}

              {searchLoading ? (
                <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>검색 중...</div>
              ) : displayedSellers.length === 0 && sellerSearch.trim() ? (
                <div style={{ fontSize: 13, color: "#9ca3af", padding: "8px 0" }}>검색 결과가 없습니다.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                  {displayedSellers.map((s) => (
                    <div
                      key={s.id}
                      onClick={() => setSelectedSellerId(s.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 12px", borderRadius: 10, cursor: "pointer",
                        border: selectedSellerId === s.id ? "2px solid #111827" : "1px solid #e5e7eb",
                        background: selectedSellerId === s.id ? "#f3f4f6" : "white",
                        transition: "all 0.12s",
                      }}
                    >
                      <img
                        src={s.avatar_url || "/default-avatar.png"}
                        alt={s.nickname}
                        style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
                      />
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>{s.nickname}</span>
                      {selectedSellerId === s.id && (
                        <span style={{ marginLeft: "auto", fontSize: 12, color: "#111827", fontWeight: 700 }}>✓ 선택됨</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 희망 비용/기간 */}
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
                  희망 비용 (원)
                </label>
                <input
                  type="number"
                  value={desiredPrice}
                  onChange={(e) => setDesiredPrice(e.target.value)}
                  placeholder="예: 50000"
                  min={0}
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
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
                border: "1px dashed #d1d5db", background: "#f8fafc",
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#9ca3af", fontSize: 11, gap: 4,
              }}>
                <span style={{ fontSize: 26, lineHeight: 1 }}>+</span>
                <span>이미지 추가</span>
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
