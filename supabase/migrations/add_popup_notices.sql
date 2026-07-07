-- 팝업공지 테이블
CREATE TABLE IF NOT EXISTS public.popup_notices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,                              -- 제목 (선택)
  content TEXT,                            -- 본문 텍스트 (선택)
  image_url TEXT,                          -- 배너 이미지 URL (선택, R2)
  link_url TEXT,                           -- 클릭 시 이동 링크 (선택)
  is_active BOOLEAN NOT NULL DEFAULT true, -- 활성화 토글
  starts_at TIMESTAMPTZ,                   -- 표시 시작 (null이면 제한 없음)
  ends_at TIMESTAMPTZ,                     -- 표시 종료 (null이면 제한 없음)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 활성 팝업 조회용 인덱스
CREATE INDEX IF NOT EXISTS idx_popup_notices_active
  ON public.popup_notices (is_active, starts_at, ends_at);

-- RLS 활성화
ALTER TABLE public.popup_notices ENABLE ROW LEVEL SECURITY;

-- 일반 사용자: 활성 팝업 조회만 가능 (홈페이지 표시용)
DROP POLICY IF EXISTS "popup_notices_public_read" ON public.popup_notices;
CREATE POLICY "popup_notices_public_read" ON public.popup_notices
  FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- 관리자: 전체 권한
DROP POLICY IF EXISTS "popup_notices_admin_all" ON public.popup_notices;
CREATE POLICY "popup_notices_admin_all" ON public.popup_notices
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
