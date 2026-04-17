"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { sbFetch } from "@/lib/supabase-fetch";
import { showError } from "../lib/toast";

type ModelItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  thumbnail: string;
  thumbnail_path?: string | null;
  category: string;
  created_at: string;
};

type SortType = "latest" | "oldest" | "price-low" | "price-high";

const CATEGORIES = ["ALL", "RING", "PENDANT", "EARRING", "BRACELET", "SET"];
const CATEGORY_LABEL: Record<string, string> = {
  ALL: "전체", RING: "링", PENDANT: "팬던트", EARRING: "이어링", BRACELET: "브레이슬릿", SET: "세트",
};

export default function FavoritesPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [sortBy, setSortBy] = useState<SortType>("latest");
  const [removingId, setRemovingId] = useState("");
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchFavoriteModels();
    localStorage.setItem("favorites_last_viewed", new Date().toISOString());
    window.dispatchEvent(new Event("favorites-updated"));
  }, []);

  const fetchFavoriteModels = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setModels([]); setLoading(false); return; }

      const { data: favoriteRows, error: favoriteError } = await supabase
        .from("favorites").select("model_id, created_at")
        .eq("user_id", session.user.id).order("created_at", { ascending: false });

      if (favoriteError) { console.error(favoriteError); setLoading(false); return; }

      const ids = (favoriteRows || []).map((row: any) => row.model_id);
      if (ids.length === 0) { setModels([]); setLoading(false); return; }

      const { data: modelRows, error: modelError } = await sbFetch(
        "models",
        `?select=id,title,description,price,thumbnail,thumbnail_path,category,created_at&id=in.(${ids.join(",")})`
      );

      if (modelError) { console.error(modelError); setLoading(false); return; }

      const ordered = ids
        .map((id) => (modelRows as ModelItem[] || []).find((model) => model.id === id))
        .filter(Boolean) as ModelItem[];

      setModels(ordered);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const removeFavorite = async (modelId: string) => {
    try {
      setRemovingId(modelId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;

      const { error } = await supabase.from("favorites").delete()
        .eq("user_id", session.user.id).eq("model_id", modelId);

      if (error) { showError("찜 해제에 실패했습니다."); return; }

      setModels((prev) => prev.filter((item) => item.id !== modelId));
      window.dispatchEvent(new Event("favorites-updated"));
    } catch (error) {
      console.error(error);
    } finally {
      setRemovingId("");
    }
  };

  const getThumbnailUrl = (item: ModelItem) => {
    if (item.thumbnail_path) {
      return supabase.storage.from("thumbnails").getPublicUrl(item.thumbnail_path).data.publicUrl;
    }
    return item.thumbnail || "";
  };

  const filteredModels = useMemo(() => {
    let arr = [...models];

    if (search.trim()) {
      arr = arr.filter((m) => m.title.toLowerCase().includes(search.trim().toLowerCase()));
    }
    if (selectedCategory !== "ALL") {
      arr = arr.filter((m) => m.category === selectedCategory);
    }

    if (sortBy === "oldest") {
      arr.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (sortBy === "price-low") {
      arr.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      arr.sort((a, b) => b.price - a.price);
    } else {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return arr;
  }, [models, sortBy, search, selectedCategory]);

  return (
    <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* 헤더 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#111827" }}>찜한 모델</h1>
        <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>
          저장해둔 관심 모델을 한 번에 모아보세요.
        </p>
      </div>

      {/* 검색 + 필터 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" }}>
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="모델 이름으로 검색..."
            style={{ flex: 1, minWidth: 180, height: 44, borderRadius: 12, border: "1px solid #d1d5db", padding: "0 16px", fontSize: 14, boxSizing: "border-box", outline: "none" }}
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortType)}
            style={{ height: 44, borderRadius: 12, border: "1px solid #d1d5db", padding: "0 14px", background: "white", fontWeight: 700, color: "#111827", outline: "none", cursor: "pointer" }}
          >
            <option value="latest">최신순</option>
            <option value="oldest">오래된순</option>
            <option value="price-low">가격 낮은순</option>
            <option value="price-high">가격 높은순</option>
          </select>
        </div>

        {/* 카테고리 필터 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => { setSelectedCategory(cat); setCurrentPage(1); }}
              style={{
                height: 34, padding: "0 16px", borderRadius: 999, fontSize: 13, fontWeight: 800, cursor: "pointer",
                border: selectedCategory === cat ? "none" : "1px solid #d1d5db",
                background: selectedCategory === cat ? "#111827" : "white",
                color: selectedCategory === cat ? "white" : "#374151",
              }}
            >
              {CATEGORY_LABEL[cat] ?? cat}
            </button>
          ))}
        </div>
      </div>

      {/* 목록 */}
      {loading ? (
        <p style={{ color: "#6b7280" }}>찜 목록 불러오는 중...</p>
      ) : models.length === 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white" }}>
          <p style={{ fontSize: 15, color: "#6b7280", margin: "0 0 16px" }}>아직 찜한 모델이 없습니다.</p>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, padding: "0 18px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800 }}>상품 보러가기</Link>
        </div>
      ) : filteredModels.length === 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white", textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <>
        <div className="library-card-grid">
          {filteredModels.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((item) => {
            const thumb = getThumbnailUrl(item);
            return (
              <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
                {/* 썸네일 */}
                <Link href={`/models/${item.id}`} style={{ textDecoration: "none", display: "block" }}>
                  <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "#0b1220" }}>
                    {thumb && <img src={thumb} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", borderRadius: 999, background: "rgba(15,23,42,0.75)", color: "white", fontSize: 11, fontWeight: 800 }}>
                      {CATEGORY_LABEL[item.category] ?? item.category}
                    </div>
                  </div>
                </Link>

                {/* 내용 */}
                <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                  <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</h2>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{item.price.toLocaleString("ko-KR")}원</div>
                  {item.description && (
                    <p style={{ margin: 0, fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.description}
                    </p>
                  )}
                </div>

                {/* 버튼 */}
                <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                  <Link
                    href={`/models/${item.id}`}
                    style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 38, borderRadius: 10, background: "#111827", color: "white", textDecoration: "none", fontWeight: 900, fontSize: 13 }}
                  >
                    상세 보기
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeFavorite(item.id)}
                    disabled={removingId === item.id}
                    style={{ height: 38, borderRadius: 10, border: "1px solid #e11d48", background: "#fff1f2", color: "#e11d48", fontWeight: 800, cursor: removingId === item.id ? "default" : "pointer", fontSize: 13 }}
                  >
                    {removingId === item.id ? "해제 중..." : "찜 해제"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {Math.ceil(filteredModels.length / ITEMS_PER_PAGE) > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32 }}>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === 1 ? 0.4 : 1 }}
            >
              ‹
            </button>
            {Array.from({ length: Math.ceil(filteredModels.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setCurrentPage(p)}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: currentPage === p ? "none" : "1px solid #d1d5db", background: currentPage === p ? "#111827" : "white", color: currentPage === p ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
              >
                {p}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(filteredModels.length / ITEMS_PER_PAGE), p + 1))}
              disabled={currentPage === Math.ceil(filteredModels.length / ITEMS_PER_PAGE)}
              style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === Math.ceil(filteredModels.length / ITEMS_PER_PAGE) ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === Math.ceil(filteredModels.length / ITEMS_PER_PAGE) ? 0.4 : 1 }}
            >
              ›
            </button>
          </div>
        )}
        </>
      )}
    </main>
  );
}
