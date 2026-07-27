-- ============================================================
-- orders 판매자 SELECT 정책 추가 (의뢰 정산 부가세 매칭용)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 배경: 판매자 판매통계(app/sales/page.tsx, app/profile.tsx 판매통계 탭)에
-- 의뢰 정산을 추가하면서, 관리자 정산관리와 동일하게 orders.order_code
-- (형식: commission-{id}-{timestamp})로 의뢰↔주문을 매칭해 부가세를 조회해야
-- 한다. 그런데 orders에는 구매자 본인(orders_select_own)과 관리자
-- (orders_admin_all)만 조회 가능한 정책만 있고, 판매자가 자신이 받은 주문을
-- 조회할 방법이 없다 — order_items에는 이미 "order_items_select_seller"
-- (seller_id = auth.uid()) 정책이 있는 것과 비교하면 orders 쪽만 누락된 상태.
--
-- 판매자에게 노출되는 범위는 "자신의 order_items가 포함된 주문"으로 한정한다
-- (order_items_select_seller와 동일한 소유권 기준을 orders로 확장한 것뿐이라
-- 새로운 데이터 노출 범위가 생기지 않는다).
-- ============================================================

DROP POLICY IF EXISTS "orders_select_seller" ON public.orders;
CREATE POLICY "orders_select_seller" ON public.orders
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.order_items oi
      WHERE oi.order_id = orders.id AND oi.seller_id = auth.uid()
    )
  );
