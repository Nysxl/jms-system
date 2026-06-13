import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Customer, JobStatus, JobPriority } from '@/lib/types';

const emptyForm = {
  customer_id: '',
  billing_customer_id: '',
  title: '',
  description: '',
  status: 'pending' as JobStatus,
  priority: 'medium' as JobPriority,
  scheduled_date: '',
  total_amount: '',
  notes: '',
};

export default function NewJob() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      supabase.from('customers').select('*').order('name').then(({ data }) => {
        if (data) setCustomers(data);
      });
    });
  }, [router]);

  const selectedCustomer = customers.find(c => c.id === form.customer_id);
  const isSubContact = selectedCustomer?.customer_type === 'sub_contact';
  // Auto-set billing to contractor when sub_contact is selected
  const handleCustomerChange = (id: string) => {
    const c = customers.find(x => x.id === id);
    setForm(prev => ({
      ...prev,
      customer_id: id,
      billing_customer_id: c?.customer_type === 'sub_contact' && c.contractor_id ? c.contractor_id : '',
    }));
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.customer_id || !form.title.trim()) {
      setError('Customer and title are required.');
      return;
    }
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setError('Not logged in.'); setIsSaving(false); return; }

    const { data, error: err } = await supabase.from('jobs').insert([{
      customer_id: form.customer_id,
      billing_customer_id: form.billing_customer_id || null,
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      scheduled_date: form.scheduled_date || null,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
      notes: form.notes,
      user_id: session.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]).select().single();

    if (err) { setError(err.message); setIsSaving(false); return; }
    router.push(`/jobs/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-6">
          <Link href="/jobs" className="text-slate-500 hover:text-slate-300 text-sm transition">
            ← Back to Jobs
          </Link>
        </div>

        <h2 className="text-3xl font-bold text-white mb-8">Create Job</h2>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">Customer / Site Contact *</label>
              <select
                value={form.customer_id}
                onChange={e => handleCustomerChange(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Select a customer</option>
                <optgroup label="Direct Clients">
                  {customers.filter(c => c.customer_type === 'direct' || !c.customer_type).map(c => (
                    <option key={c.id} value={c.id}>{c.name}{c.company_name ? ` — ${c.company_name}` : ''}</option>
                  ))}
                </optgroup>
                <optgroup label="Contractor Contacts">
                  {customers.filter(c => c.customer_type === 'sub_contact').map(c => {
                    const contractor = customers.find(x => x.id === c.contractor_id);
                    return (
                      <option key={c.id} value={c.id}>{c.name} ({contractor?.company_name || contractor?.name || 'contractor'})</option>
                    );
                  })}
                </optgroup>
              </select>
              {isSubContact && selectedCustomer && (
                <p className="text-slate-500 text-xs mt-1">
                  Contact under {customers.find(x => x.id === selectedCustomer.contractor_id)?.company_name || 'contractor'}
                </p>
              )}
            </div>

            {/* Billing override — shown always but pre-filled for sub_contacts */}
            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">
                Bill To
                {isSubContact && <span className="text-slate-500 text-xs font-normal ml-2">(defaults to contractor)</span>}
              </label>
              <select
                value={form.billing_customer_id}
                onChange={e => setForm({ ...form, billing_customer_id: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
              >
                <option value="">Same as site contact</option>
                {customers.filter(c => c.customer_type !== 'sub_contact').map(c => (
                  <option key={c.id} value={c.id}>{c.company_name || c.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">Job Title *</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="Enter job title"
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">Description</label>
              <textarea
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                rows={3}
                placeholder="Job description..."
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Status</label>
                <select
                  value={form.status}
                  onChange={e => setForm({ ...form, status: e.target.value as JobStatus })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="pending">Pending</option>
                  <option value="in-progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Priority</label>
                <select
                  value={form.priority}
                  onChange={e => setForm({ ...form, priority: e.target.value as JobPriority })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Scheduled Date</label>
                <input
                  type="datetime-local"
                  value={form.scheduled_date}
                  onChange={e => setForm({ ...form, scheduled_date: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Amount ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.total_amount}
                  onChange={e => setForm({ ...form, total_amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 text-sm font-medium mb-1">Notes</label>
              <textarea
                value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                rows={2}
                placeholder="Additional notes..."
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <Link
                href="/jobs"
                className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
              >
                {isSaving ? 'Creating...' : 'Create Job'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
