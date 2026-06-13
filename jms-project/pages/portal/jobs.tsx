import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase';
import { Job, PortalUser } from '@/lib/types';

interface SubContact {
  id: string;
  name: string;
  company_name?: string;
}

export default function PortalJobs() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [subContacts, setSubContacts] = useState<SubContact[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledDate: '',
    subContactId: '',
  });

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const stored = localStorage.getItem('portal_session');
      if (!stored) { router.push('/portal/login'); return; }

      const pu = JSON.parse(stored);
      setPortalUser(pu);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        localStorage.removeItem('portal_session');
        router.push('/portal/login');
        return;
      }

      loadData(pu.customer_id);
    } catch (err) {
      localStorage.removeItem('portal_session');
      router.push('/portal/login');
    }
  };

  const loadData = async (customerId: string) => {
    setIsLoading(true);

    // Load sub-contacts
    const { data: subs } = await supabase
      .from('customers')
      .select('id, name, company_name')
      .eq('contractor_id', customerId)
      .eq('customer_type', 'sub_contact');

    if (subs) setSubContacts(subs);

    // Load jobs for this customer + all sub-contacts
    const customerIds = [customerId, ...(subs?.map(s => s.id) || [])];
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });

    if (data) setJobs(data);
    setIsLoading(false);
  };

  const handleCreateJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!portalUser || !formData.title.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/portal/create-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalUserId: portalUser.id,
          title: formData.title,
          description: formData.description,
          scheduledDate: formData.scheduledDate || null,
          subContactId: formData.subContactId || null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setFormData({ title: '', description: '', scheduledDate: '', subContactId: '' });
        setShowCreateForm(false);
        loadData(portalUser.customer_id);
      } else {
        alert('Failed to create job request: ' + (data.error || res.status));
      }
    } catch (err) {
      alert('Error creating job request');
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      'requested': 'bg-purple-500/20 text-purple-400',
      'pending': 'bg-yellow-500/20 text-yellow-400',
      'in-progress': 'bg-blue-500/20 text-blue-400',
      'completed': 'bg-green-500/20 text-green-400',
      'cancelled': 'bg-red-500/20 text-red-400',
    };
    return map[status] || 'bg-slate-600 text-slate-300';
  };

  const getJobCustomerLabel = (job: Job) => {
    if (job.customer_id === portalUser?.customer_id) return null;
    const sub = subContacts.find(s => s.id === job.customer_id);
    return sub ? (sub.company_name || sub.name) : null;
  };

  if (!portalUser) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-slate-400">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <PortalHeader portalUserEmail={portalUser.email} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Jobs</h2>
            <p className="text-slate-400 mt-1">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">
            {showCreateForm ? '✕ Cancel' : '+ Request Job'}
          </button>
        </div>

        {/* Sub-contacts list */}
        {subContacts.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-6">
            <h3 className="text-white font-semibold mb-3 text-sm uppercase tracking-wide">Your Sub-Contacts</h3>
            <div className="flex flex-wrap gap-2">
              {subContacts.map(sc => (
                <span key={sc.id} className="px-3 py-1.5 bg-slate-700 text-slate-200 text-sm rounded-lg">
                  {sc.company_name || sc.name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Request Job Form */}
        {showCreateForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h3 className="text-white font-semibold mb-4">Request a New Job</h3>
            <form onSubmit={handleCreateJob} className="space-y-4">
              {subContacts.length > 0 && (
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Job For</label>
                  <select
                    value={formData.subContactId}
                    onChange={e => setFormData({ ...formData, subContactId: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition"
                  >
                    <option value="">Myself</option>
                    {subContacts.map(sc => (
                      <option key={sc.id} value={sc.id}>{sc.company_name || sc.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Job Title *</label>
                <input type="text" value={formData.title}
                  onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Kitchen renovation, System maintenance"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what work needs to be done..."
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Preferred Date</label>
                <input type="date" value={formData.scheduledDate}
                  onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500" />
              </div>
              <button type="submit" disabled={creating || !formData.title.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition">
                {creating ? 'Sending...' : 'Send Job Request'}
              </button>
            </form>
          </div>
        )}

        {/* Jobs List */}
        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading jobs...</div>
        ) : jobs.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-white font-semibold mb-2">No jobs yet</p>
            <p className="text-slate-400 text-sm">Request your first job to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => (
              <Link key={job.id} href={`/portal/jobs/${job.id}`}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="text-white font-semibold">{job.title}</h3>
                        {getJobCustomerLabel(job) && (
                          <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded-full">
                            {getJobCustomerLabel(job)}
                          </span>
                        )}
                      </div>
                      {job.description && <p className="text-slate-400 text-sm mb-2 line-clamp-1">{job.description}</p>}
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusColor(job.status)}`}>
                          {job.status}
                        </span>
                        {job.scheduled_date && (
                          <span className="text-slate-500 text-xs">
                            📅 {new Date(job.scheduled_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-slate-600 text-xl">→</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
