-- Add payment details columns to company_settings
ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS bsb TEXT,
ADD COLUMN IF NOT EXISTS account_number TEXT;
