"use client";

import { useEffect, useState } from "react";
import { sbAuthFetch } from "@/lib/supabase-fetch";
import { MENTOR_GRADE_CONFIG, MentorGrade } from "@/lib/grades";

export const RATE_COMMISSION = 0.2; // 의뢰 수수료율 20% (관리자 정산관리와 동일)

export type SaleType = "model" | "commission" | "cadschool";
export type CadKind = "subscription" | "addon" | "session";

export interface SaleEntry {
  id: string;
  type: SaleType;
  cadKind?: CadKind;
  model_id: string | null;
  title: string;
  price: number;            // 판매액(공급가, 세전) — 매출 집계 기준
  settlementAmount: number; // 정산액(수수료 차감 + 부가세 가산)
  vatAmount: number;
  taxInvoice: boolean;
  created_at: string;
}

export interface SellerModelRow {
  id: string;
  title: string;
  thumbnail: string;
  thumbnail_path?: string | null;
  seller_id: string;
}

interface UseSellerSalesStatsResult {
  loading: boolean;
  entries: SaleEntry[];
  models: SellerModelRow[];
  isMentor: boolean;
  refetch: () => void;
}

/**
 * 판매자 본인의 모델판매(sale_records) + 의뢰 정산(commissions) +
 * 캐드스쿨 수익(cad_subscriptions/cad_mentoring_sessions/cad_addon_purchases,
 * 본인이 멘토인 경우만)을 하나의 SaleEntry[]로 합쳐서 반환한다.
 * 관리자 정산관리(app/admin/settlement/page.tsx)와 동일한 계산 방식을 쓴다.
 */
