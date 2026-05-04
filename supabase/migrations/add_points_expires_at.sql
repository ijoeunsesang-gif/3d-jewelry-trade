-- points 테이블에 유효기간 컬럼 추가
ALTER TABLE points ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ask_posts의 addPoints 헬퍼가 NULL expires_at로 이미 저장하므로,
-- Q&A 포인트(답변/채택/좋아요)는 expires_at = NULL → 영구,
-- 구매 적립 포인트는 expires_at = NOW() + 1 YEAR 으로 구분.

-- 유효 포인트 합계 조회 함수 (만료 제외)
CREATE OR REPLACE FUNCTION get_effective_points(uid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM points
  WHERE user_id = uid
    AND (expires_at IS NULL OR expires_at > NOW());
$$ LANGUAGE SQL SECURITY DEFINER STABLE;
