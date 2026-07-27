-- ============================================================
-- pending_email_notifications RLS 강화 (보안 수정)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 문제: add_follow_notifications.sql의 기존 정책
--   CREATE POLICY "service role full access" ON pending_email_notifications
--     USING (true) WITH CHECK (true);
-- 은 주석/이름은 "서비스 롤(cron)만 접근 가능"이지만 TO 절이 빠져 있어
-- 실제로는 anon을 포함한 모든 역할에 SELECT/INSERT/UPDATE/DELETE가 전부 열려 있었다.
-- (팔로우 대상 유저-판매자-모델 매핑이 담긴 이메일 발송 대기열이 그대로 노출됨)
--
-- 이 테이블은 다음 두 라우트에서만 SUPABASE_SERVICE_ROLE_KEY로 접근한다.
-- 클라이언트가 직접 접근할 필요가 전혀 없다:
--   - app/api/models/notify-followers/route.ts   (INSERT)
--   - app/api/cron/send-follow-notifications/route.ts (SELECT, UPDATE)
-- ============================================================

DROP POLICY IF EXISTS "service role full access" ON public.pending_email_notifications;

-- anon/authenticated 롤은 명시적으로 전면 차단한다.
-- service_role은 RLS를 우회하므로 위 두 라우트는 그대로 정상 동작한다.
DROP POLICY IF EXISTS "pending_email_notifications_no_access" ON public.pending_email_notifications;
CREATE POLICY "pending_email_notifications_no_access" ON public.pending_email_notifications
  FOR ALL TO authenticated, anon
  USING (false)
  WITH CHECK (false);
