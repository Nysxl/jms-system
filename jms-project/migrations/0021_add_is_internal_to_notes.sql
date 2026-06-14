-- Add is_internal column to job_notes
ALTER TABLE IF EXISTS job_notes
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT false;
