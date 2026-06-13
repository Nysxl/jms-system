-- Add RLS policy to allow portal users to read jobs for their customer
-- Portal users authenticate via Supabase Auth, so we check if their auth.uid()
-- matches a portal_users record and allow them to read jobs for that customer

CREATE POLICY "Portal users can view their customer jobs"
  ON jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users
      WHERE portal_users.id = auth.uid()
      AND portal_users.customer_id = jobs.customer_id
    )
  );

-- Also allow portal users to insert jobs (created_by_portal_user)
CREATE POLICY "Portal users can create jobs for their customer"
  ON jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portal_users
      WHERE portal_users.id = auth.uid()
      AND portal_users.customer_id = customer_id
    )
  );

-- Allow portal users to update notes on their customer's jobs
CREATE POLICY "Portal users can update job notes"
  ON job_notes
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN portal_users ON portal_users.id = auth.uid()
      WHERE jobs.id = job_notes.job_id
      AND jobs.customer_id = portal_users.customer_id
    )
  );

-- Allow portal users to insert photos on their customer's jobs
CREATE POLICY "Portal users can upload photos to their jobs"
  ON job_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM jobs
      JOIN portal_users ON portal_users.id = auth.uid()
      WHERE jobs.id = job_images.job_id
      AND jobs.customer_id = portal_users.customer_id
    )
  );
