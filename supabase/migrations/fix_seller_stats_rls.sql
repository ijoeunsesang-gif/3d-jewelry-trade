-- ============================================================
-- seller_stats RLS 강화 (보안 수정)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 문제: scripts/migration-grades.sql의 기존 정책
--   CREATE POLICY "서비스롤 전체접근" ON seller_stats USING (true) WITH CHECK (true);
-- 은 이름과 달리 FOR/TO 절이 없어 anon을 포함한 모든 역할에 SELECT는 물론
-- INSERT/UPDATE/DELETE까지 열려 있었다. sale_records와 동일한 문제
-- (관련: fix_sale_records_rls.sql).
-- ============================================================

DROP POLICY IF EXISTS "서비스롤 전체접근" ON public.seller_stats;

-- 판매자 본인 등급/누적매출 조회 (app/profile/page.tsx "내 등급" 탭)
DROP POLICY IF EXISTS "seller_stats_select_own" ON public.seller_stats;
CREATE POLICY "seller_stats_select_own" ON public.seller_stats
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 관리자 전체 조회
DROP POLICY IF EXISTS "seller_stats_select_admin" ON public.seller_stats;
CREATE POLICY "seller_stats_select_admin" ON public.seller_stats
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- INSERT/UPDATE/DELETE 정책은 의도적으로 추가하지 않는다.
-- 실제 갱신은 app/api/grade/update/route.ts가 SUPABASE_SERVICE_ROLE_KEY로 upsert하며
-- service_role은 RLS를 우회하므로 정책이 없어도 정상 동작한다.
-- anon/authenticated 롤은 이제 SELECT(그것도 본인/관리자 행만) 외에는 접근할 수 없다.
