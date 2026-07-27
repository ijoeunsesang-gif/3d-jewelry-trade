-- 판매자/멘토 연락 수단 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS opentalk_url    TEXT,
  ADD COLUMN IF NOT EXISTS contact_phone   TEXT;
