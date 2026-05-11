-- 다운로드 수 원자적 증가 함수 (SECURITY DEFINER로 RLS 우회)
-- /api/download 라우트에서 호출됨

-- download_count 컬럼이 없으면 추가
ALTER TABLE models ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

CREATE OR REPLACE FUNCTION increment_model_download(mid UUID)
RETURNS void AS $$
  UPDATE models SET download_count = COALESCE(download_count, 0) + 1 WHERE id = mid;
$$ LANGUAGE SQL SECURITY DEFINER;
