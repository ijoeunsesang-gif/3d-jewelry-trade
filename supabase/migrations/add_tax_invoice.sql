-- ============================================================
-- 세금계산서 기능 — 1/2단계 orders/order_items 구조 위에 얹는 작업
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 사전 확인 결과 (profiles 기존 컬럼 재활용):
--   business_registration_url  이미 존재 — 사업자등록증 이미지 URL로 재사용
--   business_number            이미 존재 — 판매자 사업자등록번호로 재사용
--   business_name              이미 존재 — 상호명으로 재사용
--   → 신규로 필요한 건 승인 여부(is_business_verified)와 구매자용 사업자 정보뿐
-- ============================================================

-- ------------------------------------------------------------
-- 1. profiles — 판매자 사업자 승인 여부 (신규 1개)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_business_verified BOOLEAN NOT NULL DEFAULT false;

-- ------------------------------------------------------------
-- 2. profiles — 구매자 사업자 정보 자동입력용 (신규)
-- ------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS buyer_business_name    TEXT,
  ADD COLUMN IF NOT EXISTS buyer_business_number  TEXT,
  ADD COLUMN IF NOT EXISTS buyer_ceo_name         TEXT,
  ADD COLUMN IF NOT EXISTS buyer_business_address TEXT,
  ADD COLUMN IF NOT EXISTS buyer_tax_email        TEXT;

-- ------------------------------------------------------------
-- 3. order_items — 세금계산서 관련 (결제 시점에 기록)
-- ------------------------------------------------------------
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS tax_invoice_requested BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_amount             INTEGER,
  ADD COLUMN IF NOT EXISTS supply_amount          INTEGER;

-- ------------------------------------------------------------
-- 4. tax_invoice_requests — 결제 후 구매자가 사업자 정보를 입력해 실제로
--    세금계산서를 요청한 건. order_item_id(일반 구매) / commission_id(개인 의뢰)
--    중 하나만 채워짐.
-- ------------------------------------------------------------
CREATE TABLE public.tax_invoice_requests (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id    UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  commission_id    UUID REFERENCES public.commissions(id) ON DELETE SET NULL,
  buyer_id         UUID NOT NULL REFERENCES public.profiles(id),
  seller_id        UUID NOT NULL REFERENCES public.profiles(id),
  business_name    TEXT NOT NULL,
  business_number  TEXT NOT NULL,
  ceo_name         TEXT NOT NULL,
  business_address TEXT NOT NULL,
  email            TEXT NOT NULL,
  supply_amount    INTEGER NOT NULL,
  vat_amount       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',  -- 'pending' / 'issued'
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_at        TIMESTAMPTZ
);

CREATE INDEX idx_tax_invoice_requests_buyer_id  ON public.tax_invoice_requests (buyer_id);
CREATE INDEX idx_tax_invoice_requests_seller_id ON public.tax_invoice_requests (seller_id);
CREATE INDEX idx_tax_invoice_requests_order_item_id ON public.tax_invoice_requests (order_item_id);
CREATE INDEX idx_tax_invoice_requests_commission_id ON public.tax_invoice_requests (commission_id);

-- ------------------------------------------------------------
-- 5. RLS — 구매자 본인 / 판매자 자기 것 / 관리자 전체
--    실제 쓰기(생성/발행완료 처리)는 금액·상태 검증이 필요해 서버 라우트
--    (service role)에서 처리한다. 아래 정책은 조회 편의 + 스펙에 맞춘
--    기본 CRUD 안전망이다.
-- ------------------------------------------------------------
ALTER TABLE public.tax_invoice_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_invoice_requests_select_buyer" ON public.tax_invoice_requests;
CREATE POLICY "tax_invoice_requests_select_buyer" ON public.tax_invoice_requests
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "tax_invoice_requests_select_seller" ON public.tax_invoice_requests;
CREATE POLICY "tax_invoice_requests_select_seller" ON public.tax_invoice_requests
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "tax_invoice_requests_insert_buyer" ON public.tax_invoice_requests;
CREATE POLICY "tax_invoice_requests_insert_buyer" ON public.tax_invoice_requests
  FOR INSERT TO authenticated
  WITH CHECK (buyer_id = auth.uid());

DROP POLICY IF EXISTS "tax_invoice_requests_update_seller" ON public.tax_invoice_requests;
CREATE POLICY "tax_invoice_requests_update_seller" ON public.tax_invoice_requests
  FOR UPDATE TO authenticated
  USING (seller_id = auth.uid())
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "tax_invoice_requests_admin_all" ON public.tax_invoice_requests;
CREATE POLICY "tax_invoice_requests_admin_all" ON public.tax_invoice_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
