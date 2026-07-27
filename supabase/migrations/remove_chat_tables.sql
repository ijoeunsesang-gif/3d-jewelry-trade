-- 개인 의뢰 자유 채팅 기능 제거
-- (협상/수정요청은 commission_negotiations, commission_revisions에 별도로 저장되어 영향 없음.
--  연락 수단(ContactButtons: 오픈톡/문자)으로 대체)
DROP TABLE IF EXISTS public.commission_chats CASCADE;
