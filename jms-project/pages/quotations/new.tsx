import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Customer } from '@/lib/types';

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
}

export default function NewQuotation() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [gstEnabled, setGstEnabled] = useState(false);
  const [form, setForm] = useState({
    customer_id: '',
    title: '',
    description: '',
    valid_until: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { id: '1', description: '', quantity: 1, unit_price: 0, amount: 0 },
  ]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      supabase.from('customers').select('id, name, company_name, customer_type').order('name').then(({ data }) => {
        if (data) setCustomers(data as any);
      });
    });
  }, [router]);

  const updateLine = (id: string, field: string, value: string | number) => {
    setLineItems(prev => prev.map(li => {
      if (li.id !== id) return li;
      const updated = { ...li, [field]: value };
      if (field === 'quantity' || field === 'unit_price') {
        updated.amount = Number(updated.quantity) * Number(updated.unit_price);
      }
      return updated;
    }));
  };

  const addLine = () => setLineItems(prev => [
    ...prev,
    { id: Date.now().toString(), description: '', quantity: 1, unit_price: 0, amount: 0 },
  ]);

  const removeLine = (id: string) => setLineItems(prev => prev.filter(li => li.id !== id));

  const subtotal = lineItems.reduce((s, li) => s + li.amount, 0);
  const gstAmount = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gstAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.customer_id) { setError('Please select a customer.'); return; }
    if (!form.title.trim()) { setError('Title is required.'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: quotation, error: qErr } = await supabase
        .from('quotations')
        .insert({
          user_id: user!.id,
          customer_id: form.customer_id,
          title: form.title,
          description: form.description || null,
          subtotal,
          tax_amount: gstAmount,
          total_amount: total,
          status: 'draft',
          valid_until: form.valid_until || null,
          notes: form.notes || null,
        })
        .select()
        .single();

      if (qErr) throw qErr;

      if (lineItems.filter(li => li.description).length > 0) {
        await supabase.from('quotation_items').insert(
          lineItems
            .filter(li => li.description.trim())
            .map(li => ({
              quotation_id: quotation.id,
              description: li.description,
              quantity: li.quantity,
              unit_price: li.unit_price,
              amount: li.amount,
            }))
        );
      }

      router.push(`/quotations/${quotation.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create quotation');
    } finally {
      setSaving(false);
    }
  };

  const customerLabel = (c: Customer) => c.company_name ? `${c.company_name} (${c.name})` : c.name;

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center gap-3 mb-8">
          <Link href="/quotations" className="text-slate-400 hover:text-white transition text-sm">← Quotations</Link>
          <span className="text-slate-600">/</span>
          <h2 className="text-2xl font-bold text-white">New Quotation</h2>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-4 py-3 mb-6 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 space-y-4">
            <h3 className="text-white font-semibold text-lg">Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Customer *</label>
                <select value={form.customer_id} onChange={e => setForm({ ...form, customer_id: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{customerLabel(c)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Kitchen renovation quote"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-300 text-sm font-medium mb-1">Description</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  rows={2} placeholder="Scope of work..."
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Valid Until</label>
                <input type="date" value={form.valid_until} onChange={e => setForm({ ...form, valid_until: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold text-lg">Line Items</h3>
              <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
                <input type="checkbox" checked={gstEnabled} onChange={e => setGstEnabled(e.target.checked)}
                  className="rounded border-slate-600" />
                Include GST (10%)
              </label>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs text-slate-400 font-medium px-1 mb-1">
                <div className="col-span-6">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-2 text-right">Unit Price</div>
                <div className="col-span-2 text-right">Amount</div>
              </div>
              {lineItems.map(li => (
                <div key={li.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <input type="text" value={li.description}
                      onChange={e => updateLine(li.id, 'description', e.target.value)}
                      placeholder="Item description"
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={li.quantity}
                      onChange={e => updateLine(li.id, 'quantity', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="col-span-2">
                    <input type="number" min="0" step="0.01" value={li.unit_price}
                      onChange={e => updateLine(li.id, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:border-blue-500" />
                  </div>
                  <div className="col-span-1 text-right text-white text-sm font-medium">
                    ${li.amount.toFixed(2)}
                  </div>
                  <div className="col-span-1 text-right">
                    {lineItems.length > 1 && (
                      <button type="button" onClick={() => removeLine(li.id)}
                        className="text-slate-500 hover:text-red-400 transition text-lg leading-none">×</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={addLine}
              className="mt-4 text-blue-400 hover:text-blue-300 text-sm transition">
              + Add Line Item
            </button>

            <div className="mt-6 pt-4 border-t border-slate-700 space-y-1 text-right">
              <div className="flex justify-between text-slate-400 text-sm">
                <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
              </div>
              {gstEnabled && (
                <div className="flex justify-between text-slate-400 text-sm">
                  <span>GST (10%)</span><span>${gstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-white font-bold text-lg pt-1">
                <span>Total</span><span>${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-3">Notes</h3>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={3} placeholder="Terms, conditions, or additional notes for the client..."
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          </div>

          <div className="flex gap-3 pb-8">
            <Link href="/quotations"
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-6 rounded-lg transition">
              Cancel
            </Link>
            <button type="submit" disabled={saving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 px-8 rounded-lg transition">
              {saving ? 'Creating...' : 'Create Quotation'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
