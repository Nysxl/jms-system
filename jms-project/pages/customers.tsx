import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Customer, PortalUser } from '@/lib/types';

type Tab = 'direct' | 'contractor';

const emptyDirectForm = {
  name: '', email: '', phone: '', company_name: '',
  address: '', city: '', state: '', zip_code: '', notes: '',
};

const emptyContractorForm = {
  company_name: '', name: '', email: '', phone: '',
  address: '', city: '', state: '', zip_code: '', notes: '',
};

const emptySubContactForm = {
  name: '', email: '', phone: '',
  address: '', city: '', state: '', zip_code: '', notes: '',
};

export default function Customers() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<Tab>('direct');

  // Direct clients
  const [directClients, setDirectClients] = useState<Customer[]>([]);
  // Contractors
  const [contractors, setContractors] = useState<Customer[]>([]);
  // Sub-contacts per contractor { contractorId: Customer[] }
  const [subContactsMap, setSubContactsMap] = useState<Record<string, Customer[]>>({});
  // Expanded contractors
  const [expandedContractors, setExpandedContractors] = useState<Set<string>>(new Set());

  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Customer modal (direct or contractor)
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'direct' | 'contractor'>('direct');
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState<any>(emptyDirectForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Sub-contact modal
  const [showSubModal, setShowSubModal] = useState(false);
  const [subModalContractor, setSubModalContractor] = useState<Customer | null>(null);
  const [editingSubContact, setEditingSubContact] = useState<Customer | null>(null);
  const [subForm, setSubForm] = useState(emptySubContactForm);
  const [subFormError, setSubFormError] = useState('');
  const [isSavingSub, setIsSavingSub] = useState(false);

  // Portal access modal
  const [showPortalModal, setShowPortalModal] = useState(false);
  const [portalCustomer, setPortalCustomer] = useState<Customer | null>(null);
  const [portalUsers, setPortalUsers] = useState<PortalUser[]>([]);
  const [portalForm, setPortalForm] = useState({ email: '', password: '' });
  const [portalError, setPortalError] = useState('');
  const [isSavingPortal, setIsSavingPortal] = useState(false);
  const [editingPortalUser, setEditingPortalUser] = useState<PortalUser | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      setUserId(session.user.id);
      loadAll(session.user.id);
    });
  }, [router]);

  const loadAll = async (uid: string) => {
    setIsLoading(true);
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false });
    if (data) {
      setDirectClients(data.filter((c: Customer) => c.customer_type === 'direct' || !c.customer_type));
      setContractors(data.filter((c: Customer) => c.customer_type === 'contractor'));
      const subMap: Record<string, Customer[]> = {};
      data.filter((c: Customer) => c.customer_type === 'sub_contact').forEach((sc: Customer) => {
        if (sc.contractor_id) {
          if (!subMap[sc.contractor_id]) subMap[sc.contractor_id] = [];
          subMap[sc.contractor_id].push(sc);
        }
      });
      setSubContactsMap(subMap);
    }
    setIsLoading(false);
  };

  const loadPortalUsers = async (): Promise<PortalUser[]> => {
    const { data } = await supabase
      .from('portal_users')
      .select('*')
      .eq('user_id', userId);
    const list = (data as PortalUser[]) || [];
    setPortalUsers(list);
    return list;
  };

  const getPortalUser = (customerId: string) =>
    portalUsers.find(p => p.customer_id === customerId);

  // ---- Direct client CRUD ----
  const openCreateDirect = () => {
    setModalType('direct');
    setEditingCustomer(null);
    setForm(emptyDirectForm);
    setFormError('');
    setShowModal(true);
  };

  const openEditDirect = (c: Customer) => {
    setModalType('direct');
    setEditingCustomer(c);
    setForm({ name: c.name, email: c.email || '', phone: c.phone || '', company_name: c.company_name || '', address: c.address || '', city: c.city || '', state: c.state || '', zip_code: c.zip_code || '', notes: c.notes || '' });
    setFormError('');
    setShowModal(true);
  };

  // ---- Contractor CRUD ----
  const openCreateContractor = () => {
    setModalType('contractor');
    setEditingCustomer(null);
    setForm(emptyContractorForm);
    setFormError('');
    setShowModal(true);
  };

  const openEditContractor = (c: Customer) => {
    setModalType('contractor');
    setEditingCustomer(c);
    setForm({ company_name: c.company_name || '', name: c.name, email: c.email || '', phone: c.phone || '', address: c.address || '', city: c.city || '', state: c.state || '', zip_code: c.zip_code || '', notes: c.notes || '' });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim() && !form.company_name.trim()) {
      setFormError('Name or company name is required.');
      return;
    }
    setIsSaving(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setFormError('You must be logged in.'); setIsSaving(false); return; }

    const payload = {
      ...form,
      name: form.name || form.company_name,
      customer_type: modalType,
      updated_at: new Date().toISOString(),
    };

    if (editingCustomer) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    } else {
      const { error } = await supabase.from('customers').insert([{ ...payload, user_id: session.user.id, created_at: new Date().toISOString() }]);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    }
    setIsSaving(false);
    setShowModal(false);
    loadAll(session.user.id);
  };

  const handleDelete = async (customerId: string) => {
    try {
      // Get all sub-contacts for this customer
      const { data: subContacts } = await supabase
        .from('customers')
        .select('id')
        .eq('contractor_id', customerId)
        .eq('customer_type', 'sub_contact');

      const subContactIds = subContacts?.map(c => c.id) || [];
      const allCustomerIds = [customerId, ...subContactIds];

      // Delete all jobs and related data for this customer and sub-contacts
      for (const cId of allCustomerIds) {
        const { data: jobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('customer_id', cId);

        for (const job of jobs || []) {
          // Delete related job data
          await supabase.from('job_notes').delete().eq('job_id', job.id);
          await supabase.from('job_images').delete().eq('job_id', job.id);
          await supabase.from('job_attachments').delete().eq('job_id', job.id);
          await supabase.from('time_entries').delete().eq('job_id', job.id);
          await supabase.from('expenses').delete().eq('job_id', job.id);
          // Delete the job
          await supabase.from('jobs').delete().eq('id', job.id);
        }

        // Delete portal users for this customer
        await supabase.from('portal_users').delete().eq('customer_id', cId);
      }

      // Delete sub-contacts
      if (subContactIds.length > 0) {
        await supabase
          .from('customers')
          .delete()
          .in('id', subContactIds)
          .eq('user_id', userId);
      }

      // Finally delete the main customer
      await supabase
        .from('customers')
        .delete()
        .eq('id', customerId)
        .eq('user_id', userId);

      setDeleteConfirm(null);
      loadAll(userId);
    } catch (err: any) {
      console.error('Delete error:', err);
      alert('Failed to delete: ' + err.message);
    }
  };

  // ---- Sub-contact CRUD ----
  const openAddSubContact = (contractor: Customer) => {
    setSubModalContractor(contractor);
    setEditingSubContact(null);
    setSubForm(emptySubContactForm);
    setSubFormError('');
    setShowSubModal(true);
  };

  const openEditSubContact = (sc: Customer, contractor: Customer) => {
    setSubModalContractor(contractor);
    setEditingSubContact(sc);
    setSubForm({ name: sc.name, email: sc.email || '', phone: sc.phone || '', address: sc.address || '', city: sc.city || '', state: sc.state || '', zip_code: sc.zip_code || '', notes: sc.notes || '' });
    setSubFormError('');
    setShowSubModal(true);
  };

  const handleSubSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubFormError('');
    if (!subForm.name.trim()) { setSubFormError('Name is required.'); return; }
    setIsSavingSub(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setSubFormError('You must be logged in.'); setIsSavingSub(false); return; }

    const payload = {
      ...subForm,
      customer_type: 'sub_contact',
      contractor_id: subModalContractor!.id,
      user_id: session.user.id,
      updated_at: new Date().toISOString(),
    };

    if (editingSubContact) {
      const { error } = await supabase.from('customers').update(payload).eq('id', editingSubContact.id);
      if (error) { setSubFormError(error.message); setIsSavingSub(false); return; }
    } else {
      const { error } = await supabase.from('customers').insert([{ ...payload, created_at: new Date().toISOString() }]);
      if (error) { setSubFormError(error.message); setIsSavingSub(false); return; }
    }
    setIsSavingSub(false);
    setShowSubModal(false);
    loadAll(session.user.id);
  };

  // ---- Portal access ----
  const openPortalModal = async (customer: Customer) => {
    setPortalCustomer(customer);
    setPortalError('');
    setEditingPortalUser(null);
    const freshList = await loadPortalUsers();
    const existing = freshList.find(p => p.customer_id === customer.id);
    if (existing) {
      setEditingPortalUser(existing);
      setPortalForm({ email: existing.email, password: existing.password_plain });
    } else {
      setPortalForm({ email: customer.email || '', password: '' });
    }
    setShowPortalModal(true);
  };

  const handlePortalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPortalError('');
    if (!portalForm.email.trim() || !portalForm.password.trim()) {
      setPortalError('Email and password are required.');
      return;
    }
    setIsSavingPortal(true);

    const payload = {
      email: portalForm.email.trim(),
      password_plain: portalForm.password,
      updated_at: new Date().toISOString(),
    };

    if (editingPortalUser) {
      const { error } = await supabase.from('portal_users').update(payload).eq('id', editingPortalUser.id);
      if (error) { setPortalError(error.message); setIsSavingPortal(false); return; }
    } else {
      const { error } = await supabase.from('portal_users').insert([{
        ...payload,
        user_id: userId,
        customer_id: portalCustomer!.id,
        is_active: 1,
        created_at: new Date().toISOString(),
      }]);
      if (error) { setPortalError(error.message); setIsSavingPortal(false); return; }
    }

    // Create or update Supabase Auth user so they can log into the portal
    await fetch('/api/portal/create-auth-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: portalForm.email.trim().toLowerCase(),
        password: portalForm.password,
      }),
    });

    setIsSavingPortal(false);
    setShowPortalModal(false);
    await loadPortalUsers();
  };

  const togglePortalActive = async (pu: PortalUser) => {
    await supabase.from('portal_users').update({ is_active: pu.is_active ? 0 : 1 }).eq('id', pu.id);
    loadPortalUsers();
  };

  const toggleContractor = (id: string) => {
    setExpandedContractors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (userId) loadPortalUsers();
  }, [userId]);

  const filteredDirect = directClients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const filteredContractors = contractors.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name || '').toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = 'w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition';
  const labelCls = 'block text-slate-300 text-sm font-medium mb-1';

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Header row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-3xl font-bold text-white">Contacts</h2>
            <p className="text-slate-400 mt-1">
              {directClients.length} direct client{directClients.length !== 1 ? 's' : ''} &middot; {contractors.length} contractor{contractors.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={activeTab === 'direct' ? openCreateDirect : openCreateContractor}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            + Add {activeTab === 'direct' ? 'Direct Client' : 'Contractor'}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 p-1 rounded-lg w-fit mb-6">
          <button
            onClick={() => setActiveTab('direct')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition ${activeTab === 'direct' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Direct Clients
          </button>
          <button
            onClick={() => setActiveTab('contractor')}
            className={`px-5 py-2 rounded-md text-sm font-medium transition ${activeTab === 'contractor' ? 'bg-blue-500 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            Contractors
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder={activeTab === 'direct' ? 'Search clients...' : 'Search contractors...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading...</div>
        ) : activeTab === 'direct' ? (

          /* ---- DIRECT CLIENTS ---- */
          filteredDirect.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
              <p className="text-5xl mb-4">👤</p>
              <p className="text-white font-semibold text-lg mb-2">{search ? 'No matches' : 'No direct clients yet'}</p>
              <p className="text-slate-400 text-sm mb-6">{search ? 'Try a different search.' : 'Add your first direct client.'}</p>
              {!search && <button onClick={openCreateDirect} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">+ Add Direct Client</button>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredDirect.map(c => {
                const pu = getPortalUser(c.id);
                return (
                  <div key={c.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col gap-3 hover:border-slate-600 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-white font-semibold truncate">{c.name}</p>
                        {c.company_name && <p className="text-slate-400 text-xs truncate">{c.company_name}</p>}
                      </div>
                      {pu && (
                        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${pu.is_active === 1 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                          {pu.is_active === 1 ? 'Portal active' : 'Portal off'}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1 text-sm">
                      {c.email && <p className="text-slate-300 truncate">✉ {c.email}</p>}
                      {c.phone && <p className="text-slate-300">📞 {c.phone}</p>}
                      {c.city && <p className="text-slate-400">📍 {[c.city, c.state].filter(Boolean).join(', ')}</p>}
                    </div>

                    {c.notes && (
                      <p className="text-slate-500 text-xs border-t border-slate-700 pt-3 line-clamp-2">{c.notes}</p>
                    )}

                    <div className="flex gap-2 pt-2 mt-auto flex-wrap">
                      <button onClick={() => router.push(`/customers/${c.id}`)} className="flex-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium py-2 rounded-lg transition">View</button>
                      <button onClick={() => openEditDirect(c)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition">Edit</button>
                      <button onClick={() => openPortalModal(c)} className="flex-1 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-sm font-medium py-2 rounded-lg transition">Portal</button>
                      <button onClick={() => setDeleteConfirm(c.id)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium py-2 rounded-lg transition">Delete</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )

        ) : (

          /* ---- CONTRACTORS ---- */
          filteredContractors.length === 0 ? (
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
              <p className="text-5xl mb-4">🏢</p>
              <p className="text-white font-semibold text-lg mb-2">{search ? 'No matches' : 'No contractors yet'}</p>
              <p className="text-slate-400 text-sm mb-6">{search ? 'Try a different search.' : 'Add a company you contract for.'}</p>
              {!search && <button onClick={openCreateContractor} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">+ Add Contractor</button>}
            </div>
          ) : (
            <div className="space-y-4">
              {filteredContractors.map(contractor => {
                const subs = subContactsMap[contractor.id] || [];
                const isExpanded = expandedContractors.has(contractor.id);
                const pu = getPortalUser(contractor.id);
                return (
                  <div key={contractor.id} className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
                    {/* Contractor header row */}
                    <div className="p-5 flex items-center gap-4">
                      <button onClick={() => toggleContractor(contractor.id)} className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center text-slate-300 hover:bg-slate-600 transition flex-shrink-0 text-sm">
                        {isExpanded ? '▾' : '▸'}
                      </button>
                      <div className="w-10 h-10 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                        {(contractor.company_name || contractor.name).charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white font-semibold">{contractor.company_name || contractor.name}</p>
                        <p className="text-slate-400 text-sm">{subs.length} sub-contact{subs.length !== 1 ? 's' : ''}{contractor.email ? ` · ${contractor.email}` : ''}</p>
                      </div>
                      {pu && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${pu.is_active === 1 ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
                          {pu.is_active === 1 ? 'Portal active' : 'Portal off'}
                        </span>
                      )}
                      <div className="flex gap-2 flex-shrink-0">
                        <button onClick={() => router.push(`/customers/${contractor.id}`)} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium py-1.5 px-3 rounded-lg transition">View</button>
                        <button onClick={() => openEditContractor(contractor)} className="bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-1.5 px-3 rounded-lg transition">Edit</button>
                        <button onClick={() => openPortalModal(contractor)} className="bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 text-sm font-medium py-1.5 px-3 rounded-lg transition">Portal</button>
                        <button onClick={() => openAddSubContact(contractor)} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium py-1.5 px-3 rounded-lg transition">+ Contact</button>
                        <button onClick={() => setDeleteConfirm(contractor.id)} className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium py-1.5 px-3 rounded-lg transition">Delete</button>
                      </div>
                    </div>

                    {/* Sub-contacts */}
                    {isExpanded && (
                      <div className="border-t border-slate-700">
                        {subs.length === 0 ? (
                          <div className="px-6 py-8 text-center">
                            <p className="text-slate-500 text-sm">No contacts added yet for this contractor.</p>
                            <button onClick={() => openAddSubContact(contractor)} className="mt-3 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-sm font-medium py-2 px-4 rounded-lg transition">
                              + Add First Contact
                            </button>
                          </div>
                        ) : (
                          <div className="divide-y divide-slate-700/50">
                            {subs.map(sc => (
                              <div key={sc.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-700/30 transition group">
                                <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                  {sc.name.charAt(0).toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-white text-sm font-medium">{sc.name}</p>
                                  <p className="text-slate-400 text-xs">
                                    {[sc.email, sc.phone, sc.city].filter(Boolean).join(' · ')}
                                  </p>
                                </div>
                                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                                  <button
                                    onClick={() => router.push(`/jobs?customer_id=${sc.id}`)}
                                    className="bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium py-1.5 px-3 rounded-lg transition"
                                  >
                                    Jobs
                                  </button>
                                  <button
                                    onClick={() => openEditSubContact(sc, contractor)}
                                    className="bg-slate-700 hover:bg-slate-600 text-white text-xs font-medium py-1.5 px-3 rounded-lg transition"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => setDeleteConfirm(sc.id)}
                                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-medium py-1.5 px-3 rounded-lg transition"
                                  >
                                    Delete
                                  </button>
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
          )
        )}
      </main>

      {/* ---- Add/Edit Customer Modal ---- */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold text-lg">
                {editingCustomer ? 'Edit' : 'Add'} {modalType === 'direct' ? 'Direct Client' : 'Contractor'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white text-xl transition">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{formError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {modalType === 'contractor' && (
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Company Name *</label>
                    <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className={inputCls} placeholder="e.g. Skinmed" />
                  </div>
                )}
                <div>
                  <label className={labelCls}>{modalType === 'contractor' ? 'Contact Person' : 'Name *'}</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inputCls} placeholder="Full name" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className={inputCls} placeholder="email@example.com" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="text" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+61 400 000 000" />
                </div>
                {modalType === 'direct' && (
                  <div>
                    <label className={labelCls}>Company</label>
                    <input type="text" value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} className={inputCls} placeholder="Company name" />
                  </div>
                )}
                <div className="sm:col-span-2">
                  <label className={labelCls}>Address</label>
                  <input type="text" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inputCls} placeholder="Street address" />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input type="text" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className={inputCls} placeholder="Melbourne" />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input type="text" value={form.state} onChange={e => setForm({ ...form, state: e.target.value })} className={inputCls} placeholder="VIC" />
                </div>
                <div>
                  <label className={labelCls}>Postcode</label>
                  <input type="text" value={form.zip_code} onChange={e => setForm({ ...form, zip_code: e.target.value })} className={inputCls} placeholder="3000" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} className={`${inputCls} resize-none`} placeholder="Any additional notes..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {isSaving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- Sub-contact Modal ---- */}
      {showSubModal && subModalContractor && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-semibold text-lg">
                  {editingSubContact ? 'Edit Contact' : 'Add Contact'}
                </h3>
                <p className="text-slate-400 text-sm">Under {subModalContractor.company_name || subModalContractor.name}</p>
              </div>
              <button onClick={() => setShowSubModal(false)} className="text-slate-400 hover:text-white text-xl transition">✕</button>
            </div>
            <form onSubmit={handleSubSubmit} className="p-6 space-y-4">
              {subFormError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{subFormError}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Name *</label>
                  <input type="text" value={subForm.name} onChange={e => setSubForm({ ...subForm, name: e.target.value })} className={inputCls} placeholder="Full name" />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input type="email" value={subForm.email} onChange={e => setSubForm({ ...subForm, email: e.target.value })} className={inputCls} placeholder="email@example.com" />
                </div>
                <div>
                  <label className={labelCls}>Phone</label>
                  <input type="text" value={subForm.phone} onChange={e => setSubForm({ ...subForm, phone: e.target.value })} className={inputCls} placeholder="+61 400 000 000" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Address</label>
                  <input type="text" value={subForm.address} onChange={e => setSubForm({ ...subForm, address: e.target.value })} className={inputCls} placeholder="Street address" />
                </div>
                <div>
                  <label className={labelCls}>City</label>
                  <input type="text" value={subForm.city} onChange={e => setSubForm({ ...subForm, city: e.target.value })} className={inputCls} placeholder="Melbourne" />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <input type="text" value={subForm.state} onChange={e => setSubForm({ ...subForm, state: e.target.value })} className={inputCls} placeholder="VIC" />
                </div>
                <div>
                  <label className={labelCls}>Postcode</label>
                  <input type="text" value={subForm.zip_code} onChange={e => setSubForm({ ...subForm, zip_code: e.target.value })} className={inputCls} placeholder="3000" />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls}>Notes</label>
                  <textarea value={subForm.notes} onChange={e => setSubForm({ ...subForm, notes: e.target.value })} rows={3} className={`${inputCls} resize-none`} placeholder="Any notes about this contact..." />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowSubModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={isSavingSub} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {isSavingSub ? 'Saving...' : editingSubContact ? 'Save Changes' : 'Add Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- Portal Access Modal ---- */}
      {showPortalModal && portalCustomer && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <div>
                <h3 className="text-white font-semibold text-lg">Portal Access</h3>
                <p className="text-slate-400 text-sm">{portalCustomer.company_name || portalCustomer.name}</p>
              </div>
              <button onClick={() => setShowPortalModal(false)} className="text-slate-400 hover:text-white text-xl transition">✕</button>
            </div>
            <div className="p-6">
              {editingPortalUser && (
                <div className="mb-4 p-3 bg-slate-700/50 rounded-lg text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">Status</span>
                    <span className={editingPortalUser.is_active ? 'text-green-400' : 'text-slate-400'}>
                      {editingPortalUser.is_active === 1 ? 'Active' : 'Disabled'}
                    </span>
                  </div>
                  {editingPortalUser.last_login && (
                    <div className="flex justify-between items-center mt-1">
                      <span className="text-slate-400">Last login</span>
                      <span className="text-slate-300">{new Date(editingPortalUser.last_login).toLocaleString()}</span>
                    </div>
                  )}
                  <button
                    onClick={() => { togglePortalActive(editingPortalUser); setShowPortalModal(false); }}
                    className={`mt-3 w-full text-sm font-medium py-1.5 rounded-lg transition ${editingPortalUser.is_active === 1 ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400' : 'bg-green-500/10 hover:bg-green-500/20 text-green-400'}`}
                  >
                    {editingPortalUser.is_active === 1 ? 'Disable portal access' : 'Enable portal access'}
                  </button>
                </div>
              )}

              {!editingPortalUser && (
                <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-300">
                  {portalCustomer.customer_type === 'contractor'
                    ? 'This contractor will be able to log in and see all their contacts, jobs, and invoices.'
                    : 'This client will be able to log in and see all their jobs.'}
                </div>
              )}

              <form onSubmit={handlePortalSubmit} className="space-y-4">
                {portalError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{portalError}</div>}
                <div>
                  <label className={labelCls}>Portal Email</label>
                  <input type="email" value={portalForm.email} onChange={e => setPortalForm({ ...portalForm, email: e.target.value })} className={inputCls} placeholder="their@email.com" />
                </div>
                <div>
                  <label className={labelCls}>Password</label>
                  <input type="text" value={portalForm.password} onChange={e => setPortalForm({ ...portalForm, password: e.target.value })} className={inputCls} placeholder="Set a password" />
                  <p className="text-slate-500 text-xs mt-1">Visible to you for recovery purposes.</p>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowPortalModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                  <button type="submit" disabled={isSavingPortal} className="flex-1 bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                    {isSavingPortal ? 'Saving...' : editingPortalUser ? 'Update Credentials' : 'Create Portal Access'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-4">🗑️</p>
            <h3 className="text-white font-semibold text-lg mb-2">Delete?</h3>
            <p className="text-slate-400 text-sm mb-6">This cannot be undone.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
              <button onClick={() => handleDelete(deleteConfirm)} className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
