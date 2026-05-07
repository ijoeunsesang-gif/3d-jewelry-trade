-- 모델 신고 테이블
CREATE TABLE IF NOT EXISTS model_reports (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id    UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  reporter_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason      TEXT        NOT NULL,
  detail      TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (model_id, reporter_id)
);

COMMENT ON TABLE model_reports IS '모델 신고 — 같은 모델을 한 유저가 중복 신고 불가';

-- RLS
ALTER TABLE model_reports ENABLE ROW LEVEL SECURITY;

-- 로그인 유저 신고 등록
CREATE POLICY "model_reports_insert_auth"
  ON model_reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

-- 관리자 전체 조회
CREATE POLICY "model_reports_select_admin"
  ON model_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 관리자 상태 업데이트
CREATE POLICY "model_reports_update_admin"
  ON model_reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 본인 신고 여부 확인 (중복 방지용 조회)
CREATE POLICY "model_reports_select_own"
  ON model_reports FOR SELECT
  USING (reporter_id = auth.uid());
