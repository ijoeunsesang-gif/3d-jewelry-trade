-- ============================================================
-- lock_profiles_rls.sql 긴급 롤백용 스크립트
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- lock_profiles_rls.sql 적용 후 문제가 생겼을 때만 사용한다.
-- 이 스크립트는 profiles를 "전체 공개 SELECT"로 임시 되돌린다 —
-- add_profiles_public_view.sql로 옮기기 전의 원래 취약한 상태와 동일하다.
-- 문제를 진단/재수정하는 동안만 임시로 쓰고, 다시 lock_profiles_rls.sql을
-- (수정 후) 적용해서 원상 복구할 것.
-- ============================================================

-- 1. lock_profiles_rls.sql이 만든 정책을 전부 제거한다.
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

-- 2. is_admin() 함수도 원한다면 제거 (남겨둬도 무해하지만, 완전히 되돌리려면 제거)
-- DROP FUNCTION IF EXISTS public.is_admin(uuid);

-- 3. 임시 전체 공개 정책 복구 (⚠️ 원래 취약점 상태로 돌아감 — 임시용으로만 사용)
CREATE POLICY "profiles_select_all_TEMP_ROLLBACK" ON public.profiles
  FOR SELECT TO authenticated, anon
  USING (true);

-- 4. 본인 등록/수정은 계속 본인만 가능하도록 유지 (이 두 정책은 문제와 무관하므로
--    롤백 시에도 유지해도 안전하다 — 원하면 이 부분도 함께 남겨둔다)
CREATE POLICY "profiles_insert_own_TEMP" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own_TEMP" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 문제를 해결한 뒤에는 반드시 아래 순서로 다시 잠글 것:
--   1) 이 스크립트가 만든 정책 제거:
--        DROP POLICY IF EXISTS "profiles_select_all_TEMP_ROLLBACK" ON public.profiles;
--        DROP POLICY IF EXISTS "profiles_insert_own_TEMP" ON public.profiles;
--        DROP POLICY IF EXISTS "profiles_update_own_TEMP" ON public.profiles;
--   2) supabase/migrations/lock_profiles_rls.sql 재실행
-- ============================================================
