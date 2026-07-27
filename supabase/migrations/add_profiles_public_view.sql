-- ============================================================
-- profiles_public 뷰 생성 (보안 강화 1/2단계)
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 목적: profiles 원본 테이블은 이후 lock_profiles_rls.sql에서 "본인 + 관리자만"
-- 조회 가능하도록 잠근다. 그 전에, 판매자 공개 프로필/팔로우 목록/메시지함 등에서
-- "남의 프로필"을 조회할 때 계속 쓸 수 있도록 공개해도 안전한 컬럼만 담은 뷰를
-- 먼저 만들어 둔다.
--
-- ⚠️ 실행 순서 중요: 이 마이그레이션을 먼저 실행하고, 코드 배포 후,
--    lock_profiles_rls.sql은 가장 마지막에 실행할 것.
--
-- ⚠️ security_invoker를 켜지 않는다(=기본값 유지). 뷰 소유자(테이블 소유자와 동일,
-- 보통 postgres)는 profiles의 RLS를 우회하는 권한을 이미 가지고 있어서, 뷰가
-- "모든 행"을 반환하되 "공개 컬럼만" 반환하게 된다. 반대로 security_invoker=true로
-- 켜면 뷰 조회 시 호출자의 RLS(=lock_profiles_rls.sql 적용 후 "본인+관리자만")가
-- 그대로 적용되어, 익명/타인이 이 뷰를 조회해도 자기 자신 행 외엔 아무것도 못 보게
-- 되어 뷰를 만드는 목적 자체가 무의미해진다. 뷰는 컬럼 단위로 이미 안전하게
-- 걸러져 있으므로, 행 단위로는 전체 공개해도 문제가 없다.
-- ============================================================

CREATE OR REPLACE VIEW public.profiles_public AS
SELECT
  id,
  nickname,
  avatar_url,
  bio,
  grade,
  role,
  created_at,
  seller_registered_at,
  opentalk_url,
  contact_phone,
  phone_number,
  is_business_verified
FROM public.profiles;

GRANT SELECT ON public.profiles_public TO anon, authenticated;