export function useSellerSalesStats(userId: string | null): UseSellerSalesStatsResult {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<SaleEntry[]>([]);
  const [models, setModels] = useState<SellerModelRow[]>([]);
  const [isMentor, setIsMentor] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const combined: SaleEntry[] = [];

        /* ── 1. 모델판매 (sale_records + models) ── */
        const { data: myModels } = await sbAuthFetch(
          "models",
          `?select=id,title,thumbnail,thumbnail_path,seller_id&seller_id=eq.${userId}`
        );
        const modelList = (myModels as SellerModelRow[]) ?? [];
        const modelTitleMap = new Map(modelList.map((m) => [m.id, m]));

        const { data: saleData } = await sbAuthFetch(
          "sale_records",
          `?select=id,model_id,amount,settlement_amount,order_id,created_at&seller_id=eq.${userId}&order=created_at.desc`
        );
        const sales = (saleData as any[]) ?? [];

        // 모델판매 세금계산서/부가세 — order_items(order_id + model_id)로 매칭
        const modelOrderIds = [...new Set(sales.map((r) => r.order_id).filter(Boolean))];
        const modelTaxInfo: Record<string, { taxInvoice: boolean; vat: number }> = {};
        if (modelOrderIds.length > 0) {
          const { data: modelOrderItems } = await sbAuthFetch(
            "order_items",
            `?select=order_id,model_id,tax_invoice_requested,vat_amount&order_id=in.(${modelOrderIds.join(",")})&model_id=not.is.null`
          );
          ((modelOrderItems as any[]) ?? []).forEach((oi) => {
            modelTaxInfo[`${oi.order_id}::${oi.model_id}`] = {
              taxInvoice: !!oi.tax_invoice_requested,
              vat: oi.vat_amount ?? 0,
            };
          });
        }

        sales.forEach((r) => {
          const taxInfo = r.order_id ? modelTaxInfo[`${r.order_id}::${r.model_id}`] : undefined;
          combined.push({
            id: r.id, type: "model", model_id: r.model_id,
            title: modelTitleMap.get(r.model_id)?.title || "알 수 없는 모델",
            price: r.amount ?? 0,
            settlementAmount: r.settlement_amount ?? r.amount ?? 0,
            vatAmount: taxInfo?.vat ?? 0,
            taxInvoice: !!taxInfo?.taxInvoice,
            created_at: r.created_at,
          });
        });

        /* ── 2. 의뢰 정산 (commissions) — 수수료율 20% ──
           created_at은 의뢰 생성일이라 실제 결제일(paid_at)을 기준일로 쓴다.
           paid_at이 없는 과거 결제 건은 매칭되는 orders.created_at → 그마저
           없으면 commissions.created_at 순으로 폴백한다. */
        const { data: commData } = await sbAuthFetch(
          "commissions",
          `?select=id,title,final_price,created_at,paid_at&target_seller_id=eq.${userId}&payment_key=not.is.null&final_price=not.is.null&status=in.(working,completed,downloaded)&order=created_at.desc`
        );
        const comms = (commData as any[]) ?? [];
        const vatByCommission: Record<string, number> = {};
        const orderCreatedAtByCommission: Record<string, string> = {};

        if (comms.length > 0) {
          const commissionIds = comms.map((c) => c.id);
          // orders는 orders_select_seller 정책으로 "본인 order_items가 포함된 주문"만 조회 가능
          const { data: sellerOrders } = await sbAuthFetch(
            "orders",
            `?select=id,order_code,created_at&order_code=like.commission-*`
          );
          const orderIdToCommissionId: Record<string, string> = {};
          ((sellerOrders as any[]) ?? []).forEach((o) => {
            const matchedId = commissionIds.find((cid) => o.order_code.startsWith(`commission-${cid}-`));
            if (matchedId) {
              orderIdToCommissionId[o.id] = matchedId;
              orderCreatedAtByCommission[matchedId] = o.created_at;
            }
          });

          const matchedOrderIds = Object.keys(orderIdToCommissionId);
          if (matchedOrderIds.length > 0) {
            const { data: commOrderItems } = await sbAuthFetch(
              "order_items",
              `?select=order_id,vat_amount&order_id=in.(${matchedOrderIds.join(",")})&model_id=is.null`
            );
            ((commOrderItems as any[]) ?? []).forEach((oi) => {
              const cid = orderIdToCommissionId[oi.order_id];
              if (cid) vatByCommission[cid] = oi.vat_amount ?? 0;
            });
          }
        }

        comms.filter((c) => c.final_price).forEach((c) => {
          const amt = c.final_price as number;
          const comm = Math.round(amt * RATE_COMMISSION);
          const vat = vatByCommission[c.id] ?? 0;
          const paidAt = c.paid_at ?? orderCreatedAtByCommission[c.id] ?? c.created_at;
          combined.push({
            id: c.id, type: "commission", model_id: null,
            title: c.title || "개인 의뢰",
            price: amt, settlementAmount: (amt - comm) + vat,
            vatAmount: vat, taxInvoice: vat > 0, created_at: paidAt,
          });
        });

        /* ── 3. 캐드스쿨 수익 (본인이 멘토인 경우만) — 멘토 등급별 수수료율 ── */
        const { data: myMentorRows } = await sbAuthFetch(
          "cad_mentors",
          `?select=id,mentor_grade&user_id=eq.${userId}`
        );
        const myMentor = ((myMentorRows as any[]) ?? [])[0];

        if (myMentor) {
          const mentorId = myMentor.id as string;
          const mentorGrade = (myMentor.mentor_grade ?? "normal") as MentorGrade;
          const rate = MENTOR_GRADE_CONFIG[mentorGrade].commission;

          // 3-1. 수강패키지
          const { data: subs } = await sbAuthFetch(
            "cad_subscriptions",
            `?select=id,plan_type,price,created_at&mentor_id=eq.${mentorId}&payment_key=not.is.null&order=created_at.desc`
          );
          const subList = (subs as any[]) ?? [];
          subList.forEach((s) => {
            const amt = s.price ?? 0;
            const comm = Math.round(amt * rate);
            combined.push({
              id: s.id, type: "cadschool", cadKind: "subscription", model_id: null,
              title: `수강패키지 (${(s.plan_type ?? "").toUpperCase()})`,
              price: amt, settlementAmount: amt - comm,
              vatAmount: 0, taxInvoice: false, created_at: s.created_at,
            });
          });

          // 3-2. 건별 멘토링
          const { data: sessions } = await sbAuthFetch(
            "cad_mentoring_sessions",
            `?select=id,price,session_type,created_at&mentor_id=eq.${mentorId}&status=in.(accepted,completed)&order=created_at.desc`
          );
          ((sessions as any[]) ?? []).forEach((s) => {
            const amt = s.price ?? 0;
            const comm = Math.round(amt * rate);
            combined.push({
              id: s.id, type: "cadschool", cadKind: "session", model_id: null,
              title: `건별멘토링${s.session_type ? ` (${s.session_type})` : ""}`,
              price: amt, settlementAmount: amt - comm,
              vatAmount: 0, taxInvoice: false, created_at: s.created_at,
            });
          });

          // 3-3. 이용권 추가구매 — 본인 소유 구독(subList)에 달린 것만
          const subIds = subList.map((s) => s.id);
          if (subIds.length > 0) {
            const { data: addons } = await sbAuthFetch(
              "cad_addon_purchases",
              `?select=id,addon_type,price,created_at&subscription_id=in.(${subIds.join(",")})&status=eq.completed&order=created_at.desc`
            );
            ((addons as any[]) ?? []).forEach((a) => {
              const amt = a.price ?? 0;
              const comm = Math.round(amt * rate);
              combined.push({
                id: a.id, type: "cadschool", cadKind: "addon", model_id: null,
                title: `이용권추가 (${a.addon_type ?? ""})`,
                price: amt, settlementAmount: amt - comm,
                vatAmount: 0, taxInvoice: false, created_at: a.created_at,
              });
            });
          }
        }

        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        if (!cancelled) {
          setEntries(combined);
          setModels(modelList);
          setIsMentor(!!myMentor);
        }
      } catch (e) {
        console.error("판매 통계 불러오기 오류:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [userId, reloadKey]);

  return { loading, entries, models, isMentor, refetch: () => setReloadKey((k) => k + 1) };
}
