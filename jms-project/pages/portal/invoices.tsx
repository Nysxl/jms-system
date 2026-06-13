import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase';
import { PortalUser } from '@/lib/types';

export default function PortalInvoices() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    const stored = localStorage.getItem('portal_session');
    if (!stored) { router.push('/portal/login'); return; }
    const pu = JSON.parse(stored);
    setPortalUser(pu);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { localStorage.removeItem('portal_session'); router.push('/portal/login'); return; }
    loadInvoices(pu.customer_id);
  };

  const loadInvoices = async (customerId: string) => {
    setIsLoading(true);
    try {
      const { data: puRes } = await supabase
        .from('portal_users').select('id').eq('customer_id', customerId).single();

      if (!puRes) {
        setInvoices([]);
        setIsLoading(false);
        return;
      }

      const res = await fetch(`/api/portal/get-invoices?portalUserId=${puRes.id}`);
      const json = await res.json();
      if (json.invoices) setInvoices(json.invoices);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-600/40 text-slate-300',
      sent: 'bg-blue-500/20 text-blue-400',
      viewed: 'bg-indigo-500/20 text-indigo-400',
      paid: 'bg-green-500/20 text-green-400',
    };
    return map[s] || 'bg-slate-600 text-slate-300';
  };

  const totalOwed = invoices.filter(i => i.status !== 'paid').reduce((s: number, i: any) => s + ((i.total_amount || 0) - (i.amount_paid || 0)), 0);

  if (!portalUser) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <PortalHeader portalUserEmail={portalUser.email} />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white">Invoices</h2>
          {totalOwed > 0 && (
            <p className="text-slate-400 mt-1">Outstanding: <span className="text-orange-400 font-semibold">${totalOwed.toFixed(2)}</span></p>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading invoices...</div>
        ) : invoices.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <p className="text-5xl mb-4">🧾</p>
            <p className="text-white font-semibold mb-1">No invoices yet</p>
            <p className="text-slate-400 text-sm">Your invoices will appear here once issued.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {invoices.map((inv: any) => {
              const outstanding = (inv.total_amount || 0) - (inv.amount_paid || 0);
              return (
                <div key={inv.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-white font-semibold">{inv.invoice_number}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inv.status)}`}>{inv.status}</span>
                      </div>
                      {inv.job?.title && <p className="text-slate-400 text-sm">{inv.job.title}</p>}
                      {inv.due_date && (
                        <p className="text-slate-500 text-xs mt-1">
                          Due {new Date(inv.due_date).toLocaleDateString()}
                          {inv.status !== 'paid' && new Date(inv.due_date) < new Date() && (
                            <span className="text-red-400 ml-2">overdue</span>
                          )}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold text-lg">${(inv.total_amount || 0).toFixed(2)}</p>
                      {inv.amount_paid > 0 && inv.status !== 'paid' && (
                        <p className="text-orange-400 text-sm">Owing: ${outstanding.toFixed(2)}</p>
                      )}
                      {inv.status === 'paid' && (
                        <p className="text-green-400 text-xs mt-1">✓ Paid {inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : ''}</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
