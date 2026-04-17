"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase-browser";
import { sbFetch } from "@/lib/supabase-fetch";
import { showError, showSuccess } from "../lib/toast";

type ModelItem = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  thumbnail?: string;
  thumbnail_path?: string | null;
  seller_id: string;
  created_at: string;
  download_count?: number;
};

const ITEMS_PER_PAGE = 20;
const CATEGORIES = ["ALL", "RING", "PENDANT", "EARRING", "BRACELET", "SET"];
const CATEGORY_LABEL: Record<string, string> = {
  ALL: "전체", RING: "링", PENDANT: "팬던트", EARRING: "이어링", BRACELET: "브레이슬릿", SET: "세트",
};

export default function MyModelsPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);

  const getThumbnailUrl = (item: ModelItem) => {
    if (item.thumbnail_path) {
      return supabase.storage.from("thumbnails").getPublicUrl(item.thumbnail_path).data.publicUrl;
    }
    return item.thumbnail || "";
  };

  const fetchMyModels = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setModels([]); setLoading(false); return; }

      const { data, error } = await sbFetch("models", `?seller_id=eq.${session.user.id}&order=created_at.desc`);

      if (error) { console.error(error); setModels([]); return; }
      setModels((data || []) as ModelItem[]);
    } catch (error) {
      console.error(error); setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMyModels(); }, []);

  const handleDelete = async (modelId: string) => {
    if (!confirm("이 모델을 삭제할까요?")) return;
    try {
      setDeletingId(modelId);
      const { error } = await supabase.from("models").delete().eq("id", modelId);
      if (error) { showError("모델 삭제에 실패했습니다."); return; }
      setModels((prev) => prev.filter((item) => item.id !== modelId));
      showSuccess("모델이 삭제되었습니다.");
    } catch (error) {
      console.error(error); showError("삭제 중 오류가 발생했습니다.");
    } finally {
      setDeletingId(null);
    }
  };

  const filteredModels = models.filter((item) => {
    const matchSearch = !search.trim() || item.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchCat = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filteredModels.length / ITEMS_PER_PAGE);
  const pagedModels = filteredModels.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* 헤더 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: "#111827" }}>내 모델</h1>
          <p style={{ margin: "6px 0 0", color: "#6b7280", fontSize: 14 }}>내가 업로드한 모델을 확인하고 수정할 수 있습니다.</p>
        </div>
        <Link
          href="/upload"
          style={{ height: 44, padding: "0 18px", borderRadius: 12, background: "#111827", color: "white", textDecoration: "none", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 14 }}
        >
          새 모델 업로드
        </Link>
      </div>

      {/* 검색 + 카테고리 필터 */}
      <div style={{ marginBottom: 20 }}>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
          placeholder="모델 이름으로 검색..."
          style={{ width: "100%", height: 44, borderRadius: 12, border: "1px solid #d1d5db", padding: "0 16px", fontSize: 14, boxSizing: "border-box", outline: "none", marginBottom: 12 }}
        />
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
        <p style={{ color: "#6b7280" }}>내 모델을 불러오는 중...</p>
      ) : models.length === 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, background: "white", padding: 28 }}>
          <p style={{ margin: "0 0 16px", color: "#6b7280", fontSize: 15 }}>아직 업로드한 모델이 없습니다.</p>
          <Link href="/upload" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, padding: "0 18px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800 }}>
            모델 업로드하기
          </Link>
        </div>
      ) : filteredModels.length === 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white", textAlign: "center" }}>
          <p style={{ fontSize: 15, color: "#6b7280", margin: 0 }}>검색 결과가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="library-card-grid">
            {pagedModels.map((item) => {
              const thumb = getThumbnailUrl(item);
              const uploadDate = new Date(item.created_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });
              return (
                <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
                  {/* 썸네일 */}
                  <Link href={`/models/${item.id}`} style={{ textDecoration: "none", display: "block" }}>
                    <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "#0b1220" }}>
                      {thumb && <img src={thumb} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                      <div style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", borderRadius: 999, background: "rgba(15,23,42,0.75)", color: "white", fontSize: 11, fontWeight: 800 }}>
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </div>
                      <div style={{ position: "absolute", right: 10, bottom: 10, background: "rgba(15,23,42,0.8)", color: "white", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 999 }}>
                        다운로드 {item.download_count || 0}
                      </div>
                    </div>
                  </Link>

                  {/* 내용 */}
                  <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</h2>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{Number(item.price || 0).toLocaleString("ko-KR")}원</div>
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>업로드 {uploadDate}</div>
                  </div>

                  {/* 버튼 */}
                  <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                    <Link
                      href={`/edit-model/${item.id}`}
                      style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 38, borderRadius: 10, background: "#111827", color: "white", textDecoration: "none", fontWeight: 900, fontSize: 13 }}
                    >
                      수정
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      disabled={deletingId === item.id}
                      style={{ height: 38, borderRadius: 10, border: "1px solid #fecaca", background: "#fff1f2", color: "#b91c1c", fontWeight: 800, cursor: deletingId === item.id ? "default" : "pointer", fontSize: 13 }}
                    >
                      {deletingId === item.id ? "삭제 중..." : "삭제"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 페이지네이션 */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32 }}>
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === 1 ? 0.4 : 1 }}
              >
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
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
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === totalPages ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === totalPages ? 0.4 : 1 }}
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
