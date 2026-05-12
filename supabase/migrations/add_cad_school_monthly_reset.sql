-- ============================================================
-- 캐드스쿨 월별 자동 초기화 함수 및 pg_cron 설정
-- ============================================================

-- 월별 구독 카운트 초기화 함수
CREATE OR REPLACE FUNCTION reset_cad_subscription_monthly()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE cad_subscriptions
  SET
    checklist_count     = 0,
    review_count        = 0,
    stl_upload_count    = 0,
    mentor_change_count = 0,
    updated_at          = NOW()
  WHERE status IN ('active', 'cancelled');
END;
$$;

-- ============================================================
-- pg_cron 스케줄 등록
-- (Supabase Dashboard > Database > Extensions 에서 pg_cron 먼저 활성화 필요)
-- 매월 1일 00:00 UTC 실행 (한국 시간 09:00)
-- ============================================================
-- SELECT cron.schedule(
--   'monthly-cad-subscription-reset',
--   '0 0 1 * *',
--   'SELECT reset_cad_subscription_monthly()'
-- );

-- ============================================================
-- 관리자용 수동 초기화 API를 위한 권한 설정
-- ============================================================
GRANT EXECUTE ON FUNCTION reset_cad_subscription_monthly() TO service_role;
