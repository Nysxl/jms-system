import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Invoice, Customer } from '@/lib/types';
import { format } from 'date-fns';

const PAYMENT_METHODS = ['Cash', 'Card', 'Bank Transfer', 'Cheque', 'Other'];

export default function InvoicesPage() {
  const router = useRouter();
  const [invoices, setInvoices] = useState<(Invoice & { customer?: Customer })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<(Invoice & { customer?: Customer }) | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount_paid: '', payment_method: '', paid_date: '', payment_notes: '' });
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      loadInvoices();
    });
  }, [router]);

  const loadInvoices = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('invoices')
      .select('*, customer:customers(*)')
      .order('created_at', { ascending: false });
    if (data) setInvoices(data);
    setIsLoading(false);
  };

  const openPaymentModal = (invoice: Invoice & { customer?: Customer }) => {
    setSelectedInvoice(invoice);
    setPaymentForm({
      amount_paid: (invoice.amount_paid || invoice.total_amount || 0).toString(),
      payment_method: invoice.payment_method || '',
      paid_date: invoice.paid_date ? invoice.paid_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      payment_notes: invoice.payment_notes || '',
    });
    setPaymentError('');
    setShowPaymentModal(true);
  };

  const savePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setPaymentError('');
    if (!selectedInvoice) return;
    if (!paymentForm.payment_method.trim()) { setPaymentError('Payment method is required.'); return; }

    setSavingPayment(true);
    const amountPaid = parseFloat(paymentForm.amount_paid) || 0;
    const newStatus = amountPaid >= (selectedInvoice.total_amount || 0) ? 'paid' : 'sent';

    const { error } = await supabase.from('invoices').update({
      amount_paid: amountPaid,
      payment_method: paymentForm.payment_method,
      paid_date: paymentForm.paid_date,
      payment_notes: paymentForm.payment_notes,
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedInvoice.id);

    if (error) { setPaymentError(error.message); setSavingPayment(false); return; }
    setSavingPayment(false);
    setShowPaymentModal(false);
    loadInvoices();
  };

  const filtered = invoices.filter(inv => {
    const matchesSearch = inv.invoice_number?.toLowerCase().includes(search.toLowerCase()) ||
      inv.customer?.name?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = filterStatus === 'all' || inv.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: invoices.length,
    paid: invoices.filter(i => i.status === 'paid').length,
    unpaid: invoices.filter(i => i.status !== 'paid').length,
    overdue: invoices.filter(i => i.status !== 'paid' && i.due_date && new Date(i.due_date) < new Date()).length,
  };

  const totalAmount = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);
  const paidAmount = invoices.reduce((s, i) => s + (i.amount_paid || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-3xl font-bold text-white mb-8">Invoices</h2>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Invoiced</p>
            <p className="text-2xl font-bold text-white mt-1">${totalAmount.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Paid</p>
            <p className="text-2xl font-bold text-green-400 mt-1">${paidAmount.toFixed(2)}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Outstanding</p>
            <p className="text-2xl font-bold text-orange-400 mt-1">${(totalAmount - paidAmount).toFixed(2)}</p>
          </div>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Overdue</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.overdue}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <input type="text" placeholder="Search invoice number or customer..." value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-64 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500">
            <option value="all">All Invoices</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="viewed">Viewed</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {/* Invoice Table */}
        {isLoading ? (
          <div className="text-center py-16 text-slate-400">Loading invoices...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No invoices found.</div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Invoice #</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Customer</th>
                    <th className="px-4 py-3 text-right text-slate-400 font-medium">Amount</th>
                    <th className="px-4 py-3 text-right text-slate-400 font-medium">Paid</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Due Date</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filtered.map(inv => {
                    const isOverdue = inv.status !== 'paid' && inv.due_date && new Date(inv.due_date) < new Date();
                    return (
                      <tr key={inv.id} className={isOverdue ? 'bg-red-500/5' : ''}>
                        <td className="px-4 py-3 text-white">{inv.invoice_number}</td>
                        <td className="px-4 py-3 text-slate-300">{inv.customer?.name || '—'}</td>
                        <td className="px-4 py-3 text-right text-white font-medium">${(inv.total_amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-green-400">${(inv.amount_paid || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-slate-400">
                          {inv.due_date ? format(new Date(inv.due_date), 'dd MMM yy') : '—'}
                          {isOverdue && <span className="ml-2 text-red-400 text-xs">OVERDUE</span>}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                            inv.status === 'paid' ? 'bg-green-500/20 text-green-300' :
                            inv.status === 'sent' ? 'bg-blue-500/20 text-blue-300' :
                            inv.status === 'viewed' ? 'bg-purple-500/20 text-purple-300' :
                            'bg-slate-600 text-slate-300'
                          }`}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <button onClick={() => openPaymentModal(inv)}
                            className="text-blue-400 hover:text-blue-300 text-xs font-medium transition">
                            {inv.status === 'paid' ? 'Update' : 'Mark Paid'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Record Payment</h3>
              <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={savePayment} className="p-6 space-y-4">
              {paymentError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{paymentError}</div>}
              <div>
                <p className="text-slate-300 text-sm font-medium mb-2">Invoice: {selectedInvoice.invoice_number}</p>
                <p className="text-slate-400 text-sm">Total: ${(selectedInvoice.total_amount || 0).toFixed(2)}</p>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Amount Paid ($)</label>
                <input type="number" min="0" step="0.01" value={paymentForm.amount_paid} onChange={e => setPaymentForm({ ...paymentForm, amount_paid: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Payment Method</label>
                <select value={paymentForm.payment_method} onChange={e => setPaymentForm({ ...paymentForm, payment_method: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select...</option>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Payment Date</label>
                <input type="date" value={paymentForm.paid_date} onChange={e => setPaymentForm({ ...paymentForm, paid_date: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Notes</label>
                <textarea value={paymentForm.payment_notes} onChange={e => setPaymentForm({ ...paymentForm, payment_notes: e.target.value })} rows={2}
                  placeholder="e.g. Reference number, customer notes..."
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPaymentModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingPayment} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {savingPayment ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
