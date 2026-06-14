-- Add invoice customization options to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS show_company_name BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_logo BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS invoice_accent_color TEXT DEFAULT '#3b82f6';
