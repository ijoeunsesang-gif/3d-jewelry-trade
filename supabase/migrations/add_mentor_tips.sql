-- ============================================================
-- 멘토 팁 게시판
-- ============================================================

CREATE TABLE IF NOT EXISTS cad_tips (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id      UUID        NOT NULL REFERENCES cad_mentors(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  content        TEXT        NOT NULL,
  images         JSONB       NOT NULL DEFAULT '[]',
  like_count     INTEGER     NOT NULL DEFAULT 0,
  bookmark_count INTEGER     NOT NULL DEFAULT 0,
  comment_count  INTEGER     NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cad_tips_mentor_id   ON cad_tips(mentor_id);
CREATE INDEX IF NOT EXISTS idx_cad_tips_created_at  ON cad_tips(created_at DESC);

-- 좋아요
CREATE TABLE IF NOT EXISTS cad_tip_likes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id     UUID        NOT NULL REFERENCES cad_tips(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cad_tip_likes_tip_id  ON cad_tip_likes(tip_id);
CREATE INDEX IF NOT EXISTS idx_cad_tip_likes_user_id ON cad_tip_likes(user_id);

-- 북마크
CREATE TABLE IF NOT EXISTS cad_tip_bookmarks (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id     UUID        NOT NULL REFERENCES cad_tips(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_cad_tip_bookmarks_tip_id  ON cad_tip_bookmarks(tip_id);
CREATE INDEX IF NOT EXISTS idx_cad_tip_bookmarks_user_id ON cad_tip_bookmarks(user_id);

-- 댓글 (이미지 첨부 가능)
CREATE TABLE IF NOT EXISTS cad_tip_comments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_id     UUID        NOT NULL REFERENCES cad_tips(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  image_url  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cad_tip_comments_tip_id ON cad_tip_comments(tip_id);

-- 포인트 설정 (관리자가 변경 가능)
CREATE TABLE IF NOT EXISTS cad_point_configs (
  key         TEXT        PRIMARY KEY,
  value       INTEGER     NOT NULL DEFAULT 0,
  description TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO cad_point_configs (key, value, description) VALUES
  ('tip_post_reward', 100, '멘토 팁 게시글 작성 포인트')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE cad_tips            ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_tip_likes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_tip_bookmarks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_tip_comments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_point_configs   ENABLE ROW LEVEL SECURITY;

-- cad_tips
CREATE POLICY "tips_select_all" ON cad_tips FOR SELECT USING (true);
CREATE POLICY "tips_insert_mentor" ON cad_tips FOR INSERT TO authenticated WITH CHECK (
  mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid() AND is_active = true)
);
CREATE POLICY "tips_update_mentor" ON cad_tips FOR UPDATE TO authenticated USING (
  mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
);
CREATE POLICY "tips_delete_mentor" ON cad_tips FOR DELETE TO authenticated USING (
  mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
);

-- cad_tip_likes
CREATE POLICY "tip_likes_select_all"  ON cad_tip_likes FOR SELECT USING (true);
CREATE POLICY "tip_likes_insert_own"  ON cad_tip_likes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tip_likes_delete_own"  ON cad_tip_likes FOR DELETE TO authenticated USING (user_id = auth.uid());

-- cad_tip_bookmarks
CREATE POLICY "tip_bookmarks_select_all" ON cad_tip_bookmarks FOR SELECT USING (true);
CREATE POLICY "tip_bookmarks_insert_own" ON cad_tip_bookmarks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tip_bookmarks_delete_own" ON cad_tip_bookmarks FOR DELETE TO authenticated USING (user_id = auth.uid());

-- cad_tip_comments
CREATE POLICY "tip_comments_select_all" ON cad_tip_comments FOR SELECT USING (true);
CREATE POLICY "tip_comments_insert_own" ON cad_tip_comments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "tip_comments_delete_own" ON cad_tip_comments FOR DELETE TO authenticated USING (
  user_id = auth.uid() OR
  tip_id IN (SELECT t.id FROM cad_tips t JOIN cad_mentors m ON t.mentor_id = m.id WHERE m.user_id = auth.uid())
);

-- cad_point_configs: 전체 읽기, service_role만 쓰기
CREATE POLICY "point_configs_select_all"    ON cad_point_configs FOR SELECT USING (true);
CREATE POLICY "point_configs_service_write" ON cad_point_configs FOR ALL USING (auth.role() = 'service_role');
