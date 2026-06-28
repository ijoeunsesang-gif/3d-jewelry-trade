-- partner_requests: 업체등록요청 테이블
CREATE TABLE IF NOT EXISTS partner_requests (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email    text        NOT NULL,
  category      text        NOT NULL,
  name          text        NOT NULL,
  contact       text        NOT NULL,
  address       text        NOT NULL,
  description   text        NOT NULL,
  status        text        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  processed_at  timestamptz
);

-- 인덱스
CREATE INDEX idx_partner_requests_user_id ON partner_requests(user_id);
CREATE INDEX idx_partner_requests_status  ON partner_requests(status);

-- RLS 활성화
ALTER TABLE partner_requests ENABLE ROW LEVEL SECURITY;

-- 본인 데이터 INSERT
CREATE POLICY "users can insert own partner requests"
  ON partner_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- 본인 데이터 SELECT
CREATE POLICY "users can select own partner requests"
  ON partner_requests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 관리자 전체 SELECT (본인 포함)
CREATE POLICY "admins can select all partner requests"
  ON partner_requests FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 관리자 UPDATE
CREATE POLICY "admins can update partner requests"
  ON partner_requests FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
