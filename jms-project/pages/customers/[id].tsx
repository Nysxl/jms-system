import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Customer } from '@/lib/types';

export default function CustomerDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [contractor, setContractor] = useState<Customer | null>(null);
  const [subContacts, setSubContacts] = useState<Customer[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'jobs' | 'invoices' | 'visits' | 'sub-contacts'>('jobs');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
    });
  }, [router]);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    setIsLoading(true);
    const [{ data: cust }, { data: jobsData }, { data: invData }, { data: repsData }] = await Promise.all([
      supabase.from('customers').select('*').eq('id', id).single(),
      supabase.from('jobs').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('service_reports').select('*, job:jobs(title)').eq('job_id', id).order('created_at', { ascending: false }).limit(50),
    ]);
    if (cust) {
      setCustomer(cust);
      if (cust.contractor_id) {
        const { data: cont } = await supabase.from('customers').select('*').eq('id', cust.contractor_id).single();
        if (cont) setContractor(cont);
      }
      const { data: subs } = await supabase.from('customers').select('*').eq('contractor_id', id).eq('customer_type', 'sub_contact').order('name');
      if (subs) setSubContacts(subs);
    }
    if (jobsData) setJobs(jobsData);
    if (invData) setInvoices(invData);
    // get reports via jobs
    if (jobsData && jobsData.length > 0) {
      const jobIds = jobsData.map((j: any) => j.id);
      const { data: reps } = await supabase.from('service_reports').select('*, job:jobs(title)').in('job_id', jobIds).order('created_at', { ascending: false });
      if (reps) setReports(reps);
    }
    setIsLoading(false);
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      requested: 'bg-purple-500/10 text-purple-400',
      pending: 'bg-yellow-500/10 text-yellow-400',
      'in-progress': 'bg-blue-500/10 text-blue-400',
      completed: 'bg-green-500/10 text-green-400',
      cancelled: 'bg-red-500/10 text-red-400',
      draft: 'bg-slate-600/40 text-slate-300',
      sent: 'bg-blue-500/10 text-blue-400',
      paid: 'bg-green-500/10 text-green-400',
    };
    return map[s] || 'bg-slate-600 text-slate-300';
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>
  );

  if (!customer) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Customer not found</p></div>
  );

  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s: number, i: any) => s + (i.amount_paid || i.total_amount || 0), 0);
  const outstanding = invoices.filter(i => i.status !== 'paid').reduce((s: number, i: any) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);

  const tabs = [
    { key: 'jobs', label: `Jobs (${jobs.length})` },
    { key: 'invoices', label: `Invoices (${invoices.length})` },
    ...(subContacts.length > 0 ? [{ key: 'sub-contacts', label: `Sub-Contacts (${subContacts.length})` }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/customers" className="text-slate-400 hover:text-white transition text-sm">← Customers</Link>
          <span className="text-slate-600">/</span>
          <h2 className="text-2xl font-bold text-white">{customer.company_name || customer.name}</h2>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            customer.customer_type === 'contractor' ? 'bg-orange-500/20 text-orange-400' :
            customer.customer_type === 'sub_contact' ? 'bg-indigo-500/20 text-indigo-400' :
            'bg-slate-600/40 text-slate-300'
          }`}>{customer.customer_type}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Contact Info */}
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-white font-semibold">Contact Information</h3>
              <Link href={`/customers`} className="text-blue-400 hover:text-blue-300 text-sm transition">Edit</Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-500 text-xs mb-1">Full Name</p>
                <p className="text-white">{customer.name}</p>
              </div>
              {customer.company_name && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Company</p>
                  <p className="text-white">{customer.company_name}</p>
                </div>
              )}
              {customer.email && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Email</p>
                  <a href={`mailto:${customer.email}`} className="text-blue-400 hover:text-blue-300 transition">{customer.email}</a>
                </div>
              )}
              {customer.phone && (
                <div>
                  <p className="text-slate-500 text-xs mb-1">Phone</p>
                  <a href={`tel:${customer.phone}`} className="text-slate-300 hover:text-white transition">{customer.phone}</a>
                </div>
              )}
              {customer.address && (
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs mb-1">Address</p>
                  <p className="text-slate-300">{[customer.address, customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}</p>
                </div>
              )}
              {contractor && (
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs mb-1">Contractor</p>
                  <Link href={`/customers/${contractor.id}`} className="text-blue-400 hover:text-blue-300 transition">
                    {contractor.company_name || contractor.name}
                  </Link>
                </div>
              )}
            </div>
            {customer.notes && (
              <div className="mt-4 pt-4 border-t border-slate-700">
                <p className="text-slate-500 text-xs mb-1">Notes</p>
                <p className="text-slate-300 text-sm">{customer.notes}</p>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <p className="text-slate-400 text-sm">Total Jobs</p>
              <p className="text-3xl font-bold text-white mt-1">{jobs.length}</p>
              <div className="flex gap-3 mt-2 text-xs">
                <span className="text-blue-400">{jobs.filter(j => j.status === 'in-progress').length} active</span>
                <span className="text-green-400">{jobs.filter(j => j.status === 'completed').length} done</span>
              </div>
            </div>
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <p className="text-slate-400 text-sm">Revenue</p>
              <p className="text-2xl font-bold text-green-400 mt-1">${totalRevenue.toFixed(2)}</p>
              {outstanding > 0 && <p className="text-orange-400 text-sm mt-1">+${outstanding.toFixed(2)} outstanding</p>}
            </div>
            <Link href={`/jobs/new?customer_id=${id}`}
              className="block w-full text-center bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2.5 rounded-xl transition">
              + Create Job
            </Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6 w-fit overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${tab === t.key ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Jobs Tab */}
        {tab === 'jobs' && (
          <div className="space-y-3">
            {jobs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No jobs yet</div>
            ) : jobs.map(job => (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition cursor-pointer">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-semibold">{job.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(job.status)}`}>{job.status}</span>
                      </div>
                      {job.description && <p className="text-slate-400 text-sm line-clamp-1">{job.description}</p>}
                      <div className="flex gap-4 mt-2 text-xs text-slate-500">
                        {job.scheduled_date && <span>📅 {new Date(job.scheduled_date).toLocaleDateString()}</span>}
                        {job.total_amount && <span className="text-green-400 font-medium">${job.total_amount.toFixed(2)}</span>}
                      </div>
                    </div>
                    <span className="text-slate-500 text-xs whitespace-nowrap">{new Date(job.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Invoices Tab */}
        {tab === 'invoices' && (
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <div className="text-center py-12 text-slate-500">No invoices yet</div>
            ) : invoices.map((inv: any) => (
              <div key={inv.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-semibold">{inv.invoice_number}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inv.status)}`}>{inv.status}</span>
                    </div>
                    {inv.due_date && <p className="text-slate-500 text-xs">Due {new Date(inv.due_date).toLocaleDateString()}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold text-lg">${(inv.total_amount || 0).toFixed(2)}</p>
                    {inv.status === 'paid' && inv.paid_date && (
                      <p className="text-green-400 text-xs">Paid {new Date(inv.paid_date).toLocaleDateString()}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Sub-contacts Tab */}
        {tab === 'sub-contacts' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {subContacts.map(sc => (
              <Link key={sc.id} href={`/customers/${sc.id}`}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition cursor-pointer">
                  <p className="text-white font-semibold">{sc.company_name || sc.name}</p>
                  {sc.company_name && <p className="text-slate-400 text-sm">{sc.name}</p>}
                  {sc.email && <p className="text-slate-500 text-sm mt-1">{sc.email}</p>}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
