-- Allow portal users to read invoices for their customer and sub-contacts
CREATE POLICY "Portal users can read their invoices"
  ON invoices
  FOR SELECT
  USING (
    customer_id IN (
      SELECT pu.customer_id FROM portal_users pu
      WHERE pu.user_id = auth.uid()
      UNION
      SELECT c.id FROM customers c
      INNER JOIN portal_users pu ON c.contractor_id = pu.customer_id
      WHERE pu.user_id = auth.uid() AND c.customer_type = 'sub_contact'
    )
  );
