-- ─────────────────────────────────────────────────────────
-- 판매자 등급 시스템 DB 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- ─────────────────────────────────────────────────────────

-- 1. profiles에 grade 컬럼 추가
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS grade TEXT NOT NULL DEFAULT 'sprout';

-- 2. seller_stats 테이블
CREATE TABLE IF NOT EXISTS seller_stats (
  user_id              UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  total_sales_count    INTEGER   NOT NULL DEFAULT 0,
  total_sales_amount   BIGINT    NOT NULL DEFAULT 0,
  current_grade        TEXT      NOT NULL DEFAULT 'sprout',
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE seller_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "서비스롤 전체접근" ON seller_stats USING (true) WITH CHECK (true);

-- 3. sale_records 테이블
CREATE TABLE IF NOT EXISTS sale_records (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id         UUID        REFERENCES profiles(id),
  buyer_id          UUID        REFERENCES profiles(id),
  model_id          UUID        REFERENCES models(id),
  amount            INTEGER     NOT NULL,
  commission_rate   NUMERIC(4,2) NOT NULL,
  settlement_amount INTEGER     NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sale_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "서비스롤 전체접근" ON sale_records USING (true) WITH CHECK (true);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_sale_records_seller_id ON sale_records(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_records_created_at ON sale_records(created_at);
