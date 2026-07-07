-- commissions 소프트 삭제 컬럼 추가
ALTER TABLE public.commissions
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason_category TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_reason_detail TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by UUID DEFAULT NULL;

-- 삭제된 의뢰 조회(관리자 탭)용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_commissions_deleted_at
  ON public.commissions (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- deleted_reason_category 허용값 참고 (앱에서 검증, DB 제약은 걸지 않음):
--   'mistake'          실수로 등록
--   'cancel'           의뢰 취소 (더 필요없음)
--   'solved_elsewhere' 다른곳에서 해결
--   'info_error'       등록정보 오류 (재등록 예정)
--   'other'            기타 (상세입력 필수)
