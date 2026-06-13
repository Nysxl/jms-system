import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase';
import { PortalUser } from '@/lib/types';

export default function PortalClientDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [client, setClient] = useState<any>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'jobs' | 'invoices'>('jobs');

  useEffect(() => { checkSession(); }, []);

  useEffect(() => {
    if (id && portalUser) loadData();
  }, [id, portalUser]);

  const checkSession = async () => {
    const stored = localStorage.getItem('portal_session');
    if (!stored) { router.push('/portal/login'); return; }
    const pu = JSON.parse(stored);
    setPortalUser(pu);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { localStorage.removeItem('portal_session'); router.push('/portal/login'); return; }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const stored = localStorage.getItem('portal_session');
      const pu = stored ? JSON.parse(stored) : null;
      if (!pu) return;
      const res = await fetch(`/api/portal/get-client?portalUserId=${pu.id}&clientId=${id}`);
      if (res.ok) {
        const data = await res.json();
        setClient(data.client);
        setJobs(data.jobs || []);
        setInvoices(data.invoices || []);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      requested: 'bg-purple-500/20 text-purple-400',
      pending: 'bg-yellow-500/20 text-yellow-400',
      'in-progress': 'bg-blue-500/20 text-blue-400',
      completed: 'bg-green-500/20 text-green-400',
      cancelled: 'bg-red-500/20 text-red-400',
      draft: 'bg-slate-600/40 text-slate-300',
      sent: 'bg-blue-500/20 text-blue-400',
      paid: 'bg-green-500/20 text-green-400',
    };
    return map[s] || 'bg-slate-600 text-slate-300';
  };

  if (!portalUser) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <PortalHeader portalUserEmail={portalUser.email} customerType="contractor" />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/portal/clients" className="text-slate-400 hover:text-white transition text-sm">← My Clients</Link>
          <span className="text-slate-600">/</span>
          <h2 className="text-2xl font-bold text-white">{client?.company_name || client?.name || '...'}</h2>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading...</div>
        ) : !client ? (
          <p className="text-slate-400">Client not found</p>
        ) : (
          <>
            {/* Client Info */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <p className="text-slate-500 text-xs mb-1">Name</p>
                  <p className="text-white font-semibold">{client.name}</p>
                </div>
                {client.company_name && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Company</p>
                    <p className="text-white">{client.company_name}</p>
                  </div>
                )}
                {client.email && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Email</p>
                    <p className="text-slate-300">{client.email}</p>
                  </div>
                )}
                {client.phone && (
                  <div>
                    <p className="text-slate-500 text-xs mb-1">Phone</p>
                    <p className="text-slate-300">{client.phone}</p>
                  </div>
                )}
                {client.address && (
                  <div className="col-span-2">
                    <p className="text-slate-500 text-xs mb-1">Address</p>
                    <p className="text-slate-300">{client.address}{client.city ? `, ${client.city}` : ''}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-white">{jobs.length}</p>
                <p className="text-slate-400 text-sm mt-1">Jobs</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-green-400">{jobs.filter(j => j.status === 'completed').length}</p>
                <p className="text-slate-400 text-sm mt-1">Completed</p>
              </div>
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 text-center">
                <p className="text-2xl font-bold text-orange-400">
                  ${invoices.filter(i => i.status !== 'paid').reduce((s: number, i: any) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0).toFixed(2)}
                </p>
                <p className="text-slate-400 text-sm mt-1">Outstanding</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6 w-fit">
              <button onClick={() => setTab('jobs')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'jobs' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                Jobs ({jobs.length})
              </button>
              <button onClick={() => setTab('invoices')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'invoices' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
                Invoices ({invoices.length})
              </button>
            </div>

            {tab === 'jobs' && (
              <div className="space-y-3">
                {jobs.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No jobs yet</p>
                ) : jobs.map(job => (
                  <Link key={job.id} href={`/portal/jobs/${job.id}`}>
                    <div className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-500 transition cursor-pointer">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold">{job.title}</p>
                          {job.description && <p className="text-slate-400 text-sm mt-0.5 line-clamp-1">{job.description}</p>}
                          {job.scheduled_date && (
                            <p className="text-slate-500 text-xs mt-1">📅 {new Date(job.scheduled_date).toLocaleDateString()}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(job.status)}`}>{job.status}</span>
                          <span className="text-slate-500 text-xs">{new Date(job.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {tab === 'invoices' && (
              <div className="space-y-3">
                {invoices.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-8">No invoices yet</p>
                ) : invoices.map((inv: any) => (
                  <div key={inv.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-semibold">{inv.invoice_number}</p>
                        {inv.due_date && <p className="text-slate-500 text-xs mt-0.5">Due {new Date(inv.due_date).toLocaleDateString()}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-white font-bold">${(inv.total_amount || 0).toFixed(2)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inv.status)}`}>{inv.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
