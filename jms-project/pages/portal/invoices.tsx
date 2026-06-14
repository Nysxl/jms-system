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
  const [invoiceJob, setInvoiceJob] = useState<any | null>(null);
  const [company, setCompany] = useState<any | null>(null);

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
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('customer_id', portalUser.customer_id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });

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
    try {
      setSelectedInvoice(invoice);
      const [itemsRes, jobRes] = await Promise.all([
        supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id),
        supabase.from('jobs').select('*').eq('id', invoice.job_id).single(),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (jobRes.error) throw jobRes.error;

      setInvoiceItems(itemsRes.data || []);
      setInvoiceJob(jobRes.data || null);

      try {
        const compRes = await supabase.from('company_settings').select('*').single();
        setCompany(compRes.data || { company_name: 'Company Name' });
      } catch (err) {
        console.warn('Failed to load company settings:', err);
        setCompany({ company_name: 'Company Name' });
      }
    } catch (err) {
      console.error('Failed to load invoice details:', err);
      setSelectedInvoice(null);
      alert('Failed to load invoice details. Please try again.');
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

        {selectedInvoice && invoiceJob && company && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 px-4 py-4">
            <div className="bg-white rounded-xl w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl">
              <div className="bg-slate-100 px-6 py-4 border-b border-slate-200 flex justify-between items-center sticky top-0">
                <h3 className="text-lg font-semibold text-slate-900">{selectedInvoice.invoice_number}</h3>
                <button onClick={() => setSelectedInvoice(null)} className="text-slate-500 hover:text-slate-700 text-2xl transition">✕</button>
              </div>
              <div className="overflow-y-auto flex-1 p-8 space-y-6">
                <div className="flex items-start justify-between pb-6 border-b-2 border-slate-200">
                  <div className="flex items-center gap-4">
                    {company.logo_url ? (
                      <img src={company.logo_url} alt="logo" className="h-12 w-auto object-contain" />
                    ) : (
                      <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">logo</span>
                      </div>
                    )}
                    <div>
                      <h1 className="text-lg font-bold text-slate-900">{company.company_name}</h1>
                      {company.owner_name && <p className="text-slate-600 text-xs">{company.owner_name}</p>}
                    </div>
                  </div>
                  <div className="text-right">
                    <h2 className="text-2xl font-bold text-slate-900 mb-1">INVOICE</h2>
                    <p className="text-slate-600 font-medium text-sm">{selectedInvoice.invoice_number}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <h3 className="text-slate-500 font-semibold mb-1">FROM</h3>
                    <p className="text-slate-700 font-semibold">{company.company_name}</p>
                    {company.address && <p className="text-slate-600">{company.address}</p>}
                    {company.phone && <p className="text-slate-600">{company.phone}</p>}
                  </div>
                  <div>
                    <h3 className="text-slate-500 font-semibold mb-1">BILL TO</h3>
                    <p className="text-slate-700 font-semibold">{portalUser?.customer?.name}</p>
                    {portalUser?.customer?.company_name && <p className="text-slate-600">{portalUser.customer.company_name}</p>}
                    {portalUser?.customer?.phone && <p className="text-slate-600">{portalUser.customer.phone}</p>}
                  </div>
                </div>

                <div className="bg-slate-50 rounded p-3 border border-slate-200 text-xs space-y-1">
                  <div><span className="text-slate-500">Job:</span> <span className="font-medium text-slate-800">{invoiceJob.title}</span></div>
                  <div><span className="text-slate-500">Due:</span> <span className="text-slate-800">{new Date(selectedInvoice.due_date).toLocaleDateString()}</span></div>
                </div>

                <table className="w-full text-xs border border-slate-200 rounded overflow-hidden">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="text-left px-2 py-2 text-slate-600 font-semibold">Description</th>
                      <th className="text-right px-2 py-2 text-slate-600 font-semibold">Qty</th>
                      <th className="text-right px-2 py-2 text-slate-600 font-semibold">Unit Price</th>
                      <th className="text-right px-2 py-2 text-slate-600 font-semibold">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceItems.length === 0 ? (
                      <tr><td colSpan={4} className="px-2 py-3 text-center text-slate-400">No line items</td></tr>
                    ) : invoiceItems.map((item, idx) => (
                      <tr key={idx} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className="px-2 py-2 text-slate-700">{item.description}</td>
                        <td className="text-right px-2 py-2 text-slate-700">{item.quantity}</td>
                        <td className="text-right px-2 py-2 text-slate-700">${item.unit_price?.toFixed(2) || '0.00'}</td>
                        <td className="text-right px-2 py-2 font-medium text-slate-900">${(item.total || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end text-xs space-y-1">
                  <div className="w-40">
                    <div className="flex justify-between text-slate-600 pb-1">
                      <span>Subtotal:</span>
                      <span>${(selectedInvoice.subtotal || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 pb-2">
                      <span>Tax:</span>
                      <span>${(selectedInvoice.tax_amount || 0).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                      <span>Total:</span>
                      <span>${(selectedInvoice.total_amount || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs">
                  <h4 className="font-semibold text-slate-700 mb-2">Payment Details</h4>
                  <p className="text-slate-600 mb-2">Status: <span className="font-medium capitalize">{selectedInvoice.status}</span></p>
                  {selectedInvoice.amount_paid > 0 && (
                    <p className="text-slate-600">Amount Paid: <span className="font-medium">${selectedInvoice.amount_paid.toFixed(2)}</span></p>
                  )}
                  {company.bsb || company.account_number ? (
                    <div className="bg-white border border-slate-200 rounded p-2 text-slate-700 mt-2">
                      <p className="font-semibold mb-1">Bank Transfer</p>
                      {company.bsb && <p><span className="text-slate-500">BSB:</span> {company.bsb}</p>}
                      {company.account_number && <p><span className="text-slate-500">Account:</span> {company.account_number}</p>}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
