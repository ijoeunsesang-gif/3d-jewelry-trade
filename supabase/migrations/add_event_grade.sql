-- ============================================================
-- 등급 상향 이벤트 관리 (단발성 이벤트용 최소 테이블 3개)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 참가 신청 없이, 이벤트 기간 내 models.created_at으로 자동 집계한다.
-- 등급 상향은 100% 관리자 수동 승인이며 자동 상향/하향은 어디에도 없다.
-- ============================================================

-- 1. 이벤트 기간 설정 — 싱글턴(고정 id 1행)으로만 사용
CREATE TABLE IF NOT EXISTS event_settings (
  id         UUID        PRIMARY KEY DEFAULT '11111111-1111-1111-1111-111111111111',
  start_date TIMESTAMPTZ,
  end_date   TIMESTAMPTZ,
  is_active  BOOLEAN     DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE event_settings IS '등급 상향 이벤트 기간 설정 — 고정 id 1행만 사용(싱글턴)';

ALTER TABLE event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_settings_admin_all"
  ON event_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. 무효 처리된 모델 기록 — id만 저장, 검수 시 유효개수에서 차감
CREATE TABLE IF NOT EXISTS event_invalid_models (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  model_id   UUID        NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  reason     TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (model_id)
);

COMMENT ON TABLE event_invalid_models IS '이벤트 검수에서 무효 처리된 모델 — 존재하면 유효개수 집계에서 제외';

ALTER TABLE event_invalid_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "event_invalid_models_admin_all"
  ON event_invalid_models FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. 등급 변경 로그 — 이벤트 승인 + 수동 변경 공용, 항상 사유 필수
CREATE TABLE IF NOT EXISTS grade_change_logs (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_grade TEXT        NOT NULL,
  to_grade   TEXT        NOT NULL,
  reason     TEXT        NOT NULL,
  changed_by UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE grade_change_logs IS '판매자 등급 변경 이력 — 이벤트 승인/수동 변경 모두 여기 기록, 자동 변경은 기록하지 않음';

ALTER TABLE grade_change_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "grade_change_logs_admin_all"
  ON grade_change_logs FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
