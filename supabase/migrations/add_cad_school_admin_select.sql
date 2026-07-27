-- ============================================================
-- 캐드스쿨 결제 3개 테이블 관리자 SELECT 정책 추가
-- (정산관리 캐드스쿨 3개 탭 누락 근본 원인)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 진단: app/admin/settlement/page.tsx가 cad_subscriptions/cad_mentoring_sessions/
-- cad_addon_purchases를 service_role API가 아니라 클라이언트(supabase-browser,
-- 로그인 관리자 JWT)로 직접 조회한다. 그런데 세 테이블 모두 set_admin_role.sql
-- 작업 당시 admin 정책 대상에서 빠진 채로 만들어져, 기존 SELECT 정책이
-- "본인(구독자/구매자)" 또는 "당사자 멘토"로만 한정되어 있다 — 관리자는 그
-- row의 당사자가 아닌 이상 결과가 항상 0건이었다. commissions에서 고친 것과
-- 동일한 원인이라 동일한 패턴(is_admin() SECURITY DEFINER 함수 재사용, 자기참조
-- 재귀 없음)으로 admin 전용 SELECT 정책만 추가한다. 기존 본인/멘토 조회 정책은
-- 그대로 두고 OR로 합산되게 한다.
--
-- 월별 집계 필터(created_at)는 손대지 않는다 — 세 테이블 모두 Toss 결제 승인이
-- 성공한 그 자리에서 서버가 INSERT하는 구조라 created_at이 곧 결제 시각이며,
-- commissions처럼 "생성일과 결제일이 다른" 문제가 구조적으로 없다.
--
-- 범위 제한: 이번엔 관리자 조회만 추가한다. cad_addon_purchases의 멘토 본인
-- 조회(현재 정책은 구매자 본인만 허용해 멘토조차 자기 addon 매출을 못 봄)와
-- 멘토 본인 정산 화면 신설은 이번 작업 범위가 아니고 별도로 다룬다.
-- ============================================================

-- 1. cad_subscriptions (수강패키지)
DROP POLICY IF EXISTS "cad_subscriptions_admin_select" ON public.cad_subscriptions;
CREATE POLICY "cad_subscriptions_admin_select" ON public.cad_subscriptions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 2. cad_mentoring_sessions (건별멘토링)
DROP POLICY IF EXISTS "cad_sessions_admin_select" ON public.cad_mentoring_sessions;
CREATE POLICY "cad_sessions_admin_select" ON public.cad_mentoring_sessions
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. cad_addon_purchases (이용권추가)
DROP POLICY IF EXISTS "cad_addon_admin_select" ON public.cad_addon_purchases;
CREATE POLICY "cad_addon_admin_select" ON public.cad_addon_purchases
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
