-- user_downloads: 유저별 모델 다운로드 최초 이력 관리
-- user_id + model_id UNIQUE → 최초 1회만 download_count 증가 보장

CREATE TABLE IF NOT EXISTS user_downloads (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  model_id   UUID NOT NULL REFERENCES models(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_model_download UNIQUE (user_id, model_id)
);

ALTER TABLE user_downloads ENABLE ROW LEVEL SECURITY;

-- 본인 다운로드 이력만 조회 가능
CREATE POLICY "user_downloads_select_own" ON user_downloads
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 서비스 롤(서버)만 INSERT (클라이언트 직접 삽입 차단)
-- INSERT는 /api/download 서버 라우트에서 adminSupabase로 처리
