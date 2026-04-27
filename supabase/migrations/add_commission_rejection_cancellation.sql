-- Add rejection_reason and cancellation_reason columns to commissions table
-- Required by the private commission status system overhaul (commit 9ccce43)

ALTER TABLE commissions
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
