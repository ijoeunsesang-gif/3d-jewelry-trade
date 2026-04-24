-- 판매자 정산 정보 컬럼 추가
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bank_name        TEXT,
  ADD COLUMN IF NOT EXISTS account_holder   TEXT,
  ADD COLUMN IF NOT EXISTS account_number   TEXT,
  ADD COLUMN IF NOT EXISTS business_number  TEXT,
  ADD COLUMN IF NOT EXISTS business_name    TEXT;
