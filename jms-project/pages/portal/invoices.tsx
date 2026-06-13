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
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    const stored = localStorage.getItem('portal_session');
    if (!stored) { router.push('/portal/login'); return; }
    const pu = JSON.parse(stored);
    setPortalUser(pu);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { localStorage.removeItem('portal_session'); router.push('/portal/login'); return; }
    loadInvoices(pu);
  };

  const loadInvoices = async (portalUser: any) => {
    setIsLoading(true);
    try {
      console.log('Loading invoices for customer:', portalUser.customer_id);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', portalUser.customer_id)
        .order('created_at', { ascending: false });

      console.log('Invoices query result:', { data, error });
      if (error) throw error;
      if (data) setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const openInvoice = async (invoice: any) => {
    setSelectedInvoice(invoice);
    const { data } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('created_at', { ascending: true });
    setInvoiceItems(data || []);
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
                    <div className="text-right flex flex-col items-end gap-2">
                      <div>
                        <p className="text-white font-bold text-lg">${(inv.total_amount || 0).toFixed(2)}</p>
                        {inv.amount_paid > 0 && inv.status !== 'paid' && (
                          <p className="text-orange-400 text-sm">Owing: ${outstanding.toFixed(2)}</p>
                        )}
                        {inv.status === 'paid' && (
                          <p className="text-green-400 text-xs mt-1">✓ Paid {inv.paid_date ? new Date(inv.paid_date).toLocaleDateString() : ''}</p>
                        )}
                      </div>
                      <button onClick={() => openInvoice(inv)} className="text-blue-400 hover:text-blue-300 text-xs font-medium transition">
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedInvoice && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 sticky top-0 bg-slate-800">
                <h3 className="text-white font-semibold">{selectedInvoice.invoice_number}</h3>
                <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-white transition">✕</button>
              </div>
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-slate-400 text-sm">Status</p>
                    <p className="text-white font-semibold capitalize">{selectedInvoice.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Due Date</p>
                    <p className="text-white font-semibold">{selectedInvoice.due_date ? new Date(selectedInvoice.due_date).toLocaleDateString() : '—'}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Total Amount</p>
                    <p className="text-white font-semibold">${(selectedInvoice.total_amount || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 text-sm">Amount Paid</p>
                    <p className="text-green-400 font-semibold">${(selectedInvoice.amount_paid || 0).toFixed(2)}</p>
                  </div>
                </div>

                {invoiceItems.length > 0 && (
                  <div>
                    <h4 className="text-white font-semibold mb-3">Line Items</h4>
                    <div className="space-y-2">
                      {invoiceItems.map((item: any) => (
                        <div key={item.id} className="bg-slate-900 rounded p-3 flex justify-between">
                          <div className="flex-1">
                            <p className="text-white text-sm">{item.description}</p>
                            <p className="text-slate-400 text-xs">Qty: {item.quantity}</p>
                          </div>
                          <p className="text-white font-semibold text-right">
                            ${(item.total || 0).toFixed(2)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-slate-700 pt-4">
                  <div className="flex justify-between mb-2">
                    <p className="text-slate-400">Subtotal</p>
                    <p className="text-white">${(selectedInvoice.subtotal || 0).toFixed(2)}</p>
                  </div>
                  {selectedInvoice.tax_amount > 0 && (
                    <div className="flex justify-between mb-2">
                      <p className="text-slate-400">Tax</p>
                      <p className="text-white">${(selectedInvoice.tax_amount || 0).toFixed(2)}</p>
                    </div>
                  )}
                  <div className="flex justify-between pt-2 border-t border-slate-700">
                    <p className="text-white font-semibold">Total</p>
                    <p className="text-white font-bold text-lg">${(selectedInvoice.total_amount || 0).toFixed(2)}</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setSelectedInvoice(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
