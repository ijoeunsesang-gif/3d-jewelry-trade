-- ============================================================
-- Web Push 알림 테이블
-- Supabase Dashboard > SQL Editor 에서 실행
-- ============================================================

-- 1. push_subscriptions: 브라우저 푸시 구독 정보
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  endpoint   TEXT NOT NULL,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, endpoint)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "push_subscriptions_own" ON public.push_subscriptions;
CREATE POLICY "push_subscriptions_own" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. notification_settings: 카테고리별 푸시 수신 여부
CREATE TABLE IF NOT EXISTS public.notification_settings (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  push_inquiry  BOOLEAN DEFAULT true,
  push_chat     BOOLEAN DEFAULT true,
  push_payment  BOOLEAN DEFAULT true,
  push_wishlist BOOLEAN DEFAULT true,
  push_notice   BOOLEAN DEFAULT true,
  updated_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notification_settings_own" ON public.notification_settings;
CREATE POLICY "notification_settings_own" ON public.notification_settings
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON public.push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON public.notification_settings(user_id);
