-- ============================================================
-- PART 1: 판매자 등급명 변경, 평판 시스템, 구독→패키지 전환
-- ============================================================

-- 1. 판매자 등급명 변경 (profiles.grade 컬럼은 내부 키(sprout 등) 사용 중이므로 DB 변경 불필요)
-- grades.ts의 label만 변경되었음 (sprout→셀러, skilled→인증셀러, pro→프로셀러, master→파트너)
-- seller_stats.current_grade도 내부 키 사용이므로 변경 불필요

-- ============================================================
-- 2. 평판(Reputation) 시스템 테이블
-- ============================================================

CREATE TABLE IF NOT EXISTS reputation_scores (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score       integer NOT NULL DEFAULT 0,
  total_reviews integer NOT NULL DEFAULT 0,
  avg_rating  numeric(3,2) NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS reputation_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type  text NOT NULL,
  points      integer NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 이벤트 타입 주석:
-- purchase_review    : 구매 후 리뷰 작성 +10P
-- sell_complete      : 판매 완료 +5P
-- good_review_received: 4점 이상 리뷰 받음 +10P
-- cad_answer         : 캐드스쿨 답변 작성 +3P
-- cad_best_answer    : 베스트 답변 채택 +10P

-- RLS 정책
ALTER TABLE reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE reputation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reputation_scores_select_all" ON reputation_scores FOR SELECT USING (true);
CREATE POLICY "reputation_scores_service_role" ON reputation_scores FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "reputation_events_select_own" ON reputation_events FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reputation_events_service_role" ON reputation_events FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 3. cad_subscriptions 테이블 수정: 패키지 전환
-- ============================================================

-- auto_renewal 컬럼 제거 (있는 경우)
ALTER TABLE cad_subscriptions DROP COLUMN IF EXISTS auto_renewal;

-- 만료 알림 발송 여부 컬럼 추가
ALTER TABLE cad_subscriptions ADD COLUMN IF NOT EXISTS is_expiry_notified boolean NOT NULL DEFAULT false;
