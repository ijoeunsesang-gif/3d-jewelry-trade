-- 모델 조회수 중복 카운트 방지 (로그인 유저 하루 1회 제한)

-- 1. 조회 로그 테이블
CREATE TABLE IF NOT EXISTS model_view_logs (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id     UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, model_id, viewed_date)
);

CREATE INDEX IF NOT EXISTS model_view_logs_model_id_idx ON model_view_logs(model_id);
CREATE INDEX IF NOT EXISTS model_view_logs_user_id_idx  ON model_view_logs(user_id);

ALTER TABLE model_view_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "model_view_logs_select" ON model_view_logs
  FOR SELECT USING (auth.uid() = user_id);

-- 2. 조회수 증가 함수 재정의: 로그인 유저(uid)는 하루 1회만 증가, 비로그인(uid=NULL)은 호출될 때마다 증가
--    (비로그인 유저의 하루 1회 제한은 클라이언트 localStorage에서 처리)
DROP FUNCTION IF EXISTS increment_model_view(UUID);

CREATE OR REPLACE FUNCTION increment_model_view(mid UUID, uid UUID DEFAULT NULL)
RETURNS boolean AS $$
DECLARE
  did_increment BOOLEAN := TRUE;
BEGIN
  IF uid IS NOT NULL THEN
    INSERT INTO model_view_logs (model_id, user_id, viewed_date)
    VALUES (mid, uid, CURRENT_DATE)
    ON CONFLICT (user_id, model_id, viewed_date) DO NOTHING;

    did_increment := FOUND;
  END IF;

  IF did_increment THEN
    UPDATE models SET view_count = COALESCE(view_count, 0) + 1 WHERE id = mid;
  END IF;

  RETURN did_increment;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
