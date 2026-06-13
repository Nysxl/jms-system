import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Quotation } from '@/lib/types';
import { format } from 'date-fns';

export default function Quotations() {
  const router = useRouter();
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      loadQuotations();
    });
  }, [router]);

  const loadQuotations = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('quotations')
      .select('*, customer:customers(*)')
      .order('created_at', { ascending: false });
    if (data) setQuotations(data);
    setIsLoading(false);
  };

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-600 text-slate-300',
      sent: 'bg-blue-500/20 text-blue-300',
      accepted: 'bg-green-500/20 text-green-400',
      rejected: 'bg-red-500/20 text-red-400',
      expired: 'bg-yellow-500/20 text-yellow-400',
    };
    return map[status] || 'bg-slate-600 text-slate-300';
  };

  const filtered = quotations.filter(q => {
    const matchSearch = q.title.toLowerCase().includes(search.toLowerCase()) ||
      (q.customer?.name || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || q.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Quotations</h2>
            <p className="text-slate-400 mt-1">{quotations.length} quotation{quotations.length !== 1 ? 's' : ''}</p>
          </div>
          <Link href="/quotations/new"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">
            + New Quotation
          </Link>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          <input type="text" placeholder="Search quotations..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-blue-500">
            <option value="all">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading quotations...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <p className="text-5xl mb-4">📄</p>
            <p className="text-white font-semibold mb-2">No quotations found</p>
            <p className="text-slate-400 text-sm mb-6">Create your first quotation to get started.</p>
            <Link href="/quotations/new"
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition inline-block">
              + New Quotation
            </Link>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700 bg-slate-900/50">
                  <th className="px-6 py-3 text-left text-slate-300 font-semibold">Title</th>
                  <th className="px-6 py-3 text-left text-slate-300 font-semibold">Customer</th>
                  <th className="px-6 py-3 text-right text-slate-300 font-semibold">Amount</th>
                  <th className="px-6 py-3 text-left text-slate-300 font-semibold">Status</th>
                  <th className="px-6 py-3 text-left text-slate-300 font-semibold">Valid Until</th>
                  <th className="px-6 py-3 text-right text-slate-300 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => (
                  <tr key={q.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition">
                    <td className="px-6 py-4"><p className="text-white font-medium">{q.title}</p></td>
                    <td className="px-6 py-4 text-slate-400">{q.customer?.name}</td>
                    <td className="px-6 py-4 text-right text-white font-semibold">${q.total_amount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(q.status)}`}>{q.status}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{q.valid_until ? format(new Date(q.valid_until), 'dd MMM yyyy') : '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/quotations/${q.id}`}
                        className="text-blue-400 hover:text-blue-300 text-xs font-medium transition">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
