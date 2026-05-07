-- 금지어(banned_words) 테이블 추가
-- 저작권·상표권 위반 위험 단어 관리용

CREATE TABLE IF NOT EXISTS banned_words (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  word       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS 활성화
ALTER TABLE banned_words ENABLE ROW LEVEL SECURITY;

-- 전체 공개 읽기 (업로드 페이지 클라이언트에서도 조회 필요)
CREATE POLICY "banned_words_select" ON banned_words
  FOR SELECT USING (true);

-- 쓰기는 서비스 롤(service role)에서만 수행 (API 라우트에서 처리)

-- 기본 금지어 시드 데이터
INSERT INTO banned_words (word) VALUES
  ('replica'),
  ('cartier style'),
  ('cartier'),
  ('tiffany'),
  ('van cleef'),
  ('chrome hearts'),
  ('louis vuitton'),
  ('gucci'),
  ('chanel'),
  ('dior'),
  ('hermes'),
  ('bvlgari'),
  ('bulgari'),
  ('inspired by'),
  ('1:1'),
  ('fake'),
  ('copy'),
  ('까르띠에'),
  ('구찌'),
  ('루이비통'),
  ('샤넬'),
  ('디올'),
  ('에르메스'),
  ('불가리'),
  ('반클리프'),
  ('크롬하츠'),
  ('티파니'),
  ('레플리카'),
  ('짝퉁'),
  ('카피'),
  ('복제')
ON CONFLICT (word) DO NOTHING;
