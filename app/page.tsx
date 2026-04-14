"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./page.module.css";
import { supabase } from "./lib/supabase-browser";
import { getProfile } from "./lib/getProfile";
import type { ProfileItem } from "./lib/getProfile";
import { showError } from "./lib/toast";
import ModelCard, { type ModelItem } from "./components/ModelCard";
import TopModelCard from "./components/TopModelCard";
import QuickViewModal from "./components/QuickViewModal";
import { SkeletonCard, SkeletonTopCard } from "./components/SkeletonCard";

type SortType = "latest" | "price-low" | "price-high" | "popular";
type FavoriteMap = Record<string, boolean>;

const categoryOptions = ["ALL", "RING", "PENDANT", "EARRING", "BRACELET", "?∏Ìä∏"];
const recommendedKeywords = ["Î∞òÏ?", "?úÎçò??, "?¥Ïñ¥Îß?, "?∏Ìä∏", "Îß?, "?åÎùº??, "?êÎπÖ", "Ï≤¥Ïù∏"];
const ITEMS_PER_PAGE = 20;

export default function Home() {
  const [search, setSearch] = useState("");
  const [models, setModels] = useState<ModelItem[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [page, setPage] = useState(1);

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

  const searchWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchModels();
    fetchFavorites();
  }, []);

  // Ïπ¥ÌÖåÍ≥†Î¶¨/?ïÎ†¨/Í≤Ä??Î≥ÄÍ≤????òÏù¥ÏßÄ Ï¥àÍ∏∞??  useEffect(() => {
    setPage(1);
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
        loadQuickViewerUrl(quickModel);
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setQuickLiked(false);
        return;
      }
      const { data } = await supabase
        .from("favorites")
        .select("id")
        .eq("user_id", session.user.id)
        .eq("model_id", quickModel.id)
        .maybeSingle();
      setQuickLiked(!!data);
    };
    fetchQuickFavorite();
  }, [quickModel]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      console.log("[fetchModels] ?úÏûë - SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
      const { data, error } = await supabase
        .from("models")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      console.log("[fetchModels] Í≤∞Í≥º - data Í∞úÏàò:", data?.length ?? null, "| error:", error);
      if (error) {
        console.error("[fetchModels] ?êÎü¨ ?ÅÏÑ∏:", JSON.stringify(error));
        return;
      }
      console.log("[fetchModels] Ï≤?Î≤àÏß∏ row ?òÌîå:", data?.[0] ?? "?ÜÏùå");
      setModels(data || []);
    } catch (error) {
      console.error("[fetchModels] catch ?§Î•ò:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFavorites = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setFavoriteMap({});
        return;
      }

      const { data, error } = await supabase
        .from("favorites")
        .select("model_id")
        .eq("user_id", session.user.id);

      if (error) {
        console.error("Ï∞?Î∂àÎü¨?§Í∏∞ ?§Ìå®:", error);
        return;
      }

      const nextMap: FavoriteMap = {};
      (data || []).forEach((row: { model_id: string }) => {
        nextMap[row.model_id] = true;
      });
      setFavoriteMap(nextMap);
      window.dispatchEvent(new Event("favorites-updated"));
    } catch (error) {
      console.error("Ï∞?Î∂àÎü¨?§Í∏∞ ?§Î•ò:", error);
    }
  };

  const toggleFavorite = async (modelId: string) => {
    try {
      setFavoriteLoadingIds((prev) => ({ ...prev, [modelId]: true }));
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        showError("Î°úÍ∑∏????Ï∞?Í∏∞Îä•???¨Ïö©?????àÏäµ?àÎã§.");
        return;
      }

      const liked = !!favoriteMap[modelId];
      if (liked) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("model_id", modelId);

        if (error) {
          showError("Ï∞??¥Ï†ú???§Ìå®?àÏäµ?àÎã§.");
          return;
        }
        setFavoriteMap((prev) => {
          const next = { ...prev };
          delete next[modelId];
          return next;
        });
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: session.user.id,
          model_id: modelId,
        });

        if (error) {
          showError("Ï∞?Ï∂îÍ????§Ìå®?àÏäµ?àÎã§.");
          return;
        }
        setFavoriteMap((prev) => ({ ...prev, [modelId]: true }));
      }

      window.dispatchEvent(new Event("favorites-updated"));
    } catch (error) {
      console.error("Ï∞??†Í? ?§Î•ò:", error);
    } finally {
      setFavoriteLoadingIds((prev) => ({ ...prev, [modelId]: false }));
    }
  };

  const toggleQuickFavorite = async () => {
    try {
      if (!quickModel) return;
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        showError("Î°úÍ∑∏????Ï∞?Í∏∞Îä•???¨Ïö©?????àÏäµ?àÎã§.");
        return;
      }

      setQuickFavoriteLoading(true);

      if (quickLiked) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", session.user.id)
          .eq("model_id", quickModel.id);

        if (error) {
          showError("Ï∞??¥Ï†ú???§Ìå®?àÏäµ?àÎã§.");
          return;
        }
        setQuickLiked(false);
      } else {
        const { error } = await supabase.from("favorites").insert({
          user_id: session.user.id,
          model_id: quickModel.id,
        });

        if (error) {
          showError("Ï∞?Ï∂îÍ????§Ìå®?àÏäµ?àÎã§.");
          return;
        }
        setQuickLiked(true);
      }

      window.dispatchEvent(new Event("favorites-updated"));
    } catch (error) {
      console.error("?µÎ∑∞ Ï∞??§Î•ò:", error);
    } finally {
      setQuickFavoriteLoading(false);
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

  const getModelExt = (item: ModelItem) => {
    const source = item.model_file_path || item.file_url || "";
    return source.split("?")[0].split(".").pop()?.toLowerCase() || "";
  };

  const loadQuickViewerUrl = async (model: ModelItem) => {
    try {
      setViewerLoading(true);
      const { data: { session } } = await supabase.auth.getSession();

      const headers: Record<string, string> = { "Content-Type": "application/json" };
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
        console.error("?µÎ∑∞ APIÍ∞Ä JSON???ÑÎãå ?ëÎãµ??Î∞òÌôò??", rawText);
        setViewerUrl("");
        return;
      }

      const data = JSON.parse(rawText);
      if (!res.ok) {
        console.error("?µÎ∑∞ viewer URL Î∂àÎü¨?§Í∏∞ ?§Ìå®:", data.error);
        setViewerUrl("");
        return;
      }

      setViewerUrl(data.viewerUrl || "");
    } catch (error) {
      console.error("?µÎ∑∞ viewer URL ?îÏ≤≠ ?§Ìå®:", error);
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

  const totalPages = Math.ceil(filteredModels.length / ITEMS_PER_PAGE);
  const paginatedModels = useMemo(
    () => filteredModels.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE),
    [filteredModels, page]
  );

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
      <main className={styles.main}>
        {/* Hero + Í≤Ä??*/}
        <section className={styles.hero}>
          <div className={styles.heroOverlay} />
          <div className={styles.heroContent}>
            <p className={styles.heroSubTitle}>
              JEWELRY 3D MARKET
            </p>
            <p className={styles.heroTitle}>
              Ï£ºÏñºÎ¶?3D Î™®Îç∏ Í±∞Îûò ?åÎû´??            </p>

            <div className={styles.searchBox} style={{ position: "relative" }} ref={searchWrapRef}>
              <div style={{ position: "relative", width: "100%" }}>
                <input
                  className={styles.searchInput}
                  placeholder="Î™®Îç∏Î™? ?§Î™Ö, Ïπ¥ÌÖåÍ≥†Î¶¨ Í≤Ä??
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
                    aria-label="Í≤Ä?âÏñ¥ Ï¥àÍ∏∞??
                  >
                    √ó
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
                      Ï∂îÏ≤ú Í≤Ä??                    </div>
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
                        ?îé {item}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <button className={styles.searchButton}>Í≤Ä??/button>
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
              ?§Ïö¥Î°úÎìú Í∏∞Ï? ?ÅÏúÑ Î™®Îç∏
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
              : <p className={styles.emptyText}>?úÏãú??TOP Î™®Îç∏???ÜÏäµ?àÎã§.</p>}
          </div>
        </section>

        {/* ?ÑÌÑ∞ */}
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
                  {category === "ALL" ? "?ÑÏ≤¥" : category}
                </button>
              ))}
            </div>
            <div className={styles.sortWrap}>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className={styles.sortSelect}
              >
                <option value="latest">ÏµúÏã†??/option>
                <option value="price-low">Í∞ÄÍ≤??????/option>
                <option value="price-high">Í∞ÄÍ≤??íÏ???/option>
                <option value="popular">?∏Í∏∞??/option>
              </select>
            </div>
          </div>

          <div className={styles.filterSummary}>
            ?ÑÏû¨ Í≤∞Í≥º <strong>{filteredModels.length}Í∞?/strong>
            {search.trim() ? <> ¬∑ Í≤Ä?âÏñ¥ <strong>"{search}"</strong></> : null}
            {selectedCategory !== "ALL" ? <> ¬∑ Ïπ¥ÌÖåÍ≥†Î¶¨ <strong>{selectedCategory}</strong></> : null}
          </div>
        </section>

        {/* Î™®Îç∏ Î™©Î°ù */}
        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>ÏµúÍ∑º ?ÖÎç∞?¥Ìä∏ Î™®Îç∏Îß?/h2>
            <span className={styles.sectionBadge}>?ÑÌÑ∞/?ïÎ†¨ ?¥ÌõÑ Ï∂îÍ? Î™©Î°ù</span>
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
                  />
                ))
              : <p className={styles.emptyText}>Ï∂îÍ?Î°??úÏãú??Î™®Îç∏???ÜÏäµ?àÎã§.</p>}
          </div>

          {!loading && totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32 }}>
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: page === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: page === 1 ? 0.4 : 1 }}
              >
                ??              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPage(p)}
                  style={{ height: 38, minWidth: 38, borderRadius: 10, border: page === p ? "none" : "1px solid #d1d5db", background: page === p ? "#111827" : "white", color: page === p ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
                >
                  {p}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: page === totalPages ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: page === totalPages ? 0.4 : 1 }}
              >
                ??              </button>
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
