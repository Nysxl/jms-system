import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase';
import { PortalUser } from '@/lib/types';

export default function PortalClients() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ clientId: '', email: '', password: '', confirmPassword: '' });
  const [inviting, setInviting] = useState(false);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    const stored = localStorage.getItem('portal_session');
    if (!stored) { router.push('/portal/login'); return; }
    const pu = JSON.parse(stored);
    setPortalUser(pu);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { localStorage.removeItem('portal_session'); router.push('/portal/login'); return; }
    loadClients(pu.customer_id);
  };

  const loadClients = async (customerId: string) => {
    setIsLoading(true);
    const { data } = await supabase
      .from('customers').select('*')
      .eq('contractor_id', customerId).eq('customer_type', 'sub_contact').order('name');
    if (data) setClients(data);
    setIsLoading(false);
  };

  const filtered = clients.filter(c => {
    const q = search.toLowerCase();
    return (c.name || '').toLowerCase().includes(q) || (c.company_name || '').toLowerCase().includes(q);
  });

  const handleInviteSubContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteForm.clientId || !inviteForm.email || !inviteForm.password) return;
    if (inviteForm.password !== inviteForm.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (inviteForm.password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setInviting(true);
    try {
      const res = await fetch('/api/portal/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          portalUserId: portalUser?.id,
          subContactId: inviteForm.clientId,
          email: inviteForm.email.trim().toLowerCase(),
          password: inviteForm.password,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Portal account created for ${data.portal_user.email}`);
        setInviteForm({ clientId: '', email: '', password: '', confirmPassword: '' });
        setShowInviteForm(false);
        loadClients(portalUser!.customer_id);
      } else {
        alert('Failed to create portal account: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error creating portal account');
    } finally {
      setInviting(false);
    }
  };

  if (!portalUser) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <PortalHeader portalUserEmail={portalUser.email} customerType="contractor" />
      <main className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">My Clients</h2>
            <p className="text-slate-400 mt-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="flex-1 bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:border-blue-500" />
          <button onClick={() => setShowInviteForm(!showInviteForm)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold px-4 py-2.5 rounded-lg transition">
            {showInviteForm ? '✕' : '+ Invite'}
          </button>
        </div>

        {showInviteForm && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
            <h3 className="text-white font-semibold mb-4">Create Portal Account for Sub-Contact</h3>
            <form onSubmit={handleInviteSubContact} className="space-y-4">
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Sub-Contact</label>
                <select value={inviteForm.clientId} onChange={e => setInviteForm({ ...inviteForm, clientId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Select a sub-contact...</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.company_name || c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Email</label>
                <input type="email" value={inviteForm.email} onChange={e => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="their@email.com"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Password</label>
                <input type="password" value={inviteForm.password} onChange={e => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="At least 6 characters"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Confirm Password</label>
                <input type="password" value={inviteForm.confirmPassword} onChange={e => setInviteForm({ ...inviteForm, confirmPassword: e.target.value })}
                  placeholder="Confirm password"
                  className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={inviting || !inviteForm.clientId || !inviteForm.email || !inviteForm.password}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-2 rounded-lg transition">
                  {inviting ? 'Creating...' : 'Create Account'}
                </button>
                <button type="button" onClick={() => setShowInviteForm(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-semibold py-2 rounded-lg transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading clients...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800 rounded-xl border border-slate-700 p-12 text-center">
            <p className="text-5xl mb-4">👥</p>
            <p className="text-white font-semibold mb-1">{search ? 'No clients found' : 'No clients yet'}</p>
            <p className="text-slate-400 text-sm">Your sub-contacts will appear here.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filtered.map(client => (
              <Link key={client.id} href={`/portal/clients/${client.id}`}>
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 hover:border-slate-500 transition cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-white font-semibold">{client.company_name || client.name}</p>
                      {client.company_name && <p className="text-slate-400 text-sm">{client.name}</p>}
                      {client.email && <p className="text-slate-500 text-sm mt-1">{client.email}</p>}
                      {client.phone && <p className="text-slate-500 text-sm">{client.phone}</p>}
                    </div>
                    <span className="text-slate-500 text-xl">→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
