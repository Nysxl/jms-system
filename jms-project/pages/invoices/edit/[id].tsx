import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Job, Customer } from '@/lib/types';

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

interface CompanySettings {
  company_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  logo_url: string;
  bsb?: string;
  account_number?: string;
  show_logo?: boolean;
  show_company_name?: boolean;
  invoice_accent_color?: string;
}

const printStyles = `
  @media print {
    body { margin: 0; padding: 0; }
    .print-hidden { display: none !important; }
    .print-only { display: block !important; }
    .grid { display: block !important; }
    .lg\\:grid-cols-2 { grid-template-columns: 1fr !important; }
  }
`;

export default function EditInvoice() {
  const router = useRouter();
  const { id } = router.query as { id: string };
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [editForm, setEditForm] = useState({ status: '', due_date: '', notes: '' });
  const [accentColor, setAccentColor] = useState('#3b82f6');

  useEffect(() => {
    if (id) loadInvoice();
  }, [id]);

  const loadInvoice = async () => {
    setIsLoading(true);
    try {
      const [invRes, itemsRes] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', id).single(),
        supabase.from('invoice_items').select('*').eq('invoice_id', id),
      ]);

      if (invRes.data) {
        setInvoice(invRes.data);
        setEditForm({ status: invRes.data.status, due_date: invRes.data.due_date || '', notes: invRes.data.notes || '' });

        // Load job and customer
        const [jobRes, custRes, compRes] = await Promise.all([
          supabase.from('jobs').select('*').eq('id', invRes.data.job_id).single(),
          supabase.from('customers').select('*').eq('id', invRes.data.customer_id).single(),
          supabase.from('company_settings').select('*').single(),
        ]);
        if (jobRes.data) setJob(jobRes.data);
        if (custRes.data) setCustomer(custRes.data);
        if (compRes.data) {
          setCompany(compRes.data);
          setAccentColor(compRes.data.invoice_accent_color || '#3b82f6');
        }
      }
      if (itemsRes.data) setItems(itemsRes.data);
    } finally {
      setIsLoading(false);
    }
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

    if (items.length === 0) {
      alert('Invoice must have at least one item');
      return;
    }

    const subtotal = items.reduce((s, i) => s + i.total, 0);
    const taxAmount = invoice.tax_amount || 0;
    const total = subtotal + taxAmount;

    if (total <= 0) {
      alert('Invoice total must be greater than $0');
      return;
    }

    setIsSaving(true);

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

  const submitInvoice = async () => {
    if (!invoice) return;
    setIsSaving(true);
    try {
      await supabase.from('invoices').update({
        status: 'sent',
        updated_at: new Date().toISOString(),
      }).eq('id', invoice.id);
      setEditForm({ ...editForm, status: 'sent' });
      setInvoice({ ...invoice, status: 'sent' });
      alert('Invoice submitted successfully');
    } catch (err) {
      alert('Failed to submit invoice');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!invoice) return;
    setIsDeleting(true);
    try {
      await supabase.from('invoice_items').delete().eq('invoice_id', invoice.id);
      await supabase.from('invoices').delete().eq('id', invoice.id);
      alert('Invoice deleted successfully');
      router.push(`/jobs/${invoice.job_id}`);
    } catch (err) {
      alert('Failed to delete invoice');
    } finally {
      setIsDeleting(false);
      setDeleteConfirm(false);
    }
  };

  const downloadPdf = async () => {
    const element = document.getElementById('invoice-document');
    if (!element) return;
    setIsDownloading(true);
    const opt = {
      margin: 10,
      filename: `${invoice?.invoice_number}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
    };
    if ((window as any).html2pdf) {
      ;(window as any).html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false));
    } else {
      const script = document.createElement('script');
      script.onload = () => {
        ;(window as any).html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false));
      };
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      document.head.appendChild(script);
    }
  };

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;
  if (!invoice) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Invoice not found</p></div>;

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const taxAmount = invoice.tax_amount || 0;
  const total = subtotal + taxAmount;
  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  return (
    <div className="min-h-screen bg-slate-950">
      <style>{printStyles}</style>
      <div className="print-hidden">
        <Header />
      </div>
      <main className="mx-auto px-6 py-8">
        <Link href={`/jobs/${invoice.job_id}`} className="text-slate-400 hover:text-slate-300 text-sm mb-4 inline-block print-hidden">← Back to Job</Link>

        <div className={`grid gap-6 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
          {/* Edit Form */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 print-hidden">
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
          <div className="flex flex-col justify-end mb-8 space-y-2 w-64 ml-auto">
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

          <div className="flex gap-3 flex-wrap">
            <button onClick={saveChanges} disabled={isSaving}
              className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-lg transition">
              {isSaving ? 'Saving...' : 'Save as Draft'}
            </button>
            {invoice?.status === 'draft' && (
              <button onClick={submitInvoice} disabled={isSaving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-6 py-3 rounded-lg transition">
                {isSaving ? 'Submitting...' : 'Submit Invoice'}
              </button>
            )}
            <button onClick={() => setShowPreview(!showPreview)}
              className="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-lg transition">
              {showPreview ? '👁️ Hide Preview' : '👁️ Show Preview'}
            </button>
            <button onClick={() => setDeleteConfirm(true)}
              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold px-6 py-3 rounded-lg transition">
              🗑️ Delete Invoice
            </button>
          </div>
          </div>

          {/* Print Preview */}
          {showPreview && job && customer && company && (
            <div className="bg-white rounded-xl overflow-hidden shadow-lg flex flex-col">
              <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 flex gap-2">
                <button onClick={downloadPdf} disabled={isDownloading}
                  className="text-sm bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white px-3 py-1.5 rounded transition">
                  {isDownloading ? '📥 Downloading...' : '📥 Download PDF'}
                </button>
              </div>
              <div className="p-8 space-y-6 max-h-[calc(90vh-60px)] overflow-y-auto">
                <div id="invoice-document" className="bg-white" style={{ '--accent-color': accentColor } as React.CSSProperties}>
                <div className="border border-slate-300 rounded-lg p-6" style={{ borderBottom: `2px solid ${accentColor}` }}>
                  <div className="flex items-start justify-between pb-6">
                    <div className="flex items-center gap-4">
                      {company.show_logo && company.logo_url ? (
                        <img src={company.logo_url} alt="logo" className="h-12 w-auto object-contain" />
                      ) : company.show_logo ? (
                        <div style={{ backgroundColor: accentColor }} className="w-12 h-12 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-sm">logo</span>
                        </div>
                      ) : null}
                      {company.show_company_name && (
                        <div>
                          <h1 className="text-lg font-bold text-slate-900">{company.company_name}</h1>
                          {company.owner_name && <p className="text-slate-600 text-xs">{company.owner_name}</p>}
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <h2 style={{ color: accentColor }} className="text-2xl font-bold mb-1">INVOICE</h2>
                      <p className="text-slate-600 font-medium text-sm">{invoice.invoice_number}</p>
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
                      <p className="text-slate-700 font-semibold">{customer.name}</p>
                      {customer.company_name && <p className="text-slate-600">{customer.company_name}</p>}
                      {customer.phone && <p className="text-slate-600">{customer.phone}</p>}
                    </div>
                  </div>
                </div>

                <div className="border border-slate-300 rounded-lg p-3 bg-slate-50 text-xs space-y-1 mt-8">
                  <div><span className="text-slate-500">Job:</span> <span className="font-medium text-slate-800">{job.title}</span></div>
                  <div><span className="text-slate-500">Due:</span> <span className="text-slate-800">{formatDate(invoice.due_date)}</span></div>
                </div>

                <div style={{ height: '2px', backgroundColor: accentColor }} className="my-6"></div>

                <div className="border border-slate-300 rounded-lg overflow-hidden">
                <table className="w-full text-xs">
                  <thead style={{ backgroundColor: accentColor }}>
                    <tr>
                      <th className="text-left px-2 py-2 font-semibold text-white">Description</th>
                      <th className="text-right px-2 py-2 font-semibold text-white">Qty</th>
                      <th className="text-right px-2 py-2 font-semibold text-white">Unit Price</th>
                      <th className="text-right px-2 py-2 font-semibold text-white">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr><td colSpan={4} className="px-2 py-3 text-center text-slate-400">No line items</td></tr>
                    ) : items.map((item, idx) => (
                      <tr key={idx} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                        <td className="px-2 py-2 text-slate-700">{item.description}</td>
                        <td className="text-right px-2 py-2 text-slate-700">{item.quantity}</td>
                        <td className="text-right px-2 py-2 text-slate-700">${item.unit_price.toFixed(2)}</td>
                        <td className="text-right px-2 py-2 font-medium text-slate-900">${item.total.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>

                <div style={{ height: '2px', backgroundColor: accentColor }} className="my-4"></div>

                <div className="border border-slate-300 rounded-lg p-4 flex justify-end">
                  <div className="w-40">
                    <div className="flex justify-between text-slate-600 pb-1 text-xs">
                      <span>Subtotal:</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-600 pb-2 text-xs">
                      <span>Tax:</span>
                      <span>${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold pt-2 text-xs" style={{ borderTop: `2px solid ${accentColor}`, color: accentColor }}>
                      <span>Total:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div style={{ height: '2px', backgroundColor: accentColor }} className="my-4"></div>

                <div className="bg-slate-50 border border-slate-300 rounded-lg p-4 text-xs">
                  <h4 className="font-semibold text-slate-700 mb-2">Payment Details</h4>
                  <p className="text-slate-600 mb-2">Payment is due within 30 days</p>
                  <div className="bg-white border border-slate-200 rounded p-2 text-slate-700">
                    <p className="font-semibold mb-1">Bank Transfer</p>
                    {company.bsb && <p><span className="text-slate-500">BSB:</span> {company.bsb}</p>}
                    {company.account_number && <p><span className="text-slate-500">Account:</span> {company.account_number}</p>}
                  </div>
                </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-4">⚠️</p>
            <h3 className="text-white font-semibold text-lg mb-2">Delete Invoice?</h3>
            <p className="text-slate-400 text-sm mb-6">This action cannot be undone. The invoice and all its line items will be permanently deleted.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
              <button onClick={handleDelete} disabled={isDeleting} className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
