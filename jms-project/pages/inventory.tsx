import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { InventoryItem, InventoryTransaction } from '@/lib/types';

const emptyForm = {
  name: '',
  description: '',
  sku: '',
  category: '',
  quantity: '0',
  min_quantity: '0',
  unit_cost: '',
  unit_price: '',
  supplier: '',
  location: '',
  notes: '',
};

const txnForm = {
  transaction_type: 'in' as 'in' | 'out' | 'adjustment',
  quantity: '',
  notes: '',
  reference_id: '',
};

export default function Inventory() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStock, setFilterStock] = useState('all');

  // Item modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Transaction modal
  const [showTxnModal, setShowTxnModal] = useState(false);
  const [txnItem, setTxnItem] = useState<InventoryItem | null>(null);
  const [txn, setTxn] = useState(txnForm);
  const [txnError, setTxnError] = useState('');
  const [savingTxn, setSavingTxn] = useState(false);

  // History modal
  const [showHistory, setShowHistory] = useState(false);
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<InventoryTransaction[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      loadItems();
    });
  }, [router]);

  const loadItems = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('inventory')
      .select('*')
      .order('name', { ascending: true });
    if (data) setItems(data);
    setIsLoading(false);
  };

  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyForm);
    setFormError('');
    setShowItemModal(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      name: item.name || '',
      description: item.description || '',
      sku: item.sku || '',
      category: item.category || '',
      quantity: item.quantity?.toString() || '0',
      min_quantity: item.min_quantity?.toString() || '0',
      unit_cost: item.unit_cost?.toString() || '',
      unit_price: item.unit_price?.toString() || '',
      supplier: item.supplier || '',
      location: item.location || '',
      notes: item.notes || '',
    });
    setFormError('');
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name.trim()) { setFormError('Name is required.'); return; }
    setIsSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setFormError('Not logged in.'); setIsSaving(false); return; }

    const payload = {
      name: form.name,
      description: form.description,
      sku: form.sku,
      category: form.category,
      quantity: parseInt(form.quantity) || 0,
      min_quantity: parseInt(form.min_quantity) || 0,
      unit_cost: form.unit_cost ? parseFloat(form.unit_cost) : null,
      unit_price: form.unit_price ? parseFloat(form.unit_price) : null,
      supplier: form.supplier,
      location: form.location,
      notes: form.notes,
      updated_at: new Date().toISOString(),
    };

    if (editingItem) {
      const { error } = await supabase.from('inventory').update(payload).eq('id', editingItem.id);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    } else {
      const { error } = await supabase.from('inventory').insert([{
        ...payload,
        user_id: session.user.id,
        created_at: new Date().toISOString(),
      }]);
      if (error) { setFormError(error.message); setIsSaving(false); return; }
    }

    setIsSaving(false);
    setShowItemModal(false);
    loadItems();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('inventory').delete().eq('id', id);
    setDeleteConfirm(null);
    loadItems();
  };

  const openTransaction = (item: InventoryItem) => {
    setTxnItem(item);
    setTxn(txnForm);
    setTxnError('');
    setShowTxnModal(true);
  };

  const handleSaveTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setTxnError('');
    if (!txn.quantity || parseInt(txn.quantity) <= 0) {
      setTxnError('Quantity must be greater than 0.');
      return;
    }
    setSavingTxn(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || !txnItem) { setSavingTxn(false); return; }

    const qty = parseInt(txn.quantity);
    const newQty = txn.transaction_type === 'in'
      ? txnItem.quantity + qty
      : txn.transaction_type === 'out'
        ? Math.max(0, txnItem.quantity - qty)
        : qty; // adjustment sets absolute value

    const { error: txnErr } = await supabase.from('inventory_transactions').insert([{
      inventory_id: txnItem.id,
      user_id: session.user.id,
      transaction_type: txn.transaction_type,
      quantity: qty,
      reference_id: txn.reference_id,
      notes: txn.notes,
      created_at: new Date().toISOString(),
    }]);

    if (txnErr) { setTxnError(txnErr.message); setSavingTxn(false); return; }

    await supabase.from('inventory')
      .update({ quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', txnItem.id);

    setSavingTxn(false);
    setShowTxnModal(false);
    loadItems();
  };

  const openHistory = async (item: InventoryItem) => {
    setHistoryItem(item);
    setLoadingHistory(true);
    setShowHistory(true);
    const { data } = await supabase
      .from('inventory_transactions')
      .select('*')
      .eq('inventory_id', item.id)
      .order('created_at', { ascending: false });
    if (data) setHistory(data);
    setLoadingHistory(false);
  };

  const categories = ['all', ...Array.from(new Set(items.map(i => i.category).filter(Boolean)))];

  const filtered = items.filter(item => {
    const matchSearch =
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.supplier || '').toLowerCase().includes(search.toLowerCase()) ||
      (item.category || '').toLowerCase().includes(search.toLowerCase());
    const matchCategory = filterCategory === 'all' || item.category === filterCategory;
    const matchStock =
      filterStock === 'all' ? true :
      filterStock === 'low' ? item.quantity <= (item.min_quantity || 0) && item.quantity > 0 :
      filterStock === 'out' ? item.quantity === 0 :
      filterStock === 'ok' ? item.quantity > (item.min_quantity || 0) : true;
    return matchSearch && matchCategory && matchStock;
  });

  const stockStatus = (item: InventoryItem) => {
    if (item.quantity === 0) return { label: 'Out of stock', cls: 'bg-red-500/10 text-red-400 border border-red-500/30' };
    if (item.min_quantity && item.quantity <= item.min_quantity) return { label: 'Low stock', cls: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' };
    return { label: 'In stock', cls: 'bg-green-500/10 text-green-400 border border-green-500/30' };
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const stats = {
    total: items.length,
    lowStock: items.filter(i => i.min_quantity && i.quantity <= i.min_quantity && i.quantity > 0).length,
    outOfStock: items.filter(i => i.quantity === 0).length,
    totalValue: items.reduce((sum, i) => sum + ((i.unit_cost || 0) * i.quantity), 0),
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Inventory</h2>
            <p className="text-slate-400 mt-1">{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={openCreate}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">
            + Add Item
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Items</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-900/40 to-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Low Stock</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.lowStock}</p>
          </div>
          <div className="bg-gradient-to-br from-red-900/40 to-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Out of Stock</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.outOfStock}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-900/40 to-slate-900 border border-slate-700 rounded-xl p-4">
            <p className="text-slate-400 text-sm">Total Value</p>
            <p className="text-2xl font-bold text-blue-400 mt-1">${stats.totalValue.toFixed(2)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <input
            type="text"
            placeholder="Search by name, SKU, supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition w-64"
          />
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition">
            {categories.map(c => (
              <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
            ))}
          </select>
          <select value={filterStock} onChange={e => setFilterStock(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500 transition">
            <option value="all">All Stock Levels</option>
            <option value="ok">In Stock</option>
            <option value="low">Low Stock</option>
            <option value="out">Out of Stock</option>
          </select>
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading inventory...</div>
        ) : filtered.length === 0 ? (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-16 text-center">
            <p className="text-5xl mb-4">📦</p>
            <p className="text-white font-semibold text-lg mb-2">{search || filterCategory !== 'all' || filterStock !== 'all' ? 'No items match your filters' : 'No inventory yet'}</p>
            <p className="text-slate-400 text-sm mb-6">{search || filterCategory !== 'all' || filterStock !== 'all' ? 'Try adjusting your search or filters.' : 'Add your first item to get started.'}</p>
            {!search && filterCategory === 'all' && filterStock === 'all' && (
              <button onClick={openCreate} className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition">+ Add Item</button>
            )}
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/50">
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">SKU</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Category</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Qty</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Unit Cost</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Unit Price</th>
                    <th className="px-4 py-3 text-left text-slate-400 font-medium">Location</th>
                    <th className="px-4 py-3 text-right text-slate-400 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, idx) => {
                    const status = stockStatus(item);
                    return (
                      <tr key={item.id}
                        className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition ${idx === filtered.length - 1 ? 'border-b-0' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{item.name}</p>
                          {item.supplier && <p className="text-slate-500 text-xs">{item.supplier}</p>}
                        </td>
                        <td className="px-4 py-3 text-slate-400">{item.sku || '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{item.category || '—'}</td>
                        <td className="px-4 py-3">
                          <span className="text-white font-semibold">{item.quantity}</span>
                          {item.min_quantity ? <span className="text-slate-600 text-xs ml-1">/ {item.min_quantity} min</span> : null}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${status.cls}`}>{status.label}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{item.unit_cost ? `$${item.unit_cost.toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-3 text-slate-300">{item.unit_price ? `$${item.unit_price.toFixed(2)}` : '—'}</td>
                        <td className="px-4 py-3 text-slate-400">{item.location || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-end">
                            <button onClick={() => openTransaction(item)}
                              className="bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 text-xs px-2.5 py-1.5 rounded-lg transition" title="Stock In/Out">
                              ±
                            </button>
                            <button onClick={() => openHistory(item)}
                              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg transition" title="History">
                              📋
                            </button>
                            <button onClick={() => openEdit(item)}
                              className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2.5 py-1.5 rounded-lg transition">
                              Edit
                            </button>
                            <button onClick={() => setDeleteConfirm(item.id)}
                              className="bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs px-2.5 py-1.5 rounded-lg transition">
                              ✕
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Add / Edit Item Modal */}
      {showItemModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold text-lg">{editingItem ? 'Edit Item' : 'Add Item'}</h3>
              <button onClick={() => setShowItemModal(false)} className="text-slate-400 hover:text-white text-xl transition">✕</button>
            </div>
            <form onSubmit={handleSaveItem} className="p-6 space-y-4">
              {formError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{formError}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-1">Name *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="Item name" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">SKU</label>
                  <input type="text" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                    placeholder="SKU-001" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Category</label>
                  <input type="text" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Electrical, Tools" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Quantity</label>
                  <input type="number" min="0" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Min Quantity (low stock alert)</label>
                  <input type="number" min="0" value={form.min_quantity} onChange={e => setForm({ ...form, min_quantity: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Unit Cost ($)</label>
                  <input type="number" min="0" step="0.01" value={form.unit_cost} onChange={e => setForm({ ...form, unit_cost: e.target.value })}
                    placeholder="0.00" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Unit Price ($)</label>
                  <input type="number" min="0" step="0.01" value={form.unit_price} onChange={e => setForm({ ...form, unit_price: e.target.value })}
                    placeholder="0.00" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Supplier</label>
                  <input type="text" value={form.supplier} onChange={e => setForm({ ...form, supplier: e.target.value })}
                    placeholder="Supplier name" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Location</label>
                  <input type="text" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })}
                    placeholder="Shelf A, Van, Workshop..." className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2}
                    placeholder="Item description..." className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-1">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2}
                    placeholder="Additional notes..." className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition resize-none" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowItemModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={isSaving} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {isSaving ? 'Saving...' : editingItem ? 'Save Changes' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stock Transaction Modal */}
      {showTxnModal && txnItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">Stock Movement — {txnItem.name}</h3>
              <button onClick={() => setShowTxnModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <form onSubmit={handleSaveTransaction} className="p-6 space-y-4">
              {txnError && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">{txnError}</div>}

              <div className="bg-slate-900 rounded-lg px-4 py-3 flex justify-between items-center">
                <span className="text-slate-400 text-sm">Current Stock</span>
                <span className="text-white font-bold text-lg">{txnItem.quantity}</span>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Transaction Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['in', 'out', 'adjustment'] as const).map(type => (
                    <button key={type} type="button"
                      onClick={() => setTxn({ ...txn, transaction_type: type })}
                      className={`py-2 rounded-lg text-sm font-medium transition capitalize ${
                        txn.transaction_type === type
                          ? type === 'in' ? 'bg-green-500 text-white'
                            : type === 'out' ? 'bg-red-500 text-white'
                            : 'bg-blue-500 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      }`}>
                      {type === 'in' ? '+ Stock In' : type === 'out' ? '- Stock Out' : '~ Adjust'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">
                  {txn.transaction_type === 'adjustment' ? 'Set Quantity To' : 'Quantity'}
                </label>
                <input type="number" min="1" value={txn.quantity} onChange={e => setTxn({ ...txn, quantity: e.target.value })}
                  placeholder="0" className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Reference (optional)</label>
                <input type="text" value={txn.reference_id} onChange={e => setTxn({ ...txn, reference_id: e.target.value })}
                  placeholder="Job ID, PO number..." className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
              </div>

              <div>
                <label className="block text-slate-300 text-sm font-medium mb-1">Notes (optional)</label>
                <input type="text" value={txn.notes} onChange={e => setTxn({ ...txn, notes: e.target.value })}
                  placeholder="Reason for adjustment..." className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowTxnModal(false)} className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition">Cancel</button>
                <button type="submit" disabled={savingTxn} className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition">
                  {savingTxn ? 'Saving...' : 'Confirm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && historyItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
              <h3 className="text-white font-semibold">History — {historyItem.name}</h3>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-white transition">✕</button>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              {loadingHistory ? (
                <p className="text-center text-slate-400 py-8">Loading...</p>
              ) : history.length === 0 ? (
                <p className="text-center text-slate-500 py-8">No transactions yet.</p>
              ) : (
                <div className="space-y-2">
                  {history.map(t => (
                    <div key={t.id} className="flex items-center gap-3 bg-slate-900 rounded-lg px-4 py-3">
                      <span className={`text-lg ${t.transaction_type === 'in' ? 'text-green-400' : t.transaction_type === 'out' ? 'text-red-400' : 'text-blue-400'}`}>
                        {t.transaction_type === 'in' ? '↑' : t.transaction_type === 'out' ? '↓' : '~'}
                      </span>
                      <div className="flex-1">
                        <p className="text-white text-sm capitalize">
                          {t.transaction_type === 'in' ? `+${t.quantity} in` : t.transaction_type === 'out' ? `-${t.quantity} out` : `Set to ${t.quantity}`}
                          {t.reference_id && <span className="text-slate-500 ml-2">ref: {t.reference_id}</span>}
                        </p>
                        {t.notes && <p className="text-slate-500 text-xs">{t.notes}</p>}
                      </div>
                      <p className="text-slate-500 text-xs text-right">{formatDate(t.created_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 w-full max-w-sm text-center">
            <p className="text-4xl mb-4">🗑️</p>
            <h3 className="text-white font-semibold text-lg mb-2">Delete Item?</h3>
            <p className="text-slate-400 text-sm mb-6">This will also delete all transaction history for this item.</p>
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
