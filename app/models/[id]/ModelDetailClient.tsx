"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";
import { getProfile } from "../../lib/getProfile";
import { showError, showInfo, showSuccess } from "../../lib/toast";

const ModelViewer = dynamic(() => import("../../components/ModelViewer"), {
  ssr: false,
});

type ModelItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  thumbnail_path?: string | null;
  file_url: string;
  model_file_path?: string | null;
  seller_id: string;
  category: string;
  created_at: string;
};

export default function ModelDetailClient({ model }: { model: ModelItem }) {
  const router = useRouter();

  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"image" | "viewer">("image");
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileViewerOpen, setMobileViewerOpen] = useState(false);
  const [seller, setSeller] = useState<any>(null);
  const [alreadyPurchased, setAlreadyPurchased] = useState(false);
  const [relatedModels, setRelatedModels] = useState<ModelItem[]>([]);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [liked, setLiked] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [extraFiles, setExtraFiles] = useState<{ file_name: string; file_type: string }[]>([]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  useEffect(() => {
    if (mobileViewerOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [mobileViewerOpen]);

  useEffect(() => {
    checkPurchase();
  }, [model.id]);

  useEffect(() => {
    fetchGalleryImages();
    fetchFavoriteStatus();
    fetchExtraFiles();
  }, [model.id]);

  useEffect(() => {
    if (!model?.seller_id) return;
    getProfile(model.seller_id).then(setSeller);
  }, [model]);

  useEffect(() => {
    fetchRelatedModels();
    fetchGalleryImages();
  }, [model.id, model.category]);

  useEffect(() => {
    if (viewMode !== "viewer") return;

    const ext = getModelExt();
    if (["stl", "obj"].includes(ext)) {
      loadViewerUrl();
    } else {
      setViewerUrl("");
    }
  }, [viewMode, model.id]);

  const checkPurchase = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setAlreadyPurchased(false);
        return;
      }

      const { data, error } = await supabase
        .from("purchases")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("model_id", model.id)
        .maybeSingle();

      if (!error && data) {
        setAlreadyPurchased(true);
      } else {
        setAlreadyPurchased(false);
      }
    } catch (error) {
      console.error("구매 여부 확인 실패:", error);
      setAlreadyPurchased(false);
    }
  };

  const fetchRelatedModels = async () => {
    try {
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .eq("category", model.category)
        .neq("id", model.id)
        .order("created_at", { ascending: false })
        .limit(4);

      if (error) {
        console.error("관련 모델 불러오기 실패:", error);
        return;
      }

      setRelatedModels((data || []) as ModelItem[]);
    } catch (error) {
      console.error("관련 모델 오류:", error);
    }
  };

  const fetchGalleryImages = async () => {
    try {
      const baseThumb = getThumbnailUrl(model);
      const urls: string[] = [];

      if (baseThumb) {
        urls.push(baseThumb);
      }

      const { data, error } = await supabase
        .from("model_images")
        .select("*")
        .eq("model_id", model.id)
        .order("sort_order", { ascending: true });

      if (!error && data?.length) {
        data.forEach((row: any) => {
          let url = row.image_url || "";
          if (!url && row.image_path) {
            url = supabase.storage
              .from("thumbnails")
              .getPublicUrl(row.image_path).data.publicUrl;
          }
          if (url && !urls.includes(url)) {
            urls.push(url);
          }
        });
      }

      setGalleryImages(urls);
      setSelectedImage(urls[0] || "");
    } catch (error) {
      console.error("갤러리 이미지 불러오기 실패:", error);
      const baseThumb = getThumbnailUrl(model);
      setGalleryImages(baseThumb ? [baseThumb] : []);
      setSelectedImage(baseThumb || "");
    }
  };

  const fetchExtraFiles = async () => {
    const { data, error } = await supabase
      .from("model_files")
      .select("file_name, file_type")
      .eq("model_id", model.id)
      .order("sort_order", { ascending: true });

    if (!error && data) {
      setExtraFiles(data);
    }
  };

  const fetchFavoriteStatus = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        setLiked(false);
        return;
      }

      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("model_id", model.id)
        .maybeSingle();

      setLiked(!!data);
    } catch (error) {
      console.error("상세 찜 상태 불러오기 실패:", error);
      setLiked(false);
    }
  };

  const getThumbnailUrl = (item: ModelItem) => {
    if (item.thumbnail_path) {
      return supabase.storage
        .from("thumbnails")
        .getPublicUrl(item.thumbnail_path).data.publicUrl;
    }

    return item.thumbnail || "";
  };

  const toggleFavorite = async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        showError("로그인 후 찜 기능을 사용할 수 있습니다.");
        return;
      }

      setFavoriteLoading(true);

      if (liked) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("model_id", model.id);

        if (error) {
          console.error("상세 찜 해제 실패:", error);
          showError("찜 해제에 실패했습니다.");
          return;
        }

        setLiked(false);
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: session.user.id,
          model_id: model.id,
        });

        if (error) {
          console.error("상세 찜 추가 실패:", error);
          showError("찜 추가에 실패했습니다.");
          return;
        }

        setLiked(true);
      }

      window.dispatchEvent(new Event("favorites-updated"));
    } catch (error) {
      console.error("상세 찜 토글 오류:", error);
    } finally {
      setFavoriteLoading(false);
    }
  };

  const getModelExt = () => {
    const source = model.model_file_path || model.file_url || "";
    const clean = source.split("?")[0];
    return clean.split(".").pop()?.toLowerCase() || "";
  };

  const loadViewerUrl = async () => {
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
        console.error("상세 viewer API가 JSON이 아닌 응답을 반환함:", rawText);
        setViewerUrl("");
        return;
      }

      const data = JSON.parse(rawText);

      if (!res.ok) {
        console.error("viewer URL 불러오기 실패:", data.error);
        setViewerUrl("");
        return;
      }

      setViewerUrl(data.viewerUrl || "");
    } catch (error) {
      console.error("viewer URL 요청 실패:", error);
      setViewerUrl("");
    } finally {
      setViewerLoading(false);
    }
  };

  const handleAddToCart = () => {
    const thumbnailUrl = getThumbnailUrl(model);

    const cartItem = {
      id: model.id,
      title: model.title,
      price: model.price,
      thumbUrl: thumbnailUrl,
      category: model.category,
      downloadUrl: model.file_url,
    };

    const existingCart = JSON.parse(localStorage.getItem("cart") || "[]");
    const alreadyExists = existingCart.some((item: any) => item.id === model.id);

    if (alreadyExists) {
      showError("이미 장바구니에 담긴 상품입니다.");
      return;
    }

    const updatedCart = [...existingCart, cartItem];
    localStorage.setItem("cart", JSON.stringify(updatedCart));
    window.dispatchEvent(new Event("cart-updated"));
    showSuccess("장바구니에 담았습니다.");
  };

  const handleBuyNow = () => {
    const thumbnailUrl = getThumbnailUrl(model);

    const directOrder = {
      items: [
        {
          id: model.id,
          title: model.title,
          price: model.price,
          thumbUrl: thumbnailUrl,
          category: model.category,
          downloadUrl: model.file_url,
        },
      ],
      totalPrice: model.price,
      buyerName: "",
      buyerEmail: "",
      orderedAt: new Date().toISOString(),
    };

    localStorage.setItem("pendingOrder", JSON.stringify(directOrder));
    window.location.href = "/checkout?mode=direct";
  };

  const handleInquiry = async () => {
    try {
      setInquiryLoading(true);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user) {
        showError("로그인 후 문의할 수 있습니다.");
        return;
      }

      const myId = session.user.id;
      const sellerId = model.seller_id;

      if (myId === sellerId) {
        showError("본인 상품에는 문의할 수 없습니다.");
        return;
      }

      const user1 = myId < sellerId ? myId : sellerId;
      const user2 = myId < sellerId ? sellerId : myId;

      let { data: conversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("user1_id", user1)
        .eq("user2_id", user2)
        .eq("model_id", model.id)
        .maybeSingle();

      if (!conversation) {
        const { data: inserted, error } = await supabase
          .from("conversations")
          .insert({
            user1_id: user1,
            user2_id: user2,
            model_id: model.id,
            model_title: model.title,
            model_thumbnail: getThumbnailUrl(model),
          })
          .select("*")
          .single();

        if (error) {
          console.error("문의 대화방 생성 실패:", error);
          showError("문의 대화방 생성에 실패했습니다.");
          return;
        }

        conversation = inserted;

        await supabase.from("messages").insert({
          conversation_id: conversation.id,
          sender_id: myId,
          content: `안녕하세요. '${model.title}' 상품 문의드립니다.`,
        });
      }

      window.dispatchEvent(new Event("messages-updated"));
      router.push(`/messages?conversation=${conversation.id}`);
    } catch (error) {
      console.error("문의하기 오류:", error);
      showError("문의 페이지로 이동하지 못했습니다.");
    } finally {
      setInquiryLoading(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      showError("링크 복사에 실패했습니다.");
    }
  };

  const thumbnailUrl = getThumbnailUrl(model);
  const ext = getModelExt();
  const viewerSupported = ["stl", "obj"].includes(ext);
  const displayImage = selectedImage || thumbnailUrl;

  return (
    <main className="detail-main">
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 18 }}>
        홈 / 3D 모델 / 상세보기
      </p>

      <div className="detail-grid">
        <section>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button
              type="button"
              onClick={() => setViewMode("image")}
              style={{
                height: 52,
                padding: "0 20px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                background: viewMode === "image" ? "#111827" : "white",
                color: viewMode === "image" ? "white" : "#111827",
                fontWeight: 900,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              이미지 보기
            </button>

            {viewerSupported && (
              <button
                type="button"
                onClick={() => {
                  if (isMobile) {
                    if (!viewerUrl && !viewerLoading) loadViewerUrl();
                    setMobileViewerOpen(true);
                  } else {
                    setViewMode("viewer");
                  }
                }}
                style={{
                  height: 52,
                  padding: "0 20px",
                  borderRadius: 999,
                  border: "1px solid #d1d5db",
                  background: viewMode === "viewer" && !isMobile ? "#111827" : "white",
                  color: viewMode === "viewer" && !isMobile ? "white" : "#111827",
                  fontWeight: 900,
                  fontSize: 16,
                  cursor: "pointer",
                }}
              >
                3D 보기
              </button>
            )}
          </div>

          {/* 모바일 풀스크린 3D 뷰어 모달 */}
          {mobileViewerOpen && (
            <div style={{
              position: "fixed", inset: 0,
              background: "#000",
              zIndex: 1000,
              display: "flex",
              flexDirection: "column",
            }}>
              {/* 닫기 버튼 */}
              <button
                type="button"
                onClick={() => setMobileViewerOpen(false)}
                style={{
                  position: "absolute",
                  top: 16, right: 16,
                  zIndex: 1001,
                  width: 52, height: 52,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.4)",
                  background: "rgba(0,0,0,0.7)",
                  color: "white",
                  fontSize: 26,
                  fontWeight: 900,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  lineHeight: 1,
                }}
                aria-label="닫기"
              >
                ×
              </button>

              {/* 뷰어 영역 */}
              <div style={{ flex: 1, width: "100%", overflow: "hidden" }}>
                {viewerLoading ? (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 18, fontWeight: 800,
                  }}>
                    3D 파일 준비 중...
                  </div>
                ) : viewerUrl ? (
                  <ModelViewer url={viewerUrl} />
                ) : (
                  <div style={{
                    width: "100%", height: "100%",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "white", fontSize: 16, fontWeight: 800,
                    padding: "0 24px", textAlign: "center",
                  }}>
                    3D 미리보기를 불러올 수 없습니다.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="detail-viewer-box">
            {viewMode === "image" ? (
              displayImage ? (
                <img
                  src={displayImage}
                  alt={model.title}
                  style={{
                    width: "100%",
                    height: 520,
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    minHeight: 520,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 800,
                  }}
                >
                  이미지가 없습니다.
                </div>
              )
            ) : viewerSupported ? (
              viewerLoading ? (
                <div
                  style={{
                    minHeight: 520,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 800,
                  }}
                >
                  3D 파일 준비 중...
                </div>
              ) : viewerUrl ? (
                <div style={{ width: "100%", height: 520 }}>
                  <ModelViewer url={viewerUrl} />
                </div>
              ) : (
                <div
                  style={{
                    minHeight: 520,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "white",
                    fontWeight: 800,
                  }}
                >
                  이 파일은 3D 미리보기를 지원하지 않거나 준비되지 않았습니다.
                </div>
              )
            ) : (
              <div
                style={{
                  minHeight: 520,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "white",
                  fontWeight: 800,
                }}
              >
                이 파일은 3D 미리보기를 지원하지 않습니다.
              </div>
            )}
          </div>

          {viewMode === "image" && galleryImages.length > 1 && (
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 10,
              }}
            >
              {galleryImages.map((img, idx) => (
                <button
                  key={`${img}-${idx}`}
                  type="button"
                  onClick={() => setSelectedImage(img)}
                  style={{
                    borderRadius: 16,
                    overflow: "hidden",
                    border:
                      selectedImage === img
                        ? "2px solid #111827"
                        : "1px solid #e5e7eb",
                    background: "white",
                    padding: 0,
                    cursor: "pointer",
                    aspectRatio: "1 / 1",
                  }}
                >
                  <img
                    src={img}
                    alt={`gallery-${idx}`}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                </button>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 16,
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                height: 34,
                padding: "0 14px",
                borderRadius: 999,
                border: "1px solid #d1d5db",
                display: "inline-flex",
                alignItems: "center",
                background: "white",
                fontWeight: 800,
                color: "#374151",
              }}
            >
              {model.category}
            </span>
      
          </div>
        </section>

        <aside
          className="detail-aside"
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 28,
            background: "white",
            padding: 28,
          }}
        >
          <div
            style={{
              display: "inline-flex",
              height: 30,
              padding: "0 12px",
              borderRadius: 999,
              alignItems: "center",
              background: "#eef2ff",
              color: "#3730a3",
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {model.category}
          </div>

          <h1 className="detail-title">
            {model.title}
          </h1>

          {seller && (
            <Link
              href={`/seller/${seller.id}`}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 16,
                textDecoration: "none",
                color: "#111827",
              }}
            >
              <img
                src={seller.avatar_url || "/default-avatar.png"}
                alt={seller.nickname || "seller"}
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "1px solid #e5e7eb",
                }}
              />
              <div>
                <div style={{ fontWeight: 800 }}>
                  {seller.nickname || "판매자"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  판매자 페이지 이동
                </div>
              </div>
            </Link>
          )}

          <p
            style={{
              color: "#6b7280",
              fontSize: 16,
              marginBottom: 20,
              whiteSpace: "pre-wrap",
              lineHeight: 1.8,
            }}
          >
            {model.description}
          </p>

          <div
            style={{
              fontSize: 26,
              fontWeight: 900,
              color: "#111827",
              marginBottom: 18,
              textAlign: "right"
            }}
          >
            {model.price.toLocaleString("ko-KR")}원
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {!alreadyPurchased && (
              <>
                <button
                  type="button"
                  onClick={handleBuyNow}
                  style={{
                    height: 52,
                    borderRadius: 16,
                    border: "none",
                    background: "#111827",
                    color: "white",
                    fontWeight: 900,
                    cursor: "pointer",
                    fontSize: 17,
                  }}
                >
                  구매하기
                </button>

                <button
                  type="button"
                  onClick={handleAddToCart}
                  style={{
                    height: 52,
                    borderRadius: 16,
                    border: "1px solid #d1d5db",
                    background: "white",
                    color: "#111827",
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: 17,
                  }}
                >
                  장바구니 담기
                </button>

                <button
                  type="button"
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  style={{
                    height: 52,
                    borderRadius: 16,
                    border: liked ? "none" : "1px solid #d1d5db",
                    background: liked ? "#ef4444" : "white",
                    color: liked ? "white" : "#111827",
                    fontWeight: 900,
                    cursor: "pointer",
                    fontSize: 17,
                  }}
                >
                  {favoriteLoading ? "처리 중..." : liked ? "찜 해제" : "찜하기"}
                </button>
                
                <button
                  type="button"
                  onClick={handleInquiry}
                  disabled={inquiryLoading}
                  style={{
                    height: 52,
                    borderRadius: 16,
                    border: "1px solid #d1d5db",
                    background: "white",
                    color: "#111827",
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: 17,
                  }}
                >
                  {inquiryLoading ? "이동 중..." : "문의하기"}
                </button>
              </>
            )}

            {alreadyPurchased && (
              <Link
                href="/library"
                style={{
                  height: 52,
                  borderRadius: 16,
                  background: "#16a34a",
                  color: "white",
                  textDecoration: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 17,
                }}
              >
                내 다운로드에서 받기
              </Link>
            )}

            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                height: 52,
                borderRadius: 16,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                fontWeight: 800,
                cursor: "pointer",
                fontSize: 17,
              }}
            >
              {copied ? "복사 완료!" : "링크 복사"}
            </button>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>포함 파일</div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 10,
                  background: "#f1f5f9",
                  fontSize: 13,
                  color: "#374151",
                  fontWeight: 700,
                }}
              >
                <span
                  style={{
                    background: "#6b7280",
                    color: "white",
                    borderRadius: 6,
                    padding: "2px 7px",
                    fontSize: 11,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  대표
                </span>
                <span
                  style={{
                    background: "#111827",
                    color: "white",
                    borderRadius: 6,
                    padding: "2px 7px",
                    fontSize: 11,
                    fontWeight: 900,
                    flexShrink: 0,
                  }}
                >
                  {ext.toUpperCase()}
                </span>
                {(model.model_file_path || model.file_url || "")
                  .split("?")[0]
                  .split("/")
                  .pop() || "대표 파일"}
              </div>

              {extraFiles.map((f, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 12px",
                    borderRadius: 10,
                    background: "#f8fafc",
                    border: "1px solid #e5e7eb",
                    fontSize: 13,
                    color: "#374151",
                    fontWeight: 700,
                  }}
                >
                  <span
                    style={{
                      background: "#9ca3af",
                      color: "white",
                      borderRadius: 6,
                      padding: "2px 7px",
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    추가파일
                  </span>
                  <span
                    style={{
                      background: "#6366f1",
                      color: "white",
                      borderRadius: 6,
                      padding: "2px 7px",
                      fontSize: 11,
                      fontWeight: 900,
                      flexShrink: 0,
                    }}
                  >
                    {f.file_type.toUpperCase()}
                  </span>
                  {f.file_name}
                </div>
              ))}
            </div>

          </div>

          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 18,
              background: "#f8fafc",
              color: "#6b7280",
              fontSize: 13,
              lineHeight: 1.8,
            }}
          >
            업로드일: {new Date(model.created_at).toLocaleDateString("ko-KR")}
            <br />
            STL, OBJ 파일은 브라우저에서 형상 확인용 3D 미리보기를 지원합니다.
            <br />
            3DM 파일은 다운로드 후 Rhino에서 확인하는 것을 권장합니다.
          </div>
        </aside>
      </div>

      <section style={{ marginTop: 56 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "end",
            gap: 12,
            marginBottom: 20,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="detail-section-title">
              관련 모델 추천
            </h2>
            <p
              style={{
                margin: "8px 0 0",
                color: "#6b7280",
                fontSize: 14,
              }}
            >
              같은 카테고리의 다른 모델을 확인해보세요.
            </p>
          </div>
        </div>

        {relatedModels.length === 0 ? (
          <p style={{ color: "#6b7280" }}>관련 모델이 없습니다.</p>
        ) : (
          <div className="related-grid">
            {relatedModels.map((item) => {
              const thumb = getThumbnailUrl(item);

              return (
                <Link
                  key={item.id}
                  href={`/models/${item.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <article
                    style={{
                      border: "1px solid #e5e7eb",
                      borderRadius: 22,
                      overflow: "hidden",
                      background: "white",
                    }}
                  >
                    <div style={{ padding: 14 }}>
                      <div
                        style={{
                          fontSize: 18,
                          fontWeight: 900,
                          color: "#111827",
                        }}
                      >
                        {item.title}
                      </div>

                      <div
                        style={{
                          marginTop: 8,
                          fontSize: 13,
                          color: "#6b7280",
                          minHeight: 38,
                        }}
                      >
                        {(item.description || "").slice(0, 42)}
                      </div>

                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 20,
                          fontWeight: 900,
                          color: "#111827",
                          textAlign: "right"
                        }}
                      >
                        {item.price.toLocaleString("ko-KR")}원
                      </div>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}