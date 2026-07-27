-- ============================================================
-- sale_records RLS 강화 (보안 수정)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 문제: scripts/migration-grades.sql에서 만든 기존 정책은
--   CREATE POLICY "서비스롤 전체접근" ON sale_records USING (true) WITH CHECK (true);
-- 이름은 "서비스롤 전체접근"이지만 FOR 절이 없어 ALL(SELECT/INSERT/UPDATE/DELETE)에
-- 적용되고, TO 절도 없어 anon을 포함한 모든 역할에 그대로 열려 있었다.
-- 즉 로그인하지 않은 사용자도 모든 판매자의 매출 데이터를 열람할 수 있었고,
-- 이론적으로는 임의로 행을 추가/수정/삭제하는 것도 막혀 있지 않았다.
-- ============================================================

DROP POLICY IF EXISTS "서비스롤 전체접근" ON public.sale_records;

-- 판매자 본인 매출 내역 조회
DROP POLICY IF EXISTS "sale_records_select_seller" ON public.sale_records;
CREATE POLICY "sale_records_select_seller" ON public.sale_records
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

-- 구매자 본인 구매 내역 조회
DROP POLICY IF EXISTS "sale_records_select_buyer" ON public.sale_records;
CREATE POLICY "sale_records_select_buyer" ON public.sale_records
  FOR SELECT TO authenticated
  USING (buyer_id = auth.uid());

-- 관리자 전체 조회 (정산관리 페이지)
DROP POLICY IF EXISTS "sale_records_select_admin" ON public.sale_records;
CREATE POLICY "sale_records_select_admin" ON public.sale_records
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- INSERT/UPDATE/DELETE 정책은 의도적으로 추가하지 않는다.
-- 실제 기록은 app/api/grade/update/route.ts가 SUPABASE_SERVICE_ROLE_KEY로 처리하며
-- service_role은 RLS를 우회하므로 정책이 없어도 정상 동작한다.
-- anon/authenticated 롤은 이제 SELECT(그것도 본인/관리자 행만) 외에는 접근할 수 없다.
