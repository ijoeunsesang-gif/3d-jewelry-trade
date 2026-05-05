-- 참여자별 독립 소프트 삭제 컬럼 추가
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_by_user1 BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS deleted_by_user2 BOOLEAN NOT NULL DEFAULT false;
