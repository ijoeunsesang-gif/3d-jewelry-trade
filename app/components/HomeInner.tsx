"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { scrollToSection } from "@/lib/scroll";
import styles from "../page.module.css";
import { supabase } from "../lib/supabase-browser";
import { getAccessToken, sbAuthFetch, decodeJwt } from "@/lib/supabase-fetch";
import { getProfile } from "../lib/getProfile";
import type { ProfileItem } from "../lib/getProfile";
import { showError } from "../lib/toast";
import { ClipboardList } from "lucide-react";
import ModelCard, { type ModelItem } from "./ModelCard";
import TopModelCard from "./TopModelCard";
import QuickViewModal from "./QuickViewModal";
import { SkeletonCard, SkeletonTopCard } from "./SkeletonCard";
import { getModelThumbnailUrl } from "@/lib/imageUrl";
import PopupNoticeModal from "./PopupNoticeModal";
import { preloadModelViewer } from "@/app/lib/preloadModelViewer";

type SortType = "latest" | "price-low" | "price-high" | "popular";
type FavoriteMap = Record<string, boolean>;

const categoryOptions = ["ALL", "RING", "PENDANT", "EARRING", "BRACELET", "기타부속"];
const recommendedKeywords = ["반지", "펜던트", "이어링", "기타부속", "링", "플라워", "큐빅", "체인"];
const ITEMS_PER_PAGE = 12;

