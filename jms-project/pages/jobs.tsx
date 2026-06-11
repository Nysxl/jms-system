import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { JobCard } from '@/components/JobCard';
import { supabase } from '@/lib/supabase';
import { Job, Customer, JobStatus, JobPriority } from '@/lib/types';

const emptyForm = {
  customer_id: '',
  title: '',
  description: '',
  status: 'pending' as JobStatus,
  priority: 'medium' as JobPriority,
  scheduled_date: '',
  total_amount: '',
  notes: '',
};

export default function Jobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<JobStatus | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<JobPriority | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadJobs();
    loadCustomers();
  }, []);

  const loadJobs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setJobs(data);
    setIsLoading(false);
  };

  const loadCustomers = async () => {
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('name', { ascending: true });
    if (!error && data) setCustomers(data);
  };

  const openCreate = () => {
    setEditingJob(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (job: Job) => {
    setEditingJob(job);
    setForm({
      customer_id: job.customer_id || '',
      title: job.title || '',
      description: job.description || '',
      status: job.status,
      priority: job.priority,
      scheduled_date: job.scheduled_date ? job.scheduled_date.slice(0, 16) : '',
      total_amount: job.total_amount?.toString() || '',
      notes: job.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.customer_id || !form.title.trim()) {
      setFormError('Customer and title are required.');
      return;
    }

    setIsSaving(true);
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      customer_id: form.customer_id,
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      scheduled_date: form.scheduled_date || null,
      total_amount: form.total_amount ? parseFloat(form.total_amount) : null,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    };

    if (editingJob) {
      const { error } = await supabase
        .from('jobs')
        .update(payload)
        .eq('id', editingJob.id);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    } else {
      const { error } = await supabase
        .from('jobs')
        .insert([{ ...payload, user_id: user?.id, created_at: new Date().toISOString() }]);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    }

    setIsSaving(false);
    setShowModal(false);
    loadJobs();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('jobs').delete().eq('id', id);
    setDeleteConfirm(null);
    loadJobs();
  };

  const filtered = jobs.filter(j => {
    const customer = customers.find(c => c.id === j.customer_id);
    const matchesSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      (j.description || '').toLowerCase().includes(search.toLowerCase()) ||
      (customer?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || j.status === filterStatus;
    const matchesPriority = filterPriority === 'all' || j.priority === filterPriority;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  const stats = {
    total: jobs.length,
    pending: jobs.filter(j => j.status === 'pending').length,
    active: jobs.filter(j => j.status === 'in-progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Jobs</h2>
            <p className="text-slate-400 mt-1">{jobs.length} total job{jobs.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            + Create Job
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/40 to-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Pending</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pending}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Active</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">{stats.active}</p>
          </div>
          <div className="bg-gradient-to-br from-green-900/40 to-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Completed</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{stats.completed}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 max-w-sm bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as JobStatus | 'all')}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value as JobPriority | 'all')}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading jobs...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-white font-semibold text-lg mb-2">
              {search || filterStatus !== 'all' || filterPriority !== 'all'
                ? 'No jobs match your filters'
                : 'No jobs yet'}
            </p>
            <p className="text-slate-400 text-sm mb-6">
              {search || filterStatus !== 'all' || filterPriority !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Create your first job to get started.'}
            </p>
            {!search && filterStatus === 'all' && filterPriority === 'all' && (
              <button
                onClick={openCreate}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                + Create Job
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(job => (
              <div key={job.id} className="relative group">
                <JobCard
                  job={job}
                  customer={customers.find(c => c.id === job.customer_id)}
                />
                <div className="absolute top-3 right-3 hidden group-hover:flex gap-1">
                  <button
                    onClick={e => { e.preventDefault(); openEdit(job); }}
                    className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={e => { e.preventDefault(); setDeleteConfirm(job.id); }}
                    className="bg-red-500/20 hover:bg-red-500/40 text-red-400 text-xs px-2 py-1 rounded transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold text-lg">
                {editingJob ? 'Edit Job' : 'Create Job'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-xl transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Customer *</label>
                <select
                  value={form.customer_id}
                  onChange={e => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="">Select a customer</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
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
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
                >
                  {isSaving ? 'Saving...' : editingJob ? 'Save Changes' : 'Create Job'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-4">🗑️</p>
            <h3 className="text-white font-semibold text-lg mb-2">Delete Job?</h3>
            <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
