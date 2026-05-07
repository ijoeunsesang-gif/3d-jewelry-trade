-- 모델 조회수 + 댓글 기능 마이그레이션

-- 1. models 테이블에 view_count 컬럼 추가
ALTER TABLE models ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0;

-- 2. 조회수 원자적 증가 함수 (SECURITY DEFINER로 RLS 우회)
CREATE OR REPLACE FUNCTION increment_model_view(mid UUID)
RETURNS void AS $$
  UPDATE models SET view_count = COALESCE(view_count, 0) + 1 WHERE id = mid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- 3. model_comments 테이블
CREATE TABLE IF NOT EXISTS model_comments (
  id          UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id    UUID         NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  parent_id   UUID         REFERENCES model_comments(id) ON DELETE CASCADE,
  content     TEXT         NOT NULL,
  likes       INTEGER      DEFAULT 0,
  created_at  TIMESTAMPTZ  DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  DEFAULT NOW()
);

-- 4. model_comment_likes 테이블
CREATE TABLE IF NOT EXISTS model_comment_likes (
  id          UUID  DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id  UUID  NOT NULL REFERENCES model_comments(id) ON DELETE CASCADE,
  user_id     UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(comment_id, user_id)
);

-- 5. 인덱스
CREATE INDEX IF NOT EXISTS model_comments_model_id_idx     ON model_comments(model_id);
CREATE INDEX IF NOT EXISTS model_comments_parent_id_idx    ON model_comments(parent_id);
CREATE INDEX IF NOT EXISTS model_comments_created_at_idx   ON model_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS model_comment_likes_comment_idx ON model_comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS model_comment_likes_user_idx    ON model_comment_likes(user_id);

-- 6. RLS 활성화
ALTER TABLE model_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_comment_likes ENABLE ROW LEVEL SECURITY;

-- 7. model_comments RLS 정책
CREATE POLICY "model_comments_select" ON model_comments
  FOR SELECT USING (true);

CREATE POLICY "model_comments_insert" ON model_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "model_comments_update" ON model_comments
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "model_comments_delete" ON model_comments
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 8. model_comment_likes RLS 정책
CREATE POLICY "model_comment_likes_select" ON model_comment_likes
  FOR SELECT USING (true);

CREATE POLICY "model_comment_likes_insert" ON model_comment_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "model_comment_likes_delete" ON model_comment_likes
  FOR DELETE USING (auth.uid() = user_id);

-- 9. 댓글 좋아요 원자적 증가/감소 함수
CREATE OR REPLACE FUNCTION increment_comment_likes(cid UUID)
RETURNS void AS $$
  UPDATE model_comments SET likes = COALESCE(likes, 0) + 1 WHERE id = cid;
$$ LANGUAGE SQL SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrement_comment_likes(cid UUID)
RETURNS void AS $$
  UPDATE model_comments SET likes = GREATEST(COALESCE(likes, 0) - 1, 0) WHERE id = cid;
$$ LANGUAGE SQL SECURITY DEFINER;
