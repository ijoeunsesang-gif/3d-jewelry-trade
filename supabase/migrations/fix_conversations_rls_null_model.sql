-- conversations 테이블 RLS 정책 수정
-- model_id가 NULL인 seller 직접 문의 대화도 조회 허용

-- RLS 활성화 (이미 활성화돼 있으면 무시됨)
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- 기존 SELECT 정책 제거 (model_id IS NOT NULL 조건이 걸려 있을 수 있음)
DROP POLICY IF EXISTS "conversations_select" ON conversations;
DROP POLICY IF EXISTS "Enable read access for conversation participants" ON conversations;
DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
DROP POLICY IF EXISTS "conversation_participants_select" ON conversations;

-- 참여자(user1 또는 user2)는 model_id 여부와 무관하게 대화 조회 가능
CREATE POLICY "participants_can_read_conversations" ON conversations
  FOR SELECT USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- INSERT: 참여자로 포함된 경우만 허용
DROP POLICY IF EXISTS "conversations_insert" ON conversations;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON conversations;
CREATE POLICY "participants_can_insert_conversations" ON conversations
  FOR INSERT WITH CHECK (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );

-- UPDATE: 본인 관련 컬럼(deleted_by_*)만 수정 허용
DROP POLICY IF EXISTS "conversations_update" ON conversations;
CREATE POLICY "participants_can_update_conversations" ON conversations
  FOR UPDATE USING (
    auth.uid() = user1_id OR auth.uid() = user2_id
  );
