-- Track how much of each line item has been invoiced
ALTER TABLE IF EXISTS job_line_items
  ADD COLUMN IF NOT EXISTS quantity_invoiced NUMERIC(10,2) NOT NULL DEFAULT 0;

-- Allow linking service reports to invoices
ALTER TABLE IF EXISTS invoices
  ADD COLUMN IF NOT EXISTS service_report_id UUID REFERENCES service_reports(id) ON DELETE SET NULL;
