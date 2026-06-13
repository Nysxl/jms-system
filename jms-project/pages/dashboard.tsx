import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { JobCard } from '@/components/JobCard';
import { supabase } from '@/lib/supabase';
import { Job, Customer } from '@/lib/types';

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
    totalRevenue: 0,
    paidRevenue: 0,
    outstandingRevenue: 0,
    overduInvoices: 0,
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      loadData();
    });
  }, [router]);

  const loadData = async () => {
    setIsLoading(true);
    const [jobsRes, custRes, invRes] = await Promise.all([
      supabase.from('jobs').select('*').order('created_at', { ascending: false }).limit(6),
      supabase.from('customers').select('*'),
      supabase.from('invoices').select('*'),
    ]);

    const jobsList = jobsRes.data || [];
    const custList = custRes.data || [];
    const invList = invRes.data || [];

    setJobs(jobsList);
    setCustomers(custList);

    const totalRev = invList.reduce((s, i) => s + (i.total_amount || 0), 0);
    const paidRev = invList.reduce((s, i) => s + (i.amount_paid || 0), 0);
    const overdueCount = invList.filter(i => i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()).length;

    setStats({
      totalJobs: jobsList.length,
      activeJobs: jobsList.filter(j => j.status === 'in-progress').length,
      completedJobs: jobsList.filter(j => j.status === 'completed').length,
      pendingJobs: jobsList.filter(j => j.status === 'pending').length,
      totalRevenue: totalRev,
      paidRevenue: paidRev,
      outstandingRevenue: totalRev - paidRev,
      overduInvoices: overdueCount,
    });

    // Get total count separately since we limited to 6
    const { count } = await supabase.from('jobs').select('*', { count: 'exact', head: true });
    if (count !== null) {
      setStats(s => ({ ...s, totalJobs: count }));
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">

        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white">Dashboard</h2>
          <p className="text-slate-400 mt-1">Welcome back — here's what's going on</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Total Jobs</p>
            <p className="text-3xl font-bold text-white mt-2">{stats.totalJobs}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-900/50 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Active</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{stats.activeJobs}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/50 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Pending</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.pendingJobs}</p>
          </div>
          <div className="bg-gradient-to-br from-green-900/50 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Completed</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{stats.completedJobs}</p>
          </div>
        </div>

        {/* Revenue KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-gradient-to-br from-purple-900/50 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Total Revenue</p>
            <p className="text-2xl font-bold text-purple-300 mt-2">${stats.totalRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-green-900/50 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Paid</p>
            <p className="text-2xl font-bold text-green-300 mt-2">${stats.paidRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-orange-900/50 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Outstanding</p>
            <p className="text-2xl font-bold text-orange-300 mt-2">${stats.outstandingRevenue.toFixed(2)}</p>
          </div>
          <div className="bg-gradient-to-br from-red-900/50 to-slate-900 rounded-xl border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Overdue</p>
            <p className="text-2xl font-bold text-red-300 mt-2">{stats.overduInvoices}</p>
          </div>
        </div>

        {/* Recent Jobs */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-white">Recent Jobs</h3>
            <div className="flex gap-3">
              <Link href="/jobs" className="text-slate-400 hover:text-white text-sm transition">
                View all →
              </Link>
              <Link href="/jobs/new"
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-5 rounded-lg transition text-sm">
                + Create Job
              </Link>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-16 text-slate-400">Loading...</div>
          ) : jobs.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
              <p className="text-5xl mb-4">📋</p>
              <p className="text-white font-semibold mb-2">No jobs yet</p>
              <p className="text-slate-400 text-sm mb-6">Create your first job to get started.</p>
              <Link href="/jobs/new"
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">
                + Create Job
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  customer={customers.find(c => c.id === job.customer_id)}
                />
              ))}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
