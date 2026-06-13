import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';
import { Customer, Job, Invoice, JobNote, JobImage } from '@/lib/types';
import axios from 'axios';
import { format } from 'date-fns';

interface PortalSession {
  id: string;
  email: string;
  customer_id: string;
  user_id: string;
  customer: Customer;
}

function logActivity(session: PortalSession, action_type: string, entity_type?: string, entity_id?: string, details?: any) {
  axios.post('/api/portal/log', { portal_user_id: session.id, user_id: session.user_id, action_type, entity_type, entity_id, details }).catch(() => {});
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300',
    'in-progress': 'bg-blue-500/20 text-blue-300',
    completed: 'bg-green-500/20 text-green-300',
    cancelled: 'bg-red-500/20 text-red-400',
    draft: 'bg-slate-600 text-slate-300',
    sent: 'bg-blue-500/20 text-blue-300',
    viewed: 'bg-purple-500/20 text-purple-300',
    paid: 'bg-green-500/20 text-green-300',
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status] || 'bg-slate-600 text-slate-300'}`}>{status}</span>;
}

function formatTs(ts?: string | null) {
  if (!ts) return '—';
  try { return format(new Date(ts), 'dd MMM yyyy, h:mm a'); } catch { return ts; }
}

// ============================================================
// CONTRACTOR PORTAL
// ============================================================
function ContractorPortal({ session }: { session: PortalSession }) {
  const [subContacts, setSubContacts] = useState<Customer[]>([]);
  const [jobsMap, setJobsMap] = useState<Record<string, Job[]>>({});
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [activeTab, setActiveTab] = useState<'contacts' | 'invoices'>('contacts');
  const [selectedContact, setSelectedContact] = useState<Customer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    const { data: subs } = await supabase
      .from('customers')
      .select('*')
      .eq('contractor_id', session.customer_id)
      .eq('customer_type', 'sub_contact')
      .order('name');
    if (subs) setSubContacts(subs);

    // Jobs for the contractor itself (billing_customer_id = contractor) AND jobs for sub-contacts
    const subIds = (subs || []).map((s: Customer) => s.id);
    const allCustomerIds = [session.customer_id, ...subIds];

    const { data: jobs } = await supabase
      .from('jobs')
      .select('*, customer:customers!customer_id(*)')
      .in('customer_id', allCustomerIds)
      .order('created_at', { ascending: false });

    if (jobs) {
      const map: Record<string, Job[]> = {};
      jobs.forEach((j: Job) => {
        if (!map[j.customer_id]) map[j.customer_id] = [];
        map[j.customer_id].push(j);
      });
      // Also bucket jobs billed to contractor
      const { data: billedJobs } = await supabase
        .from('jobs')
        .select('*, customer:customers!customer_id(*)')
        .eq('billing_customer_id', session.customer_id)
        .order('created_at', { ascending: false });
      if (billedJobs) {
        billedJobs.forEach((j: Job) => {
          if (!map[j.customer_id]) map[j.customer_id] = [];
          if (!map[j.customer_id].find(x => x.id === j.id)) map[j.customer_id].push(j);
        });
      }
      setJobsMap(map);
    }

    // Invoices for contractor or any sub-contact
    const { data: invs } = await supabase
      .from('invoices')
      .select('*')
      .in('customer_id', allCustomerIds)
      .order('created_at', { ascending: false });
    if (invs) setInvoices(invs);

    setIsLoading(false);
  }, [session.customer_id]);

  useEffect(() => {
    loadData();
    logActivity(session, 'job_viewed');
  }, [loadData, session]);

  const filteredSubs = subContacts.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.address || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalJobs = Object.values(jobsMap).flat().length;
  const completedJobs = Object.values(jobsMap).flat().filter(j => j.status === 'completed').length;
  const pendingJobs = Object.values(jobsMap).flat().filter(j => j.status === 'pending' || j.status === 'in-progress').length;
  const totalInvoiced = invoices.reduce((s, i) => s + (i.total_amount || 0), 0);

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Contacts', value: subContacts.length },
          { label: 'Total Jobs', value: totalJobs },
          { label: 'Active', value: pendingJobs, accent: 'text-blue-400' },
          { label: 'Invoiced', value: `$${totalInvoiced.toLocaleString('en-AU', { minimumFractionDigits: 2 })}` },
        ].map(stat => (
          <div key={stat.label} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">{stat.label}</p>
            <p className={`text-2xl font-bold ${stat.accent || 'text-white'}`}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit mb-6">
        {(['contacts', 'invoices'] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)} className={`px-5 py-2 rounded-md text-sm font-medium capitalize transition ${activeTab === t ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}>{t}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-slate-400 py-16 text-center">Loading...</div>
      ) : activeTab === 'contacts' ? (
        <>
          <div className="mb-4">
            <input type="text" placeholder="Search contacts..." value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-sm bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
          </div>
          <div className="space-y-3">
            {filteredSubs.map(sub => {
              const jobs = jobsMap[sub.id] || [];
              const lastJob = jobs[0];
              const isSelected = selectedContact?.id === sub.id;
              return (
                <div key={sub.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <button onClick={() => setSelectedContact(isSelected ? null : sub)} className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-700/40 transition text-left">
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                      {sub.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium">{sub.name}</p>
                      <p className="text-slate-400 text-xs">{[sub.address, sub.city].filter(Boolean).join(', ') || 'No address'}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-slate-300 text-sm">{jobs.length} job{jobs.length !== 1 ? 's' : ''}</p>
                      {lastJob && <p className="text-slate-500 text-xs">{lastJob.status === 'completed' ? 'Last visit: ' + formatTs(lastJob.completed_date) : <StatusBadge status={lastJob.status} />}</p>}
                    </div>
                    <span className="text-slate-500 text-sm ml-2">{isSelected ? '▾' : '▸'}</span>
                  </button>

                  {isSelected && (
                    <div className="border-t border-slate-700 px-5 py-4">
                      {sub.phone && <p className="text-slate-400 text-sm mb-3">📞 {sub.phone}</p>}
                      {sub.notes && <p className="text-slate-500 text-sm mb-4 italic">{sub.notes}</p>}
                      {jobs.length === 0 ? (
                        <p className="text-slate-500 text-sm">No jobs recorded yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {jobs.map(job => (
                            <div key={job.id} className="bg-slate-700/50 rounded-lg p-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <p className="text-white text-sm font-medium">{job.title}</p>
                                  {job.description && <p className="text-slate-400 text-xs mt-0.5 line-clamp-2">{job.description}</p>}
                                </div>
                                <StatusBadge status={job.status} />
                              </div>
                              <div className="flex gap-4 mt-2 text-xs text-slate-500">
                                {job.scheduled_date && <span>Scheduled: {formatTs(job.scheduled_date)}</span>}
                                {job.completed_date && <span>Completed: {formatTs(job.completed_date)}</span>}
                                {job.total_amount != null && <span className="text-slate-300">${job.total_amount.toFixed(2)}</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        /* Invoices tab */
        <div className="space-y-3">
          {invoices.length === 0 ? (
            <div className="text-center py-16 text-slate-500">No invoices yet.</div>
          ) : (
            invoices.map(inv => (
              <div key={inv.id} className="bg-slate-800 border border-slate-700 rounded-xl px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium text-sm">#{inv.invoice_number}</p>
                  <p className="text-slate-400 text-xs mt-0.5">Due: {formatTs(inv.due_date)}</p>
                </div>
                <StatusBadge status={inv.status} />
                <p className="text-white font-semibold">${inv.total_amount?.toFixed(2)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// CLIENT PORTAL (direct or sub_contact)
// ============================================================
function ClientPortal({ session }: { session: PortalSession }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [notes, setNotes] = useState<JobNote[]>([]);
  const [images, setImages] = useState<JobImage[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadJobs = useCallback(async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('customer_id', session.customer_id)
      .order('created_at', { ascending: false });
    if (data) setJobs(data);
    setIsLoading(false);
  }, [session.customer_id]);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  const openJob = async (job: Job) => {
    setSelectedJob(job);
    logActivity(session, 'job_viewed', 'job', job.id, { title: job.title });

    const [{ data: n }, { data: i }] = await Promise.all([
      supabase.from('job_notes').select('*').eq('job_id', job.id).order('created_at', { ascending: false }),
      supabase.from('job_images').select('*').eq('job_id', job.id).order('uploaded_at', { ascending: false }),
    ]);
    if (n) setNotes(n);
    if (i) setImages(i);
  };

  const addNote = async () => {
    if (!newNote.trim() || !selectedJob) return;
    setIsSavingNote(true);
    const { error } = await supabase.from('job_notes').insert([{
      job_id: selectedJob.id,
      user_id: session.user_id,
      content: newNote.trim(),
      author_type: 'portal_user',
      portal_user_id: session.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }]);
    if (!error) {
      logActivity(session, 'note_added', 'note', selectedJob.id, { job_title: selectedJob.title, content_preview: newNote.slice(0, 80) });
      setNewNote('');
      const { data: n } = await supabase.from('job_notes').select('*').eq('job_id', selectedJob.id).order('created_at', { ascending: false });
      if (n) setNotes(n);
    }
    setIsSavingNote(false);
  };

  const filtered = jobs.filter(j =>
    j.title.toLowerCase().includes(search.toLowerCase()) ||
    (j.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const completedJobs = jobs.filter(j => j.status === 'completed').length;
  const activeJobs = jobs.filter(j => j.status === 'pending' || j.status === 'in-progress').length;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Total Jobs</p>
          <p className="text-2xl font-bold text-white">{jobs.length}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Active</p>
          <p className="text-2xl font-bold text-blue-400">{activeJobs}</p>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <p className="text-slate-400 text-xs mb-1">Completed</p>
          <p className="text-2xl font-bold text-green-400">{completedJobs}</p>
        </div>
      </div>

      {selectedJob ? (
        /* ---- Job detail view ---- */
        <div>
          <button onClick={() => setSelectedJob(null)} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition">
            ← Back to jobs
          </button>
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <h3 className="text-white text-xl font-semibold">{selectedJob.title}</h3>
                {selectedJob.description && <p className="text-slate-400 text-sm mt-1">{selectedJob.description}</p>}
              </div>
              <StatusBadge status={selectedJob.status} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              {selectedJob.scheduled_date && (
                <div>
                  <p className="text-slate-500 text-xs">Scheduled</p>
                  <p className="text-slate-300">{formatTs(selectedJob.scheduled_date)}</p>
                </div>
              )}
              {selectedJob.completed_date && (
                <div>
                  <p className="text-slate-500 text-xs">Completed</p>
                  <p className="text-slate-300">{formatTs(selectedJob.completed_date)}</p>
                </div>
              )}
              {selectedJob.total_amount != null && (
                <div>
                  <p className="text-slate-500 text-xs">Amount</p>
                  <p className="text-slate-300">${selectedJob.total_amount.toFixed(2)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Photos */}
          {images.length > 0 && (
            <div className="mb-6">
              <h4 className="text-white font-medium mb-3">Photos</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {images.map(img => (
                  <div key={img.id} className="bg-slate-800 border border-slate-700 rounded-lg overflow-hidden">
                    <img src={img.image_url} alt={img.file_name} className="w-full h-32 object-cover" />
                    {img.caption && <p className="text-slate-400 text-xs p-2">{img.caption}</p>}
                    <p className="text-slate-600 text-xs px-2 pb-2">{formatTs(img.display_timestamp || img.uploaded_at)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <h4 className="text-white font-medium mb-3">Notes</h4>
            <div className="space-y-3 mb-4">
              {notes.map(note => (
                <div key={note.id} className="bg-slate-800 border border-slate-700 rounded-lg p-4">
                  <p className="text-slate-300 text-sm">{note.content}</p>
                  <p className="text-slate-600 text-xs mt-2">
                    {note.author_type === 'portal_user' ? 'You · ' : 'Service team · '}
                    {formatTs(note.display_timestamp || note.created_at)}
                  </p>
                </div>
              ))}
              {notes.length === 0 && <p className="text-slate-600 text-sm">No notes yet.</p>}
            </div>

            {/* Add note */}
            <div className="flex gap-2">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                rows={2}
                placeholder="Add a note..."
                className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
              />
              <button
                onClick={addNote}
                disabled={isSavingNote || !newNote.trim()}
                className="bg-blue-500 hover:bg-blue-600 disabled:opacity-40 text-white font-medium px-4 rounded-lg transition self-stretch"
              >
                {isSavingNote ? '...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* ---- Job list ---- */
        <>
          <div className="mb-4">
            <input type="text" placeholder="Search jobs..." value={search} onChange={e => setSearch(e.target.value)} className="w-full max-w-sm bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
          </div>
          {isLoading ? (
            <div className="text-slate-400 py-16 text-center">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              {search ? 'No jobs match your search.' : 'No jobs yet.'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(job => (
                <button key={job.id} onClick={() => openJob(job)} className="w-full bg-slate-800 border border-slate-700 hover:border-slate-600 rounded-xl px-5 py-4 flex items-center gap-4 transition text-left">
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-medium">{job.title}</p>
                    {job.description && <p className="text-slate-400 text-xs mt-0.5 truncate">{job.description}</p>}
                    <div className="flex gap-3 mt-1 text-xs text-slate-500">
                      {job.scheduled_date && <span>Scheduled: {formatTs(job.scheduled_date)}</span>}
                      {job.completed_date && <span>Completed: {formatTs(job.completed_date)}</span>}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusBadge status={job.status} />
                    {job.total_amount != null && <span className="text-slate-300 text-sm font-medium">${job.total_amount.toFixed(2)}</span>}
                  </div>
                  <span className="text-slate-600 text-sm">›</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// PORTAL SHELL (auth check + header)
// ============================================================
export default function PortalDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<PortalSession | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [isSavingPw, setIsSavingPw] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('portal_session');
    if (!raw) { router.push('/portal/login'); return; }
    try { setSession(JSON.parse(raw)); } catch { router.push('/portal/login'); }
  }, [router]);

  const logout = () => {
    if (session) logActivity(session, 'logout');
    localStorage.removeItem('portal_session');
    router.push('/portal/login');
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) { setPwError('All fields are required.'); return; }
    if (pwForm.newPw !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
    if (pwForm.newPw.length < 6) { setPwError('Password must be at least 6 characters.'); return; }
    if (!session) return;

    // Verify current password against stored plain text
    const { data: pu } = await supabase.from('portal_users').select('password_plain').eq('id', session.id).single();
    if (!pu || pu.password_plain !== pwForm.current) { setPwError('Current password is incorrect.'); return; }

    setIsSavingPw(true);
    const { error } = await supabase.from('portal_users').update({ password_plain: pwForm.newPw, updated_at: new Date().toISOString() }).eq('id', session.id);
    if (error) { setPwError(error.message); setIsSavingPw(false); return; }

    logActivity(session, 'password_changed');
    setPwSuccess(true);
    setIsSavingPw(false);
    setTimeout(() => { setShowPasswordModal(false); setPwForm({ current: '', newPw: '', confirm: '' }); setPwSuccess(false); }, 1500);
  };

  if (!session) return <div className="min-h-screen bg-slate-950" />;

  const customerType = session.customer?.customer_type;
  const displayName = session.customer?.company_name || session.customer?.name || session.email;

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Portal header */}
      <header className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center text-white font-bold text-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-white font-semibold text-sm">{displayName}</p>
              <p className="text-slate-500 text-xs capitalize">{customerType === 'contractor' ? 'Contractor Portal' : 'Client Portal'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => { setPwError(''); setPwSuccess(false); setPwForm({ current: '', newPw: '', confirm: '' }); setShowPasswordModal(true); }} className="text-slate-400 hover:text-white text-sm transition">Change Password</button>
            <button onClick={logout} className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium px-4 py-1.5 rounded-lg transition">Sign Out</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">
            {customerType === 'contractor' ? 'Your Contacts & Jobs' : 'Your Jobs'}
          </h2>
          <p className="text-slate-400 text-sm mt-1">Welcome back, {displayName}</p>
        </div>

        {customerType === 'contractor' ? (
          <ContractorPortal session={session} />
        ) : (
          <ClientPortal session={session} />
        )}
      </main>

      {/* Change password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Change Password</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={changePassword} className="p-6 space-y-4">
              {pwError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{pwError}</div>}
              {pwSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3">Password changed successfully.</div>}
              {[{ label: 'Current Password', key: 'current' }, { label: 'New Password', key: 'newPw' }, { label: 'Confirm New Password', key: 'confirm' }].map(f => (
                <div key={f.key}>
                  <label className="block text-slate-300 text-sm font-medium mb-1">{f.label}</label>
                  <input type="password" value={(pwForm as any)[f.key]} onChange={e => setPwForm({ ...pwForm, [f.key]: e.target.value })} className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowPasswordModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={isSavingPw} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {isSavingPw ? 'Saving...' : 'Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
