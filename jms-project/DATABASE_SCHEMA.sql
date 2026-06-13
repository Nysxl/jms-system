-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  company_name TEXT,
  avatar_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  company_name TEXT,
  notes TEXT,
  customer_type TEXT DEFAULT 'direct', -- direct, contractor, sub_contact
  contractor_id TEXT, -- FK to customers.id, set when customer_type = 'sub_contact'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (contractor_id) REFERENCES customers(id)
);

-- Jobs Table
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  billing_customer_id TEXT, -- if set, invoices go here instead of customer_id
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'pending', -- pending, in-progress, completed, cancelled
  priority TEXT DEFAULT 'medium', -- low, medium, high, urgent
  scheduled_date DATETIME,
  completed_date DATETIME,
  total_amount REAL,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (billing_customer_id) REFERENCES customers(id)
);

-- Job Notes Table
CREATE TABLE IF NOT EXISTS job_notes (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  display_timestamp DATETIME, -- overridable display timestamp; falls back to created_at
  author_type TEXT DEFAULT 'admin', -- admin, portal_user
  portal_user_id TEXT, -- set when note was added by a portal user
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Job Images Table
CREATE TABLE IF NOT EXISTS job_images (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  caption TEXT,
  display_timestamp DATETIME, -- overridable display timestamp; falls back to uploaded_at
  author_type TEXT DEFAULT 'admin', -- admin, portal_user
  portal_user_id TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Job Signatures Table
CREATE TABLE IF NOT EXISTS job_signatures (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  signature_data TEXT NOT NULL, -- Base64 encoded signature
  signed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Service Reports Table
CREATE TABLE IF NOT EXISTS service_reports (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  work_performed TEXT,
  parts_used TEXT,
  labor_hours REAL,
  labor_rate REAL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Contracts Table
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  terms TEXT,
  status TEXT DEFAULT 'draft', -- draft, sent, signed, executed
  signed_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  user_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_number TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'draft', -- draft, sent, viewed, paid
  subtotal REAL NOT NULL,
  tax_amount REAL DEFAULT 0,
  total_amount REAL NOT NULL,
  payment_terms TEXT,
  due_date DATETIME,
  paid_date DATETIME,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (job_id) REFERENCES jobs(id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Invoice Items Table
CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  invoice_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit_price REAL NOT NULL,
  amount REAL NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id)
);

-- Inventory Table
CREATE TABLE IF NOT EXISTS inventory (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  category TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_quantity INTEGER DEFAULT 0,
  unit_cost REAL,
  unit_price REAL,
  supplier TEXT,
  location TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Inventory Transactions Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id TEXT PRIMARY KEY,
  inventory_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  transaction_type TEXT NOT NULL, -- in, out, adjustment
  quantity INTEGER NOT NULL,
  reference_id TEXT, -- Job ID or Invoice ID
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (inventory_id) REFERENCES inventory(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Portal Users Table (client-facing portal accounts)
CREATE TABLE IF NOT EXISTS portal_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL, -- the admin who owns this
  customer_id TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_plain TEXT NOT NULL, -- stored for admin visibility / recovery
  is_active INTEGER DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Portal Activity Log
CREATE TABLE IF NOT EXISTS portal_activity_log (
  id TEXT PRIMARY KEY,
  portal_user_id TEXT NOT NULL,
  user_id TEXT NOT NULL, -- admin owner
  action_type TEXT NOT NULL, -- login, logout, note_added, note_edited, photo_added, password_changed, job_viewed
  entity_type TEXT, -- job, note, image
  entity_id TEXT,
  details TEXT, -- JSON blob with extra context
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (portal_user_id) REFERENCES portal_users(id)
);

-- Customer Pricing (override inventory prices per customer)
CREATE TABLE IF NOT EXISTS customer_pricing (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  inventory_id TEXT NOT NULL,
  override_price REAL NOT NULL, -- price for this customer for this item
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (inventory_id) REFERENCES inventory(id),
  UNIQUE(customer_id, inventory_id) -- one price per customer per item
);

-- Create Indexes
CREATE INDEX idx_customers_user_id ON customers(user_id);
CREATE INDEX idx_customers_contractor_id ON customers(contractor_id);
CREATE INDEX idx_customers_type ON customers(customer_type);
CREATE INDEX idx_jobs_user_id ON jobs(user_id);
CREATE INDEX idx_jobs_customer_id ON jobs(customer_id);
CREATE INDEX idx_jobs_billing_customer_id ON jobs(billing_customer_id);
CREATE INDEX idx_jobs_status ON jobs(status);
CREATE INDEX idx_job_notes_job_id ON job_notes(job_id);
CREATE INDEX idx_job_images_job_id ON job_images(job_id);
CREATE INDEX idx_invoices_user_id ON invoices(user_id);
CREATE INDEX idx_invoices_customer_id ON invoices(customer_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_inventory_user_id ON inventory(user_id);
CREATE INDEX idx_inventory_sku ON inventory(sku);
CREATE INDEX idx_portal_users_customer_id ON portal_users(customer_id);
CREATE INDEX idx_portal_users_email ON portal_users(email);
CREATE INDEX idx_portal_activity_portal_user_id ON portal_activity_log(portal_user_id);
CREATE INDEX idx_customer_pricing_user_id ON customer_pricing(user_id);
CREATE INDEX idx_customer_pricing_customer_id ON customer_pricing(customer_id);
CREATE INDEX idx_customer_pricing_inventory_id ON customer_pricing(inventory_id);

-- ============================================================
-- MIGRATION: run these against an existing database
-- ============================================================
-- ALTER TABLE customers ADD COLUMN customer_type TEXT DEFAULT 'direct';
-- ALTER TABLE customers ADD COLUMN contractor_id TEXT REFERENCES customers(id);
-- ALTER TABLE jobs ADD COLUMN billing_customer_id TEXT REFERENCES customers(id);
-- ALTER TABLE job_notes ADD COLUMN display_timestamp DATETIME;
-- ALTER TABLE job_notes ADD COLUMN author_type TEXT DEFAULT 'admin';
-- ALTER TABLE job_notes ADD COLUMN portal_user_id TEXT;
-- ALTER TABLE job_images ADD COLUMN display_timestamp DATETIME;
-- ALTER TABLE job_images ADD COLUMN caption TEXT;
-- ALTER TABLE job_images ADD COLUMN author_type TEXT DEFAULT 'admin';
-- ALTER TABLE job_images ADD COLUMN portal_user_id TEXT;
