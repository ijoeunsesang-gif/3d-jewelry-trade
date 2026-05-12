-- ============================================================
-- 캐드스쿨 테이블
-- ============================================================

-- 자유 피드백 게시판
CREATE TABLE IF NOT EXISTS cad_posts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  content     TEXT        NOT NULL,
  files       JSONB       NOT NULL DEFAULT '[]',
  point_cost  INTEGER     NOT NULL DEFAULT 100,
  status      TEXT        NOT NULL DEFAULT 'open',  -- open / closed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 자유 피드백 답변
CREATE TABLE IF NOT EXISTS cad_post_comments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id       UUID        NOT NULL REFERENCES cad_posts(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL,
  files         JSONB       NOT NULL DEFAULT '[]',
  is_best_answer BOOLEAN    NOT NULL DEFAULT false,
  point_reward  INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 멘토 등록
CREATE TABLE IF NOT EXISTS cad_mentors (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  intro             TEXT        NOT NULL DEFAULT '',
  per_session_price INTEGER     NOT NULL DEFAULT 0,
  package_5_price   INTEGER     NOT NULL DEFAULT 0,
  package_10_price  INTEGER     NOT NULL DEFAULT 0,
  daily_limit       INTEGER     NOT NULL DEFAULT 2,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 건별 멘토링 세션
CREATE TABLE IF NOT EXISTS cad_mentoring_sessions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id    UUID        NOT NULL REFERENCES cad_mentors(id) ON DELETE CASCADE,
  mentee_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  description  TEXT        NOT NULL DEFAULT '',
  files        JSONB       NOT NULL DEFAULT '[]',
  price        INTEGER     NOT NULL DEFAULT 0,
  status       TEXT        NOT NULL DEFAULT 'pending', -- pending / accepted / completed / cancelled
  result_files JSONB       NOT NULL DEFAULT '[]',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 횟수제 패키지
CREATE TABLE IF NOT EXISTS cad_packages (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id       UUID        NOT NULL REFERENCES cad_mentors(id) ON DELETE CASCADE,
  mentee_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  package_type    TEXT        NOT NULL,  -- '5회' / '10회'
  total_count     INTEGER     NOT NULL,
  remaining_count INTEGER     NOT NULL,
  price           INTEGER     NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ,           -- 구매 후 3개월
  status          TEXT        NOT NULL DEFAULT 'active', -- active / exhausted / expired
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 패키지 채팅
CREATE TABLE IF NOT EXISTS cad_package_chats (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id         UUID        NOT NULL REFERENCES cad_packages(id) ON DELETE CASCADE,
  sender_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content            TEXT        NOT NULL DEFAULT '',
  files              JSONB       NOT NULL DEFAULT '[]',
  is_answer_complete BOOLEAN     NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE cad_posts             ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_post_comments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_mentors           ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_mentoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_packages          ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_package_chats     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- cad_posts 정책
-- ============================================================
CREATE POLICY "cad_posts_select_all" ON cad_posts
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cad_posts_insert_own" ON cad_posts
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "cad_posts_update_own" ON cad_posts
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cad_posts_delete_own" ON cad_posts
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- cad_post_comments 정책
-- ============================================================
CREATE POLICY "cad_comments_select_all" ON cad_post_comments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cad_comments_insert_own" ON cad_post_comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "cad_comments_update_own" ON cad_post_comments
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "cad_comments_delete_own" ON cad_post_comments
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- cad_mentors 정책
-- ============================================================
CREATE POLICY "cad_mentors_select_all" ON cad_mentors
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cad_mentors_insert_own" ON cad_mentors
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "cad_mentors_update_own" ON cad_mentors
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- ============================================================
-- cad_mentoring_sessions 정책 (멘토 또는 멘티만 조회)
-- ============================================================
CREATE POLICY "cad_sessions_select_participant" ON cad_mentoring_sessions
  FOR SELECT TO authenticated
  USING (
    mentee_id = auth.uid() OR
    mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
  );

CREATE POLICY "cad_sessions_insert_mentee" ON cad_mentoring_sessions
  FOR INSERT TO authenticated WITH CHECK (mentee_id = auth.uid());

CREATE POLICY "cad_sessions_update_participant" ON cad_mentoring_sessions
  FOR UPDATE TO authenticated
  USING (
    mentee_id = auth.uid() OR
    mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
  );

-- ============================================================
-- cad_packages 정책 (멘토 또는 멘티만 조회)
-- ============================================================
CREATE POLICY "cad_packages_select_participant" ON cad_packages
  FOR SELECT TO authenticated
  USING (
    mentee_id = auth.uid() OR
    mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
  );

CREATE POLICY "cad_packages_insert_mentee" ON cad_packages
  FOR INSERT TO authenticated WITH CHECK (mentee_id = auth.uid());

CREATE POLICY "cad_packages_update_participant" ON cad_packages
  FOR UPDATE TO authenticated
  USING (
    mentee_id = auth.uid() OR
    mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
  );

-- ============================================================
-- cad_package_chats 정책 (패키지 참여자만)
-- ============================================================
CREATE POLICY "cad_pkg_chats_select_participant" ON cad_package_chats
  FOR SELECT TO authenticated
  USING (
    package_id IN (
      SELECT id FROM cad_packages
      WHERE mentee_id = auth.uid()
         OR mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "cad_pkg_chats_insert_participant" ON cad_package_chats
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    package_id IN (
      SELECT id FROM cad_packages
      WHERE mentee_id = auth.uid()
         OR mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "cad_pkg_chats_update_sender" ON cad_package_chats
  FOR UPDATE TO authenticated USING (sender_id = auth.uid());
