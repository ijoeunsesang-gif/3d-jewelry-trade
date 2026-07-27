-- ============================================================
-- profiles 본체 RLS 강화 (보안 강화 2/2단계)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- ⚠️ 실행 전제조건 ⚠️
-- add_profiles_public_view.sql이 이미 반영되어 있어야 하고,
-- profiles(nickname, ...) FK 임베딩을 쓰던 클라이언트 코드가 전부
-- profiles_public/getProfilesMap 경유로 리팩터링된 상태여야 한다.
-- (완료됨 — 2026-07-27 배포)
--
-- ⚠️ 1차 시도 실패 이력 (이번 수정으로 해결) ⚠️
-- 최초 버전은 admin_all_profiles 정책의 USING/WITH CHECK 절이
--   EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
-- 형태로 "profiles 위에 걸린 정책이 profiles를 다시 서브쿼리로 조회"하는
-- 자기참조 구조였다. 이전에는 profiles에 USING(true)(전체공개) 정책이 같이 있어서
-- 플래너가 OR 전체를 상수 TRUE로 접어버려 문제가 드러나지 않았지만, 그 공개 정책을
-- 없애고 나니(=본 마이그레이션의 목적) admin_all_profiles의 서브쿼리를 실제로
-- 펼쳐야 했고, 그 순간 "infinite recursion detected in policy for relation profiles"
-- 에러가 발생해 본인 조회/관리자 조회가 전부 실패했다(실행 후 원복 이력 있음).
-- 이번 버전은 admin 판별을 SECURITY DEFINER 함수(is_admin)로 분리해서
-- 이 자기참조를 없앤다 — 다른 테이블(sale_records 등)의 admin 정책은
-- 서브쿼리 대상(profiles)이 정책이 걸린 테이블 자신이 아니라서
-- 애초에 이 문제가 없었으므로 그대로 둔다(변경 없음).
-- ============================================================

-- 0. admin 판별 헬퍼 함수 (SECURITY DEFINER로 profiles RLS를 우회해서 조회한다.
--    이 함수 내부의 SELECT는 profiles의 RLS 정책 평가를 다시 트리거하지 않으므로
--    admin_all_profiles 정책이 이 함수를 호출해도 자기참조 재귀가 발생하지 않는다.)
CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = uid AND role = 'admin'
  );
$$;

-- authenticated 롤이 정책 평가 중 이 함수를 호출할 수 있어야 한다.
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- 1. profiles에 걸려 있는 기존 정책을 이름과 무관하게 전부 제거한다.
--    (원본 "전체 공개(USING true)" 정책이 대시보드에서 만들어져 마이그레이션
--     파일만으로는 정확한 이름을 알 수 없어, pg_policies를 조회해 전부 제거한다.
--     이전에 문제를 겪고 원복했다면 그때 남은 정책까지 함께 정리된다.)
DO $$
DECLARE
  pol RECORD;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

-- 2. 본인 조회
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

-- 3. 관리자 전체 조회/등록/수정/삭제 — is_admin() 함수로 자기참조 없이 판별
--    (ask 신고 처리(is_point_blocked), 사업자 인증취소 등 관리자 화면이 이 정책에 의존한다)
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

-- 4. 본인 등록(최초 가입 시 upsert)
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- 5. 본인 수정
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- anon은 이제 profiles 원본 테이블에 매치되는 정책이 하나도 없어 완전히 차단된다.
-- 공개 정보(닉네임/아바타/등급/연락처 등)는 profiles_public 뷰로만 제공한다.
