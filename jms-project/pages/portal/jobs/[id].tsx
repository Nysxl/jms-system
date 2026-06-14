import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase';
import { Job, JobNote, JobImage, PortalUser } from '@/lib/types';

interface JobAttachment {
  id: string;
  job_id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

const fileIcon = (type: string) => {
  if (type.startsWith('image/')) return '🖼️';
  if (type === 'application/pdf') return '📄';
  if (type.includes('word')) return '📝';
  if (type.includes('sheet') || type.includes('excel')) return '📊';
  if (type.includes('presentation') || type.includes('powerpoint')) return '📑';
  if (type.includes('zip') || type.includes('compressed')) return '🗜️';
  return '📎';
};

export default function PortalJobDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [images, setImages] = useState<JobImage[]>([]);
  const [attachments, setAttachments] = useState<JobAttachment[]>([]);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<any | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<any[]>([]);
  const [invoiceJob, setInvoiceJob] = useState<any | null>(null);
  const [company, setCompany] = useState<any | null>(null);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const attachRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkSession();
  }, []);

  useEffect(() => {
    if (id && portalUser) {
      loadJobData();
    }
  }, [id, portalUser]);

  const checkSession = async () => {
    const stored = localStorage.getItem('portal_session');
    if (!stored) {
      router.push('/portal/login');
      return;
    }
    const pu = JSON.parse(stored);
    if (pu) setPortalUser(pu);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/portal/login');
    }
  };

  const loadJobData = async () => {
    setIsLoading(true);
    const { data: jobData } = await supabase.from('jobs').select('*').eq('id', id).single();
    if (jobData) {
      setJob(jobData);
      // Fetch admin's company name
      const { data: companyData } = await supabase
        .from('company_settings').select('company_name').eq('user_id', jobData.user_id).single();
      if (jobData && companyData?.company_name) {
        setJob({ ...jobData, admin_company_name: companyData.company_name } as any);
      }
    }
    const { data: notesData } = await supabase.from('job_notes').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (notesData) setNotes(notesData);
    const { data: imagesData } = await supabase.from('job_images').select('*').eq('job_id', id).order('uploaded_at', { ascending: false });
    if (imagesData) setImages(imagesData);
    const { data: attachData } = await supabase.from('job_attachments').select('*').eq('job_id', id).order('uploaded_at', { ascending: false });
    if (attachData) setAttachments(attachData);
    // Load invoices for this job that are billed to the current customer
    if (jobData && portalUser) {
      const { data: invoiceData } = await supabase.from('invoices')
        .select('*')
        .eq('job_id', id)
        .eq('customer_id', portalUser.customer_id)
        .neq('status', 'draft')
        .order('created_at', { ascending: false });
      if (invoiceData) setInvoices(invoiceData);
    }
    setIsLoading(false);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !job) return;

    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert('Not authenticated');
        return;
      }

      const { data, error } = await supabase.from('job_notes').insert({
        job_id: job.id,
        user_id: user.id,
        content: newNote,
        author_type: 'portal_user',
        created_at: new Date().toISOString(),
      }).select().single();

      if (error) throw error;
      if (data) {
        setNotes([data, ...notes]);
        setNewNote('');
      }
    } catch (err: any) {
      alert('Failed to add note: ' + (err.message || 'Unknown error'));
    } finally {
      setSavingNote(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || !job) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Not authenticated');
      return;
    }

    for (const file of Array.from(files)) {
      try {
        const fileName = `portal_${user.id}_${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('job-attachments')
          .upload(fileName, file);

        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from('job-attachments')
            .getPublicUrl(fileName);

          const { data: imgData, error: imgError } = await supabase.from('job_images').insert({
            job_id: job.id,
            user_id: user.id,
            image_url: publicUrl,
            file_name: file.name,
            author_type: 'portal_user',
            uploaded_at: new Date().toISOString(),
          }).select().single();

          if (imgError) throw imgError;
          if (imgData) setImages([...images, imgData]);
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || !job) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      alert('Not authenticated');
      return;
    }

    for (const file of Array.from(files)) {
      try {
        const path = `attachments/${user.id}/${job.id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from('job-attachments').upload(path, file);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('job-attachments').getPublicUrl(path);
        const { data: attData, error: attError } = await supabase.from('job_attachments').insert({
          job_id: job.id,
          user_id: user.id,
          file_name: file.name,
          file_url: urlData.publicUrl,
          file_type: file.type,
          file_size: file.size,
          uploaded_at: new Date().toISOString(),
          uploader_email: user.email,
          author_type: 'portal_user',
        }).select().single();

        if (attError) throw attError;
        if (attData) setAttachments([...attachments, attData]);
      } catch (err) {
        console.error('Attachment upload error:', err);
        alert('Failed to upload attachment');
      }
    }
  };

  const handleDeleteAttachment = async (attachment: JobAttachment) => {
    if (!confirm('Delete this file?')) return;
    try {
      const path = attachment.file_url.split('/job-attachments/')[1];
      if (path) {
        await supabase.storage.from('job-attachments').remove([decodeURIComponent(path)]);
      }
      const { error } = await supabase.from('job_attachments').delete().eq('id', attachment.id);
      if (error) throw error;
      setAttachments(attachments.filter(a => a.id !== attachment.id));
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete file');
    }
  };

  const handleSignature = async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Check if canvas has actual drawing (not empty)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const hasDrawing = imageData.data.some((pixel, i) => i % 4 !== 3 || pixel !== 255);

    if (!hasDrawing) {
      alert('Please sign the canvas');
      return;
    }

    const signatureData = canvas.toDataURL('image/png');

    try {
      await supabase.from('jobs').update({
        signature_data: signatureData,
        signed_by: portalUser?.email || 'Portal User',
        signed_at: new Date().toISOString(),
      }).eq('id', job?.id);
      if (job) {
        setJob({ ...job, signature_data: signatureData, signed_by: portalUser?.email || 'Portal User', signed_at: new Date().toISOString() });
      }
      setShowSignature(false);
      alert('Signature saved successfully!');
    } catch (err) {
      console.error('Signature save error:', err);
    }
  };

  const drawSignature = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (e.buttons === 1) {
      ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
      ctx.stroke();
    }
  };

  const startSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#fff';
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  if (!portalUser) {
    if (isLoading) {
      return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;
    }
    return null; // Will redirect in useEffect
  }

  if (isLoading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;
  if (!job) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Job not found</p></div>;

  const customerNotes = notes.filter(n => n.author_type === 'portal_user');
  const adminNotes = notes.filter(n => n.author_type === 'admin' && (n.is_internal as any) !== true);
  const customerImages = images.filter(i => i.author_type === 'portal_user');
  const adminImages = images.filter(i => i.author_type === 'admin' && (i.is_internal as any) !== true);

  return (
    <div className="min-h-screen bg-slate-950">
      <PortalHeader portalUserEmail={portalUser?.email} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <button onClick={() => router.push('/portal/jobs')} className="text-slate-400 hover:text-slate-300 text-sm mb-4 transition">← Back to Jobs</button>
        <h1 className="text-3xl font-bold text-white mb-6">{job.title}</h1>

        {/* Job Status */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold mb-2">Status</h3>
              <span className="inline-block px-3 py-1 bg-slate-700 text-slate-300 rounded-full text-sm font-medium capitalize">{job.status}</span>
            </div>
            {job.scheduled_date && (
              <div>
                <h3 className="text-white font-semibold mb-2">Scheduled</h3>
                <p className="text-slate-400">{new Date(job.scheduled_date).toLocaleDateString()}</p>
              </div>
            )}
            {job.description && (
              <div>
                <h3 className="text-white font-semibold mb-2">Description</h3>
                <p className="text-slate-400 text-sm">{job.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Your Notes (Customer) */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-white font-semibold mb-4">Your Notes</h3>
          <form onSubmit={handleAddNote} className="mb-4">
            <div className="flex gap-2">
              <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Add a note..."
                className="flex-1 bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              <button type="submit" disabled={savingNote || !newNote.trim()} className="bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg transition">Add</button>
            </div>
          </form>
          {customerNotes.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No notes yet</p>
          ) : (
            <div className="space-y-3">
              {customerNotes.map(note => (
                <div key={note.id} className="bg-slate-900 rounded-lg px-4 py-3 group">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-slate-400 text-xs">👤 Your note</span>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-slate-300 text-sm">{note.content}</p>
                      <p className="text-slate-600 text-xs mt-1">{new Date(note.created_at).toLocaleString()}</p>
                    </div>
                    <button onClick={async () => {
                      if (confirm('Delete this note?')) {
                        await supabase.from('job_notes').delete().eq('id', note.id);
                        setNotes(notes.filter(n => n.id !== note.id));
                      }
                    }} className="text-red-400 hover:text-red-300 text-xs opacity-0 group-hover:opacity-100 transition flex-shrink-0">✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Admin Photos */}
          {adminImages.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h4 className="text-slate-300 font-medium text-sm mb-3">📸 {(job as any)?.admin_company_name || 'Admin'} Photos</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {adminImages.filter(img => !(img.is_internal as any)).map(img => (
                  <div key={img.id} className="bg-slate-700 rounded-lg overflow-hidden flex flex-col">
                    <img src={img.image_url} alt={img.file_name} className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition" />
                    <div className="p-2">
                      <button onClick={() => {}} className="w-full bg-slate-600 hover:bg-slate-500 text-white text-xs px-2 py-1.5 rounded transition">View</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Photos */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <h4 className="text-slate-300 font-medium text-sm mb-3">Your Photos</h4>
            <button onClick={() => fileRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-1.5 rounded-lg transition mb-3">+ Add Photos</button>
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
            {customerImages.length === 0 ? (
              <p className="text-slate-500 text-sm">No photos yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {customerImages.map(img => (
                  <div key={img.id} className="bg-slate-700 rounded-lg overflow-hidden flex flex-col">
                    <img src={img.image_url} alt={img.file_name} className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition" />
                    <div className="p-2">
                      <button onClick={() => {}} className="w-full bg-slate-600 hover:bg-slate-500 text-white text-xs px-2 py-1.5 rounded transition">View</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Admin Attachments */}
          {attachments.filter((att: any) => att.author_type === 'admin').length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h4 className="text-slate-300 font-medium text-sm mb-3">📎 {(job as any)?.admin_company_name || 'Admin'} Documents</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {attachments.filter((att: any) => att.author_type === 'admin' && (att.is_internal as any) !== true).map(att => (
                  <div key={att.id} className="bg-slate-700 rounded-lg overflow-hidden flex flex-col">
                    <div className="bg-slate-800 p-4 flex items-center justify-center min-h-24">
                      <span className="text-4xl">{fileIcon(att.file_type)}</span>
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-white text-xs font-medium truncate flex-1">{att.file_name}</p>
                        <span className="text-slate-400 text-xs flex-shrink-0">📝</span>
                      </div>
                      <p className="text-slate-500 text-xs mb-3 flex-1">{(att.file_size / 1024).toFixed(1)} KB</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Customer Attachments */}
          <div className="mt-6 pt-6 border-t border-slate-700">
            <h4 className="text-slate-300 font-medium text-sm mb-3">Documents & Files</h4>
            <button onClick={() => attachRef.current?.click()} className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-1.5 rounded-lg transition mb-3">+ Add Documents</button>
            <input ref={attachRef} type="file" multiple onChange={handleAttachmentUpload} className="hidden" />
            {attachments.filter((att: any) => att.author_type === 'portal_user').length === 0 ? (
              <p className="text-slate-500 text-sm">No documents yet</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {attachments.filter((att: any) => att.author_type === 'portal_user').map(att => (
                  <div key={att.id} className="bg-slate-700 rounded-lg overflow-hidden flex flex-col">
                    <div className="bg-slate-800 p-4 flex items-center justify-center min-h-24">
                      <span className="text-4xl">{fileIcon(att.file_type)}</span>
                    </div>
                    <div className="p-3 flex-1 flex flex-col">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <p className="text-white text-xs font-medium truncate flex-1">{att.file_name}</p>
                        <span className="text-slate-400 text-xs flex-shrink-0">👤</span>
                      </div>
                      <p className="text-slate-500 text-xs mb-3 flex-1">{(att.file_size / 1024).toFixed(1)} KB</p>
                      <button onClick={() => handleDeleteAttachment(att as any)}
                        className="w-full bg-red-600 hover:bg-red-500 text-white text-xs px-2 py-1.5 rounded transition">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Admin Notes (Read-only for customer) */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-slate-400 font-semibold mb-4">📝 {(job as any)?.admin_company_name || 'Admin'} Notes</h3>
          {adminNotes.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No admin notes yet</p>
          ) : (
            <div className="space-y-3">
              {adminNotes.map(note => (
                <div key={note.id} className="bg-slate-900 rounded-lg px-4 py-3">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="text-slate-400 text-xs">📝 {(job as any)?.admin_company_name || 'Admin'}</span>
                  </div>
                  <p className="text-slate-300 text-sm">{note.content}</p>
                  <p className="text-slate-600 text-xs mt-1">{new Date(note.created_at).toLocaleString()}</p>
                </div>
              ))}
            </div>
          )}

          {/* Admin Photos */}
          {adminImages.length > 0 && (
            <div className="mt-6 pt-6 border-t border-slate-700">
              <h4 className="text-slate-300 font-medium text-sm mb-3">Admin Photos</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {adminImages.map(img => (
                  <div key={img.id} className="bg-slate-700 rounded-lg overflow-hidden flex flex-col">
                    <img src={img.image_url} alt={img.file_name} className="w-full aspect-square object-cover cursor-pointer hover:opacity-90 transition" />
                    <div className="p-2">
                      <button onClick={() => {}} className="w-full bg-slate-600 hover:bg-slate-500 text-white text-xs px-2 py-1.5 rounded transition">View</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Invoices */}
        {invoices.length > 0 && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4">💰 Invoices</h3>
            <div className="space-y-3">
              {invoices.map(invoice => (
                <div key={invoice.id} className="bg-slate-900 rounded-lg p-4 border border-slate-700">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-white font-medium">Invoice #{invoice.invoice_number || invoice.id.slice(0, 8)}</p>
                      <p className="text-slate-400 text-xs">Created {new Date(invoice.created_at).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-semibold">${parseFloat(invoice.total || 0).toFixed(2)}</p>
                      <span className={`text-xs px-2 py-1 rounded ${
                        invoice.status === 'sent' ? 'bg-blue-500/20 text-blue-400' :
                        invoice.status === 'paid' ? 'bg-green-500/20 text-green-400' :
                        'bg-slate-600/20 text-slate-400'
                      }`}>
                        {invoice.status || 'pending'}
                      </span>
                    </div>
                  </div>
                  <p className="text-slate-400 text-xs mb-3">Due {new Date(invoice.due_date).toLocaleDateString()}</p>
                  <button onClick={async () => {
                    try {
                      const [itemsRes, jobRes] = await Promise.all([
                        supabase.from('invoice_items').select('*').eq('invoice_id', invoice.id),
                        supabase.from('jobs').select('*').eq('id', invoice.job_id).single(),
                      ]);

                      if (itemsRes.data) setInvoiceItems(itemsRes.data);
                      if (jobRes.data) setInvoiceJob(jobRes.data);
                      setSelectedInvoice(invoice);

                      try {
                        const compRes = await supabase.from('company_settings').select('*').single();
                        setCompany(compRes.data || { company_name: 'Company Name', show_logo: true, show_company_name: true, invoice_accent_color: '#3b82f6' });
                      } catch (err) {
                        setCompany({ company_name: 'Company Name', show_logo: true, show_company_name: true, invoice_accent_color: '#3b82f6' });
                      }
                    } catch (err) {
                      console.error('Failed to load invoice details:', err);
                      alert('Failed to load invoice details');
                    }
                  }}
                    className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs px-3 py-1.5 rounded transition">
                    View Invoice
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Digital Signature */}
        {job.status === 'completed' && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
            <h3 className="text-white font-semibold mb-4">📝 Signature</h3>
            {job.signature_data ? (
              <div>
                <img src={job.signature_data} alt="Signature" className="max-w-xs border border-slate-600 rounded-lg mb-3" />
                <p className="text-slate-400 text-sm">Signed by {job.signed_by} on {new Date(job.signed_at || '').toLocaleString()}</p>
              </div>
            ) : (
              <div>
                {!showSignature ? (
                  <button onClick={() => setShowSignature(true)} className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition">+ Add Signature</button>
                ) : (
                  <div className="space-y-3">
                    <canvas ref={canvasRef} width={400} height={150} onMouseMove={drawSignature} onMouseDown={startSignature}
                      className="border-2 border-slate-600 rounded-lg cursor-crosshair bg-slate-900 w-full" />
                    <div className="flex gap-2">
                      <button onClick={handleSignature} className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition">Save Signature</button>
                      <button onClick={clearSignature} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition">Clear</button>
                      <button onClick={() => setShowSignature(false)} className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition">Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Invoice Preview Modal */}
        {selectedInvoice && invoiceJob && company && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <div className="bg-slate-900 rounded-lg shadow-2xl w-full max-w-2xl my-8" id="invoice-document">
              <div className="flex items-center justify-between p-6 border-b border-slate-700">
                <h3 className="text-white text-lg font-semibold">Invoice #{selectedInvoice.invoice_number}</h3>
                <button onClick={() => setSelectedInvoice(null)} className="text-slate-400 hover:text-white text-2xl">✕</button>
              </div>
              <div className="p-8 space-y-6">
                {/* Header */}
                <div className="border border-slate-300 rounded-lg p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900">INVOICE</h2>
                      <p className="text-slate-600">{company.company_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-slate-900">Invoice #: {selectedInvoice.invoice_number}</p>
                      <p className="text-slate-600">Date: {new Date(selectedInvoice.created_at).toLocaleDateString()}</p>
                      <p className="text-slate-600">Due: {new Date(selectedInvoice.due_date).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>

                {/* Job Details */}
                <div className="border border-slate-300 rounded-lg p-3 bg-slate-50">
                  <div><span className="text-slate-500 text-xs">Job:</span> <span className="font-medium text-slate-800">{invoiceJob.title}</span></div>
                </div>

                {/* Line Items */}
                {invoiceItems.length > 0 && (
                  <div className="border border-slate-300 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-slate-700 text-white">
                        <tr>
                          <th className="text-left p-3">Description</th>
                          <th className="text-right p-3 w-24">Qty</th>
                          <th className="text-right p-3 w-28">Unit Price</th>
                          <th className="text-right p-3 w-28">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceItems.map((item: any) => (
                          <tr key={item.id} className="border-t border-slate-300">
                            <td className="p-3 text-slate-800">{item.description}</td>
                            <td className="text-right p-3 text-slate-800">{item.quantity}</td>
                            <td className="text-right p-3 text-slate-800">${parseFloat(item.unit_price || 0).toFixed(2)}</td>
                            <td className="text-right p-3 text-slate-800">${parseFloat(item.total || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Totals */}
                <div className="border border-slate-300 rounded-lg p-4 flex justify-end">
                  <div className="w-64">
                    <div className="flex justify-between text-slate-800 mb-2">
                      <span>Subtotal:</span>
                      <span>${parseFloat(selectedInvoice.subtotal || 0).toFixed(2)}</span>
                    </div>
                    {selectedInvoice.tax > 0 && (
                      <div className="flex justify-between text-slate-800 mb-2">
                        <span>Tax:</span>
                        <span>${parseFloat(selectedInvoice.tax || 0).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-semibold text-lg border-t border-slate-300 pt-2" style={{ color: company.invoice_accent_color }}>
                      <span>Total:</span>
                      <span>${parseFloat(selectedInvoice.total || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="p-6 border-t border-slate-700 flex gap-3">
                <button onClick={() => setSelectedInvoice(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg transition">Close</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
