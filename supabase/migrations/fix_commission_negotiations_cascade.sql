-- Fix commission_negotiations foreign key to cascade on parent delete
ALTER TABLE commission_negotiations
  DROP CONSTRAINT IF EXISTS commission_negotiations_commission_id_fkey;

ALTER TABLE commission_negotiations
  ADD CONSTRAINT commission_negotiations_commission_id_fkey
  FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE;
