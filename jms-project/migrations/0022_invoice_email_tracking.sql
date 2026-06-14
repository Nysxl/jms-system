-- Add email tracking columns to invoices table
ALTER TABLE invoices ADD COLUMN last_email_sent_at TIMESTAMP;
ALTER TABLE invoices ADD COLUMN last_viewed_at TIMESTAMP;

-- Create index for viewing tracking
CREATE INDEX idx_invoices_last_viewed_at ON invoices(last_viewed_at);
