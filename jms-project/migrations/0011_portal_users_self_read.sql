-- Allow portal users to read their own record using their auth.uid()
-- This enables the login API to query portal_users after signInWithPassword (no service key needed)
CREATE POLICY IF NOT EXISTS "portal_users_self_read"
  ON portal_users FOR SELECT
  USING (
    auth.uid()::text = user_id::text
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- Also allow portal users to read their own customer
CREATE POLICY IF NOT EXISTS "customers_portal_read"
  ON customers FOR SELECT
  USING (
    id IN (
      SELECT customer_id FROM portal_users
      WHERE user_id = auth.uid()
      OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
    )
  );
