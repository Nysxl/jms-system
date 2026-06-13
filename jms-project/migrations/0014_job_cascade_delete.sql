-- Ensure cascade delete for all job-related tables
-- Note: We need to drop and recreate foreign keys to update them

-- job_notes - ensure CASCADE
ALTER TABLE IF EXISTS job_notes DROP CONSTRAINT IF EXISTS job_notes_job_id_fkey;
ALTER TABLE IF EXISTS job_notes ADD CONSTRAINT job_notes_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- job_images - ensure CASCADE
ALTER TABLE IF EXISTS job_images DROP CONSTRAINT IF EXISTS job_images_job_id_fkey;
ALTER TABLE IF EXISTS job_images ADD CONSTRAINT job_images_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- job_attachments - ensure CASCADE
ALTER TABLE IF EXISTS job_attachments DROP CONSTRAINT IF EXISTS job_attachments_job_id_fkey;
ALTER TABLE IF EXISTS job_attachments ADD CONSTRAINT job_attachments_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- job_line_items - ensure CASCADE
ALTER TABLE IF EXISTS job_line_items DROP CONSTRAINT IF EXISTS job_line_items_job_id_fkey;
ALTER TABLE IF EXISTS job_line_items ADD CONSTRAINT job_line_items_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- time_entries - ensure CASCADE
ALTER TABLE IF EXISTS time_entries DROP CONSTRAINT IF EXISTS time_entries_job_id_fkey;
ALTER TABLE IF EXISTS time_entries ADD CONSTRAINT time_entries_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- job_attachments (second FK if it exists) - ensure CASCADE
ALTER TABLE IF EXISTS job_attachments DROP CONSTRAINT IF EXISTS job_attachments_job_id_key;

-- invoices - change to CASCADE instead of SET NULL
ALTER TABLE IF EXISTS invoices DROP CONSTRAINT IF EXISTS invoices_job_id_fkey;
ALTER TABLE IF EXISTS invoices ADD CONSTRAINT invoices_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;

-- service_reports - ensure CASCADE if table exists
ALTER TABLE IF EXISTS service_reports DROP CONSTRAINT IF EXISTS service_reports_job_id_fkey;
ALTER TABLE IF EXISTS service_reports ADD CONSTRAINT service_reports_job_id_fkey
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE;
