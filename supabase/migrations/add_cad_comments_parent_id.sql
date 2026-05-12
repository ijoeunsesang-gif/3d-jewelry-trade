-- Add parent_id to cad_post_comments for sub-comment (thread reply) support
ALTER TABLE cad_post_comments
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES cad_post_comments(id) ON DELETE CASCADE;
