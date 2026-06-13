-- Add uploader info to job_attachments and job_images
ALTER TABLE IF EXISTS job_attachments
  ADD COLUMN IF NOT EXISTS uploader_email TEXT,
  ADD COLUMN IF NOT EXISTS author_type TEXT DEFAULT 'admin';

ALTER TABLE IF EXISTS job_images
  ADD COLUMN IF NOT EXISTS uploader_email TEXT,
  ADD COLUMN IF NOT EXISTS author_type TEXT DEFAULT 'admin';
