-- Migration: add status column to polox.contacts
-- Run this with psql or your migration runner against the database used by the app.
-- Adds a simple VARCHAR column with default 'novo' and NOT NULL constraint.
-- Also creates a partial index for active rows (deleted_at IS NULL) to speed queries.

ALTER TABLE polox.contacts
  ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'novo';

-- Optional: add index for fast filtering by status on active rows
CREATE INDEX IF NOT EXISTS idx_polox_contacts_status_active
  ON polox.contacts (status)
  WHERE deleted_at IS NULL;

-- Backfill: if you want to set a specific status for existing rows, run an UPDATE
-- Example: mark contacts with no activity as 'novo' (already default) or use business rules
-- UPDATE polox.contacts SET status = 'novo' WHERE status IS NULL;
