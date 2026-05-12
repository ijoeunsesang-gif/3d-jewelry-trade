-- messages 테이블에 이미지 전송 기능 추가
-- image_url: R2 업로드된 이미지 공개 URL
-- content: 이미지 메시지는 NULL 가능하도록 NOT NULL 제약 제거

ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE messages ALTER COLUMN content DROP NOT NULL;
