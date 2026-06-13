-- Add signature tracking and portal job creation to jobs table
ALTER TABLE jobs ADD COLUMN created_by_portal_user TEXT;
ALTER TABLE jobs ADD COLUMN signature_data TEXT;
ALTER TABLE jobs ADD COLUMN signed_by TEXT;
ALTER TABLE jobs ADD COLUMN signed_at TIMESTAMP;

-- Create index for portal job creation tracking
CREATE INDEX idx_jobs_created_by_portal_user ON jobs(created_by_portal_user);
