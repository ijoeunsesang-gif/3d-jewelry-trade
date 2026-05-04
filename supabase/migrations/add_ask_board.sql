-- 물어보기 게시판 테이블

CREATE TABLE IF NOT EXISTS ask_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  is_solved BOOLEAN DEFAULT false,
  accepted_answer_id UUID,
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ask_answers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID NOT NULL REFERENCES ask_posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  images TEXT[] DEFAULT '{}',
  likes INTEGER DEFAULT 0,
  is_accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ask_answer_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  answer_id UUID NOT NULL REFERENCES ask_answers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  UNIQUE(answer_id, user_id)
);

CREATE TABLE IF NOT EXISTS points (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- 포인트 원자적 증가 함수
CREATE OR REPLACE FUNCTION increment_profile_points(uid UUID, delta INTEGER)
RETURNS void AS $$
  UPDATE profiles SET points = COALESCE(points, 0) + delta WHERE id = uid;
$$ LANGUAGE SQL SECURITY DEFINER;

-- 조회수 원자적 증가 함수
CREATE OR REPLACE FUNCTION increment_ask_view(post_id UUID)
RETURNS void AS $$
  UPDATE ask_posts SET view_count = view_count + 1 WHERE id = post_id;
$$ LANGUAGE SQL SECURITY DEFINER;

-- 인덱스
CREATE INDEX IF NOT EXISTS ask_posts_user_id_idx     ON ask_posts(user_id);
CREATE INDEX IF NOT EXISTS ask_posts_created_at_idx  ON ask_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS ask_answers_post_id_idx   ON ask_answers(post_id);
CREATE INDEX IF NOT EXISTS ask_answer_likes_ans_idx  ON ask_answer_likes(answer_id);
CREATE INDEX IF NOT EXISTS points_user_id_idx        ON points(user_id);
