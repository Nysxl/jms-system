import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase';
import { Job, PortalUser } from '@/lib/types';

export default function PortalJobs() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledDate: '',
  });

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('Session:', session?.user?.id);
      if (!session) {
        router.push('/portal/login');
        return;
      }

      // Get portal user
      const { data: pu, error: puError } = await supabase
        .from('portal_users')
        .select('*')
        .eq('id', session.user.id)
        .single();

      console.log('Portal user:', pu, 'Error:', puError);
      if (pu) {
        setPortalUser(pu);
        loadJobs(pu.customer_id);
      } else {
        console.error('Portal user not found for session:', session.user.id);
      }
    } catch (err) {
      console.error('Session check failed:', err);
    }
  };

  const loadJobs = async (customerId: string) => {
    setIsLoading(true);
    console.log('Loading jobs for customer:', customerId);
    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', customerId)
      .order('scheduled_date', { ascending: true });
    console.log('Jobs query result:', { data, error });
    if (data) {
      setJobs(data);
      console.log('Jobs loaded:', data.length);
    }
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
        }),
      });

      if (res.ok) {
        const { job } = await res.json();
        setJobs([...jobs, job]);
        setFormData({ title: '', description: '', scheduledDate: '' });
        setShowCreateForm(false);
      } else {
        alert('Failed to create job');
      }
    } catch (err) {
      console.error('Create job error:', err);
      alert('Error creating job');
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      'pending': 'bg-yellow-500/20 text-yellow-400',
      'in-progress': 'bg-blue-500/20 text-blue-400',
      'completed': 'bg-green-500/20 text-green-400',
      'cancelled': 'bg-red-500/20 text-red-400',
    };
    return map[status] || 'bg-slate-600 text-slate-300';
  };

  if (!portalUser) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <PortalHeader portalUserEmail={portalUser.email} />

      <main className="max-w-7xl mx-auto px-6 py-8">
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

        {/* Create Job Form */}
        {showCreateForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h3 className="text-white font-semibold mb-4">Request a New Job</h3>
            <form onSubmit={handleCreateJob} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Job Title *</label>
                <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Kitchen renovation, System maintenance"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what work needs to be done..."
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Preferred Date</label>
                <input type="date" value={formData.scheduledDate} onChange={e => setFormData({ ...formData, scheduledDate: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500" />
              </div>
              <button type="submit" disabled={creating || !formData.title.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition">
                {creating ? 'Creating...' : 'Send Job Request'}
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
            <p className="text-slate-400 text-sm mb-6">Request your first job to get started.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {jobs.map(job => (
              <Link key={job.id} href={`/portal/jobs/${job.id}`}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-slate-600 transition cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-white font-semibold text-lg mb-2">{job.title}</h3>
                      {job.description && <p className="text-slate-400 text-sm mb-3">{job.description}</p>}
                      <div className="flex items-center gap-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor(job.status)}`}>
                          {job.status}
                        </span>
                        {job.scheduled_date && (
                          <span className="text-slate-400 text-sm">
                            📅 {new Date(job.scheduled_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-slate-500 text-2xl">→</div>
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
