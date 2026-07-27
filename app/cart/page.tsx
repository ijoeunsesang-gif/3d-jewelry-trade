"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { scrollToTop } from "@/lib/scroll";
import { getThumbnailUrl } from "@/lib/imageUrl";
import { supabase } from "../lib/supabase-browser";

type CartItem = {
  id: string;
  title: string;
  price: number;
  thumbUrl: string;
  category: string;
  downloadUrl?: string;
  seller_id?: string;
  taxInvoice?: boolean;
};

const VAT_RATE = 0.1;

const ITEMS_PER_PAGE = 20;
const UNKNOWN_SELLER_KEY = "__unknown__";

const OLD_SUPABASE_THUMB = "https://fvhotaxjdacfulxjahon.supabase.co/storage/v1/object/public/thumbnails/";

const migrateThumbUrl = (url: string | undefined) => {
  if (!url) return url;
  if (url.startsWith(OLD_SUPABASE_THUMB))
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${url.slice(OLD_SUPABASE_THUMB.length)}`;
  return url;
};


function CartPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentPage = Number(searchParams.get("page") ?? "1") || 1;

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (p === 1) params.delete("page");
    else params.set("page", String(p));
    router.push(`?${params.toString()}`);
    scrollToTop();
  };

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [sellerNames, setSellerNames] = useState<Record<string, string>>({});
  const [sellerVerified, setSellerVerified] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const allCheckboxRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    (async () => {
      const savedCart: CartItem[] = JSON.parse(localStorage.getItem("cart") || "[]");
      let cart: CartItem[] = savedCart.map((i) => ({ ...i, thumbUrl: migrateThumbUrl(i.thumbUrl) ?? i.thumbUrl }));

      // 하위 호환: seller_id 없이 담긴 기존 아이템은 models 테이블에서 조회해 보강
      const missingIds = cart.filter((i) => !i.seller_id).map((i) => i.id);
      if (missingIds.length > 0) {
        const { data: models } = await supabase
          .from("models")
          .select("id, seller_id")
          .in("id", missingIds);
        const sellerOf: Record<string, string> = {};
        (models ?? []).forEach((m: { id: string; seller_id: string }) => {
          sellerOf[m.id] = m.seller_id;
        });
        cart = cart.map((i) => (i.seller_id ? i : { ...i, seller_id: sellerOf[i.id] }));
      }

      if (JSON.stringify(cart) !== JSON.stringify(savedCart)) {
        localStorage.setItem("cart", JSON.stringify(cart));
      }

      setCartItems(cart);
      window.dispatchEvent(new Event("cart-reset"));

      const sellerIds = [...new Set(cart.map((i) => i.seller_id).filter(Boolean))] as string[];
      if (sellerIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles_public")
          .select("id, nickname, is_business_verified")
          .in("id", sellerIds);
        const names: Record<string, string> = {};
        const verified: Record<string, boolean> = {};
        (profiles ?? []).forEach((p: { id: string; nickname: string | null; is_business_verified: boolean }) => {
          names[p.id] = p.nickname || "판매자";
          verified[p.id] = !!p.is_business_verified;
        });
        setSellerNames(names);
        setSellerVerified(verified);
      }
    })();
  }, []);

  const toggleGroupTaxInvoice = (items: CartItem[], checked: boolean) => {
    const ids = new Set(items.map((i) => i.id));
    setCartItems((prev) => {
      const updated = prev.map((i) => (ids.has(i.id) ? { ...i, taxInvoice: checked } : i));
      localStorage.setItem("cart", JSON.stringify(updated));
      return updated;
    });
  };

  const allSelected = cartItems.length > 0 && cartItems.every(i => selectedIds.has(i.id));
  const someSelected = selectedIds.size > 0 && !allSelected;

  useEffect(() => {
    if (allCheckboxRef.current) {
      allCheckboxRef.current.indeterminate = someSelected;
    }
  }, [someSelected]);

  const selectedItems = useMemo(
    () => cartItems.filter(i => selectedIds.has(i.id)),
    [cartItems, selectedIds]
  );
  const selectedCount = selectedItems.length;
  const selectedTotal = useMemo(
    () => selectedItems.reduce((sum, i) => sum + i.price + (i.taxInvoice ? Math.round(i.price * VAT_RATE) : 0), 0),
    [selectedItems]
  );

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(cartItems.map(i => i.id)));
    }
  };

  const toggleItem = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (items: CartItem[]) => {
    const ids = items.map((i) => i.id);
    const allSel = ids.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSel) ids.forEach((id) => next.delete(id));
      else ids.forEach((id) => next.add(id));
      return next;
    });
  };

  const removeItem = (id: string) => {
    const updated = cartItems.filter((item) => item.id !== id);
    setCartItems(updated);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    localStorage.setItem("cart", JSON.stringify(updated));
    window.dispatchEvent(new Event("cart-updated"));
  };

  const handleSelectedCheckout = () => {
    if (selectedCount === 0) return;
    const ids = [...selectedIds].join(",");
    window.location.href = `/checkout?mode=selected&ids=${encodeURIComponent(ids)}`;
  };

  const pagedItems = cartItems.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  const sellerGroups = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of pagedItems) {
      const key = item.seller_id || UNKNOWN_SELLER_KEY;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()];
  }, [pagedItems]);

  return (
    <main
      className="cart-checkout-main"
      style={{
        maxWidth: 1200,
        margin: "40px auto",
        padding: "0 20px",
        fontFamily:
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <h1
        style={{
          fontSize: 34,
          fontWeight: 900,
          marginBottom: 24,
          color: "#111827",
        }}
      >
        장바구니
      </h1>

      {cartItems.length === 0 ? (
        <div
          style={{
            border: "1px solid #e5e7eb",
            borderRadius: 24,
            padding: 32,
            background: "white",
          }}
        >
          <p style={{ fontSize: 16, color: "#6b7280", marginBottom: 16 }}>
            장바구니에 담긴 상품이 없습니다.
          </p>

          <Link
            href="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              height: 48,
              padding: "0 18px",
              borderRadius: 14,
              background: "#111827",
              color: "white",
              textDecoration: "none",
              fontWeight: 800,
            }}
          >
            상품 보러가기
          </Link>
        </div>
      ) : (
        <div
          className="cart-checkout-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1.6fr) minmax(280px, 0.8fr)",
            gap: 24,
            alignItems: "start",
          }}
        >
          <section style={{ display: "grid", gap: 16 }}>
            {/* 전체선택 행 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: "white",
                borderRadius: 16,
                border: "1px solid #e5e7eb",
              }}
            >
              <input
                ref={allCheckboxRef}
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#111827", flexShrink: 0 }}
              />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#374151" }}>
                전체선택 ({selectedCount}/{cartItems.length})
              </span>
            </div>

            {sellerGroups.map(([sellerKey, items]) => {
              const groupSelected = items.every((i) => selectedIds.has(i.id));
              const groupSubtotal = items.reduce((sum, i) => sum + i.price, 0);
              const sellerLabel =
                sellerKey === UNKNOWN_SELLER_KEY
                  ? "판매자 정보 없음"
                  : sellerNames[sellerKey] ?? "판매자";
              const canTaxInvoice = sellerKey !== UNKNOWN_SELLER_KEY && !!sellerVerified[sellerKey];
              const taxInvoiceChecked = canTaxInvoice && items.every((i) => i.taxInvoice);
              const groupVat = taxInvoiceChecked ? Math.round(groupSubtotal * VAT_RATE) : 0;

              return (
                <div key={sellerKey} style={{ display: "grid", gap: 10 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      padding: "10px 16px",
                      background: "#f9fafb",
                      borderRadius: 12,
                      border: "1px solid #f3f4f6",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <label
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: "pointer",
                          fontSize: 14,
                          fontWeight: 800,
                          color: "#374151",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={groupSelected}
                          onChange={() => toggleGroup(items)}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: "#111827" }}
                        />
                        🏪 {sellerLabel}
                      </label>
                      <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 700 }}>
                        소계 {groupSubtotal.toLocaleString("ko-KR")}원
                      </span>
                    </div>

                    {canTaxInvoice && (
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151", fontWeight: 700 }}>
                        <input
                          type="checkbox"
                          checked={taxInvoiceChecked}
                          onChange={(e) => toggleGroupTaxInvoice(items, e.target.checked)}
                          style={{ width: 15, height: 15, cursor: "pointer", accentColor: "#111827" }}
                        />
                        🧾 세금계산서 발행
                        {taxInvoiceChecked && (
                          <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>
                            (공급가 {groupSubtotal.toLocaleString("ko-KR")}원 + 부가세 {groupVat.toLocaleString("ko-KR")}원 = 합계 {(groupSubtotal + groupVat).toLocaleString("ko-KR")}원)
                          </span>
                        )}
                      </label>
                    )}
                  </div>

                  {items.map((item) => (
                    <article
                      key={item.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "28px 120px minmax(0, 1fr) auto",
                        gap: 16,
                        border: `1px solid ${selectedIds.has(item.id) ? "#6366f1" : "#e5e7eb"}`,
                        borderRadius: 20,
                        padding: 16,
                        background: selectedIds.has(item.id) ? "#fafafe" : "white",
                        alignItems: "center",
                        transition: "border-color 0.15s, background 0.15s",
                        cursor: "pointer",
                      }}
                      onClick={() => toggleItem(item.id)}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleItem(item.id)}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 18, height: 18, cursor: "pointer", accentColor: "#111827", flexShrink: 0 }}
                      />

                      <img
                        src={getThumbnailUrl(item.thumbUrl)}
                        alt={item.title}
                        style={{
                          width: 120,
                          height: 90,
                          objectFit: "cover",
                          borderRadius: 14,
                          border: "1px solid #e5e7eb",
                        }}
                      />

                      <div>
                        <div
                          style={{
                            display: "inline-block",
                            padding: "5px 9px",
                            borderRadius: 999,
                            background: "#eef2ff",
                            color: "#3730a3",
                            fontSize: 11,
                            fontWeight: 800,
                            marginBottom: 8,
                          }}
                        >
                          {item.category}
                        </div>

                        <h2
                          style={{
                            fontSize: 20,
                            fontWeight: 900,
                            margin: "0 0 8px",
                            color: "#111827",
                          }}
                        >
                          {item.title}
                        </h2>
                      </div>

                      <div style={{ textAlign: "right" }} onClick={e => e.stopPropagation()}>
                        <div
                          style={{
                            fontSize: 24,
                            fontWeight: 900,
                            color: "#111827",
                            marginBottom: 12,
                          }}
                        >
                          {item.price.toLocaleString("ko-KR")}원
                        </div>

                        <button
                          onClick={() => removeItem(item.id)}
                          style={{
                            height: 42,
                            padding: "0 14px",
                            borderRadius: 12,
                            border: "1px solid #fecaca",
                            background: "#fff1f2",
                            color: "#b91c1c",
                            fontWeight: 800,
                            cursor: "pointer",
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              );
            })}

            {Math.ceil(cartItems.length / ITEMS_PER_PAGE) > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }}>
                <button
                  type="button"
                  onClick={() => goToPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === 1 ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === 1 ? 0.4 : 1 }}
                >
                  ‹
                </button>
                {Array.from({ length: Math.ceil(cartItems.length / ITEMS_PER_PAGE) }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => goToPage(p)}
                    style={{ height: 38, minWidth: 38, borderRadius: 10, border: currentPage === p ? "none" : "1px solid #d1d5db", background: currentPage === p ? "#111827" : "white", color: currentPage === p ? "white" : "#374151", cursor: "pointer", fontWeight: 800, fontSize: 14 }}
                  >
                    {p}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => goToPage(Math.min(Math.ceil(cartItems.length / ITEMS_PER_PAGE), currentPage + 1))}
                  disabled={currentPage === Math.ceil(cartItems.length / ITEMS_PER_PAGE)}
                  style={{ height: 38, minWidth: 38, borderRadius: 10, border: "1px solid #d1d5db", background: "white", cursor: currentPage === Math.ceil(cartItems.length / ITEMS_PER_PAGE) ? "default" : "pointer", fontWeight: 700, color: "#374151", opacity: currentPage === Math.ceil(cartItems.length / ITEMS_PER_PAGE) ? 0.4 : 1 }}
                >
                  ›
                </button>
              </div>
            )}
          </section>

          <aside
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 24,
              padding: 24,
              background: "white",
              position: "sticky",
              top: 24,
            }}
          >
            <h2
              style={{
                fontSize: 24,
                fontWeight: 900,
                marginBottom: 18,
                color: "#111827",
              }}
            >
              주문 요약
            </h2>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                color: "#6b7280",
                fontSize: 15,
              }}
            >
              <span>전체 상품</span>
              <span>{cartItems.length}개</span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                color: "#6b7280",
                fontSize: 15,
              }}
            >
              <span>선택 상품</span>
              <span
                style={{
                  color: selectedCount > 0 ? "#111827" : "#9ca3af",
                  fontWeight: selectedCount > 0 ? 700 : 400,
                }}
              >
                {selectedCount}개
              </span>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 18,
                color: "#111827",
                fontSize: 18,
                fontWeight: 900,
                borderTop: "1px solid #f3f4f6",
                paddingTop: 14,
                marginTop: 8,
              }}
            >
              <span>선택 합계</span>
              <span style={{ color: selectedCount > 0 ? "#111827" : "#9ca3af" }}>
                {selectedCount > 0 ? `${selectedTotal.toLocaleString("ko-KR")}원` : "—"}
              </span>
            </div>

            <p style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px", lineHeight: 1.5 }}>
              ℹ️ 구매 후 6개월간 횟수 제한없이 다운로드 가능
            </p>

            <button
              onClick={handleSelectedCheckout}
              disabled={selectedCount === 0}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 54,
                borderRadius: 16,
                border: "none",
                background: selectedCount > 0 ? "#111827" : "#e5e7eb",
                color: selectedCount > 0 ? "white" : "#9ca3af",
                fontSize: 16,
                fontWeight: 900,
                cursor: selectedCount > 0 ? "pointer" : "default",
                marginBottom: 10,
                transition: "background 0.15s",
              }}
            >
              {selectedCount > 0
                ? `선택 상품 결제 (${selectedCount}개)`
                : "상품을 선택해주세요"}
            </button>

            <Link
              href="/checkout"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 50,
                borderRadius: 16,
                border: "1px solid #d1d5db",
                background: "white",
                color: "#111827",
                textDecoration: "none",
                fontWeight: 800,
                marginBottom: 10,
              }}
            >
              전체 결제하기
            </Link>

            <Link
              href="/"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                height: 44,
                borderRadius: 16,
                border: "1px solid #e5e7eb",
                background: "white",
                color: "#6b7280",
                textDecoration: "none",
                fontWeight: 700,
                fontSize: 14,
              }}
            >
              계속 쇼핑하기
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}

export default function CartPage() {
  return (
    <Suspense fallback={null}>
      <CartPageInner />
    </Suspense>
  );
}
