// Database utility functions for D1/SQLite
import { Job, Customer, JobNote } from '@/lib/types';

export interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  exec(sql: string): Promise<{ success: boolean }>;
}

export interface D1PreparedStatement {
  bind(...values: any[]): D1PreparedStatement;
  first<T = Record<string, any>>(): Promise<T | null>;
  all<T = Record<string, any>>(): Promise<T[]>;
  run(): Promise<{ success: boolean }>;
}

// Job operations
export async function createJob(db: D1Database, job: Partial<Job> & { id: string }) {
  const stmt = db.prepare(`
    INSERT INTO jobs (id, user_id, customer_id, title, description, status, priority, scheduled_date, total_amount, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  return stmt
    .bind(
      job.id,
      job.user_id,
      job.customer_id,
      job.title,
      job.description || null,
      job.status || 'pending',
      job.priority || 'medium',
      job.scheduled_date || null,
      job.total_amount || null,
      job.notes || null
    )
    .run();
}

export async function getJob(db: D1Database, jobId: string) {
  return db
    .prepare('SELECT * FROM jobs WHERE id = ?')
    .bind(jobId)
    .first<Job>();
}

export async function getJobs(db: D1Database, userId: string) {
  return db
    .prepare('SELECT * FROM jobs WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<Job>();
}

export async function updateJob(db: D1Database, jobId: string, updates: Partial<Job>) {
  const fields = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');

  const values = Object.values(updates);
  values.push(jobId);

  return db
    .prepare(`UPDATE jobs SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...values)
    .run();
}

export async function deleteJob(db: D1Database, jobId: string) {
  return db
    .prepare('DELETE FROM jobs WHERE id = ?')
    .bind(jobId)
    .run();
}

// Customer operations
export async function createCustomer(db: D1Database, customer: Partial<Customer> & { id: string; user_id: string }) {
  const stmt = db.prepare(`
    INSERT INTO customers (id, user_id, name, email, phone, address, city, state, zip_code, company_name, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);

  return stmt
    .bind(
      customer.id,
      customer.user_id,
      customer.name,
      customer.email,
      customer.phone || null,
      customer.address || null,
      customer.city || null,
      customer.state || null,
      customer.zip_code || null,
      customer.company_name || null,
      customer.notes || null
    )
    .run();
}

export async function getCustomer(db: D1Database, customerId: string) {
  return db
    .prepare('SELECT * FROM customers WHERE id = ?')
    .bind(customerId)
    .first<Customer>();
}

export async function getCustomers(db: D1Database, userId: string) {
  return db
    .prepare('SELECT * FROM customers WHERE user_id = ? ORDER BY created_at DESC')
    .bind(userId)
    .all<Customer>();
}

export async function updateCustomer(db: D1Database, customerId: string, updates: Partial<Customer>) {
  const fields = Object.keys(updates)
    .map(key => `${key} = ?`)
    .join(', ');

  const values = Object.values(updates);
  values.push(customerId);

  return db
    .prepare(`UPDATE customers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(...values)
    .run();
}

// Job Notes operations
export async function createJobNote(db: D1Database, note: Partial<JobNote> & { id: string }) {
  return db
    .prepare(`
      INSERT INTO job_notes (id, job_id, user_id, content, created_at, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `)
    .bind(note.id, note.job_id, note.user_id, note.content)
    .run();
}

export async function getJobNotes(db: D1Database, jobId: string) {
  return db
    .prepare('SELECT * FROM job_notes WHERE job_id = ? ORDER BY created_at DESC')
    .bind(jobId)
    .all<JobNote>();
}
