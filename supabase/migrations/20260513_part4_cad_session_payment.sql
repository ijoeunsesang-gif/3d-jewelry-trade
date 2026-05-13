ALTER TABLE cad_mentoring_sessions
  ADD COLUMN IF NOT EXISTS session_type text,
  ADD COLUMN IF NOT EXISTS payment_key text,
  ADD COLUMN IF NOT EXISTS order_id text UNIQUE;
