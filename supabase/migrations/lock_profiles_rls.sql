-- ============================================================
-- profiles 본체 RLS 강화 (보안 강화 2/2단계)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- ⚠️⚠️⚠️ 지금 바로 실행하지 말 것 ⚠️⚠️⚠️
-- 이 마이그레이션은 profiles를 "본인 + 관리자만 SELECT"로 잠근다.
-- 코드베이스 전수 점검 결과, cad_mentors/cad_posts/cad_tips/ask_posts/
-- job_posts/model_comments/commission_comments 등 30곳 이상이
-- `profiles(nickname, avatar_url, grade, ...)` 형태로 PostgREST FK 임베딩을
-- 통해 "글쓴이 정보"를 표시하고 있다. PostgREST 임베딩은 임베드된(조인된)
-- profiles 행에도 그대로 RLS를 적용하기 때문에, 이 마이그레이션을 실행하면
-- "본인 글이 아닌 모든 글"의 작성자 닉네임/아바타/등급이 조회 시점에 null로
-- 빠져 화면 전체에서 "작성자 정보 없음" 현상이 발생한다.
-- (자세한 목록은 대화 내 "작업 5: 전수 점검" 결과 참고)
--
-- 이 임베딩 지점들을 profiles_public 경유로 전환(또는 다른 방식으로 해결)
-- 하기 전까지는 절대 실행하지 말 것.
-- ============================================================

-- 1. profiles에 걸려 있는 기존 정책을 이름과 무관하게 전부 제거한다.
--    (원본 "전체 공개(USING true)" 정책이 대시보드에서 만들어져 마이그레이션
--     파일만으로는 정확한 이름을 알 수 없어, pg_policies를 조회해 전부 제거한다.)
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

-- 3. 관리자 전체 조회/등록/수정/삭제 (set_admin_role.sql의 admin_all_profiles 재생성 —
--    ask 신고 처리(is_point_blocked), 사업자 인증취소 등 관리자 화면이 이 정책에 의존한다)
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

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
