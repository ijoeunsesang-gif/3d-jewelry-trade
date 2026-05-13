-- ============================================================
-- PART 3: cad_subscriptions에 결제 정보 컬럼 추가
-- ============================================================

ALTER TABLE cad_subscriptions ADD COLUMN IF NOT EXISTS payment_key text;
ALTER TABLE cad_subscriptions ADD COLUMN IF NOT EXISTS order_id    text UNIQUE;
