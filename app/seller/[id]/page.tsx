"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase-browser";
import { sbFetch, getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError } from "../../lib/toast";
import GradeBadge from "../../components/GradeBadge";
import AvatarImage from "../../components/AvatarImage";
import Image from "next/image";
import { Grade } from "@/lib/grades";
import { Phone } from "lucide-react";
import { getModelThumbnailUrl } from "@/lib/imageUrl";
import ContactButtons from "../../components/ContactButtons";

const ModelViewer = dynamic(() => import("../../components/ModelViewer"), {
  ssr: false,
});

type SortType = "latest" | "oldest" | "price-low" | "price-high" | "popular";

export default function SellerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [seller, setSeller] = useState<any>(null);
  const [models, setModels] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentUserId, setCurrentUserId] = useState("");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [notifyEnabled, setNotifyEnabled] = useState(true);
  const [notifModalOpen, setNotifModalOpen] = useState(false);
  const [notifyToggling, setNotifyToggling] = useState(false);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sellerPage, setSellerPage] = useState(1);
  const SELLER_PAGE_SIZE = 12;

  const [favoriteMap, setFavoriteMap] = useState<Record<string, boolean>>({});
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Record<string, boolean>>({});

  const [quickModel, setQuickModel] = useState<any>(null);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };  

  useEffect(() => {
    if (!id) return;
    fetchSellerData();
  }, [id]);

  useEffect(() => {
    if (!quickModel) return;

    const ext = getModelExt(quickModel);
    if (["stl", "obj"].includes(ext)) {
      loadQuickViewerUrl(quickModel);
    } else {
      setViewerUrl("");
    }
  }, [quickModel]);

  useEffect(() => {
    if (!quickModel) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeQuickView();
    };

    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [quickModel]);

  const fetchSellerData = async () => {
    try {
      setLoading(true);

      const token = getAccessToken();
      const currentUserId_ = token ? ((decodeJwt(token) as any)?.sub as string) : "";
      setCurrentUserId(currentUserId_);

      const { data: _sellerArr, error: sellerError } = await sbFetch("profiles", `?id=eq.${id}&limit=1`);
      const sellerData = (_sellerArr as any[])?.[0] ?? null;

      if (sellerError) {
        console.error("판매자 정보 불러오기 실패:", sellerError);
      } else {
        setSeller(sellerData);
      }

      const { data: modelData, error: modelError } = await sbFetch("models", `?seller_id=eq.${id}&order=created_at.desc`);

      if (modelError) {
        console.error("판매자 모델 불러오기 실패:", modelError);
      } else {
        const { data: favoriteRows, error: favoriteRowsError } = await sbFetch("favorites", "?select=model_id");

        if (favoriteRowsError) {
          console.error("찜 개수 불러오기 실패:", favoriteRowsError);
        }

        const countMap: Record<string, number> = {};

        (favoriteRows || []).forEach((row: any) => {
          countMap[row.model_id] = (countMap[row.model_id] || 0) + 1;
        });

        const modelsWithFavoriteCount = (modelData || []).map((model: any) => ({
          ...model,
          favoriteCount: countMap[model.id] || 0,
        }));

        setModels(modelsWithFavoriteCount);
      }

      const { count: followerCount, error: followerError } = await supabase
        .from("follows")
        .select("*", { count: "exact", head: true })
        .eq("following_id", id);

      if (followerError) {
        console.error("팔로워 수 불러오기 실패:", followerError);
      } else {
        setFollowersCount(followerCount || 0);
      }

      if (currentUserId_ && currentUserId_ !== id) {
        const { data: followRow, error: followCheckError } = await supabase
          .from("follows")
          .select("id, notify_enabled")
          .eq("follower_id", currentUserId_)
          .eq("following_id", id)
          .maybeSingle();

        if (followCheckError) {
          console.error("팔로우 여부 확인 실패:", followCheckError);
        } else {
          setIsFollowing(!!followRow);
          setNotifyEnabled(followRow?.notify_enabled ?? true);
        }
      } else {
        setIsFollowing(false);
      }

      if (currentUserId_) {
        const { data: favoritesData, error: favoritesError } = await supabase
          .from("favorites")
          .select("model_id")
          .eq("user_id", currentUserId_);

        if (favoritesError) {
          console.error("찜 목록 불러오기 실패:", favoritesError);
        } else {
          const nextMap: Record<string, boolean> = {};
          (favoritesData || []).forEach((row: any) => {
            nextMap[row.model_id] = true;
          });
          setFavoriteMap(nextMap);
        }
      } else {
        setFavoriteMap({});
      }
    } catch (error) {
      console.error("판매자 페이지 오류:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUserId) { showError("로그인 후 이용할 수 있습니다."); return; }
    if (currentUserId === id) { showError("본인은 팔로우할 수 없습니다."); return; }

    if (!isFollowing) {
      setNotifModalOpen(true);
      return;
    }

    setFollowLoading(true);
    try {
      const { error } = await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUserId)
        .eq("following_id", id);
      if (error) { showError("언팔로우에 실패했습니다."); return; }
      setIsFollowing(false);
      setFollowersCount((prev) => Math.max(prev - 1, 0));
    } catch (e) {
      console.error("언팔로우 오류:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const confirmFollow = async (withNotify: boolean) => {
    setNotifModalOpen(false);
    setFollowLoading(true);
    try {
      const { error } = await supabase.from("follows").insert({
        follower_id: currentUserId,
        following_id: id,
        notify_enabled: withNotify,
      });
      if (error) { showError("팔로우에 실패했습니다."); return; }
      setIsFollowing(true);
      setNotifyEnabled(withNotify);
      setFollowersCount((prev) => prev + 1);
      try {
        await supabase.from("notifications").insert({
          user_id: id,
          type: "follow",
          title: "새 팔로우",
          link: `/seller/${currentUserId}`,
          is_read: false,
        });
        window.dispatchEvent(new Event("notifications-updated"));
      } catch {}
    } catch (e) {
      console.error("팔로우 오류:", e);
    } finally {
      setFollowLoading(false);
    }
  };

  const handleNotifyToggle = async () => {
    if (!currentUserId || !isFollowing || notifyToggling) return;
    const newVal = !notifyEnabled;
    setNotifyToggling(true);
    setNotifyEnabled(newVal);
    const { error } = await supabase
      .from("follows")
      .update({ notify_enabled: newVal })
      .eq("follower_id", currentUserId)
      .eq("following_id", id);
    if (error) {
      setNotifyEnabled(!newVal);
      showError("설정 저장에 실패했습니다.");
    }
    setNotifyToggling(false);
  };

  const handleMessageSeller = async () => {
    try {
      if (!currentUserId) {
        showError("로그인 후 이용할 수 있습니다.");
        return;
      }

      if (currentUserId === id) {
        showError("본인에게는 메시지를 보낼 수 없습니다.");
        return;
      }

      const userA = currentUserId < id ? currentUserId : id;
      const userB = currentUserId < id ? id : currentUserId;

      let { data: existingConversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("user1_id", userA)
        .eq("user2_id", userB)
        .is("model_id", null)
        .maybeSingle();

      if (!existingConversation) {
        const { data: insertedConversation, error } = await supabase
          .from("conversations")
          .insert({
            user1_id: userA,
            user2_id: userB,
          })
          .select("*")
          .single();

        if (error) {
          console.error("대화방 생성 실패:", error);
          showError("대화방 생성에 실패했습니다.");
          return;
        }

        existingConversation = insertedConversation;
      }

      window.dispatchEvent(new Event("messages-updated"));
      router.push(`/messages?conversation=${existingConversation.id}`);
    } catch (error) {
      console.error("메시지 시작 오류:", error);
      showError("메시지 페이지로 이동하지 못했습니다.");
    }
  };

  const toggleFavorite = async (modelId: string) => {
    try {
      if (!currentUserId) {
        showError("로그인 후 찜 기능을 사용할 수 있습니다.");
        return;
      }

      setFavoriteLoadingIds((prev) => ({ ...prev, [modelId]: true }));

      const liked = !!favoriteMap[modelId];

      if (liked) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", currentUserId)
          .eq("model_id", modelId);

        if (error) {
          console.error("찜 해제 실패:", error);
          showToast("찜 해제에 실패했습니다.");
          return;
        }

        setFavoriteMap((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: currentUserId,
          model_id: modelId,
        });

        if (error) {
          console.error("찜 추가 실패:", error);
          showError("찜 추가에 실패했습니다.");
          return;
        }

        setFavoriteMap((prev) => ({ ...prev, [modelId]: true }));
      }

      window.dispatchEvent(new Event("favorites-updated"));
    } catch (error) {
      console.error("찜 토글 오류:", error);
    } finally {
      setFavoriteLoadingIds((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const handleAddToCart = (item: any) => {
    const thumbUrl = getThumbnailUrl(item);

    const cartItem = {
      id: item.id,
      title: item.title,
      price: item.price,
      thumbUrl,
      category: item.category,
      downloadUrl: item.file_url,
    };

    const existingCart = JSON.parse(localStorage.getItem("cart") || "[]");
    const alreadyExists = existingCart.some((cart: any) => cart.id === item.id);

    if (alreadyExists) {
      showToast("이미 장바구니에 담긴 상품입니다.");
      return;
    }

    const updatedCart = [...existingCart, cartItem];
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    window.dispatchEvent(new Event("cart-updated"));
    showToast("장바구니에 담았습니다.");
  };

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let result = [...models];

    if (categoryFilter !== "ALL") {
      result = result.filter((item) => item.category === categoryFilter);
    }

    if (keyword) {
      result = result.filter((item) => {
        const title = item.title?.toLowerCase() || "";
        const desc = item.description?.toLowerCase() || "";
        const category = item.category?.toLowerCase() || "";
        return (
          title.includes(keyword) ||
          desc.includes(keyword) ||
          category.includes(keyword)
        );
      });
    }

    if (sortBy === "oldest") {
      result.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    } else if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "popular") {
      result.sort(
        (a: any, b: any) => (b.favoriteCount || 0) - (a.favoriteCount || 0)
      );
    } else {
      result.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return result;
  }, [models, search, sortBy, categoryFilter]);

  useEffect(() => { setSellerPage(1); }, [search, sortBy, categoryFilter]);

  const sellerTotalPages = Math.ceil(filteredModels.length / SELLER_PAGE_SIZE);
  const paginatedModels = useMemo(
    () => filteredModels.slice((sellerPage - 1) * SELLER_PAGE_SIZE, sellerPage * SELLER_PAGE_SIZE),
    [filteredModels, sellerPage]
  );

  const sellerCategoryCount = useMemo(() => {
    return new Set(
      models
        .map((item) => item.category)
        .filter(Boolean)
    ).size;
  }, [models]);

  const getThumbnailUrl = getModelThumbnailUrl;

  const getModelExt = (item: any) => {
    const source = item.model_file_path || item.file_url || "";
    const clean = source.split("?")[0];
    return clean.split(".").pop()?.toLowerCase() || "";
  };

  const loadQuickViewerUrl = async (model: any) => {
    try {
      setViewerLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      if (session?.access_token) {
        headers.Authorization = `Bearer ${session.access_token}`;
      }

      const res = await fetch("/api/model-viewer-url", {
        method: "POST",
        headers,
        body: JSON.stringify({
          modelFilePath: model.model_file_path || "",
          fileUrl: model.file_url || "",
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      const rawText = await res.text();

      if (!contentType.includes("application/json")) {
        console.error("seller quickview API 비정상 응답:", rawText);
        setViewerUrl("");
        return;
      }

      const data = JSON.parse(rawText);

      if (!res.ok) {
        console.error("seller quickview URL 불러오기 실패:", data.error);
        setViewerUrl("");
        return;
      }

      setViewerUrl(data.viewerUrl || "");
    } catch (error) {
      console.error("seller quickview 요청 실패:", error);
      setViewerUrl("");
    } finally {
      setViewerLoading(false);
    }
  };

  const openQuickView = (model: any) => {
    setQuickModel(model);
    setViewerUrl("");
  };

  const closeQuickView = () => {
    setQuickModel(null);
    setViewerUrl("");
  };

  const quickThumb = quickModel ? getThumbnailUrl(quickModel) : "";
  const quickExt = quickModel ? getModelExt(quickModel) : "";
  const quickViewerSupported = ["stl", "obj"].includes(quickExt);

  const categories = ["ALL", "RING", "PENDANT", "EARRING", "BRACELET", "기타부속"];

  return (
    <>
      <main
        className="seller-main"
        style={{
          maxWidth: 1240,
          margin: "0 auto",
          padding: "36px 20px 60px",
          display: "grid",
          gridTemplateColumns: "260px 1fr",
          alignItems: "start",
          gap: 28,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        <section
          className="seller-profile-section"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 28,
            padding: 24,
            background: "white",
            height: "fit-content",
            position: "sticky",
            top: 20,
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            {(() => {
              const grade = (seller?.grade || "sprout") as Grade;
              const hasRing = grade === "pro" || grade === "master";
              const ringStyle = hasRing ? {
                padding: 3,
                borderRadius: "50%",
                background: grade === "master"
                  ? "linear-gradient(135deg, #f59e0b, #d97706, #fbbf24)"
                  : "linear-gradient(135deg, #7c3aed, #6d28d9, #a78bfa)",
                display: "inline-block",
              } : {};
              return (
                <div style={ringStyle}>
                  <AvatarImage
                    avatarUrl={seller?.avatar_url}
                    nickname={seller?.nickname}
                    size={108}
                    border={hasRing ? "3px solid white" : "1px solid #e5e7eb"}
                  />
                </div>
              );
            })()}

            <h1
              style={{
                margin: "18px 0 6px",
                fontSize: 32,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              {seller?.nickname || "판매자"}
            </h1>

            {seller?.grade && seller.grade !== "sprout" && (
              <div style={{ marginBottom: 6 }}>
                <GradeBadge grade={seller.grade as Grade} size="md" />
              </div>
            )}

            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.7,
                color: "#6b7280",
                whiteSpace: "pre-wrap",
              }}
            >
              {seller?.bio || "소개가 아직 없습니다."}
            </p>

            {seller?.phone_number && (
              <div style={{ marginTop: 10, fontSize: 13, color: "#374151", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Phone size={13} color="#16a34a" strokeWidth={2.5} />
                {seller.phone_number}
              </div>
            )}

            {(seller?.opentalk_url || seller?.contact_phone) && (
              <div style={{ marginTop: 14, display: "flex", justifyContent: "center" }}>
                <ContactButtons opentalkUrl={seller?.opentalk_url} contactPhone={seller?.contact_phone} />
              </div>
            )}
          </div>

          {currentUserId && currentUserId !== id && (
            <>
              <div style={{ marginTop: 18, display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleFollowToggle}
                  disabled={followLoading}
                  style={{
                    flex: 1,
                    height: 48,
                    borderRadius: 14,
                    border: isFollowing ? "1px solid #d1d5db" : "none",
                    background: isFollowing ? "white" : "#111827",
                    color: isFollowing ? "#111827" : "white",
                    fontWeight: 900,
                    cursor: followLoading ? "not-allowed" : "pointer",
                  }}
                >
                  {followLoading ? "처리 중..." : isFollowing ? "팔로우 취소" : "팔로우"}
                </button>
                {isFollowing && (
                  <button
                    type="button"
                    onClick={handleNotifyToggle}
                    disabled={notifyToggling}
                    title={notifyEnabled ? "새 작품 알림 켜짐 (클릭하여 끄기)" : "새 작품 알림 꺼짐 (클릭하여 켜기)"}
                    style={{
                      width: 48, height: 48, borderRadius: 14,
                      border: "1px solid #d1d5db",
                      background: notifyEnabled ? "#fffbeb" : "white",
                      color: notifyEnabled ? "#f59e0b" : "#9ca3af",
                      fontSize: 20, cursor: notifyToggling ? "not-allowed" : "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {notifyEnabled ? "🔔" : "🔕"}
                  </button>
                )}
              </div>

              {/* 팔로우 알림 동의 모달 */}
              {notifModalOpen && (
                <div
                  onClick={() => setNotifModalOpen(false)}
                  style={{
                    position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    zIndex: 9999,
                  }}
                >
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      background: "white", borderRadius: 20, padding: "28px 24px",
                      width: 320, boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
                    }}
                  >
                    <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>🔔</div>
                    <h3 style={{ fontSize: 17, fontWeight: 900, color: "#111827", margin: "0 0 8px", textAlign: "center" }}>
                      새 작품 알림
                    </h3>
                    <p style={{ fontSize: 14, color: "#6b7280", textAlign: "center", margin: "0 0 24px", lineHeight: 1.6 }}>
                      이 판매자가 새 작품을 업로드하면<br />알림을 받으시겠습니까?
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => confirmFollow(true)}
                        style={{
                          height: 44, borderRadius: 12, border: "none",
                          background: "#111827", color: "white",
                          fontWeight: 900, fontSize: 14, cursor: "pointer",
                        }}
                      >
                        알림 받기
                      </button>
                      <button
                        type="button"
                        onClick={() => confirmFollow(false)}
                        style={{
                          height: 44, borderRadius: 12,
                          border: "1px solid #d1d5db", background: "white",
                          color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer",
                        }}
                      >
                        알림 없이 팔로우
                      </button>
                      <button
                        type="button"
                        onClick={() => setNotifModalOpen(false)}
                        style={{
                          height: 36, borderRadius: 12, border: "none",
                          background: "transparent", color: "#9ca3af",
                          fontSize: 13, cursor: "pointer",
                        }}
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleMessageSeller}
                style={{
                  marginTop: 10,
                  width: "100%",
                  height: 48,
                  borderRadius: 14,
                  border: "1px solid #d1d5db",
                  background: "white",
                  color: "#111827",
                  fontWeight: 900,
                  cursor: "pointer",
                }}
              >
                판매자에게 메시지 보내기
              </button>
            </>
          )}

          <div
            style={{
              marginTop: 20,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
            }}
          >
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>업로드</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#111827" }}>
                {models.length}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                background: "#f8fafc",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>팔로워</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#111827" }}>
                {followersCount}
              </div>
            </div>

            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 16,
                padding: 14,
                background: "#f8fafc",
                gridColumn: "1 / -1",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280" }}>카테고리</div>
              <div style={{ marginTop: 6, fontSize: 22, fontWeight: 900, color: "#111827" }}>
                {sellerCategoryCount}
              </div>
            </div>
          </div>
        </section>

        <section>
        <div
          style={{
            marginBottom: 18,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            rowGap: 4,
            columnGap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: 34,
                fontWeight: 900,
                color: "#111827",
              }}
            >
              판매자의 모델
            </h2>

            <p
              style={{
                margin: "8px 0 0",
                color: "#6b7280",
                fontSize: 14,
              }}
            >
              등록 모델 {filteredModels.length}개
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              justifyContent: "flex-end",
            }}
          >
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              style={{
                height: 44,
                borderRadius: 14,
                border: "1px solid #d1d5db",
                padding: "0 14px",
                background: "white",
                fontWeight: 700,
                color: "#111827",
                outline: "none",
              }}
            >
              {categories.map((item) => (
                <option key={item} value={item}>
                  {item === "ALL" ? "전체 카테고리" : item}
                </option>
              ))}
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="모델명 검색"
              style={{
                width: 220,
                height: 44,
                borderRadius: 14,
                border: "1px solid #d1d5db",
                padding: "0 14px",
                outline: "none",
              }}
            />

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              style={{
                height: 44,
                borderRadius: 14,
                border: "1px solid #d1d5db",
                padding: "0 14px",
                background: "white",
                fontWeight: 700,
                color: "#111827",
                outline: "none",
              }}
            >
              <option value="latest">최신순</option>
              <option value="oldest">오래된순</option>
              <option value="price-low">가격 낮은순</option>
              <option value="price-high">가격 높은순</option>
              <option value="popular">인기순</option>
            </select>
          </div>
        </div>

          {loading ? (
            <p style={{ color: "#6b7280" }}>불러오는 중...</p>
          ) : filteredModels.length === 0 ? (
            <p style={{ color: "#6b7280" }}>등록된 모델이 없습니다.</p>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                gap: 20,
              }}
            >
              {paginatedModels.map((item) => {
                const thumb = getThumbnailUrl(item);
                const liked = !!favoriteMap[item.id];
                const liking = !!favoriteLoadingIds[item.id];
                const isPopular = (item.download_count || 0) >= 5;

                console.log(item.title, item.download_count);

                return (
                  <article
                    key={item.id}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-6px)";
                      e.currentTarget.style.boxShadow = "0 18px 40px rgba(15, 23, 42, 0.12)";
                      e.currentTarget.style.borderColor = "#d1d5db";

                      const image = e.currentTarget.querySelector(
                        ".seller-card-image"
                      ) as HTMLImageElement | null;
                      if (image) {
                        image.style.transform = "scale(1.04)";
                      }

                      const quickBtn = e.currentTarget.querySelector(
                        ".seller-card-quickview"
                      ) as HTMLButtonElement | null;
                      if (quickBtn) {
                        quickBtn.style.background = "#111827";
                        quickBtn.style.color = "white";
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 6px 20px rgba(15, 23, 42, 0.04)";
                      e.currentTarget.style.borderColor = "#e5e7eb";

                      const image = e.currentTarget.querySelector(
                        ".seller-card-image"
                      ) as HTMLImageElement | null;
                      if (image) {
                        image.style.transform = "scale(1)";
                      }

                      const quickBtn = e.currentTarget.querySelector(
                        ".seller-card-quickview"
                      ) as HTMLButtonElement | null;
                      if (quickBtn) {
                        quickBtn.style.background = "rgba(255,255,255,0.92)";
                        quickBtn.style.color = "#111827";
                      }
                    }}
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 22,
                      overflow: "hidden",
                      background: "white",
                      boxShadow: "0 6px 20px rgba(15, 23, 42, 0.04)",
                      display: "flex",
                      flexDirection: "column",
                      transform: "translateY(0)",
                      transition:
                        "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
                    }}
                  >
                    <div
                      style={{
                        background: "#0b1220",
                        aspectRatio: "16 / 10",
                        overflow: "hidden",
                        position: "relative",
                      }}
                    >
                      {thumb ? (
                        <Image
                          fill
                          className="seller-card-image"
                          src={thumb}
                          alt={item.title}
                          sizes="(max-width: 768px) 100vw, 50vw"
                          style={{
                            objectFit: "cover",
                            transform: "scale(1)",
                            transition: "transform 0.28s ease",
                          }}
                        />
                      ) : null}

                      <div
                        style={{
                          position: "absolute",
                          top: 12,
                          left: 12,
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          zIndex: 2,
                        }}
                      >
                        <span
                          style={{
                            height: 28,
                            padding: "0 10px",
                            borderRadius: 999,
                            display: "inline-flex",
                            alignItems: "center",
                            background: "rgba(15,23,42,0.82)",
                            color: "white",
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {item.category}
                        </span>

                        {isPopular && (
                          <div
                            style={{
                              position: "absolute",
                              left: 3,
                              top: 40,
                              background: "#f59e0b",
                              color: "white",
                              fontSize: 11,
                              fontWeight: 800,
                              padding: "4px 8px",
                              borderRadius: 999,
                              zIndex: 3,
                              whiteSpace: "nowrap",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            🔥 인기
                          </div>
                        )}
                      </div>

                      <button
                        className="seller-card-quickview"
                        type="button"
                        onClick={() => openQuickView(item)}
                        style={{
                          position: "absolute",
                          left: 12,
                          bottom: 12,
                          height: 34,
                          padding: "0 14px",
                          borderRadius: 999,
                          border: "none",
                          background: "rgba(255,255,255,0.92)",
                          color: "#111827",
                          fontSize: 12,
                          fontWeight: 900,
                          cursor: "pointer",
                          transition: "background 0.22s ease, color 0.22s ease",
                        }}
                      >
                        Quick View
                      </button>

                      <div
                        style={{
                          position: "absolute",
                          right: 10,
                          bottom: 10,
                          background: "rgba(15,23,42,0.8)",
                          color: "white",
                          fontSize: 12,
                          fontWeight: 700,
                          padding: "6px 10px",
                          borderRadius: 999,
                        }}
                      >
                        다운로드 {item.download_count || 0}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (!liking) toggleFavorite(item.id);
                        }}
                        style={{
                          position: "absolute",
                          right: 12,
                          top: 12,
                          width: 36,
                          height: 36,
                          borderRadius: "50%",
                          border: liked ? "none" : "1px solid rgba(255,255,255,0.5)",
                          background: liked ? "#ef4444" : "rgba(15,23,42,0.45)",
                          color: "white",
                          fontSize: 18,
                          fontWeight: 900,
                          cursor: "pointer",
                        }}
                        aria-label="찜하기"
                      >
                        {liked ? "♥" : "♡"}
                      </button>
                    </div>

                    <div style={{ padding: 18, display: "flex", flexDirection: "column", flex: 1 }}>
                      <Link
                        href={`/models/${item.id}`}
                        style={{
                          textDecoration: "none",
                          color: "inherit",
                          display: "block",
                        }}
                      >
                        <div 
                          style={{ fontWeight: 900 }}>
                            {item.title}
                        </div>

                        <div
                          style={{
                            marginTop: 14,
                            fontSize: 22,
                            fontWeight: 900,
                            color: "#111827",
                            textAlign: "right"
                          }}
                        >
                          {item.price.toLocaleString("ko-KR")}원
                        </div>
                      </Link>

                      <button
                        onClick={() => handleAddToCart(item)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = "#f8fafc";
                          e.currentTarget.style.borderColor = "#9ca3af";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = "white";
                          e.currentTarget.style.borderColor = "#d1d5db";
                        }}
                        style={{
                          marginTop: 12,
                          width: "100%",
                          height: 44,
                          borderRadius: 14,
                          border: "1px solid #d1d5db",
                          background: "white",
                          color: "#111827",
                          fontWeight: 800,
                          cursor: "pointer",
                          transition: "background 0.2s ease, border-color 0.2s ease",
                        }}
                      >
                        장바구니 담기
                      </button>
                    </div>
                  </article>
                );
               })}
            </div>
          )}

          {sellerTotalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32 }}>
              <button
                onClick={() => setSellerPage((p) => Math.max(1, p - 1))}
                disabled={sellerPage === 1}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: sellerPage === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: sellerPage === 1 ? 0.4 : 1 }}
              >‹</button>
              {Array.from({ length: sellerTotalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setSellerPage(p)}
                  style={{ height: 38, minWidth: 38, borderRadius: 10, border: sellerPage === p ? "none" : "1px solid #d1d5db", background: sellerPage === p ? "#111827" : "white", color: sellerPage === p ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
                >{p}</button>
              ))}
              <button
                onClick={() => setSellerPage((p) => Math.min(sellerTotalPages, p + 1))}
                disabled={sellerPage === sellerTotalPages}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: sellerPage === sellerTotalPages ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: sellerPage === sellerTotalPages ? 0.4 : 1 }}
              >›</button>
            </div>
          )}
        </section>
      </main>

      {quickModel && (
        <div
          onClick={closeQuickView}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.52)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(1100px, 100%)",
              borderRadius: 28,
              overflow: "hidden",
              background: "white",
              display: "grid",
              gridTemplateColumns: "1.7fr 0.9fr",
              boxShadow: "0 30px 80px rgba(15, 23, 42, 0.30)",
            }}
          >
            <div
              style={{
                minHeight: 440,
                background: "#060f23",
              }}
            >
              {viewerLoading ? (
                <div
                  style={{
                    minHeight: 440,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 800,
                  }}
                >
                  3D 파일 준비 중...
                </div>
              ) : quickViewerSupported && viewerUrl ? (
                <div style={{ width: "100%", height: 440 }}>
                  <ModelViewer url={viewerUrl} />
                </div>
              ) : quickThumb ? (
                <Image
                  src={quickThumb}
                  alt={quickModel.title}
                  width={800}
                  height={440}
                  style={{
                    width: "100%",
                    height: 440,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    minHeight: 440,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 800,
                  }}
                >
                  PREVIEW
                </div>
              )}
            </div>

            <div
              style={{
                padding: 28,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                minHeight: 440,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: "5px 0 0",
                    fontSize: 30,
                    fontWeight: 900,
                    color: "#111827",
                  }}
                >
                  {quickModel.title}
                </h3>

                <p
                  style={{
                    margin: "14px 0 0",
                    color: "#6b7280",
                    fontSize: 14,
                    lineHeight: 1.7,
                    whiteSpace: "pre-wrap",
                    minHeight: 170,
                  }}
                >
                  {quickModel.description || "제품 설명이 없습니다."}
                </p>
               </div>   

              <div
                style={{
                  marginTop: "auto", // ⭐ 핵심
                }}
              >
                <div
                  style={{
                    textAlign: "right",
                    fontSize: 30,
                    fontWeight: 900,
                    marginBottom: 12,
                  }}
                >
                  {quickModel.price.toLocaleString("ko-KR")}원
                </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 12,
                  marginTop: 24,
                }}
              >
                <Link
                  href={`/models/${quickModel.id}`}
                  style={{
                    height: 50,
                    borderRadius: 16,
                    background: "#111827",
                    color: "white",
                    textDecoration: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 900,
                  }}
                >
                  상세로 이동
                </Link>

                <button
                  type="button"
                  onClick={closeQuickView}
                  style={{
                    height: 50,
                    borderRadius: 16,
                    border: "1px solid #d1d5db",
                    background: "white",
                    color: "#111827",
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  닫기
                </button>
               </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 6,
                }}
              >
                <p
                  style={{
                    margin: 0,
                    color: "#6b7280",
                    fontSize: 13,
                    whiteSpace: "nowrap",
                  }}
                >
                  • ESC 키로 닫기 가능
                </p>
              </div>
             </div> 
            </div> 
          </div>
        </div>
      )}
      
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 30,
            right: 30,
            background: "#111827",
            color: "white",
            padding: "12px 18px",
            borderRadius: 12,
            fontWeight: 800,
            zIndex: 9999,
            boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
          }}
        >
          {toast}
        </div>
      )}
    </>
  );
}

