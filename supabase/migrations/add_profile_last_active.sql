-- 자동로그인(세션 복원) 시에도 마지막 접속 시간이 갱신되도록 profiles에 자체 트래킹 컬럼 추가
-- (auth.users.last_sign_in_at은 실제 로그인 그랜트 때만 갱신되고, 세션 복원/리프레시 때는 갱신되지 않음)

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;

-- 하루 1회만 갱신되는 함수 (SECURITY DEFINER로 RLS 우회, 불필요한 UPDATE 방지)
CREATE OR REPLACE FUNCTION touch_last_active(uid UUID)
RETURNS void AS $$
  UPDATE profiles
  SET last_active_at = NOW()
  WHERE id = uid
    AND (last_active_at IS NULL OR last_active_at < CURRENT_DATE);
$$ LANGUAGE SQL SECURITY DEFINER;
