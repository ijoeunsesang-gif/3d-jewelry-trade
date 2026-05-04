-- ask_reports 테이블
CREATE TABLE IF NOT EXISTS ask_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID NOT NULL REFERENCES ask_answers(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (answer_id, reporter_id)
);

-- profiles에 is_point_blocked 컬럼 추가
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_point_blocked BOOLEAN NOT NULL DEFAULT false;

-- ask_answers에 report_count 캐시 컬럼 추가 (매번 COUNT 조회 방지)
ALTER TABLE ask_answers ADD COLUMN IF NOT EXISTS report_count INTEGER NOT NULL DEFAULT 0;

-- 신고 등록 시 report_count 자동 증가 트리거
CREATE OR REPLACE FUNCTION increment_answer_report_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE ask_answers SET report_count = report_count + 1 WHERE id = NEW.answer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_report_count ON ask_reports;
CREATE TRIGGER trg_increment_report_count
  AFTER INSERT ON ask_reports
  FOR EACH ROW EXECUTE FUNCTION increment_answer_report_count();

-- 오늘 물어보기 포인트 합산 함수 (악용 방지용 일일 한도 확인)
CREATE OR REPLACE FUNCTION get_today_ask_points(uid UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(SUM(amount), 0)::INTEGER
  FROM points
  WHERE user_id = uid
    AND reason IN ('답변 등록', '답변 좋아요', '답변 채택')
    AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Asia/Seoul') AT TIME ZONE 'Asia/Seoul';
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- RLS 정책

ALTER TABLE ask_reports ENABLE ROW LEVEL SECURITY;

-- 본인 신고 내역 조회
CREATE POLICY "reporter can read own reports"
  ON ask_reports FOR SELECT
  USING (reporter_id = auth.uid());

-- 관리자 전체 조회
CREATE POLICY "admin can read all reports"
  ON ask_reports FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 신고 등록 (로그인 사용자만, 중복 불가는 UNIQUE 제약으로 처리)
CREATE POLICY "authenticated can insert report"
  ON ask_reports FOR INSERT
  WITH CHECK (reporter_id = auth.uid());

-- report_count 는 트리거가 서비스롤로 업데이트하므로 직접 수정 정책 불필요

-- is_point_blocked 업데이트는 관리자만
CREATE POLICY "admin can update is_point_blocked"
  ON profiles FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
