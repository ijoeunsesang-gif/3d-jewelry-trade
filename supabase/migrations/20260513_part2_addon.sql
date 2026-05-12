-- ============================================================
-- PART 2: 검수 후 CAD수정 추가, addon_purchases 테이블
-- ============================================================

-- cad_subscriptions에 검수 후 CAD수정 사용 횟수 컬럼 추가
ALTER TABLE cad_subscriptions ADD COLUMN IF NOT EXISTS post_review_cad_count integer NOT NULL DEFAULT 0;

-- 추가 구매로 늘어난 한도 컬럼 추가
ALTER TABLE cad_subscriptions ADD COLUMN IF NOT EXISTS checklist_extra_limit integer NOT NULL DEFAULT 0;
ALTER TABLE cad_subscriptions ADD COLUMN IF NOT EXISTS review_extra_limit integer NOT NULL DEFAULT 0;
ALTER TABLE cad_subscriptions ADD COLUMN IF NOT EXISTS post_review_cad_extra_limit integer NOT NULL DEFAULT 0;

-- addon_purchases: 이용권 추가 구매 내역
CREATE TABLE IF NOT EXISTS cad_addon_purchases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES cad_subscriptions(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  addon_type      text NOT NULL,  -- 'checklist' | 'review' | 'post_review_cad'
  price           integer NOT NULL,
  order_id        text NOT NULL UNIQUE,
  status          text NOT NULL DEFAULT 'pending', -- 'pending' | 'completed'
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cad_addon_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "addon_select_own" ON cad_addon_purchases FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "addon_service_role" ON cad_addon_purchases FOR ALL USING (auth.role() = 'service_role');
