import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase';
import { Job, JobNote, JobImage, PortalUser } from '@/lib/types';

export default function PortalJobDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [images, setImages] = useState<JobImage[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    if (jobData) setJob(jobData);
    const { data: notesData } = await supabase.from('job_notes').select('*').eq('job_id', id).order('created_at', { ascending: false });
    if (notesData) setNotes(notesData);
    const { data: imagesData } = await supabase.from('job_images').select('*').eq('job_id', id).order('uploaded_at', { ascending: false });
    if (imagesData) setImages(imagesData);
    setIsLoading(false);
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !portalUser || !job) return;

    setSavingNote(true);
    try {
      const res = await fetch('/api/portal/add-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalUserId: portalUser.id, jobId: job.id, content: newNote }),
      });
      const data = await res.json();
      if (res.ok && data.note) {
        setNotes([data.note, ...notes]);
        setNewNote('');
      } else {
        alert('Failed to add note: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setSavingNote(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || !portalUser || !job) return;

    for (const file of Array.from(files)) {
      try {
        const fileName = `portal_${portalUser.id}_${Date.now()}_${file.name}`;
        const { data, error } = await supabase.storage
          .from('job-attachments')
          .upload(fileName, file);

        if (!error && data) {
          const { data: { publicUrl } } = supabase.storage
            .from('job-attachments')
            .getPublicUrl(fileName);

          await fetch('/api/portal/add-photo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              portalUserId: portalUser.id,
              jobId: job.id,
              imageUrl: publicUrl,
              fileName: file.name,
            }),
          });

          setImages([...images, { id: Date.now().toString(), job_id: job.id, user_id: portalUser.user_id, image_url: publicUrl, file_name: file.name, author_type: 'portal_user', uploaded_at: new Date().toISOString() }]);
        }
      } catch (err) {
        console.error('Upload error:', err);
      }
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
  const adminNotes = notes.filter(n => n.author_type === 'admin');
  const customerImages = images.filter(i => i.author_type === 'portal_user');
  const adminImages = images.filter(i => i.author_type === 'admin');

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
                <div key={note.id} className="bg-slate-900 rounded-lg px-4 py-3">
                  <p className="text-slate-300 text-sm">{note.content}</p>
                  <p className="text-slate-600 text-xs mt-1">{new Date(note.created_at).toLocaleString()}</p>
                </div>
              ))}
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {customerImages.map(img => (
                  <img key={img.id} src={img.image_url} alt={img.file_name} className="rounded-lg w-full aspect-square object-cover cursor-pointer hover:opacity-80" />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Admin Notes (Read-only for customer) */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h3 className="text-slate-400 font-semibold mb-4">📝 Admin Notes</h3>
          {adminNotes.length === 0 ? (
            <p className="text-slate-500 text-sm text-center py-4">No admin notes yet</p>
          ) : (
            <div className="space-y-3">
              {adminNotes.map(note => (
                <div key={note.id} className="bg-slate-900 rounded-lg px-4 py-3">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {adminImages.map(img => (
                  <img key={img.id} src={img.image_url} alt={img.file_name} className="rounded-lg w-full aspect-square object-cover" />
                ))}
              </div>
            </div>
          )}
        </div>

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
      </main>
    </div>
  );
}
