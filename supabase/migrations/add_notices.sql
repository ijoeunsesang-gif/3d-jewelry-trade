-- 공지사항 테이블
CREATE TABLE IF NOT EXISTS notices (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title      TEXT        NOT NULL,
  content    TEXT        NOT NULL,
  is_pinned  BOOLEAN     DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notices IS '공지사항 — is_pinned=true 항목이 상단 고정';

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION set_notices_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER notices_updated_at
  BEFORE UPDATE ON notices
  FOR EACH ROW EXECUTE FUNCTION set_notices_updated_at();

-- RLS
ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- 전체 공개 조회
CREATE POLICY "notices_select_all"
  ON notices FOR SELECT
  USING (true);

-- 관리자만 등록/수정/삭제
CREATE POLICY "notices_insert_admin"
  ON notices FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "notices_update_admin"
  ON notices FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "notices_delete_admin"
  ON notices FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
