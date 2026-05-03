-- profiles 탈퇴 소프트 삭제 컬럼 추가
-- Supabase Dashboard > SQL Editor 에서 실행
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 기존 고아 프로필 정리 (auth.users에 대응 레코드 없는 profiles 삭제)
DELETE FROM public.profiles
WHERE id NOT IN (SELECT id FROM auth.users);
