-- 탈퇴 회원 핵심 정보 보관 테이블
-- 전자상거래법 기준 5년 보관

CREATE TABLE IF NOT EXISTS deleted_profiles (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  original_user_id UUID        NOT NULL,
  nickname         TEXT,
  email            TEXT,
  phone            TEXT,
  bank_account     TEXT,               -- "은행명 / 예금주 / 계좌번호" 포맷
  role             TEXT,               -- 'user' | 'seller'
  warning_count    INTEGER     DEFAULT 0,
  deleted_at       TIMESTAMPTZ DEFAULT NOW(),
  reason           TEXT                -- 탈퇴 사유 (선택)
);

-- 보관 기간 기준: 5년 (전자상거래 등에서의 소비자보호에 관한 법률 §6)
COMMENT ON TABLE deleted_profiles IS '탈퇴 회원 핵심 정보 — 전자상거래법 기준 5년 보관';

-- RLS 활성화 (서비스 롤만 쓰기, 관리자 API에서 조회)
ALTER TABLE deleted_profiles ENABLE ROW LEVEL SECURITY;

-- 서비스 롤(service role)에서만 접근 — 일반 사용자 직접 접근 차단
-- 읽기 정책 없음: admin API 라우트에서 service role 키로만 조회
