-- ============================================================
-- cad_addon_purchases 멘토 본인 SELECT 정책 추가
-- Supabase Dashboard > SQL Editor 에서 실행
--
-- 배경: 판매통계 개편으로 멘토 본인 화면에 캐드스쿨(수강패키지/이용권추가/
-- 건별멘토링) 수익을 합산해서 보여줘야 하는데, cad_addon_purchases의 기존
-- SELECT 정책("addon_select_own")은 구매자 본인(user_id = auth.uid())과
-- service_role만 허용해서 멘토는 자기 소유 subscription 밑에 달린 addon
-- 구매 내역조차 조회할 방법이 없었다(add_cad_school_admin_select.sql에서
-- admin 조회는 이미 추가했지만 멘토 조회는 이번 작업 범위로 남겨뒀었다).
--
-- cad_addon_purchases.subscription_id → cad_subscriptions.mentor_id →
-- cad_mentors.user_id 순으로 이어지는 FK 체인을 따라, 해당 addon이 걸린
-- 구독의 담당 멘토 본인이면 조회를 허용한다. 기존 "본인 구매자" 정책은
-- 그대로 두고 OR로 합산되게 한다.
-- ============================================================

DROP POLICY IF EXISTS "addon_select_mentor" ON public.cad_addon_purchases;
CREATE POLICY "addon_select_mentor" ON public.cad_addon_purchases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.cad_subscriptions s
      JOIN public.cad_mentors m ON m.id = s.mentor_id
      WHERE s.id = cad_addon_purchases.subscription_id
        AND m.user_id = auth.uid()
    )
  );
