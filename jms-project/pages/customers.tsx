import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Customer } from '@/lib/types';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  company_name: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  notes: '',
};

export default function Customers() {
  const router = useRouter();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/login');
      } else {
        loadCustomers();
      }
    });
  }, [router]);

  const loadCustomers = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setCustomers(data);
    setIsLoading(false);
  };

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      company_name: customer.company_name || '',
      address: customer.address || '',
      city: customer.city || '',
      state: customer.state || '',
      zip_code: customer.zip_code || '',
      notes: customer.notes || '',
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!form.name.trim() || !form.email.trim()) {
      setFormError('Name and email are required.');
      return;
    }

    setIsSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setFormError('You must be logged in.');
      setIsSaving(false);
      return;
    }

    if (editingCustomer) {
      const { error } = await supabase
        .from('customers')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', editingCustomer.id);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    } else {
      const { error } = await supabase
        .from('customers')
        .insert([{
          ...form,
          user_id: session.user.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }]);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    }

    setIsSaving(false);
    setShowModal(false);
    loadCustomers();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('customers').delete().eq('id', id);
    setDeleteConfirm(null);
    loadCustomers();
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    (c.company_name || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Customers</h2>
            <p className="text-slate-400 mt-1">{customers.length} total customer{customers.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={openCreate}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition"
          >
            + Add Customer
          </button>
        </div>

        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, email or company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-3 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading customers...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
            <p className="text-5xl mb-4">👥</p>
            <p className="text-white font-semibold text-lg mb-2">
              {search ? 'No customers match your search' : 'No customers yet'}
            </p>
            <p className="text-slate-400 text-sm mb-6">
              {search ? 'Try a different search term.' : 'Add your first customer to get started.'}
            </p>
            {!search && (
              <button
                onClick={openCreate}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition"
              >
                + Add Customer
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map(customer => (
              <div
                key={customer.id}
                className="bg-slate-800 border border-slate-700 rounded-xl p-6 flex flex-col gap-3 hover:border-slate-600 transition"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-white font-semibold truncate">{customer.name}</p>
                    {customer.company_name && (
                      <p className="text-slate-400 text-xs truncate">{customer.company_name}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1 text-sm">
                  <p className="text-slate-300 truncate">✉️ {customer.email}</p>
                  {customer.phone && <p className="text-slate-300">📞 {customer.phone}</p>}
                  {customer.city && (
                    <p className="text-slate-400">
                      📍 {[customer.city, customer.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>

                {customer.notes && (
                  <p className="text-slate-500 text-xs border-t border-slate-700 pt-3 line-clamp-2">
                    {customer.notes}
                  </p>
                )}

                <div className="flex gap-2 pt-2 mt-auto">
                  <button
                    onClick={() => openEdit(customer)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium py-2 rounded-lg transition"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(customer.id)}
                    className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-medium py-2 rounded-lg transition"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold text-lg">
                {editingCustomer ? 'Edit Customer' : 'Add Customer'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white text-xl transition"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {formError && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="Full name"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Email *</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="+61 400 000 000"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Company</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={e => setForm({ ...form, company_name: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="Company name"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-1">Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="Street address"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="Melbourne"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="VIC"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Postcode</label>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={e => setForm({ ...form, zip_code: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    placeholder="3000"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                    rows={3}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none"
                    placeholder="Any additional notes..."
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
                >
                  {isSaving ? 'Saving...' : editingCustomer ? 'Save Changes' : 'Add Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-4">🗑️</p>
            <h3 className="text-white font-semibold text-lg mb-2">Delete Customer?</h3>
            <p className="text-slate-400 text-sm mb-6">This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 rounded-lg transition"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
