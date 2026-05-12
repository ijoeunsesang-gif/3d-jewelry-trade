-- 멘토 프로필 상세 정보 컬럼 추가
ALTER TABLE cad_mentors
  ADD COLUMN IF NOT EXISTS career_start_year integer,
  ADD COLUMN IF NOT EXISTS programs jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS work_types jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS can_cpx boolean DEFAULT false;
