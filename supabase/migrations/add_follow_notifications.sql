-- follows 테이블에 notify_enabled 컬럼 추가
ALTER TABLE public.follows
  ADD COLUMN IF NOT EXISTS notify_enabled boolean DEFAULT true NOT NULL;

-- notification_settings 테이블에 push_new_product 컬럼 추가
ALTER TABLE public.notification_settings
  ADD COLUMN IF NOT EXISTS push_new_product boolean DEFAULT true;

-- 이메일 발송 대기 테이블 생성
CREATE TABLE IF NOT EXISTS public.pending_email_notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id   uuid NOT NULL,
  seller_name text NOT NULL,
  model_id    uuid NOT NULL,
  model_name  text NOT NULL,
  model_image text,
  created_at  timestamptz DEFAULT now() NOT NULL,
  sent_at     timestamptz
);

ALTER TABLE public.pending_email_notifications ENABLE ROW LEVEL SECURITY;

-- 서비스 롤(cron)만 접근 가능
CREATE POLICY "service role full access" ON public.pending_email_notifications
  USING (true)
  WITH CHECK (true);
