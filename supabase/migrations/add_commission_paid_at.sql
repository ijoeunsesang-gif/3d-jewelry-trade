-- ============================================================
-- commissions.paid_at 컬럼 추가 (결제일 기준 정산 집계용)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 배경: commissions.created_at은 의뢰 "생성일"이고 실제 결제(협의완료 후
-- 토스 결제 승인) 시점과 다르다. 정산관리(app/admin/settlement/page.tsx)가
-- created_at으로 월을 필터링하면, 6월에 생성되어 7월에 결제된 의뢰는 7월
-- 정산에 잡히지 않고 6월 쪽에 남아 실제로는 결제된 적 없는 것처럼 보인다.
-- paid_at을 결제 승인 시점(/api/commission/payment/confirm)에 기록해
-- 정산 집계 기준일로 쓴다.
-- ============================================================

ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- 과거 결제 완료 건(paid_at이 없는 기존 데이터)은 마이그레이션 시점에
-- 알 수 없으므로 채우지 않는다. app 코드에서 paid_at IS NULL이면
-- created_at으로 폴백 처리한다.
