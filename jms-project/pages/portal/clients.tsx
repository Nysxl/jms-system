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

        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 placeholder-slate-500 focus:outline-none focus:border-blue-500 mb-6" />

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
