import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Job, Customer } from '@/lib/types';

// ─── Types ───────────────────────────────────────────────────────────────────

type SortField = 'title' | 'customer' | 'status' | 'priority' | 'scheduled_date' | 'total_amount' | 'created_at';
type SortDir = 'asc' | 'desc';

const ALL_COLUMNS = [
  { key: 'title',          label: 'Job Title' },
  { key: 'customer',       label: 'Customer' },
  { key: 'status',         label: 'Status' },
  { key: 'priority',       label: 'Priority' },
  { key: 'scheduled_date', label: 'Scheduled' },
  { key: 'total_amount',   label: 'Amount' },
  { key: 'created_at',     label: 'Created' },
  { key: 'description',    label: 'Description' },
] as const;

const DEFAULT_COLUMNS = ['title', 'customer', 'status', 'priority', 'scheduled_date', 'total_amount'];

const STATUS_COLORS: Record<string, string> = {
  requested:   'bg-purple-500/10 text-purple-400 border border-purple-500/30',
  pending:     'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  'in-progress': 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  completed:   'bg-green-500/10 text-green-400 border border-green-500/30',
  cancelled:   'bg-red-500/10 text-red-400 border border-red-500/30',
};

const PRIORITY_COLORS: Record<string, string> = {
  low:    'text-slate-400',
  medium: 'text-blue-400',
  high:   'text-orange-400',
  urgent: 'text-red-400',
};

const STORAGE_KEY = 'jms_jobs_columns';

// ─── Component ───────────────────────────────────────────────────────────────

