-- ask_posts RLS 활성화 (미설정 시)
ALTER TABLE ask_posts ENABLE ROW LEVEL SECURITY;

-- 본인 게시물 삭제 정책
CREATE POLICY "delete_own_ask_post"
  ON ask_posts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
