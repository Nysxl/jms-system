-- Add DELETE RLS policies for tables that need them

-- Allow users to delete their own customers
CREATE POLICY "Users can delete their own customers"
  ON customers
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to delete their own jobs
CREATE POLICY "Users can delete their own jobs"
  ON jobs
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to delete their own job notes
CREATE POLICY "Users can delete their own job notes"
  ON job_notes
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to delete their own job images
CREATE POLICY "Users can delete their own job images"
  ON job_images
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to delete their own job attachments
CREATE POLICY "Users can delete their own job attachments"
  ON job_attachments
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to delete their own time entries
CREATE POLICY "Users can delete their own time entries"
  ON time_entries
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to delete their own expenses
CREATE POLICY "Users can delete their own expenses"
  ON expenses
  FOR DELETE
  USING (user_id = auth.uid());

-- Allow users to delete their own portal users
CREATE POLICY "Users can delete their own portal users"
  ON portal_users
  FOR DELETE
  USING (user_id = auth.uid());
