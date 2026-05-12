-- ============================================================
-- 캐드스쿨 구독 플랜 시스템 전환
-- ============================================================

-- 기존 횟수제 테이블 제거 (FK 순서: 자식 먼저)
DROP TABLE IF EXISTS cad_package_chats CASCADE;
DROP TABLE IF EXISTS cad_packages CASCADE;

-- ============================================================
-- cad_mentors 컬럼 추가
-- ============================================================
ALTER TABLE cad_mentors
  ADD COLUMN IF NOT EXISTS warning_count   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_rating      NUMERIC   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_ratings   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS response_rate   NUMERIC   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_suspended    BOOLEAN   NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ;

-- ============================================================
-- cad_subscriptions (구독 정보)
-- ============================================================
CREATE TABLE IF NOT EXISTS cad_subscriptions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscriber_id        UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  mentor_id            UUID        NOT NULL REFERENCES cad_mentors(id) ON DELETE CASCADE,
  plan_type            TEXT        NOT NULL,             -- basic / pro / master
  price                INTEGER     NOT NULL DEFAULT 0,   -- 19900 / 39900 / 79000
  status               TEXT        NOT NULL DEFAULT 'active', -- active / cancelled / expired
  mentor_change_count  INTEGER     NOT NULL DEFAULT 0,
  checklist_count      INTEGER     NOT NULL DEFAULT 0,
  review_count         INTEGER     NOT NULL DEFAULT 0,
  stl_upload_count     INTEGER     NOT NULL DEFAULT 0,
  started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at           TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- cad_subscription_chats (구독 채팅)
-- ============================================================
CREATE TABLE IF NOT EXISTS cad_subscription_chats (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID       NOT NULL REFERENCES cad_subscriptions(id) ON DELETE CASCADE,
  sender_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content        TEXT        NOT NULL DEFAULT '',
  files          JSONB       NOT NULL DEFAULT '[]',
  message_type   TEXT        NOT NULL DEFAULT 'question', -- question / answer / checklist / review
  is_answered    BOOLEAN     NOT NULL DEFAULT false,
  answered_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- cad_mentor_warnings (멘토 경고)
-- ============================================================
CREATE TABLE IF NOT EXISTS cad_mentor_warnings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id        UUID        NOT NULL REFERENCES cad_mentors(id) ON DELETE CASCADE,
  reason           TEXT        NOT NULL DEFAULT '',
  warning_type     TEXT        NOT NULL, -- late_response / low_rating / no_response
  reported_by      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  admin_confirmed  BOOLEAN     NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- cad_mentor_ratings (멘토 평점)
-- ============================================================
CREATE TABLE IF NOT EXISTS cad_mentor_ratings (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID        NOT NULL REFERENCES cad_subscriptions(id) ON DELETE CASCADE,
  mentor_id       UUID        NOT NULL REFERENCES cad_mentors(id) ON DELETE CASCADE,
  subscriber_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating          INTEGER     NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment         TEXT        NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RLS 활성화
-- ============================================================
ALTER TABLE cad_subscriptions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_subscription_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_mentor_warnings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE cad_mentor_ratings     ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- cad_subscriptions 정책
-- ============================================================
CREATE POLICY "cad_subs_select_participant" ON cad_subscriptions
  FOR SELECT TO authenticated
  USING (
    subscriber_id = auth.uid() OR
    mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
  );

CREATE POLICY "cad_subs_insert_subscriber" ON cad_subscriptions
  FOR INSERT TO authenticated WITH CHECK (subscriber_id = auth.uid());

CREATE POLICY "cad_subs_update_participant" ON cad_subscriptions
  FOR UPDATE TO authenticated
  USING (
    subscriber_id = auth.uid() OR
    mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
  );

-- ============================================================
-- cad_subscription_chats 정책
-- ============================================================
CREATE POLICY "cad_sub_chats_select_participant" ON cad_subscription_chats
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT id FROM cad_subscriptions
      WHERE subscriber_id = auth.uid()
         OR mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "cad_sub_chats_insert_participant" ON cad_subscription_chats
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid() AND
    subscription_id IN (
      SELECT id FROM cad_subscriptions
      WHERE subscriber_id = auth.uid()
         OR mentor_id IN (SELECT id FROM cad_mentors WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "cad_sub_chats_update_sender" ON cad_subscription_chats
  FOR UPDATE TO authenticated USING (sender_id = auth.uid());

-- ============================================================
-- cad_mentor_warnings 정책
-- ============================================================
CREATE POLICY "cad_warnings_select_authenticated" ON cad_mentor_warnings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cad_warnings_insert_authenticated" ON cad_mentor_warnings
  FOR INSERT TO authenticated WITH CHECK (reported_by = auth.uid());

-- ============================================================
-- cad_mentor_ratings 정책
-- ============================================================
CREATE POLICY "cad_ratings_select_all" ON cad_mentor_ratings
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "cad_ratings_insert_subscriber" ON cad_mentor_ratings
  FOR INSERT TO authenticated WITH CHECK (subscriber_id = auth.uid());
