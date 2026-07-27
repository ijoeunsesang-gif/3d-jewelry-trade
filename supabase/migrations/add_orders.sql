-- ============================================================
-- 결제 구조 개편 1단계: 주문(order) 테이블 신설
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 주의: 기존 orders/order_items 테이블은 대시보드에서 직접 생성된
--       미사용(0 rows) 레거시 테이블이라 DROP 후 목표 스키마로 재생성한다.
--       (코드 어디에서도 .from("orders")를 호출하지 않는 것 확인됨)
-- ============================================================

-- ------------------------------------------------------------
-- 1. 기존 레거시 orders/order_items 제거 (0 rows, 데이터 손실 없음)
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.order_items CASCADE;
DROP TABLE IF EXISTS public.orders CASCADE;

-- ------------------------------------------------------------
-- 2. orders — 결제 트랜잭션(토스 결제 1건) 단위
-- ------------------------------------------------------------
CREATE TABLE public.orders (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code   TEXT NOT NULL UNIQUE,               -- 토스에 넘긴 orderId
  buyer_id     UUID NOT NULL REFERENCES public.profiles(id),
  payment_key  TEXT,                                -- 토스 결제 키
  total_amount INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL DEFAULT 'paid',         -- 'paid' / 'refunded' / 'partial_refunded'
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_buyer_id ON public.orders (buyer_id);

-- ------------------------------------------------------------
-- 3. order_items — 주문 내 모델(판매자) 단위 항목
--    개인 의뢰 결제는 특정 모델에 연결되지 않으므로 model_id는 nullable.
-- ------------------------------------------------------------
CREATE TABLE public.order_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id   UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  model_id   UUID REFERENCES public.models(id) ON DELETE SET NULL,
  seller_id  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  price      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_order_items_order_id ON public.order_items (order_id);
CREATE INDEX idx_order_items_seller_id ON public.order_items (seller_id);

-- ------------------------------------------------------------
-- 4. RLS — 구매자는 본인 주문만, 판매자는 자기 order_items만, 관리자 전체
-- ------------------------------------------------------------
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- orders: 구매자 본인 조회/등록
DROP POLICY IF EXISTS "orders_select_own" ON public.orders;
CREATE POLICY "orders_select_own" ON public.orders
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
CREATE POLICY "orders_admin_all" ON public.orders
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- order_items: 구매자는 본인 주문의 항목, 판매자는 자기 몫의 항목만 조회
DROP POLICY IF EXISTS "order_items_select_buyer" ON public.order_items;
CREATE POLICY "order_items_select_buyer" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.buyer_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items_select_seller" ON public.order_items;
CREATE POLICY "order_items_select_seller" ON public.order_items
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "order_items_insert_buyer" ON public.order_items;
CREATE POLICY "order_items_insert_buyer" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND o.buyer_id = auth.uid())
  );

DROP POLICY IF EXISTS "order_items_admin_all" ON public.order_items;
CREATE POLICY "order_items_admin_all" ON public.order_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ------------------------------------------------------------
-- 5. 기존 테이블에 order 참조 컬럼 추가 (전부 nullable, 기존 데이터 호환)
-- ------------------------------------------------------------
ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS order_id    UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_key TEXT,
  ADD COLUMN IF NOT EXISTS seller_id   UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchases_order_id ON public.purchases (order_id);
CREATE INDEX IF NOT EXISTS idx_purchases_seller_id ON public.purchases (seller_id);

ALTER TABLE public.sale_records
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sale_records_order_id ON public.sale_records (order_id);
