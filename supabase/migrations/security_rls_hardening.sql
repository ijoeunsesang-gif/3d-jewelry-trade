-- ============================================================
-- 보안 강화 마이그레이션
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- 1. points 테이블 RLS 활성화 및 정책 추가
--    (기존에 RLS 정책 없이 service role로만 접근하던 테이블)
ALTER TABLE public.points ENABLE ROW LEVEL SECURITY;

-- 자신의 포인트만 조회 가능
DROP POLICY IF EXISTS "points_select_own" ON public.points;
CREATE POLICY "points_select_own" ON public.points
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 관리자는 전체 조회 가능
DROP POLICY IF EXISTS "points_admin_all" ON public.points;
CREATE POLICY "points_admin_all" ON public.points
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- anon은 points 접근 불가 (service role만 INSERT 가능)
DROP POLICY IF EXISTS "points_no_anon" ON public.points;

-- ============================================================
-- 2. notifications 테이블 RLS 확인 및 강화
-- ============================================================
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "notifications_admin_all" ON public.notifications;
CREATE POLICY "notifications_admin_all" ON public.notifications
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 3. seller_reinstate_requests RLS 확인 및 강화
-- ============================================================
ALTER TABLE public.seller_reinstate_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reinstate_select_own" ON public.seller_reinstate_requests;
CREATE POLICY "reinstate_select_own" ON public.seller_reinstate_requests
  FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "reinstate_insert_own" ON public.seller_reinstate_requests;
CREATE POLICY "reinstate_insert_own" ON public.seller_reinstate_requests
  FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "reinstate_admin_all" ON public.seller_reinstate_requests;
CREATE POLICY "reinstate_admin_all" ON public.seller_reinstate_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 4. commission_disputes RLS 확인 및 강화
-- ============================================================
ALTER TABLE public.commission_disputes ENABLE ROW LEVEL SECURITY;

-- 본인이 신고한 건만 조회
DROP POLICY IF EXISTS "disputes_select_own" ON public.commission_disputes;
CREATE POLICY "disputes_select_own" ON public.commission_disputes
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "disputes_insert_own" ON public.commission_disputes;
CREATE POLICY "disputes_insert_own" ON public.commission_disputes
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS "disputes_admin_all" ON public.commission_disputes;
CREATE POLICY "disputes_admin_all" ON public.commission_disputes
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- ============================================================
-- 5. deleted_profiles — 일반 유저 SELECT 차단 (service role 전용)
-- ============================================================
ALTER TABLE public.deleted_profiles ENABLE ROW LEVEL SECURITY;

-- 기존 정책 제거 후 접근 차단 (service role은 RLS 무시)
DROP POLICY IF EXISTS "deleted_profiles_no_access" ON public.deleted_profiles;
CREATE POLICY "deleted_profiles_no_access" ON public.deleted_profiles
  FOR ALL TO authenticated, anon
  USING (false);
