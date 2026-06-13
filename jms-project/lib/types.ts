// User Types
export interface User {
  id: string;
  email: string;
  name: string;
  company_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

// Customer Types
export type CustomerType = 'direct' | 'contractor' | 'sub_contact';

export interface Customer {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  company_name?: string;
  notes?: string;
  customer_type: CustomerType;
  contractor_id?: string; // set when customer_type === 'sub_contact'
  // joined fields
  contractor?: Customer;
  sub_contacts?: Customer[];
  portal_user?: PortalUser;
  created_at: string;
  updated_at: string;
}

// Job Types
export type JobStatus = 'pending' | 'in-progress' | 'completed' | 'cancelled';
export type JobPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Job {
  id: string;
  user_id: string;
  customer_id: string;
  billing_customer_id?: string; // if set, invoices go here instead of customer_id
  title: string;
  description?: string;
  status: JobStatus;
  priority: JobPriority;
  scheduled_date?: string;
  completed_date?: string;
  total_amount?: number;
  notes?: string;
  // joined fields
  customer?: Customer;
  billing_customer?: Customer;
  created_at: string;
  updated_at: string;
}

// Job Note Types
export interface JobNote {
  id: string;
  job_id: string;
  user_id: string;
  content: string;
  display_timestamp?: string; // overridable; falls back to created_at
  author_type: 'admin' | 'portal_user';
  portal_user_id?: string;
  created_at: string;
  updated_at: string;
}

// Job Image Types
export interface JobImage {
  id: string;
  job_id: string;
  user_id: string;
  image_url: string;
  file_name: string;
  file_size?: number;
  caption?: string;
  display_timestamp?: string; // overridable; falls back to uploaded_at
  author_type: 'admin' | 'portal_user';
  portal_user_id?: string;
  uploaded_at: string;
}

// Job Signature Types
export interface JobSignature {
  id: string;
  job_id: string;
  customer_id: string;
  signature_data: string;
  signed_at: string;
}

// Service Report Types
export interface ServiceReport {
  id: string;
  job_id: string;
  user_id: string;
  title: string;
  description?: string;
  work_performed?: string;
  parts_used?: string;
  labor_hours?: number;
  labor_rate?: number;
  created_at: string;
  updated_at: string;
}

// Contract Types
export interface Contract {
  id: string;
  job_id: string;
  user_id: string;
  customer_id: string;
  title: string;
  content: string;
  terms?: string;
  status: 'draft' | 'sent' | 'signed' | 'executed';
  signed_date?: string;
  created_at: string;
  updated_at: string;
}

// Invoice Types
export interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export interface Invoice {
  id: string;
  job_id?: string;
  user_id: string;
  customer_id: string;
  invoice_number: string;
  status: 'draft' | 'sent' | 'viewed' | 'paid';
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  payment_terms?: string;
  due_date?: string;
  paid_date?: string;
  notes?: string;
  items?: InvoiceItem[];
  created_at: string;
  updated_at: string;
}

// Inventory Types
export interface InventoryItem {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  sku?: string;
  category?: string;
  quantity: number;
  min_quantity?: number;
  unit_cost?: number;
  unit_price?: number;
  supplier?: string;
  location?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryTransaction {
  id: string;
  inventory_id: string;
  user_id: string;
  transaction_type: 'in' | 'out' | 'adjustment';
  quantity: number;
  reference_id?: string;
  notes?: string;
  created_at: string;
}

// Portal User Types
export interface PortalUser {
  id: string;
  user_id: string;
  customer_id: string;
  email: string;
  password_plain: string; // stored for admin visibility
  is_active: boolean;
  last_login?: string;
  customer?: Customer;
  created_at: string;
  updated_at: string;
}

export type PortalActivityType =
  | 'login'
  | 'logout'
  | 'job_viewed'
  | 'note_added'
  | 'note_edited'
  | 'photo_added'
  | 'password_changed';

export interface PortalActivityLog {
  id: string;
  portal_user_id: string;
  user_id: string;
  action_type: PortalActivityType;
  entity_type?: 'job' | 'note' | 'image';
  entity_id?: string;
  details?: string; // JSON
  ip_address?: string;
  created_at: string;
  portal_user?: PortalUser;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
