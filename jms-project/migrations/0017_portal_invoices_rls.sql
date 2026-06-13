-- Allow portal users to read invoices for their own customer only
-- Invoices are only visible to the specific customer they're billed to
CREATE POLICY "Portal users can read their invoices"
  ON invoices
  FOR SELECT
  USING (
    customer_id = (
      SELECT customer_id FROM portal_users
      WHERE user_id = auth.uid()
    )
  );
