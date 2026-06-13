import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { PortalUser, PortalActivityLog, PortalActivityType } from '@/lib/types';
import { format } from 'date-fns';

function formatTs(ts?: string | null) {
  if (!ts) return '—';
  try { return format(new Date(ts), 'dd MMM yyyy, h:mm a'); } catch { return ts || '—'; }
}

const ACTION_LABELS: Record<PortalActivityType, string> = {
  login: 'Logged in',
  logout: 'Logged out',
  job_viewed: 'Viewed job',
  note_added: 'Added note',
  note_edited: 'Edited note',
  photo_added: 'Added photo',
  password_changed: 'Changed password',
};

const ACTION_COLORS: Record<PortalActivityType, string> = {
  login: 'bg-green-500/20 text-green-400',
  logout: 'bg-slate-600 text-slate-300',
  job_viewed: 'bg-blue-500/20 text-blue-300',
  note_added: 'bg-purple-500/20 text-purple-300',
  note_edited: 'bg-yellow-500/20 text-yellow-300',
  photo_added: 'bg-indigo-500/20 text-indigo-300',
  password_changed: 'bg-orange-500/20 text-orange-300',
};

export default function PortalManagement() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [activityLog, setActivityLog] = useState<PortalActivityLog[]>([]);
  const [selectedUser, setSelectedUser] = useState<PortalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');

  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({ email: '', password: '' });
  const [editError, setEditError] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editSuccess, setEditSuccess] = useState(false);

  // Password visibility toggle per user
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});

  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUser, setResetUser] = useState<PortalUser | null>(null);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);
      loadData(session.user.id);
    });
  }, [router]);

  const loadData = useCallback(async (uid: string) => {
    setIsLoading(true);
    const { data: users } = await supabase
      .from('portal_users')
      .select('*, customer:customers(*)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (users) setPortalUsers(users);

    const { data: logs } = await supabase
      .from('portal_activity_log')
      .select('*, portal_user:portal_users(email, customer:customers(name, company_name))')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(500);
    if (logs) setActivityLog(logs);

    setIsLoading(false);
  }, []);

  const toggleActive = async (pu: PortalUser) => {
    await supabase.from('portal_users').update({ is_active: pu.is_active ? 0 : 1 }).eq('id', pu.id);
    loadData(userId);
  };

  const openEdit = (pu: PortalUser) => {
    setSelectedUser(pu);
    setEditForm({ email: pu.email, password: pu.password_plain });
    setEditError('');
    setEditSuccess(false);
    setShowEditModal(true);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    if (!editForm.email.trim() || !editForm.password.trim()) { setEditError('Email and password are required.'); return; }
    setIsSavingEdit(true);
    const { error } = await supabase.from('portal_users').update({
      email: editForm.email.trim(),
      password_plain: editForm.password,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedUser!.id);
    if (error) { setEditError(error.message); setIsSavingEdit(false); return; }
    setEditSuccess(true);
    setIsSavingEdit(false);
    loadData(userId);
    setTimeout(() => setShowEditModal(false), 1000);
  };

  const openResetPassword = (pu: PortalUser) => {
    setResetUser(pu);
    setResetPassword('');
    setResetError('');
    setShowResetModal(true);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError('');
    if (!resetPassword.trim() || resetPassword.length < 6) {
      setResetError('Password must be at least 6 characters.');
      return;
    }
    setResettingPassword(true);
    try {
      const res = await fetch('/api/portal/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalUserId: resetUser!.id,
          newPassword: resetPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setShowResetModal(false);
        loadData(userId);
        alert(`Password reset for ${resetUser!.email}`);
      }
    } catch (err: any) {
      setResetError(err.response?.data?.error || 'Failed to reset password.');
    }
    setResettingPassword(false);
  };

  const deletePortalUser = async (id: string) => {
    await supabase.from('portal_users').delete().eq('id', id);
    loadData(userId);
  };

  const filteredUsers = portalUsers.filter(pu =>
    pu.email.toLowerCase().includes(search.toLowerCase()) ||
    (pu.customer?.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (pu.customer?.company_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredLogs = activityLog.filter(log => {
    if (filterAction !== 'all' && log.action_type !== filterAction) return false;
    if (selectedUser && log.portal_user_id !== selectedUser.id) return false;
    return true;
  });

  const inputCls = 'w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition';
  const labelCls = 'block text-slate-300 text-sm font-medium mb-1';

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white">Portal Management</h2>
          <p className="text-slate-400 mt-1">{portalUsers.length} portal account{portalUsers.length !== 1 ? 's' : ''}</p>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left: Portal users */}
            <div className="xl:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold">Accounts</h3>
                {selectedUser && (
                  <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-white text-sm transition">Show all logs</button>
                )}
              </div>
              <input
                type="text"
                placeholder="Search accounts..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition mb-4"
              />
              <div className="space-y-3">
                {filteredUsers.map(pu => {
                  const isSelected = selectedUser?.id === pu.id;
                  return (
                    <div
                      key={pu.id}
                      className={`bg-slate-800 border rounded-xl p-4 transition cursor-pointer ${isSelected ? 'border-blue-500' : 'border-slate-700 hover:border-slate-600'}`}
                      onClick={() => setSelectedUser(isSelected ? null : pu)}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0">
                          <p className="text-white font-medium text-sm truncate">{pu.customer?.company_name || pu.customer?.name || '—'}</p>
                          <p className="text-slate-400 text-xs truncate">{pu.email}</p>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${pu.is_active === 1 ? 'bg-green-500/20 text-green-400' : 'bg-slate-600 text-slate-400'}`}>
                          {pu.is_active === 1 ? 'Active' : 'Off'}
                        </span>
                      </div>

                      {/* Password */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-slate-500 text-xs">Password:</span>
                        {showPassword[pu.id] ? (
                          <span className="text-slate-200 text-xs font-mono">{pu.password_plain}</span>
                        ) : (
                          <span className="text-slate-600 text-xs">{'•'.repeat(Math.min(pu.password_plain?.length || 8, 12))}</span>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); setShowPassword(prev => ({ ...prev, [pu.id]: !prev[pu.id] })); }}
                          className="text-slate-500 hover:text-slate-300 text-xs transition"
                        >
                          {showPassword[pu.id] ? 'hide' : 'show'}
                        </button>
                      </div>

                      <p className="text-slate-500 text-xs mb-3">Last login: {formatTs(pu.last_login)}</p>

                      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEdit(pu)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-1.5 rounded-lg transition">Edit</button>
                        <button onClick={() => openResetPassword(pu)} className="flex-1 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 text-xs font-medium py-1.5 rounded-lg transition">Reset</button>
                        <button onClick={() => toggleActive(pu)} className={`flex-1 text-xs font-medium py-1.5 rounded-lg transition ${pu.is_active ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'}`}>
                          {pu.is_active ? 'Disable' : 'Enable'}
                        </button>
                        <button onClick={() => deletePortalUser(pu.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium py-1.5 px-3 rounded-lg transition">✕</button>
                      </div>
                    </div>
                  );
                })}
                {filteredUsers.length === 0 && (
                  <p className="text-slate-500 text-sm text-center py-8">No portal accounts found.</p>
                )}
              </div>
            </div>

            {/* Right: Activity log */}
            <div className="xl:col-span-2">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h3 className="text-white font-semibold">
                  Activity Log
                  {selectedUser && <span className="text-slate-400 text-sm font-normal ml-2">— {selectedUser.customer?.company_name || selectedUser.customer?.name || selectedUser.email}</span>}
                </h3>
                <select
                  value={filterAction}
                  onChange={e => setFilterAction(e.target.value)}
                  className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-blue-500 transition"
                >
                  <option value="all">All actions</option>
                  {(Object.keys(ACTION_LABELS) as PortalActivityType[]).map(k => (
                    <option key={k} value={k}>{ACTION_LABELS[k]}</option>
                  ))}
                </select>
              </div>

              {filteredLogs.length === 0 ? (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-12 text-center">
                  <p className="text-slate-500">No activity recorded yet.</p>
                </div>
              ) : (
                <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                  <div className="divide-y divide-slate-700/50 max-h-[calc(100vh-280px)] overflow-y-auto">
                    {filteredLogs.map(log => {
                      const label = ACTION_LABELS[log.action_type as PortalActivityType] || log.action_type;
                      const colorCls = ACTION_COLORS[log.action_type as PortalActivityType] || 'bg-slate-600 text-slate-300';
                      const puName = (log as any).portal_user?.customer?.company_name || (log as any).portal_user?.customer?.name || (log as any).portal_user?.email || '—';
                      let details: any = null;
                      try { if (log.details) details = JSON.parse(log.details); } catch {}
                      return (
                        <div key={log.id} className="px-5 py-3 flex items-start gap-3 hover:bg-slate-700/30 transition">
                          <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 mt-0.5 ${colorCls}`}>{label}</span>
                          <div className="flex-1 min-w-0">
                            {!selectedUser && <p className="text-slate-300 text-sm font-medium">{puName}</p>}
                            {details?.job_title && <p className="text-slate-400 text-xs truncate">Job: {details.job_title}</p>}
                            {details?.content_preview && <p className="text-slate-500 text-xs italic truncate">"{details.content_preview}"</p>}
                            {log.ip_address && <p className="text-slate-600 text-xs">IP: {log.ip_address}</p>}
                          </div>
                          <p className="text-slate-500 text-xs flex-shrink-0 text-right">{formatTs(log.created_at)}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Edit portal user modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Edit Portal Access</h3>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={saveEdit} className="p-6 space-y-4">
              {editError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{editError}</div>}
              {editSuccess && <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3">Saved successfully.</div>}
              <p className="text-slate-400 text-sm">{selectedUser.customer?.company_name || selectedUser.customer?.name}</p>
              <div>
                <label className={labelCls}>Email</label>
                <input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Password</label>
                <input type="text" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} className={inputCls} />
                <p className="text-slate-500 text-xs mt-1">This is stored so you can recover it for the client.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={isSavingEdit} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {isSavingEdit ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && resetUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Reset Password</h3>
              <button onClick={() => setShowResetModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              {resetError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{resetError}</div>}
              <p className="text-slate-400 text-sm">Resetting password for <strong>{resetUser.email}</strong></p>
              <div>
                <label className={labelCls}>New Password</label>
                <input type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} className={inputCls} placeholder="New password" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowResetModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={resettingPassword} className="flex-1 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {resettingPassword ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
