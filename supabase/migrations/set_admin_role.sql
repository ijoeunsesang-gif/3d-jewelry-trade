-- ============================================================
-- 관리자 계정 설정 및 RLS 정책 추가
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- 1. role 컬럼은 이미 존재함 (user/seller 값 사용 중) — 안전하게 재확인
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- 2. 관리자 계정 지정
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'ijoeunsesang@gmail.com'
);

-- ============================================================
-- 3. RLS 정책 추가: admin role은 모든 주요 테이블 접근 허용
--    기존 정책과 OR 로 합산되므로 기존 사용자 정책에 영향 없음
-- ============================================================

-- profiles
DROP POLICY IF EXISTS "admin_all_profiles" ON public.profiles;
CREATE POLICY "admin_all_profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- models
DROP POLICY IF EXISTS "admin_all_models" ON public.models;
CREATE POLICY "admin_all_models" ON public.models
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- commissions
DROP POLICY IF EXISTS "admin_all_commissions" ON public.commissions;
CREATE POLICY "admin_all_commissions" ON public.commissions
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- commission_comments
DROP POLICY IF EXISTS "admin_all_commission_comments" ON public.commission_comments;
CREATE POLICY "admin_all_commission_comments" ON public.commission_comments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- commission_negotiations
DROP POLICY IF EXISTS "admin_all_commission_negotiations" ON public.commission_negotiations;
CREATE POLICY "admin_all_commission_negotiations" ON public.commission_negotiations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- purchases
DROP POLICY IF EXISTS "admin_all_purchases" ON public.purchases;
CREATE POLICY "admin_all_purchases" ON public.purchases
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );
