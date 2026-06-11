import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { Job, Customer } from '@/lib/types';

interface CompanySettings {
  company_name: string;
  owner_name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  licence_number: string;
  abn: string;
  website: string;
  logo_url: string;
}

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  inventory_id: string | null;
}

interface JobAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
}

export default function InvoicePage() {
  const router = useRouter();
  const { id, gst } = router.query as { id: string; gst: string };

  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [gstEnabled, setGstEnabled] = useState(gst === 'true');
  const [invoiceNumber, setInvoiceNumber] = useState('');

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  useEffect(() => {
    setGstEnabled(gst === 'true');
  }, [gst]);

  const loadAll = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const [jobRes, companyRes, lineRes, attachRes] = await Promise.all([
      supabase.from('jobs').select('*').eq('id', id).single(),
      supabase.from('company_settings').select('*').eq('user_id', user?.id).single(),
      supabase.from('job_line_items').select('*').eq('job_id', id).order('created_at', { ascending: true }),
      supabase.from('job_attachments').select('*').eq('job_id', id).order('uploaded_at', { ascending: true }),
    ]);

    if (jobRes.data) {
      setJob(jobRes.data);
      const { data: cust } = await supabase.from('customers').select('*').eq('id', jobRes.data.customer_id).single();
      if (cust) setCustomer(cust);
    }
    if (companyRes.data) setCompany(companyRes.data);
    if (lineRes.data) setLineItems(lineRes.data);
    if (attachRes.data) setAttachments(attachRes.data);

    // Generate invoice number from job id + date
    const now = new Date();
    setInvoiceNumber(`INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${id.slice(-6).toUpperCase()}`);

    setIsLoading(false);
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const subtotal = lineItems.reduce((sum, li) => sum + li.amount, 0);
  const gstAmount = gstEnabled ? subtotal * 0.1 : 0;
  const total = subtotal + gstAmount;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 14);

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">Loading invoice...</div>
  );

  if (!job) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">Job not found.</div>
  );

  return (
    <>
      {/* Toolbar - hidden when printing */}
      <div className="print:hidden bg-slate-900 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => router.back()} className="text-slate-400 hover:text-white text-sm transition">← Back</button>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <div
              onClick={() => setGstEnabled(g => !g)}
              className={`relative w-9 h-5 rounded-full transition ${gstEnabled ? 'bg-blue-500' : 'bg-slate-600'}`}
            >
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${gstEnabled ? 'translate-x-4' : ''}`} />
            </div>
            <span className="text-slate-300 text-sm">Include GST (10%)</span>
          </label>
          <button onClick={() => window.print()}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition">
            🖨️ Print / Save as PDF
          </button>
        </div>
      </div>

      <div className="bg-white min-h-screen">
        <div className="max-w-3xl mx-auto px-10 py-10 print:px-8 print:py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-200">
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="Logo" className="h-16 w-auto object-contain" />
              ) : (
                <div className="w-16 h-16 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">JMS</span>
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold text-slate-900">{company?.company_name || 'Company Name'}</h1>
                {company?.owner_name && <p className="text-slate-600 text-sm">{company.owner_name}</p>}
                {company?.licence_number && <p className="text-slate-500 text-xs">Licence: {company.licence_number}</p>}
                {company?.abn && <p className="text-slate-500 text-xs">ABN: {company.abn}</p>}
              </div>
            </div>
            <div className="text-right">
              <h2 className="text-3xl font-bold text-slate-900 mb-2">INVOICE</h2>
              <p className="text-slate-600 font-medium">{invoiceNumber}</p>
              <p className="text-slate-500 text-sm mt-1">Date: {formatDate(new Date().toISOString())}</p>
              <p className="text-slate-500 text-sm">Due: {formatDate(dueDate.toISOString())}</p>
            </div>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">From</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-semibold">{company?.company_name}</p>
                {company?.address && <p>{company.address}</p>}
                {(company?.city || company?.state) && <p>{[company?.city, company?.state, company?.zip_code].filter(Boolean).join(', ')}</p>}
                {company?.phone && <p>{company.phone}</p>}
                {company?.email && <p>{company.email}</p>}
                {company?.website && <p>{company.website}</p>}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Bill To</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-semibold">{customer?.name}</p>
                {customer?.company_name && <p>{customer.company_name}</p>}
                {customer?.address && <p>{customer.address}</p>}
                {(customer?.city || customer?.state) && <p>{[customer?.city, customer?.state, customer?.zip_code].filter(Boolean).join(', ')}</p>}
                {customer?.phone && <p>{customer.phone}</p>}
                {customer?.email && <p>{customer.email}</p>}
              </div>
            </div>
          </div>

          {/* Job reference */}
          <div className="bg-slate-50 rounded-lg px-5 py-4 mb-6 border border-slate-200">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Job</p>
                <p className="text-slate-800 font-medium">{job.title}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Job Reference</p>
                <p className="text-slate-800 font-mono text-xs">{job.id.slice(-8).toUpperCase()}</p>
              </div>
              {job.scheduled_date && (
                <div>
                  <p className="text-slate-500 text-xs">Service Date</p>
                  <p className="text-slate-800">{formatDate(job.scheduled_date)}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500 text-xs">Status</p>
                <p className="text-slate-800 capitalize">{job.status}</p>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-sm mb-6 border border-slate-200 rounded-lg overflow-hidden">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left px-4 py-3 text-slate-600 font-semibold">Description</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold w-16">Qty</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold w-24">Unit Price</th>
                <th className="text-right px-4 py-3 text-slate-600 font-semibold w-24">Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-400 text-sm">No line items</td>
                </tr>
              ) : lineItems.map((item, idx) => (
                <tr key={item.id} className={`border-t border-slate-200 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                  <td className="px-4 py-3 text-slate-800">{item.description}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-slate-700">${item.unit_price.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-900">${item.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Subtotal</span>
                <span className="text-slate-800">${subtotal.toFixed(2)}</span>
              </div>
              {gstEnabled && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">GST (10%)</span>
                  <span className="text-slate-800">${gstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold pt-2 border-t border-slate-300">
                <span className="text-slate-900">Total {gstEnabled ? '(inc. GST)' : ''}</span>
                <span className="text-slate-900">${total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Payment details placeholder */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-5 mb-8">
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Payment Details</h4>
            <p className="text-slate-600 text-sm">Please make payment within 14 days of invoice date.</p>
            {company?.email && <p className="text-slate-600 text-sm mt-1">For queries contact: {company.email}</p>}
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Supporting Documents</h4>
              <div className="space-y-1">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <span>📎</span>
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                      className="hover:text-blue-600 transition underline print:no-underline print:text-slate-700">
                      {att.file_name}
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-slate-200 pt-6 text-center">
            <p className="text-slate-400 text-xs">
              {company?.company_name}
              {company?.abn ? ` · ABN: ${company.abn}` : ''}
              {company?.phone ? ` · ${company.phone}` : ''}
              {company?.email ? ` · ${company.email}` : ''}
            </p>
            {gstEnabled && (
              <p className="text-slate-400 text-xs mt-1">This document includes GST. Please retain for tax purposes.</p>
            )}
          </div>

        </div>
      </div>

      <style jsx global>{`
        @media print {
          @page { margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
