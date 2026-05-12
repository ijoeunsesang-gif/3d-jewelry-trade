"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase-browser";
import { getAccessToken, decodeJwt } from "@/lib/supabase-fetch";
import { showError, showInfo } from "../../lib/toast";
import { loadTossPayments, ANONYMOUS } from "@tosspayments/tosspayments-sdk";

const GOLD = "#c9a84c";

type AddonType = "checklist" | "review" | "post_review_cad";

const ADDONS: { type: AddonType; label: string; desc: string; price: number; icon: string }[] = [
  { type: "checklist",       label: "CAD수정 1회",        desc: "멘토가 파일을 직접 수정해드립니다.",        price: 9900,  icon: "✏️" },
  { type: "review",          label: "실무 검수 1회",       desc: "판매·출력 가능 여부를 컨펌해드립니다.",      price: 14900, icon: "🔍" },
  { type: "post_review_cad", label: "검수 후 CAD수정 1회", desc: "검수 후 수정까지 한 번에 처리해드립니다.",   price: 19900, icon: "⚡" },
];

function AddonContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subId   = searchParams.get("sub")  ?? "";
  const preType = (searchParams.get("type") ?? "") as AddonType | "";

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [paying, setPaying] = useState<AddonType | null>(null);
  const [subStatus, setSubStatus] = useState<"loading" | "active" | "inactive">("loading");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    const payload = decodeJwt(token) as { sub?: string } | null;
    setMyUserId(payload?.sub ?? null);

    if (!subId) { setSubStatus("inactive"); return; }

    (async () => {
      const { data } = await supabase
        .from("cad_subscriptions")
        .select("id, status, subscriber_id")
        .eq("id", subId)
        .single();

      if (!data || data.status !== "active" || data.subscriber_id !== payload?.sub) {
        setSubStatus("inactive");
      } else {
        setSubStatus("active");
      }
    })();
  }, [subId]);

  const handlePurchase = async (addon: typeof ADDONS[0]) => {
    const token = getAccessToken();
    if (!token) { showInfo("로그인이 필요합니다."); router.push("/auth"); return; }
    if (!subId) { showError("구독 정보가 없습니다."); return; }

    const clientKey = process.env.NEXT_PUBLIC_TOSSPAYMENTS_CLIENT_KEY;
    if (!clientKey) { showError("결제 설정이 올바르지 않습니다."); return; }

    setPaying(addon.type);
    try {
      const payload = decodeJwt(token) as { sub?: string; email?: string } | null;
      const orderId = `cad-addon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      localStorage.setItem("pendingCadAddon", JSON.stringify({
        subscriptionId: subId,
        addonType: addon.type,
        price: addon.price,
        orderId,
      }));

      const tossPayments = await loadTossPayments(clientKey);
      const payment = tossPayments.payment({ customerKey: payload?.sub ?? ANONYMOUS });
      await payment.requestPayment({
        method: "CARD",
        amount: { currency: "KRW", value: addon.price },
        orderId,
        orderName: `[캐드스쿨] ${addon.label}`,
        successUrl: `${window.location.origin}/cad-school/addon/success`,
        failUrl: `${window.location.origin}/cad-school/addon/fail`,
        ...(payload?.email ? { customerEmail: payload.email } : {}),
        customerName: "구매자",
      });
    } catch (e: unknown) {
      const errObj = e !== null && typeof e === "object" ? (e as Record<string, unknown>) : {};
      const errCode = typeof errObj.code === "string" ? errObj.code : "";
      const errMsg = e instanceof Error ? e.message : typeof errObj.message === "string" ? errObj.message : "";
      if (!errMsg.includes("취소") && !errCode.includes("CANCELED")) {
        showError("결제 중 오류가 발생했습니다.");
      }
    } finally {
      setPaying(null);
    }
  };

  return (
    <main style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 96px", fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* 헤더 */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        {subId
          ? <Link href={`/cad-school/subscription/${subId}`} style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 채팅방으로</Link>
          : <Link href="/cad-school/my" style={{ color: "#6b7280", textDecoration: "none", fontSize: 14 }}>← 내 활동</Link>}
        <span style={{ color: "#d1d5db" }}>/</span>
        <span style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>이용권 추가 구매</span>
      </div>

      <div style={{ background: "#111827", borderRadius: 20, padding: "24px 28px", marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: GOLD, letterSpacing: 2, marginBottom: 6 }}>ADD-ON</div>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 900, color: "white" }}>이용권 추가 구매</h1>
        <p style={{ margin: "8px 0 0", fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
          수강 기간 내 횟수를 모두 사용한 경우 추가로 구매할 수 있습니다.
        </p>
      </div>

      {subStatus === "loading" && (
        <div style={{ textAlign: "center", padding: "48px 20px", color: "#9ca3af" }}>불러오는 중...</div>
      )}

      {subStatus === "inactive" && (
        <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 16, padding: "24px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#dc2626", marginBottom: 8 }}>활성 수강 패키지가 없습니다</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>이용권 추가 구매는 활성 수강 패키지가 있을 때만 가능합니다.</div>
          <Link href="/cad-school" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "10px 24px", borderRadius: 12, background: "#111827", color: "white", textDecoration: "none", fontWeight: 800, fontSize: 13 }}>
            수강 패키지 보기
          </Link>
        </div>
      )}

      {subStatus === "active" && (
        <div style={{ display: "grid", gap: 16 }}>
          {ADDONS.map((addon) => {
            const isPreSelected = preType === addon.type;
            const isPaying = paying === addon.type;
            return (
              <div
                key={addon.type}
                style={{
                  background: isPreSelected ? "#f0f9ff" : "white",
                  border: `1.5px solid ${isPreSelected ? "#0891b2" : "#e5e7eb"}`,
                  borderRadius: 20,
                  padding: "22px 24px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
                    <div style={{ fontSize: 32 }}>{addon.icon}</div>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 900, color: "#111827", marginBottom: 4 }}>{addon.label}</div>
                      <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5 }}>{addon.desc}</div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#111827" }}>{addon.price.toLocaleString("ko-KR")}원</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>1회</div>
                  </div>
                </div>
                <button
                  onClick={() => handlePurchase(addon)}
                  disabled={isPaying || paying !== null}
                  style={{
                    marginTop: 16, width: "100%", height: 46, borderRadius: 12, border: "none",
                    background: isPaying ? "#d1d5db" : isPreSelected ? "#0891b2" : "#111827",
                    color: "white", fontWeight: 900, fontSize: 14, cursor: isPaying || paying !== null ? "not-allowed" : "pointer",
                  }}
                >
                  {isPaying ? "결제 중..." : "구매하기"}
                </button>
              </div>
            );
          })}

          <div style={{ background: "#f8fafc", border: "1px solid #e5e7eb", borderRadius: 12, padding: "12px 16px", fontSize: 12, color: "#6b7280", lineHeight: 1.9 }}>
            <div>· 추가 구매한 이용권은 현재 수강 기간 내에서만 사용 가능합니다.</div>
            <div>· 결제 후 즉시 해당 횟수가 추가됩니다.</div>
            <div>· 이용권은 환불이 불가합니다.</div>
          </div>
        </div>
      )}
    </main>
  );
}

export default function AddonPage() {
  return (
    <Suspense fallback={<main style={{ padding: "60px 20px", textAlign: "center", color: "#6b7280" }}>불러오는 중...</main>}>
      <AddonContent />
    </Suspense>
  );
}
