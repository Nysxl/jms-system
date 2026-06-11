import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { Job, Customer, ServiceReport, JobImage } from '@/lib/types';

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

export default function ServiceReportPage() {
  const router = useRouter();
  const { id, reportId } = router.query as { id: string; reportId: string };

  const [report, setReport] = useState<ServiceReport | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [images, setImages] = useState<JobImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id && reportId) loadAll();
  }, [id, reportId]);

  const loadAll = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();

    const [reportRes, jobRes, companyRes, imagesRes] = await Promise.all([
      supabase.from('service_reports').select('*').eq('id', reportId).single(),
      supabase.from('jobs').select('*').eq('id', id).single(),
      supabase.from('company_settings').select('*').eq('user_id', user?.id).single(),
      supabase.from('job_images').select('*').eq('job_id', id).order('uploaded_at', { ascending: true }),
    ]);

    if (reportRes.data) setReport(reportRes.data);
    if (jobRes.data) {
      setJob(jobRes.data);
      const { data: cust } = await supabase.from('customers').select('*').eq('id', jobRes.data.customer_id).single();
      if (cust) setCustomer(cust);
    }
    if (companyRes.data) setCompany(companyRes.data);
    if (imagesRes.data) setImages(imagesRes.data);

    setIsLoading(false);
  };

  const formatDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';

  const laborTotal =
    report?.labor_hours && report?.labor_rate
      ? (report.labor_hours * report.labor_rate).toFixed(2)
      : null;

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">
      Loading report...
    </div>
  );

  if (!report || !job) return (
    <div className="min-h-screen bg-white flex items-center justify-center text-slate-400">
      Report not found.
    </div>
  );

  return (
    <>
      {/* Print controls - hidden when printing */}
      <div className="print:hidden bg-slate-900 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button
          onClick={() => router.back()}
          className="text-slate-400 hover:text-white text-sm transition"
        >
          ← Back
        </button>
        <button
          onClick={() => window.print()}
          className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold px-6 py-2 rounded-lg transition"
        >
          🖨️ Print / Save as PDF
        </button>
      </div>

      {/* Report - this is what gets printed */}
      <div className="bg-white min-h-screen">
        <div className="max-w-3xl mx-auto px-10 py-10 print:px-8 print:py-8">

          {/* Header */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-slate-200">
            <div className="flex items-center gap-4">
              {company?.logo_url ? (
                <img
                  src={company.logo_url}
                  alt="Company Logo"
                  className="h-16 w-auto object-contain"
                />
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
              <h2 className="text-2xl font-bold text-slate-900 mb-1">SERVICE REPORT</h2>
              <p className="text-slate-500 text-sm">Date: {formatDate(report.created_at)}</p>
              <p className="text-slate-500 text-sm">Report #: {report.id.slice(-8).toUpperCase()}</p>
            </div>
          </div>

          {/* Company + Customer Info */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">From</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                {company?.address && <p>{company.address}</p>}
                {(company?.city || company?.state) && (
                  <p>{[company?.city, company?.state, company?.zip_code].filter(Boolean).join(', ')}</p>
                )}
                {company?.phone && <p>{company.phone}</p>}
                {company?.email && <p>{company.email}</p>}
                {company?.website && <p>{company.website}</p>}
              </div>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Client</h3>
              <div className="text-sm text-slate-700 space-y-0.5">
                <p className="font-semibold">{customer?.name}</p>
                {customer?.company_name && <p>{customer.company_name}</p>}
                {customer?.address && <p>{customer.address}</p>}
                {(customer?.city || customer?.state) && (
                  <p>{[customer?.city, customer?.state, customer?.zip_code].filter(Boolean).join(', ')}</p>
                )}
                {customer?.phone && <p>{customer.phone}</p>}
                {customer?.email && <p>{customer.email}</p>}
              </div>
            </div>
          </div>

          {/* Job Details */}
          <div className="bg-slate-50 rounded-lg p-5 mb-6 border border-slate-200">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Job Details</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500 text-xs">Job Title</p>
                <p className="text-slate-800 font-medium">{job.title}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Status</p>
                <p className="text-slate-800 font-medium capitalize">{job.status}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Scheduled Date</p>
                <p className="text-slate-800">{formatDate(job.scheduled_date)}</p>
              </div>
              <div>
                <p className="text-slate-500 text-xs">Priority</p>
                <p className="text-slate-800 capitalize">{job.priority}</p>
              </div>
            </div>
          </div>

          {/* Report Title */}
          <h3 className="text-lg font-bold text-slate-900 mb-2">{report.title}</h3>

          {/* Description */}
          {report.description && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</h4>
              <p className="text-slate-700 text-sm whitespace-pre-line">{report.description}</p>
            </div>
          )}

          {/* Work Performed */}
          {report.work_performed && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Work Performed</h4>
              <p className="text-slate-700 text-sm whitespace-pre-line">{report.work_performed}</p>
            </div>
          )}

          {/* Parts Used */}
          {report.parts_used && (
            <div className="mb-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Parts / Materials Used</h4>
              <p className="text-slate-700 text-sm whitespace-pre-line">{report.parts_used}</p>
            </div>
          )}

          {/* Labour */}
          {(report.labor_hours || report.labor_rate) && (
            <div className="mb-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Labour</h4>
              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2 text-slate-600 font-medium">Description</th>
                    <th className="text-right px-4 py-2 text-slate-600 font-medium">Hours</th>
                    <th className="text-right px-4 py-2 text-slate-600 font-medium">Rate</th>
                    <th className="text-right px-4 py-2 text-slate-600 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200">
                    <td className="px-4 py-2 text-slate-700">Labour</td>
                    <td className="px-4 py-2 text-right text-slate-700">{report.labor_hours ?? '—'}</td>
                    <td className="px-4 py-2 text-right text-slate-700">{report.labor_rate ? `$${report.labor_rate}/hr` : '—'}</td>
                    <td className="px-4 py-2 text-right font-semibold text-slate-900">{laborTotal ? `$${laborTotal}` : '—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Total */}
          {job.total_amount && (
            <div className="flex justify-end mb-8">
              <div className="bg-slate-900 text-white rounded-lg px-6 py-3 text-right">
                <p className="text-slate-400 text-xs uppercase tracking-wide">Total Amount</p>
                <p className="text-2xl font-bold">${job.total_amount.toFixed(2)}</p>
              </div>
            </div>
          )}

          {/* Photos */}
          {images.length > 0 && (
            <div className="mb-8">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Job Photos</h4>
              <div className="grid grid-cols-3 gap-3">
                {images.map(img => (
                  <img
                    key={img.id}
                    src={img.image_url}
                    alt={img.file_name}
                    className="w-full aspect-square object-cover rounded-lg border border-slate-200"
                  />
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t-2 border-slate-200 pt-6 mt-8">
            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-xs text-slate-500 mb-8">Technician Signature</p>
                <div className="border-b border-slate-400 w-48" />
                <p className="text-xs text-slate-500 mt-1">{company?.owner_name || 'Technician'}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500 mb-8">Customer Signature</p>
                <div className="border-b border-slate-400 w-48" />
                <p className="text-xs text-slate-500 mt-1">{customer?.name || 'Customer'}</p>
              </div>
            </div>
            <p className="text-center text-slate-400 text-xs mt-8">
              {company?.company_name}
              {company?.phone ? ` · ${company.phone}` : ''}
              {company?.email ? ` · ${company.email}` : ''}
            </p>
          </div>

        </div>
      </div>

      {/* Print styles */}
      <style jsx global>{`
        @media print {
          @page { margin: 15mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </>
  );
}
