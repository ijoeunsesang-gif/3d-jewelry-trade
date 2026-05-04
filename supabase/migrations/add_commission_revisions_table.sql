CREATE TABLE IF NOT EXISTS commission_revisions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  commission_id UUID NOT NULL REFERENCES commissions(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('problem', 'additional')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'negotiating')),
  negotiation_round INTEGER NOT NULL DEFAULT 0,
  requester_message TEXT NOT NULL DEFAULT '',
  images TEXT[] DEFAULT '{}',
  seller_price NUMERIC,
  seller_days INTEGER,
  seller_message TEXT,
  seller_rejection_reason TEXT,
  requester_neg_price NUMERIC,
  requester_neg_days INTEGER,
  requester_neg_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS commission_revisions_commission_id_idx
  ON commission_revisions(commission_id);

CREATE INDEX IF NOT EXISTS commission_revisions_active_idx
  ON commission_revisions(commission_id, status)
  WHERE status IN ('pending', 'negotiating');
