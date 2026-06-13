-- Drop old policies
DROP POLICY IF EXISTS "Portal users can view their customer jobs" ON jobs;
DROP POLICY IF EXISTS "Portal users can create jobs for their customer" ON jobs;

-- Updated RLS policy to allow portal users to see jobs for their customer and sub-contacts
CREATE POLICY "Portal users can view jobs for their customer and sub-contacts"
  ON jobs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM portal_users
      WHERE portal_users.id = auth.uid()
      AND (
        -- Direct customer match
        portal_users.customer_id = jobs.customer_id
        OR
        -- Sub-contact of portal user's customer
        jobs.customer_id IN (
          SELECT id FROM customers
          WHERE contractor_id = portal_users.customer_id
          AND customer_type = 'sub_contact'
        )
      )
    )
  );

-- Also allow portal users to insert jobs
CREATE POLICY "Portal users can create jobs for their customer or sub-contacts"
  ON jobs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM portal_users
      WHERE portal_users.id = auth.uid()
      AND (
        -- Direct customer match
        portal_users.customer_id = customer_id
        OR
        -- Sub-contact of portal user's customer
        customer_id IN (
          SELECT id FROM customers
          WHERE contractor_id = portal_users.customer_id
          AND customer_type = 'sub_contact'
        )
      )
    )
  );
