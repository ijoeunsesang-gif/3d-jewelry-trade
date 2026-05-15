-- ── 멘토 등급 시스템 추가 ──

-- 1. cad_mentors에 mentor_grade / completed_count 컬럼 추가
ALTER TABLE cad_mentors
  ADD COLUMN IF NOT EXISTS mentor_grade TEXT NOT NULL DEFAULT 'normal'
    CHECK (mentor_grade IN ('normal', 'certified', 'pro', 'master')),
  ADD COLUMN IF NOT EXISTS completed_count INTEGER NOT NULL DEFAULT 0;

-- 2. mentor_grade 인덱스
CREATE INDEX IF NOT EXISTS idx_cad_mentors_mentor_grade ON cad_mentors (mentor_grade);

-- 3. 등급 산출 순수 함수 (IMMUTABLE)
CREATE OR REPLACE FUNCTION compute_mentor_grade(p_completed INT, p_avg_rating NUMERIC)
RETURNS TEXT AS $$
BEGIN
  IF p_completed >= 100 AND p_avg_rating >= 4.8 THEN RETURN 'master';
  ELSIF p_completed >= 30  AND p_avg_rating >= 4.5 THEN RETURN 'pro';
  ELSIF p_completed >= 10  AND p_avg_rating >= 4.0 THEN RETURN 'certified';
  ELSE RETURN 'normal';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. 특정 멘토 등급 갱신 RPC
--    완료 건수 = 완료된 cad_subscriptions + cad_mentoring_sessions
--    (cad_posts는 mentor_id 컬럼이 없어 집계에서 제외)
DROP FUNCTION IF EXISTS update_mentor_grade(UUID);
CREATE OR REPLACE FUNCTION update_mentor_grade(p_mentor_id UUID)
RETURNS JSON AS $$
DECLARE
  v_avg_rating    NUMERIC;
  v_completed_sub INT;
  v_completed_ses INT;
  v_completed     INT;
  v_new_grade     TEXT;
  v_old_grade     TEXT;
BEGIN
  SELECT avg_rating, mentor_grade
    INTO v_avg_rating, v_old_grade
    FROM cad_mentors
   WHERE id = p_mentor_id;

  IF NOT FOUND THEN
    RETURN json_build_object('ok', false, 'error', 'mentor not found');
  END IF;

  -- 수강패키지 완료 건수
  SELECT COALESCE(COUNT(*), 0)
    INTO v_completed_sub
    FROM cad_subscriptions
   WHERE mentor_id = p_mentor_id
     AND status = 'completed';

  -- 건별 멘토링 완료 건수 (유료 피드백 포함)
  SELECT COALESCE(COUNT(*), 0)
    INTO v_completed_ses
    FROM cad_mentoring_sessions
   WHERE mentor_id = p_mentor_id
     AND status = 'completed';

  v_completed := v_completed_sub + v_completed_ses;
  v_new_grade := compute_mentor_grade(v_completed, COALESCE(v_avg_rating, 0));

  UPDATE cad_mentors
     SET mentor_grade    = v_new_grade,
         completed_count = v_completed
   WHERE id = p_mentor_id;

  RETURN json_build_object(
    'ok',            true,
    'mentor_id',     p_mentor_id,
    'old_grade',     v_old_grade,
    'new_grade',     v_new_grade,
    'completed',     v_completed,
    'avg_rating',    v_avg_rating
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. 모든 활성 멘토 등급 일괄 갱신 RPC (관리자용)
CREATE OR REPLACE FUNCTION update_all_mentor_grades()
RETURNS JSON AS $$
DECLARE
  rec       RECORD;
  v_updated INT := 0;
BEGIN
  FOR rec IN SELECT id FROM cad_mentors WHERE is_active = true LOOP
    PERFORM update_mentor_grade(rec.id);
    v_updated := v_updated + 1;
  END LOOP;
  RETURN json_build_object('ok', true, 'updated', v_updated);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
