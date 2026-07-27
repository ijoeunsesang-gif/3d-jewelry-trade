-- 모델별 댓글 수 일괄 조회 RPC
-- 홈페이지에서 model_comments 전체 행(limit=10000)을 내려받아 클라이언트에서 세던 방식을 대체.
-- 사용처: app/page.tsx fetchModels()

CREATE OR REPLACE FUNCTION get_model_comment_counts(model_ids UUID[])
RETURNS TABLE(model_id UUID, comment_count BIGINT)
LANGUAGE SQL STABLE AS $$
  SELECT model_id, COUNT(*) AS comment_count
  FROM model_comments
  WHERE model_id = ANY(model_ids)
  GROUP BY model_id;
$$;
