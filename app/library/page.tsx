"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../lib/supabase";
import { showError, showInfo } from "../lib/toast";

type PurchasedModel = {
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
  purchased_at: string;
};

const CATEGORIES = ["ALL", "RING", "PENDANT", "EARRING", "BRACELET", "SET"];
const CATEGORY_LABEL: Record<string, string> = {
  ALL: "전체", RING: "링", PENDANT: "팬던트", EARRING: "이어링", BRACELET: "브레이슬릿", SET: "세트",
};


export default function LibraryPage() {
  const router = useRouter();
  const [items, setItems] = useState<PurchasedModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // 검색 / 카테고리 필터
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");

  // 페이지네이션
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => { fetchLibrary(); }, []);

  const fetchLibrary = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { showInfo("로그인이 필요합니다."); window.location.href = "/auth"; return; }

      const { data: purchases, error: purchaseError } = await supabase
        .from("purchases").select("model_id, created_at")
        .eq("user_id", session.user.id).order("created_at", { ascending: false });
      if (purchaseError) { console.error(purchaseError); return; }
      if (!purchases || purchases.length === 0) { setItems([]); return; }

      const modelIds = [...new Set(purchases.map((p) => p.model_id))];
      const { data: models, error: modelError } = await supabase
        .from("models").select("*").in("id", modelIds);
      if (modelError) { console.error(modelError); return; }

      const ordered = purchases
        .map((p) => {
          const m = models?.find((mm) => mm.id === p.model_id);
          if (!m) return null;
          return { ...m, purchased_at: p.created_at };
        })
        .filter(Boolean) || [];
      setItems(Array.from(new Map(ordered.map((i: any) => [i.id, i])).values()) as PurchasedModel[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleDownload = async (item: PurchasedModel) => {
    try {
      setDownloadingId(item.id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) { showInfo("로그인이 필요합니다."); return; }
      const res = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ modelId: item.id }),
      });
      const data = await res.json();
      if (!res.ok) { showError(data.error || "다운로드 링크 생성에 실패했습니다."); return; }
      window.open(data.signedUrl, "_blank");
    } catch (e) { console.error(e); showError("다운로드 중 오류가 발생했습니다."); }
    finally { setDownloadingId(null); }
  };

  const getThumbnailUrl = (item: PurchasedModel) => {
    if (item.thumbnail_path) {
      return supabase.storage.from("thumbnails").getPublicUrl(item.thumbnail_path).data.publicUrl;
    }
    return item.thumbnail || "";
  };

  const filteredItems = items.filter((item) => {
    const matchSearch = !search.trim() || item.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchCat = selectedCategory === "ALL" || item.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const pagedItems = filteredItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  if (loading) {
    return <main style={{ maxWidth: 1100, margin: "40px auto", padding: "0 20px" }}><p>내 다운로드를 불러오는 중...</p></main>;
  }

  return (
    <>
      <main style={{ maxWidth: 1200, margin: "40px auto", padding: "0 20px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
            <div>
              <h1 style={{ fontSize: 30, fontWeight: 900, color: "#111827", margin: 0 }}>내 다운로드</h1>
              <p style={{ color: "#6b7280", fontSize: 14, margin: "6px 0 0" }}>구매한 3D 모델을 안전하게 다시 다운로드할 수 있습니다.</p>
            </div>
            <div style={{ padding: "8px 14px", borderRadius: 999, background: "#f3f4f6", color: "#111827", fontWeight: 800, fontSize: 13 }}>총 {items.length}개</div>
          </div>

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
                key={cat} type="button"
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

        {items.length === 0 ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white" }}>
            <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 16 }}>아직 구매한 상품이 없습니다.</p>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: 48, padding: "0 18px", borderRadius: 14, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800 }}>상품 보러가기</Link>
          </div>
        ) : filteredItems.length === 0 ? (
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 24, padding: 32, background: "white", textAlign: "center" }}>
            <p style={{ fontSize: 15, color: "#6b7280" }}>검색 결과가 없습니다.</p>
          </div>
        ) : (
          <div className="library-card-grid">
            {pagedItems.map((item) => {
              const thumbUrl = getThumbnailUrl(item);
              const fileName = item.model_file_path ? item.model_file_path.split("/").pop() || "" : "";
              const fileExt = fileName.includes(".") ? fileName.split(".").pop()?.toUpperCase() : "";
              const purchaseDate = item.purchased_at
                ? new Date(item.purchased_at).toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" })
                : "-";
              return (
                <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 20, background: "white", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 2px 12px rgba(15,23,42,0.06)" }}>
                  <div style={{ position: "relative", aspectRatio: "4/3", overflow: "hidden", background: "#0b1220" }}>
                    {thumbUrl && <img src={thumbUrl} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />}
                    <div style={{ position: "absolute", top: 10, left: 10, padding: "3px 9px", borderRadius: 999, background: "rgba(15,23,42,0.75)", color: "white", fontSize: 11, fontWeight: 800 }}>
                      {item.category}
                    </div>
                    {fileExt && (
                      <div style={{ position: "absolute", top: 10, right: 10, padding: "3px 8px", borderRadius: 6, background: "#111827", color: "white", fontSize: 11, fontWeight: 900 }}>
                        {fileExt}
                      </div>
                    )}
                  </div>

                  <div style={{ padding: "14px 16px", flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
                    <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</h2>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#111827" }}>{item.price.toLocaleString("ko-KR")}원</div>
                    {fileName && (
                      <div style={{ fontSize: 12, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        📎 {fileName}
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: "#9ca3af" }}>구매일 {purchaseDate}</div>
                  </div>

                  <div style={{ padding: "0 14px 14px", display: "flex", flexDirection: "column", gap: 7 }}>
                    <button
                      onClick={() => handleDownload(item)}
                      disabled={downloadingId === item.id}
                      style={{ height: 40, borderRadius: 10, border: "none", background: "#111827", color: "white", fontWeight: 900, cursor: downloadingId === item.id ? "default" : "pointer", fontSize: 13 }}
                    >
                      {downloadingId === item.id ? "생성 중..." : "다운로드"}
                    </button>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7 }}>
                      <button
                        onClick={() => router.push(`/send-to-printer?modelId=${item.id}`)}
                        style={{ height: 36, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", fontWeight: 800, cursor: "pointer", fontSize: 12 }}
                      >
                        출력소 전송
                      </button>
                      <Link
                        href={`/models/${item.id}`}
                        style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 36, borderRadius: 10, border: "1px solid #d1d5db", background: "white", color: "#111827", textDecoration: "none", fontWeight: 800, fontSize: 12 }}
                      >
                        상세 보기
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 32 }}>
            <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}
              style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === 1 ? 0.4 : 1 }}>‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button key={page} onClick={() => setCurrentPage(page)}
                style={{ height: 38, minWidth: 38, borderRadius: 10, border: currentPage === page ? "none" : "1px solid #d1d5db", background: currentPage === page ? "#111827" : "white", color: currentPage === page ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}>
                {page}
              </button>
            ))}
            <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
              style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === totalPages ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === totalPages ? 0.4 : 1 }}>›</button>
          </div>
        )}
      </main>
</>
  );
}