export default function Jobs() {
  const router = useRouter();

  const [jobs, setJobs]           = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch]               = useState('');
  const [filterStatus, setFilterStatus]   = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCustomer, setFilterCustomer] = useState('all');

  // Sort
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDir, setSortDir]     = useState<SortDir>('desc');

  // Column config
  const [visibleCols, setVisibleCols] = useState<string[]>(DEFAULT_COLUMNS);
  const [showColPicker, setShowColPicker] = useState(false);

  // Selection / bulk
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [showBulkMenu, setShowBulkMenu] = useState(false);
  const [bulkWorking, setBulkWorking]   = useState(false);

  // ── Load preferences from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setVisibleCols(JSON.parse(saved)); } catch {}
    }
  }, []);

  const saveColumns = (cols: string[]) => {
    setVisibleCols(cols);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cols));
  };

  // ── Auth + data
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      loadData();
    });
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    const [jobsRes, custRes] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }),
      supabase.from('customers').select('*').order('name', { ascending: true }),
    ]);
    if (jobsRes.data) setJobs(jobsRes.data);
    if (custRes.data) setCustomers(custRes.data);
    setIsLoading(false);
  };

  // ── Helpers
  const customerName = (id: string) => {
    const c = customers.find(c => c.id === id);
    if (!c) return '—';
    const displayName = c.company_name || c.name;
    if (c.customer_type === 'sub_contact' && c.contractor_id) {
      const contractor = customers.find(p => p.id === c.contractor_id);
      const contractorDisplay = contractor ? (contractor.company_name || contractor.name) : null;
      return contractorDisplay ? `${contractorDisplay} (${displayName})` : displayName;
    }
    return displayName;
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  // ── Filtering
  const filtered = jobs.filter(j => {
    const cname = customerName(j.customer_id).toLowerCase();
    const matchSearch =
      j.title.toLowerCase().includes(search.toLowerCase()) ||
      cname.includes(search.toLowerCase()) ||
      (j.description || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus   = filterStatus   === 'all' || j.status   === filterStatus;
    const matchPriority = filterPriority === 'all' || j.priority === filterPriority;
    const matchCustomer = filterCustomer === 'all' || j.customer_id === filterCustomer;
    return matchSearch && matchStatus && matchPriority && matchCustomer;
  });

  // ── Sorting
  const sorted = [...filtered].sort((a, b) => {
    let av: any, bv: any;
    if (sortField === 'customer') {
      av = customerName(a.customer_id);
      bv = customerName(b.customer_id);
    } else {
      av = (a as any)[sortField] ?? '';
      bv = (b as any)[sortField] ?? '';
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="text-slate-600 ml-1">↕</span>;
    return <span className="text-blue-400 ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>;
  };

  // ── Selection
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === sorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sorted.map(j => j.id)));
    }
  };

  // ── Bulk: export service reports
  const handleBulkExportReports = async () => {
    setBulkWorking(true);
    const ids = Array.from(selected);
    // Open each job's detail page in new tabs so user can print individually
    // A full PDF merge would require a server function — open tabs is the practical client-side approach
    for (const id of ids) {
      const { data: reports } = await supabase
        .from('service_reports')
        .select('id')
        .eq('job_id', id)
        .limit(1);
      if (reports && reports.length > 0) {
        window.open(`/jobs/${id}/report?reportId=${reports[0].id}`, '_blank');
      }
    }
    setBulkWorking(false);
    setShowBulkMenu(false);
  };

  // ── Bulk: mark complete
  const handleBulkMarkComplete = async () => {
    setBulkWorking(true);
    await supabase
      .from('jobs')
      .update({ status: 'completed', updated_at: new Date().toISOString() })
      .in('id', Array.from(selected));
    await loadData();
    setSelected(new Set());
    setBulkWorking(false);
    setShowBulkMenu(false);
  };

  // ── Bulk: delete
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} job(s)? This cannot be undone.`)) return;
    setBulkWorking(true);
    await supabase.from('jobs').delete().in('id', Array.from(selected));
    await loadData();
    setSelected(new Set());
    setBulkWorking(false);
    setShowBulkMenu(false);
  };

  // ── Stats
  const stats = {
    total:     jobs.length,
    pending:   jobs.filter(j => j.status === 'pending').length,
    active:    jobs.filter(j => j.status === 'in-progress').length,
    completed: jobs.filter(j => j.status === 'completed').length,
  };

  // ── Column toggle
  const toggleCol = (key: string) => {
    if (visibleCols.includes(key)) {
      if (visibleCols.length === 1) return; // keep at least one
      saveColumns(visibleCols.filter(c => c !== key));
    } else {
      saveColumns([...visibleCols, key]);
    }
  };

  // ── Cell renderer
  const renderCell = (job: Job, colKey: string) => {
    switch (colKey) {
      case 'title':
        return (
          <Link href={`/jobs/${job.id}`} className="text-white font-medium hover:text-blue-400 transition">
            {job.title}
          </Link>
        );
      case 'customer':
        return <span className="text-slate-300">{customerName(job.customer_id)}</span>;
      case 'status':
        return (
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[job.status]}`}>
            {job.status}
          </span>
        );
      case 'priority':
        return (
          <span className={`text-sm font-medium capitalize ${PRIORITY_COLORS[job.priority]}`}>
            {job.priority}
          </span>
        );
      case 'scheduled_date':
        return <span className="text-slate-300 text-sm">{formatDate(job.scheduled_date)}</span>;
      case 'total_amount':
        return (
          <span className={job.total_amount ? 'text-green-400 font-medium' : 'text-slate-600'}>
            {job.total_amount ? `$${job.total_amount.toFixed(2)}` : '—'}
          </span>
        );
      case 'created_at':
        return <span className="text-slate-400 text-sm">{formatDate(job.created_at)}</span>;
      case 'description':
        return (
          <span className="text-slate-400 text-sm truncate max-w-xs block">
            {job.description || '—'}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-full px-6 py-8">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Jobs</h2>
            <p className="text-slate-400 mt-1">{jobs.length} total job{jobs.length !== 1 ? 's' : ''}</p>
          </div>
          <Link
            href="/jobs/new"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition text-center"
          >
            + Create Job
          </Link>
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

        {/* Toolbar */}
        <div className="flex flex-wrap gap-3 mb-4">
          {/* Search */}
          <input
            type="text"
            placeholder="Search jobs..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition w-56"
          />

          {/* Customer filter */}
          <select
            value={filterCustomer}
            onChange={e => setFilterCustomer(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">All Clients</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {/* Priority filter */}
          <select
            value={filterPriority}
            onChange={e => setFilterPriority(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
          >
            <option value="all">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>

          {/* Column picker */}
          <div className="relative">
            <button
              onClick={() => setShowColPicker(p => !p)}
              className="bg-slate-800 border border-slate-700 hover:border-slate-500 text-white rounded-lg px-3 py-2 text-sm transition flex items-center gap-2"
            >
              ⚙️ Columns
            </button>
            {showColPicker && (
              <div className="absolute top-10 right-0 bg-slate-800 border border-slate-700 rounded-xl p-4 z-20 w-52 shadow-xl">
                <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">Toggle Columns</p>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className="flex items-center gap-2 py-1.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={visibleCols.includes(col.key)}
                      onChange={() => toggleCol(col.key)}
                      className="accent-blue-500"
                    />
                    <span className="text-slate-300 text-sm group-hover:text-white transition">{col.label}</span>
                  </label>
                ))}
                <button
                  onClick={() => saveColumns(DEFAULT_COLUMNS)}
                  className="mt-3 w-full text-xs text-slate-500 hover:text-slate-300 transition"
                >
                  Reset to default
                </button>
              </div>
            )}
          </div>

          {/* Bulk actions */}
          {selected.size > 0 && (
            <div className="relative ml-auto">
              <button
                onClick={() => setShowBulkMenu(p => !p)}
                className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold transition flex items-center gap-2"
              >
                {selected.size} selected ▾
              </button>
              {showBulkMenu && (
                <div className="absolute top-10 right-0 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden z-20 w-56 shadow-xl">
                  <button
                    onClick={handleBulkExportReports}
                    disabled={bulkWorking}
                    className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                  >
                    📄 Export Service Reports
                  </button>
                  <button
                    onClick={handleBulkMarkComplete}
                    disabled={bulkWorking}
                    className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition disabled:opacity-50"
                  >
                    ✅ Mark as Completed
                  </button>
                  <button
                    onClick={() => { setSelected(new Set()); setShowBulkMenu(false); }}
                    className="w-full text-left px-4 py-3 text-sm text-slate-400 hover:bg-slate-700 transition"
                  >
                    ✕ Deselect All
                  </button>
                  <div className="border-t border-slate-700" />
                  <button
                    onClick={handleBulkDelete}
                    disabled={bulkWorking}
                    className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
                  >
                    🗑️ Delete Selected
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Results count */}
        <p className="text-slate-500 text-sm mb-3">
          Showing {sorted.length} of {jobs.length} jobs
          {selected.size > 0 && ` · ${selected.size} selected`}
        </p>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading jobs...</div>
        ) : sorted.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-white font-semibold text-lg mb-2">No jobs match your filters</p>
            <p className="text-slate-400 text-sm">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    {/* Select all */}
                    <th className="px-4 py-3 w-10">
                      <input
                        type="checkbox"
                        checked={selected.size === sorted.length && sorted.length > 0}
                        onChange={toggleSelectAll}
                        className="accent-blue-500"
                      />
                    </th>
                    {/* Dynamic columns */}
                    {ALL_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => (
                      <th
                        key={col.key}
                        className="px-4 py-3 text-left text-slate-400 font-medium cursor-pointer hover:text-white transition select-none whitespace-nowrap"
                        onClick={() => handleSort(col.key as SortField)}
                      >
                        {col.label}
                        <SortIcon field={col.key as SortField} />
                      </th>
                    ))}
                    {/* Actions */}
                    <th className="px-4 py-3 text-right text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((job, idx) => (
                    <tr
                      key={job.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition ${
                        selected.has(job.id) ? 'bg-blue-500/5' : ''
                      } ${idx === sorted.length - 1 ? 'border-b-0' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selected.has(job.id)}
                          onChange={() => toggleSelect(job.id)}
                          className="accent-blue-500"
                        />
                      </td>
                      {ALL_COLUMNS.filter(c => visibleCols.includes(c.key)).map(col => (
                        <td key={col.key} className="px-4 py-3">
                          {renderCell(job, col.key)}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end">
                          <Link
                            href={`/jobs/${job.id}`}
                            className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-3 py-1.5 rounded-lg transition"
                          >
                            Open
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Close dropdowns on outside click */}
      {(showColPicker || showBulkMenu) && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => { setShowColPicker(false); setShowBulkMenu(false); }}
        />
      )}
    </div>
  );
}
