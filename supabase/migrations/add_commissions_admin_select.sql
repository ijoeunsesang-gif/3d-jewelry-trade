-- ============================================================
-- commissions 관리자 SELECT 정책 추가 (정산관리 의뢰 누락 근본 원인)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 진단: app/admin/settlement/page.tsx는 service_role API가 아니라
-- 클라이언트(supabase-browser, 로그인 사용자 JWT)로 commissions를 직접
-- 조회한다. 기존 "조회 권한" SELECT 정책(작성자 본인 / target_seller_id
-- 본인 / is_private=false 공개 의뢰)에는 관리자 조건이 없어서, 비공개
-- 개인 의뢰(is_private=true, target_seller_id 지정)는 그 의뢰의 당사자가
-- 아닌 관리자에게는 행 자체가 보이지 않아 정산관리에서 누락됐다.
--
-- set_admin_role.sql의 "admin_all_commissions" 정책(FOR ALL)이 이미 있지만
-- 그 정책은 EXISTS(SELECT 1 FROM profiles p WHERE p.id=auth.uid() AND
-- p.role='admin') 형태의 자기참조 서브쿼리다. profiles 테이블 자체가 아니라
-- commissions 위에 걸린 정책이라 재귀 문제는 없지만, 이미 profiles RLS
-- 잠금(lock_profiles_rls.sql) 작업에서 admin 판별을 SECURITY DEFINER
-- 함수 is_admin()으로 통일했으므로 동일한 방식으로 맞춘다.
-- 기존 admin_all_commissions은 그대로 두고(변경 없음), is_admin() 기반
-- SELECT 전용 정책을 추가로 얹어 OR로 합산되게 한다.
-- ============================================================

DROP POLICY IF EXISTS "commissions_admin_select" ON public.commissions;
CREATE POLICY "commissions_admin_select" ON public.commissions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
