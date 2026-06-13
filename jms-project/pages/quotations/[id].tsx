import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Quotation, QuotationItem, Customer } from '@/lib/types';

export default function QuotationDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [items, setItems] = useState<QuotationItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [convertingToJob, setConvertingToJob] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ status: '', valid_until: '', notes: '' });

  useEffect(() => {
    if (id) loadQuotation();
  }, [id]);

  const loadQuotation = async () => {
    setIsLoading(true);
    const { data: q } = await supabase
      .from('quotations')
      .select('*')
      .eq('id', id)
      .single();

    if (!q) { router.push('/quotations'); return; }
    setQuotation(q);
    setEditForm({ status: q.status, valid_until: q.valid_until || '', notes: q.notes || '' });

    const [{ data: its }, { data: cust }] = await Promise.all([
      supabase.from('quotation_items').select('*').eq('quotation_id', id).order('created_at'),
      supabase.from('customers').select('*').eq('id', q.customer_id).single(),
    ]);
    if (its) setItems(its);
    if (cust) setCustomer(cust);
    setIsLoading(false);
  };

  const saveChanges = async () => {
    if (!quotation) return;
    setSaving(true);
    const { error } = await supabase
      .from('quotations')
      .update({
        status: editForm.status,
        valid_until: editForm.valid_until || null,
        notes: editForm.notes || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (!error) {
      setQuotation({ ...quotation, ...editForm, status: editForm.status as Quotation['status'] });
      setEditMode(false);
    }
    setSaving(false);
  };

  const convertToJob = async () => {
    if (!quotation || !customer) return;
    if (!confirm('Convert this quotation to a job?')) return;
    setConvertingToJob(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: job, error } = await supabase
        .from('jobs')
        .insert({
          user_id: user!.id,
          customer_id: quotation.customer_id,
          title: quotation.title,
          description: quotation.description || '',
          status: 'pending',
          priority: 'medium',
          total_amount: quotation.total_amount,
        })
        .select()
        .single();
      if (error) throw error;

      await supabase.from('quotations').update({ status: 'accepted' }).eq('id', id);
      router.push(`/jobs/${job.id}`);
    } catch (err: any) {
      alert('Failed to convert: ' + err.message);
    } finally {
      setConvertingToJob(false);
    }
  };

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      draft: 'bg-slate-600/40 text-slate-300 border border-slate-600',
      sent: 'bg-blue-500/10 text-blue-300 border border-blue-500/30',
      accepted: 'bg-green-500/10 text-green-400 border border-green-500/30',
      rejected: 'bg-red-500/10 text-red-400 border border-red-500/30',
      expired: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
    };
    return map[s] || 'bg-slate-600 text-slate-300';
  };

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-slate-400">Loading...</p>
    </div>
  );

  if (!quotation) return null;

  const gstAmount = quotation.tax_amount || 0;

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/quotations" className="text-slate-400 hover:text-white transition text-sm">← Quotations</Link>
          <span className="text-slate-600">/</span>
          <h2 className="text-2xl font-bold text-white truncate">{quotation.title}</h2>
        </div>

        {/* Header Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-slate-400 text-sm mb-1">Customer</p>
              <p className="text-white font-semibold text-lg">{customer?.company_name || customer?.name}</p>
              {customer?.company_name && <p className="text-slate-400 text-sm">{customer.name}</p>}
              {customer?.email && <p className="text-slate-500 text-sm">{customer.email}</p>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`px-3 py-1 rounded-full text-sm font-semibold ${statusColor(quotation.status)}`}>
                {quotation.status}
              </span>
              <p className="text-3xl font-bold text-white">${quotation.total_amount.toFixed(2)}</p>
              {quotation.valid_until && (
                <p className="text-slate-400 text-sm">Valid until {new Date(quotation.valid_until).toLocaleDateString()}</p>
              )}
            </div>
          </div>

          {quotation.description && (
            <p className="text-slate-400 text-sm mt-4 pt-4 border-t border-slate-700">{quotation.description}</p>
          )}

          <div className="flex gap-2 mt-5 flex-wrap">
            <button onClick={() => setEditMode(!editMode)}
              className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition">
              {editMode ? 'Cancel Edit' : 'Edit'}
            </button>
            {quotation.status !== 'accepted' && (
              <button onClick={convertToJob} disabled={convertingToJob}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition">
                {convertingToJob ? 'Converting...' : 'Convert to Job'}
              </button>
            )}
          </div>
        </div>

        {/* Edit Panel */}
        {editMode && (
          <div className="bg-slate-800 border border-blue-500/30 rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4">Edit Quotation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Status</label>
                <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Valid Until</label>
                <input type="date" value={editForm.valid_until}
                  onChange={e => setEditForm({ ...editForm, valid_until: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-300 text-sm font-medium mb-1">Notes</label>
                <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
            <button onClick={saveChanges} disabled={saving}
              className="mt-4 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 px-6 rounded-lg transition">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Line Items */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Line Items</h3>
          {items.length === 0 ? (
            <p className="text-slate-500 text-sm">No line items</p>
          ) : (
            <>
              <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 font-medium mb-2 px-1">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              <div className="space-y-2">
                {items.map(item => (
                  <div key={item.id} className="grid grid-cols-12 gap-2 py-2 border-b border-slate-700/50 last:border-0">
                    <div className="col-span-6 text-slate-200 text-sm">{item.description}</div>
                    <div className="col-span-2 text-right text-slate-400 text-sm">{item.quantity}</div>
                    <div className="col-span-2 text-right text-slate-400 text-sm">${item.unit_price.toFixed(2)}</div>
                    <div className="col-span-2 text-right text-white text-sm font-medium">${item.amount.toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700 space-y-1">
                <div className="flex justify-between text-slate-400 text-sm">
                  <span>Subtotal</span><span>${quotation.subtotal.toFixed(2)}</span>
                </div>
                {gstAmount > 0 && (
                  <div className="flex justify-between text-slate-400 text-sm">
                    <span>GST (10%)</span><span>${gstAmount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-white font-bold text-lg pt-1">
                  <span>Total</span><span>${quotation.total_amount.toFixed(2)}</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Notes */}
        {quotation.notes && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-2">Notes</h3>
            <p className="text-slate-400 text-sm whitespace-pre-wrap">{quotation.notes}</p>
          </div>
        )}

        <p className="text-slate-600 text-xs mt-6">
          Created {new Date(quotation.created_at).toLocaleDateString()} · Last updated {new Date(quotation.updated_at).toLocaleDateString()}
        </p>
      </main>
    </div>
  );
}
