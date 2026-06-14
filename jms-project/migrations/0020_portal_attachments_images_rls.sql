-- Add RLS policies for portal users to read attachments and images
CREATE POLICY "Portal users can read non-internal attachments for their jobs"
  ON job_attachments
  FOR SELECT
  USING (
    is_internal = false
    AND job_id IN (
      SELECT id FROM jobs
      WHERE customer_id = (SELECT customer_id FROM portal_users WHERE user_id = auth.uid())
    )
  );

CREATE POLICY "Portal users can read non-internal images for their jobs"
  ON job_images
  FOR SELECT
  USING (
    is_internal = false
    AND job_id IN (
      SELECT id FROM jobs
      WHERE customer_id = (SELECT customer_id FROM portal_users WHERE user_id = auth.uid())
    )
  );
