CREATE TABLE IF NOT EXISTS job_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  is_recruiting BOOLEAN   NOT NULL,
  contact     TEXT,
  is_closed   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE job_posts ENABLE ROW LEVEL SECURITY;

-- 전체 공개 조회
CREATE POLICY "anyone can read job_posts"
  ON job_posts FOR SELECT
  USING (true);

-- 로그인 유저 등록 (본인 user_id만)
CREATE POLICY "authenticated can insert job_posts"
  ON job_posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 본인 또는 관리자 수정
CREATE POLICY "owner or admin can update job_posts"
  ON job_posts FOR UPDATE
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 본인 또는 관리자 삭제
CREATE POLICY "owner or admin can delete job_posts"
  ON job_posts FOR DELETE
  USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE INDEX IF NOT EXISTS job_posts_user_id_idx       ON job_posts(user_id);
CREATE INDEX IF NOT EXISTS job_posts_is_recruiting_idx ON job_posts(is_recruiting);
CREATE INDEX IF NOT EXISTS job_posts_created_at_idx    ON job_posts(created_at DESC);