// created_at 동률/페이지 경계에서 동일 모델이 두 배치에 겹쳐 들어올 수 있어 id 기준으로 정리한다.
function dedupeById(items: ModelItem[]): ModelItem[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

type Props = {
  initialModels: ModelItem[];
  initialHasMore: boolean;
};

function HomeInner({ initialModels, initialHasMore }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const page = Number(searchParams.get("page") ?? "1") || 1;

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p === 1) params.delete("page");
    else params.set("page", String(p));
    router.push(`?${params.toString()}`);
    scrollToSection("recent-models");
  };

  const [search, setSearch] = useState("");
  const [models, setModels] = useState<ModelItem[]>(initialModels);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingMore, setLoadingMore] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortType>("latest");

  const [quickModel, setQuickModel] = useState<ModelItem | null>(null);
  const [viewerUrl, setViewerUrl] = useState("");
  const [viewerLoading, setViewerLoading] = useState(false);

  const [favoriteMap, setFavoriteMap] = useState<FavoriteMap>({});
  const [favoriteLoadingIds, setFavoriteLoadingIds] = useState<Record<string, boolean>>({});

  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const [quickSeller, setQuickSeller] = useState<ProfileItem | null>(null);
  const [quickLiked, setQuickLiked] = useState(false);
  const [quickFavoriteLoading, setQuickFavoriteLoading] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // 서버 렌더가 이미 첫 배치를 채워줬으므로 보통은 재요청하지 않는다.
    // 서버 fetch가 실패해 빈 배열로 내려온 경우에만 클라이언트에서 한 번 자체 재시도한다(자기치유).
    if (initialModels.length === 0) {
      fetchModels();
    }
    fetchFavorites();
    const token = getAccessToken();
    if (token) setCurrentUserId((decodeJwt(token) as any)?.sub ?? null);
  }, []);

  // 카테고리/정렬/검색이 실제로 변경됐을 때만 페이지 초기화 (Strict Mode 이중 실행 방지)
  const prevFilters = useRef({ selectedCategory: "ALL", sortBy: "latest" as SortType, search: "" });
  useEffect(() => {
    const prev = prevFilters.current;
    if (prev.selectedCategory === selectedCategory && prev.sortBy === sortBy && prev.search === search) return;
    prevFilters.current = { selectedCategory, sortBy, search };
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    router.replace(`?${params.toString()}`);
  }, [selectedCategory, sortBy, search]);

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

  useEffect(() => {
    if (quickModel) {
      const ext = getModelExt(quickModel);
      if (["stl", "obj"].includes(ext)) {
        // 인증 API 호출과 ModelViewer 청크(~950KB) 다운로드를 병렬로 시작한다.
        loadQuickViewerUrl(quickModel);
        preloadModelViewer();
      } else {
        setViewerUrl("");
      }
    }
  }, [quickModel]);

  useEffect(() => {
    if (!quickModel) {
      setQuickSeller(null);
      return;
    }
    getProfile(quickModel.seller_id).then(setQuickSeller);
  }, [quickModel]);

  useEffect(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      setSuggestions([]);
      return;
    }

    const candidateSet = new Set<string>();
    models.forEach((model) => {
      if (model.title?.toLowerCase().includes(keyword)) candidateSet.add(model.title);
      if (model.category?.toLowerCase().includes(keyword)) candidateSet.add(model.category);

      const words = (model.description || "")
        .split(/[\s,./()]+/)
        .map((w) => w.trim())
        .filter(Boolean);
      words.forEach((w) => {
        if (w.toLowerCase().includes(keyword) && w.length >= 2) candidateSet.add(w);
      });
    });
    setSuggestions(Array.from(candidateSet).slice(0, 6));
  }, [search, models]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!searchWrapRef.current?.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchQuickFavorite = async () => {
      if (!quickModel) {
        setQuickLiked(false);
        return;
      }
      const token = getAccessToken();
      if (!token) { setQuickLiked(false); return; }
      const userId = (decodeJwt(token) as any)?.sub as string;
      const { data: favRows } = await sbAuthFetch("favorites", `?select=id&user_id=eq.${userId}&model_id=eq.${quickModel.id}&limit=1`);
      setQuickLiked(!!((favRows as any[])?.length));
    };
    fetchQuickFavorite();
  }, [quickModel]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/home-models?offset=0");
      const data = await res.json();
      setModels(dedupeById(Array.isArray(data.models) ? data.models : []));
      setHasMore(!!data.hasMore);
    } catch (e) {
      console.error('[fetchModels] 에러:', e);
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  // 48개씩 서버에서 캐싱된 배치로 로드. 필터/정렬은 이미 로드된 목록 위에서 클라이언트가 처리하므로,
  // 기본 보기(전체/최신순/검색 없음)에서 로드된 배치를 넘어가는 페이지로 이동할 때만 추가 로드한다.
  const loadMoreModels = async () => {
    if (loadingMore || !hasMore) return;
    try {
      setLoadingMore(true);
      const res = await fetch(`/api/home-models?offset=${models.length}`);
      const data = await res.json();
      const more = Array.isArray(data.models) ? data.models : [];
      setModels((prev) => dedupeById([...prev, ...more]));
      setHasMore(!!data.hasMore);
    } catch (e) {
      console.error('[loadMoreModels] 에러:', e);
    } finally {
      setLoadingMore(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const token = getAccessToken();
      if (!token) { setFavoriteMap({}); return; }
      const userId = (decodeJwt(token) as any)?.sub as string;
      if (!userId) { setFavoriteMap({}); return; }

      const { data, error } = await supabase
        .from("favorites")
        .select("model_id")
        .eq("user_id", userId);

      if (error) {
        console.error("찜 불러오기 실패:", error);
        setFavoriteMap({});
        return;
      }

      const nextMap: FavoriteMap = {};
      ((data || []) as { model_id: string }[]).forEach((row) => {
        nextMap[row.model_id] = true;
      });
      setFavoriteMap(nextMap);
      window.dispatchEvent(new Event("favorites-updated"));
    } catch (error) {
      console.error("찜 불러오기 오류:", error);
      setFavoriteMap({});
    }
  };

  const toggleFavorite = async (modelId: string) => {
    // 연타/더블클릭 방지: 이미 진행 중이면 무시
    if (favoriteLoadingIds[modelId]) return;

    const token = getAccessToken();
    if (!token) {
      showError("로그인 후 찜 기능을 사용할 수 있습니다.");
      return;
    }
    const userId = (decodeJwt(token) as any)?.sub as string;
    const wasLiked = !!favoriteMap[modelId];

    // 낙관적 업데이트: 서버 응답을 기다리지 않고 클릭 즉시 하트를 바꾼다.
    setFavoriteLoadingIds((prev) => ({ ...prev, [modelId]: true }));
    setFavoriteMap((prev) => {
      const next = { ...prev };
      if (wasLiked) delete next[modelId];
      else next[modelId] = true;
      return next;
    });
    window.dispatchEvent(new Event("favorites-updated"));

    try {
      const { error } = wasLiked
        ? await supabase.from("favorites").delete().eq("user_id", userId).eq("model_id", modelId)
        : await supabase.from("favorites").insert({ user_id: userId, model_id: modelId });

      if (error) {
        // favoriteMap이 아직 안 채워진 상태에서 이미 찜된 걸 다시 찜하려 한 레이스(unique 위반)는
        // 결과적으로 원하던 상태(찜됨)와 같으므로 롤백하지 않고 조용히 넘어간다.
        if (!wasLiked && error.code === "23505") return;
        throw error;
      }
    } catch (error) {
      console.error("찜 토글 오류:", error);
      // 롤백
      setFavoriteMap((prev) => {
        const next = { ...prev };
        if (wasLiked) next[modelId] = true;
        else delete next[modelId];
        return next;
      });
      window.dispatchEvent(new Event("favorites-updated"));
      showError(wasLiked ? "찜 해제에 실패했습니다." : "찜 추가에 실패했습니다.");
    } finally {
      setFavoriteLoadingIds((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const toggleQuickFavorite = async () => {
    if (!quickModel || quickFavoriteLoading) return;
    const token = getAccessToken();
    if (!token) {
      showError("로그인 후 찜 기능을 사용할 수 있습니다.");
      return;
    }
    const userId = (decodeJwt(token) as any)?.sub as string;
    const wasLiked = quickLiked;
    const modelId = quickModel.id;

    // 낙관적 업데이트
    setQuickFavoriteLoading(true);
    setQuickLiked(!wasLiked);
    window.dispatchEvent(new Event("favorites-updated"));

    try {
      const { error } = wasLiked
        ? await supabase.from("favorites").delete().eq("user_id", userId).eq("model_id", modelId)
        : await supabase.from("favorites").insert({ user_id: userId, model_id: modelId });

      if (error) {
        if (!wasLiked && error.code === "23505") return;
        throw error;
      }
    } catch (error) {
      console.error("퀵뷰 찜 오류:", error);
      setQuickLiked(wasLiked);
      window.dispatchEvent(new Event("favorites-updated"));
      showError(wasLiked ? "찜 해제에 실패했습니다." : "찜 추가에 실패했습니다.");
    } finally {
      setQuickFavoriteLoading(false);
    }
  };

  const getThumbnailUrl = getModelThumbnailUrl;

  const getModelExt = (item: ModelItem) => {
    const source = item.model_file_path || item.file_url || "";
    return source.split("?")[0].split(".").pop()?.toLowerCase() || "";
  };

  const loadQuickViewerUrl = async (model: ModelItem) => {
    try {
      setViewerLoading(true);
      const token = getAccessToken();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) {
        headers.Authorization = `Bearer ${token}`;
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
        console.error("퀵뷰 API가 JSON이 아닌 응답을 반환함:", rawText);
        setViewerUrl("");
        return;
      }

      const data = JSON.parse(rawText);
      if (!res.ok) {
        console.error("퀵뷰 viewer URL 불러오기 실패:", data.error);
        setViewerUrl("");
        return;
      }

      setViewerUrl(data.viewerUrl || "");
    } catch (error) {
      console.error("퀵뷰 viewer URL 요청 실패:", error);
    } finally {
      setViewerLoading(false);
    }
  };

  const filteredModels = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    let result = [...models];

    if (selectedCategory !== "ALL") {
      result = result.filter((m) => m.category === selectedCategory);
    }

    if (keyword) {
      result = result.filter((m) => {
        const title = m.title?.toLowerCase() || "";
        const desc = m.description?.toLowerCase() || "";
        const cat = m.category?.toLowerCase() || "";
        return title.includes(keyword) || desc.includes(keyword) || cat.includes(keyword);
      });
    }

    if (sortBy === "price-low") {
      result.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      result.sort((a, b) => b.price - a.price);
    } else if (sortBy === "popular") {
      result.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return result;
  }, [models, search, selectedCategory, sortBy]);

  const topModels = useMemo(
    () => [...models].sort((a, b) => (b.download_count || 0) - (a.download_count || 0)).slice(0, 6),
    [models]
  );

  const isDefaultView = selectedCategory === "ALL" && !search.trim() && sortBy === "latest";
  const totalPages = Math.ceil(filteredModels.length / ITEMS_PER_PAGE);
  const canGoNext = page < totalPages || (isDefaultView && hasMore);
  const paginatedModels = useMemo(
    () => filteredModels.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filteredModels, page]
  );

  // 기본 보기(필터/검색 없음)에서 이미 로드한 배치를 넘어서는 페이지로 이동하면 다음 배치를 미리 불러온다.
  useEffect(() => {
    if (!isDefaultView || loading || loadingMore || !hasMore) return;
    if (page * ITEMS_PER_PAGE > models.length) {
      loadMoreModels();
    }
  }, [page, isDefaultView, models.length, hasMore, loadingMore, loading]);

  const openQuickView = (model: ModelItem) => {
    setViewerUrl("");
    setQuickModel(model);
  };

  const closeQuickView = () => {
    setQuickModel(null);
    setViewerUrl("");
  };

  const applyKeyword = (keyword: string) => {
    setSearch(keyword);
    setShowSuggestions(false);
  };

  const clearSearch = () => {
    setSearch("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  return (
    <>
      <PopupNoticeModal />
      <main className={styles.main}>
        {/* Hero + 검색 */}
        <section className={styles.hero}>
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <p className={styles.heroTitle}>
              3D 마켓
            </p>
            <p className={styles.heroSubTitle}>
              주얼리 3D 모델 거래 플랫폼
            </p>

            <div className={styles.searchBox} style={{ position: "relative" }} ref={searchWrapRef}>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  className={styles.searchInput}
                  placeholder="모델명, 설명, 카테고리 검색"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => setShowSuggestions(true)}
                />

                {search.trim() && (
                  <button
                    type="button"
                    onClick={clearSearch}
                    style={{
                      position: "absolute",
                      right: 14,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      border: "none",
                      background: "rgba(160,140,91,0.15)",
                      color: "#7a6840",
                      cursor: "pointer",
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                    aria-label="검색어 초기화"
                  >
                    ×
                  </button>
                )}

                {showSuggestions && suggestions.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      left: 0,
                      right: 0,
                      top: 62,
                      background: "white",
                      border: "1px solid #e5e7eb",
                      borderRadius: 20,
                      boxShadow: "0 20px 50px rgba(15, 23, 42, 0.14)",
                      overflow: "hidden",
                      zIndex: 30,
                    }}
                  >
                    <div
                      style={{
                        padding: "12px 16px 8px",
                        fontSize: 12,
                        fontWeight: 800,
                        color: "#6b7280",
                        background: "#f8fafc",
                        borderBottom: "1px solid #eef2f7",
                      }}
                    >
                      추천 검색
                    </div>
                    {suggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onMouseDown={() => applyKeyword(item)}
                        style={{
                          width: "100%",
                          height: 48,
                          border: "none",
                          borderBottom: "1px solid #f3f4f6",
                          background: "white",
                          textAlign: "left",
                          padding: "0 16px",
                          cursor: "pointer",
                          fontSize: 14,
                          color: "#111827",
                        }}
                      >
                        🔎 {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className={styles.searchButton}>검색</button>
            </div>

            <div className={styles.keywordRow}>
              {recommendedKeywords.map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onClick={() => applyKeyword(keyword)}
                  className={styles.keywordChip}
                >
                  #{keyword}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Best 6 */}
        <section style={{ marginTop: 18, marginBottom: 26 }}>
          <div style={{ display: "flex", alignItems: "end", gap: 12, marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 40, fontWeight: 900, color: "#111827", lineHeight: 1 }}>
              Best 6
            </h3>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#6b7280", lineHeight: 1, paddingBottom: 2 }}>
              다운로드 기준 상위 모델
            </p>
          </div>

          <div className={styles.topGrid}>
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <SkeletonTopCard key={i} />)
              : topModels.length > 0
              ? topModels.map((item) => (
                  <TopModelCard
                    key={`top-${item.id}`}
                    item={item}
                    liked={!!favoriteMap[item.id]}
                    liking={!!favoriteLoadingIds[item.id]}
                    onToggleFavorite={toggleFavorite}
                    onQuickView={openQuickView}
                    getThumbnailUrl={getThumbnailUrl}
                  />
                ))
              : <p className={styles.emptyText}>표시할 TOP 모델이 없습니다.</p>}
          </div>
        </section>

        {/* 배너 2개: 의뢰하기 + 캐드스쿨 */}
        <section style={{ marginTop: 10, marginBottom: 28, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {/* 좌측: 의뢰하기 */}
          <a
            href="/commission"
            style={{
              flex: "1 1 calc(50% - 6px)",
              minWidth: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              background: "linear-gradient(135deg, #f8f6f0 0%, #ede8dc 50%, #e8e0cc 100%)",
              borderRadius: 20,
              padding: "11px 22px",
              textDecoration: "none",
              border: "1px solid rgba(160,140,91,0.35)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(201,168,76,0.2)", border: "1px solid rgba(160,140,91,0.4)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <ClipboardList size={18} color="#a08c5b" strokeWidth={2} />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#2c2416", lineHeight: 1, whiteSpace: "nowrap" }}>의뢰하기</span>
                <span style={{ fontSize: 12, color: "#7a6840", lineHeight: 1.4 }}>원하는 3D 모델을 전문가에게 의뢰하세요</span>
              </div>
            </div>
            <div style={{ padding: "7px 15px", borderRadius: 10, background: "#a08c5b", color: "white", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
              의뢰하기 →
            </div>
          </a>

          {/* 우측: 캐드스쿨 */}
          <a
            href="/cad-school"
            style={{
              flex: "1 1 calc(50% - 6px)",
              minWidth: 260,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
              background: "linear-gradient(135deg, #f8f6f0 0%, #ede8dc 50%, #e8e0cc 100%)",
              borderRadius: 20,
              padding: "11px 22px",
              textDecoration: "none",
              border: "1px solid rgba(160,140,91,0.35)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(201,168,76,0.2)", border: "1px solid rgba(160,140,91,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                🎓
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 20, fontWeight: 900, color: "#2c2416", lineHeight: 1, whiteSpace: "nowrap" }}>캐드스쿨</span>
                <span style={{ fontSize: 12, color: "#7a6840", lineHeight: 1.4 }}>질문 · 피드백 · 1:1 멘토링 · 패키지 학습</span>
              </div>
            </div>
            <div style={{ padding: "7px 15px", borderRadius: 10, background: "#a08c5b", color: "white", fontWeight: 800, fontSize: 12, whiteSpace: "nowrap", flexShrink: 0 }}>
              입장하기 →
            </div>
          </a>
        </section>

        {/* 필터 */}
        <section className={styles.filterSection}>
          <div className={styles.filterTopRow}>
            <div className={styles.categoryWrap}>
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`${styles.categoryBtn} ${selectedCategory === category ? styles.categoryBtnActive : ""}`}
                >
                  {category === "ALL" ? "전체" : category}
                </button>
              ))}
            </div>
            <div className={styles.sortWrap}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className={styles.sortSelect}
              >
                <option value="latest">최신순</option>
                <option value="price-low">가격 낮은순</option>
                <option value="price-high">가격 높은순</option>
                <option value="popular">인기순</option>
              </select>
            </div>
          </div>

          <div className={styles.filterSummary}>
            현재 결과 <strong>{filteredModels.length}개</strong>
            {search.trim() ? <> · 검색어 <strong>"{search}"</strong></> : null}
            {selectedCategory !== "ALL" ? <> · 카테고리 <strong>{selectedCategory}</strong></> : null}
          </div>
        </section>

        {/* 모델 목록 */}
        <section id="recent-models" className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>최근 업데이트 모델링</h2>
            <span className={styles.sectionBadge}>필터/정렬 이후 추가 목록</span>
          </div>

          <div className={styles.cardGrid}>
            {loading
              ? Array.from({ length: ITEMS_PER_PAGE }).map((_, i) => <SkeletonCard key={i} />)
              : paginatedModels.length > 0
              ? paginatedModels.map((item) => (
                  <ModelCard
                    key={item.id}
                    item={item}
                    search={search}
                    liked={!!favoriteMap[item.id]}
                    liking={!!favoriteLoadingIds[item.id]}
                    onToggleFavorite={toggleFavorite}
                    onQuickView={openQuickView}
                    getThumbnailUrl={getThumbnailUrl}
                    currentUserId={currentUserId}
                  />
                ))
              : <p className={styles.emptyText}>추가로 표시할 모델이 없습니다.</p>}
          </div>

          {!loading && totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32 }}>
              <button
                type="button"
                onClick={() => goToPage(Math.max(1, page - 1))}
                disabled={page === 1}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: page === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: page === 1 ? 0.4 : 1 }}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => goToPage(p)}
                  style={{ height: 38, minWidth: 38, borderRadius: 10, border: page === p ? "none" : "1px solid #d1d5db", background: page === p ? "#111827" : "white", color: page === p ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={!canGoNext}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: canGoNext ? "pointer" : "default", fontWeight: 700, color: "#374151", opacity: canGoNext ? 1 : 0.4 }}
              >
                ›
              </button>
            </div>
          )}
        </section>
      </main>

      {quickModel && (
        <QuickViewModal
          model={quickModel}
          seller={quickSeller}
          viewerUrl={viewerUrl}
          viewerLoading={viewerLoading}
          liked={quickLiked}
          favoriteLoading={quickFavoriteLoading}
          onClose={closeQuickView}
          onToggleFavorite={toggleQuickFavorite}
          getThumbnailUrl={getThumbnailUrl}
        />
      )}
    </>
  );
}

export default function HomeInnerWithSuspense(props: Props) {
  return (
    <Suspense fallback={null}>
      <HomeInner {...props} />
    </Suspense>
  );
}
