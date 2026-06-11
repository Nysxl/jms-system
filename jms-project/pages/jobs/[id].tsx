import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Job, Customer, JobNote, JobImage, ServiceReport } from '@/lib/types';

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
  'in-progress': 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
  completed: 'bg-green-500/10 text-green-400 border border-green-500/30',
  cancelled: 'bg-red-500/10 text-red-400 border border-red-500/30',
};

const priorityColors: Record<string, string> = {
  low: 'text-slate-400',
  medium: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

export default function JobDetail() {
  const router = useRouter();
  const { id } = router.query as { id: string };

  const [job, setJob] = useState<Job | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [images, setImages] = useState<JobImage[]>([]);
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Notes
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Photos
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Service report modal
  const [showReportModal, setShowReportModal] = useState(false);
  const [editingReport, setEditingReport] = useState<ServiceReport | null>(null);
  const [reportForm, setReportForm] = useState({
    title: '',
    description: '',
    work_performed: '',
    parts_used: '',
    labor_hours: '',
    labor_rate: '',
  });
  const [savingReport, setSavingReport] = useState(false);
  const [reportError, setReportError] = useState('');

  // Lightbox
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (id) loadAll();
  }, [id]);

  const loadAll = async () => {
    setIsLoading(true);
    await Promise.all([loadJob(), loadNotes(), loadImages(), loadReports()]);
    setIsLoading(false);
  };

  const loadJob = async () => {
    const { data } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (data) {
      setJob(data);
      const { data: cust } = await supabase.from('customers').select('*').eq('id', data.customer_id).single();
      if (cust) setCustomer(cust);
    }
  };

  const loadNotes = async () => {
    const { data } = await supabase
      .from('job_notes')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: false });
    if (data) setNotes(data);
  };

  const loadImages = async () => {
    const { data } = await supabase
      .from('job_images')
      .select('*')
      .eq('job_id', id)
      .order('uploaded_at', { ascending: false });
    if (data) setImages(data);
  };

  const loadReports = async () => {
    const { data } = await supabase
      .from('service_reports')
      .select('*')
      .eq('job_id', id)
      .order('created_at', { ascending: false });
    if (data) setReports(data);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    setSavingNote(true);
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('job_notes').insert([{
      job_id: id,
      user_id: user?.id,
      content: newNote.trim(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
    setNewNote('');
    setSavingNote(false);
    loadNotes();
  };

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from('job_notes').delete().eq('id', noteId);
    loadNotes();
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    const { data: { user } } = await supabase.auth.getUser();

    for (const file of Array.from(files)) {
      const ext = file.name.split('.').pop();
      const path = `jobs/${id}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(path, file);

      if (uploadError) continue;

      const { data: urlData } = supabase.storage.from('job-photos').getPublicUrl(path);

      await supabase.from('job_images').insert([{
        job_id: id,
        user_id: user?.id,
        image_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        uploaded_at: new Date().toISOString(),
      }]);
    }

    setUploadingPhoto(false);
    loadImages();
  };

  const handleDeletePhoto = async (image: JobImage) => {
    const path = image.image_url.split('/job-photos/')[1];
    if (path) await supabase.storage.from('job-photos').remove([path]);
    await supabase.from('job_images').delete().eq('id', image.id);
    loadImages();
  };

  const openCreateReport = () => {
    setEditingReport(null);
    setReportForm({ title: job?.title || '', description: job?.description || '', work_performed: '', parts_used: '', labor_hours: '', labor_rate: '' });
    setReportError('');
    setShowReportModal(true);
  };

  const openEditReport = (report: ServiceReport) => {
    setEditingReport(report);
    setReportForm({
      title: report.title || '',
      description: report.description || '',
      work_performed: report.work_performed || '',
      parts_used: report.parts_used || '',
      labor_hours: report.labor_hours?.toString() || '',
      labor_rate: report.labor_rate?.toString() || '',
    });
    setReportError('');
    setShowReportModal(true);
  };

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportForm.title.trim()) { setReportError('Title is required.'); return; }
    setSavingReport(true);
    const { data: { user } } = await supabase.auth.getUser();

    const payload = {
      job_id: id,
      user_id: user?.id,
      title: reportForm.title,
      description: reportForm.description,
      work_performed: reportForm.work_performed,
      parts_used: reportForm.parts_used,
      labor_hours: reportForm.labor_hours ? parseFloat(reportForm.labor_hours) : null,
      labor_rate: reportForm.labor_rate ? parseFloat(reportForm.labor_rate) : null,
      updated_at: new Date().toISOString(),
    };

    if (editingReport) {
      await supabase.from('service_reports').update(payload).eq('id', editingReport.id);
    } else {
      await supabase.from('service_reports').insert([{ ...payload, created_at: new Date().toISOString() }]);
    }

    setSavingReport(false);
    setShowReportModal(false);
    loadReports();
  };

  const handleDeleteReport = async (reportId: string) => {
    await supabase.from('service_reports').delete().eq('id', reportId);
    loadReports();
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const formatDateTime = (d?: string) => d ? new Date(d).toLocaleString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  if (isLoading) return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="text-center py-20 text-slate-400">Loading job...</div>
    </div>
  );

  if (!job) return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <div className="text-center py-20 text-slate-400">Job not found. <Link href="/jobs" className="text-blue-400 hover:underline">Back to jobs</Link></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Breadcrumb */}
        <div className="mb-6">
          <Link href="/jobs" className="text-slate-500 hover:text-slate-300 text-sm transition">
            ← Back to Jobs
          </Link>
        </div>

        {/* Job Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-1">{job.title}</h2>
              <p className="text-slate-400">
                {customer ? (
                  <Link href={`/customers`} className="hover:text-blue-400 transition">
                    {customer.name}{customer.company_name ? ` — ${customer.company_name}` : ''}
                  </Link>
                ) : 'Unknown Customer'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColors[job.status]}`}>
                {job.status}
              </span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold bg-slate-700 ${priorityColors[job.priority]}`}>
                {job.priority} priority
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-700">
            <div>
              <p className="text-slate-500 text-xs mb-1">Scheduled</p>
              <p className="text-white text-sm">{formatDate(job.scheduled_date)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Created</p>
              <p className="text-white text-sm">{formatDate(job.created_at)}</p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Amount</p>
              <p className="text-green-400 text-sm font-semibold">
                {job.total_amount ? `$${job.total_amount.toFixed(2)}` : '—'}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs mb-1">Completed</p>
              <p className="text-white text-sm">{formatDate(job.completed_date)}</p>
            </div>
          </div>

          {job.description && (
            <div className="mt-4 pt-4 border-t border-slate-700">
              <p className="text-slate-500 text-xs mb-1">Description</p>
              <p className="text-slate-300 text-sm">{job.description}</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left column: Notes + Photos */}
          <div className="lg:col-span-2 space-y-6">

            {/* Photos */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Photos</h3>
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploadingPhoto}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm px-4 py-1.5 rounded-lg transition"
                >
                  {uploadingPhoto ? 'Uploading...' : '+ Add Photos'}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              {images.length === 0 ? (
                <div
                  onClick={() => fileRef.current?.click()}
                  className="border-2 border-dashed border-slate-600 rounded-xl p-10 text-center cursor-pointer hover:border-blue-500 transition"
                >
                  <p className="text-3xl mb-2">📷</p>
                  <p className="text-slate-400 text-sm">Click to upload job photos</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map(img => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden aspect-square bg-slate-700">
                      <img
                        src={img.image_url}
                        alt={img.file_name}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => setLightbox(img.image_url)}
                      />
                      <button
                        onClick={() => handleDeletePhoto(img)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-6 h-6 text-xs hidden group-hover:flex items-center justify-center transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <div
                    onClick={() => fileRef.current?.click()}
                    className="aspect-square border-2 border-dashed border-slate-600 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-500 transition"
                  >
                    <span className="text-slate-500 text-2xl">+</span>
                  </div>
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Notes</h3>

              <form onSubmit={handleAddNote} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Add a note..."
                  className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                />
                <button
                  type="submit"
                  disabled={savingNote || !newNote.trim()}
                  className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg transition"
                >
                  Add
                </button>
              </form>

              {notes.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No notes yet.</p>
              ) : (
                <div className="space-y-3">
                  {notes.map(note => (
                    <div key={note.id} className="flex gap-3 group">
                      <div className="flex-1 bg-slate-900 rounded-lg px-4 py-3">
                        <p className="text-slate-300 text-sm">{note.content}</p>
                        <p className="text-slate-600 text-xs mt-1">{formatDateTime(note.created_at)}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        className="text-slate-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column: Service Reports */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Service Reports</h3>
                <button
                  onClick={openCreateReport}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg transition"
                >
                  + New
                </button>
              </div>

              {reports.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-3xl mb-2">📄</p>
                  <p className="text-slate-500 text-sm">No reports yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {reports.map(report => (
                    <div key={report.id} className="bg-slate-900 rounded-lg p-4">
                      <p className="text-white text-sm font-medium mb-1">{report.title}</p>
                      <p className="text-slate-500 text-xs mb-3">{formatDate(report.created_at)}</p>
                      <div className="flex gap-2">
                        <Link
                          href={`/jobs/${id}/report?reportId=${report.id}`}
                          className="flex-1 text-center bg-slate-700 hover:bg-slate-600 text-white text-xs py-1.5 rounded-lg transition"
                        >
                          View / Print
                        </Link>
                        <button
                          onClick={() => openEditReport(report)}
                          className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs py-1.5 rounded-lg transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteReport(report.id)}
                          className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-2 py-1.5 rounded-lg transition"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer info card */}
            {customer && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="text-white font-semibold mb-3">Customer</h3>
                <div className="space-y-1 text-sm">
                  <p className="text-white font-medium">{customer.name}</p>
                  {customer.company_name && <p className="text-slate-400">{customer.company_name}</p>}
                  <p className="text-slate-400">✉️ {customer.email}</p>
                  {customer.phone && <p className="text-slate-400">📞 {customer.phone}</p>}
                  {customer.address && <p className="text-slate-400">📍 {customer.address}</p>}
                  {customer.city && <p className="text-slate-400">{[customer.city, customer.state, customer.zip_code].filter(Boolean).join(', ')}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Service Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">{editingReport ? 'Edit Report' : 'New Service Report'}</h3>
              <button onClick={() => setShowReportModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleSaveReport} className="p-6 space-y-4">
              {reportError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{reportError}</div>
              )}
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Report Title *</label>
                <input
                  type="text"
                  value={reportForm.title}
                  onChange={e => setReportForm({ ...reportForm, title: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  placeholder="Service Report — Job Title"
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Job Description</label>
                <textarea
                  value={reportForm.description}
                  onChange={e => setReportForm({ ...reportForm, description: e.target.value })}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                  placeholder="Brief description of the job..."
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Work Performed</label>
                <textarea
                  value={reportForm.work_performed}
                  onChange={e => setReportForm({ ...reportForm, work_performed: e.target.value })}
                  rows={4}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                  placeholder="Detailed description of work carried out..."
                />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Parts / Materials Used</label>
                <textarea
                  value={reportForm.parts_used}
                  onChange={e => setReportForm({ ...reportForm, parts_used: e.target.value })}
                  rows={2}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                  placeholder="List parts and materials used..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Labour Hours</label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={reportForm.labor_hours}
                    onChange={e => setReportForm({ ...reportForm, labor_hours: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="0.0"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Labour Rate ($/hr)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={reportForm.labor_rate}
                    onChange={e => setReportForm({ ...reportForm, labor_rate: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowReportModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingReport} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {savingReport ? 'Saving...' : editingReport ? 'Save Changes' : 'Create Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Photo" className="max-w-full max-h-full rounded-lg object-contain" />
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-slate-300 transition">✕</button>
        </div>
      )}
    </div>
  );
}
