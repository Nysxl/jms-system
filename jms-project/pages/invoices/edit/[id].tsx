import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';

interface Invoice {
  id: string;
  job_id: string;
  customer_id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  amount_paid: number;
  notes: string;
  payment_terms: string;
  created_at: string;
}

interface InvoiceItem {
  id: string;
  invoice_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export default function EditInvoice() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ status: '', due_date: '', notes: '' });

  useEffect(() => {
    if (id) loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    setIsLoading(true);
    const [invRes, itemsRes] = await Promise.all([
      supabase.from('invoices').select('*').eq('id', id).single(),
      supabase.from('invoice_items').select('*').eq('invoice_id', id).order('sort_order'),
    ]);
    if (invRes.data) {
      setInvoice(invRes.data);
      setEditForm({ status: invRes.data.status, due_date: invRes.data.due_date || '', notes: invRes.data.notes || '' });
    }
    if (itemsRes.data) setItems(itemsRes.data);
    setIsLoading(false);
  };

  const handleItemChange = (idx: number, field: string, value: any) => {
    const updated = [...items];
    if (field === 'quantity') {
      updated[idx].quantity = parseFloat(value) || 0;
      updated[idx].total = updated[idx].quantity * updated[idx].unit_price;
    } else if (field === 'unit_price') {
      updated[idx].unit_price = parseFloat(value) || 0;
      updated[idx].total = updated[idx].quantity * updated[idx].unit_price;
    } else if (field === 'description') {
      updated[idx].description = value;
    }
    setItems(updated);
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: '',
      invoice_id: invoice!.id,
      description: '',
      quantity: 1,
      unit_price: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const deleteItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx);
    setItems(updated);
  };

  const saveChanges = async () => {
    if (!invoice) return;
    setIsSaving(true);

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxAmount = invoice.tax_amount || 0;
    const total = subtotal + taxAmount;

    try {
      await supabase.from('invoices').update({
        status: editForm.status,
        due_date: editForm.due_date || null,
        notes: editForm.notes,
        subtotal,
        total_amount: total,
      }).eq('id', id);

      for (const item of items) {
        if (item.id) {
          // Update existing item
          await supabase.from('invoice_items').update({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          }).eq('id', item.id);
        } else {
          // Insert new item
          await supabase.from('invoice_items').insert({
            invoice_id: invoice!.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.total,
          });
        }
      }

      alert('Invoice updated successfully');
      setInvoice({ ...invoice, status: editForm.status, due_date: editForm.due_date, notes: editForm.notes, subtotal, total_amount: total });
    } catch (err) {
      alert('Failed to save invoice');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;
  if (!invoice) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Invoice not found</p></div>;

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxAmount = invoice.tax_amount || 0;
  const total = subtotal + taxAmount;

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-6xl mx-auto px-6 py-8">
        <Link href={`/jobs/${invoice.job_id}`} className="text-slate-400 hover:text-slate-300 text-sm mb-4 inline-block">← Back to Job</Link>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8">
          <h1 className="text-3xl font-bold text-white mb-2">{invoice.invoice_number}</h1>
          <p className="text-slate-400 text-sm mb-6">Issued {new Date(invoice.issue_date).toLocaleDateString()}</p>

          <div className="grid grid-cols-3 gap-4 mb-8">
            <div>
              <label className="block text-slate-400 text-sm mb-1">Status</label>
              <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm">
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="viewed">Viewed</option>
                <option value="paid">Paid</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Due Date</label>
              <input type="date" value={editForm.due_date} onChange={e => setEditForm({ ...editForm, due_date: e.target.value })}
                className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">Amount Paid</label>
              <p className="text-white font-semibold">${(invoice.amount_paid || 0).toFixed(2)}</p>
            </div>
          </div>

          <div className="mb-8">
            <label className="block text-slate-400 text-sm mb-2">Notes</label>
            <textarea value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })} rows={3}
              className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm" />
          </div>

          {/* Line Items */}
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-white font-semibold">Line Items</h3>
              <button onClick={addItem}
                className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-3 py-1.5 rounded transition">
                + Add Item
              </button>
            </div>
            {items.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-8">No items. Click "Add Item" to start.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left text-slate-400 font-medium pb-3">Description</th>
                      <th className="text-right text-slate-400 font-medium pb-3 px-4">Qty</th>
                      <th className="text-right text-slate-400 font-medium pb-3 px-4">Unit Price</th>
                      <th className="text-right text-slate-400 font-medium pb-3">Total</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => (
                      <tr key={idx} className="border-b border-slate-700">
                        <td className="py-3">
                          <input type="text" value={item.description} onChange={e => handleItemChange(idx, 'description', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm" />
                        </td>
                        <td className="px-4">
                          <input type="number" value={item.quantity} onChange={e => handleItemChange(idx, 'quantity', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm text-right" />
                        </td>
                        <td className="px-4">
                          <input type="number" value={item.unit_price} onChange={e => handleItemChange(idx, 'unit_price', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-600 text-white rounded px-2 py-1 text-sm text-right" step="0.01" />
                        </td>
                        <td className="text-right py-3 text-white font-medium">${item.total.toFixed(2)}</td>
                        <td className="text-center">
                          <button onClick={() => deleteItem(idx)}
                            className="text-red-400 hover:text-red-300 text-sm transition">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="flex justify-end mb-8 space-y-2 w-64">
            <div className="flex justify-between text-slate-400 text-sm">
              <span>Subtotal:</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-400 text-sm">
              <span>Tax:</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-white font-bold text-lg border-t border-slate-700 pt-2">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>

          <button onClick={saveChanges} disabled={isSaving}
            className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-lg transition">
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </main>
    </div>
  );
}
