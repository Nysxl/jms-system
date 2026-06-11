import React, { useState, useEffect, useRef } from 'react';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';

const emptySettings = {
  company_name: '',
  owner_name: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zip_code: '',
  licence_number: '',
  abn: '',
  website: '',
  logo_url: '',
};

export default function Settings() {
  const [form, setForm] = useState(emptySettings);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('company_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setForm({
        company_name: data.company_name || '',
        owner_name: data.owner_name || '',
        email: data.email || '',
        phone: data.phone || '',
        address: data.address || '',
        city: data.city || '',
        state: data.state || '',
        zip_code: data.zip_code || '',
        licence_number: data.licence_number || '',
        abn: data.abn || '',
        website: data.website || '',
        logo_url: data.logo_url || '',
      });
      if (data.logo_url) setLogoPreview(data.logo_url);
    }
    setIsLoading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setErrorMsg('Logo must be under 2MB.');
      return;
    }

    setUploadingLogo(true);
    const { data: { user } } = await supabase.auth.getUser();
    const ext = file.name.split('.').pop();
    const path = `logos/${user?.id}/logo.${ext}`;

    const { error } = await supabase.storage
      .from('company-assets')
      .upload(path, file, { upsert: true });

    if (error) {
      setErrorMsg('Logo upload failed: ' + error.message);
      setUploadingLogo(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('company-assets')
      .getPublicUrl(path);

    const url = urlData.publicUrl;
    setForm(f => ({ ...f, logo_url: url }));
    setLogoPreview(url);
    setUploadingLogo(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setIsSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = { ...form, user_id: user.id, updated_at: new Date().toISOString() };

    const { data: existing } = await supabase
      .from('company_settings')
      .select('id')
      .eq('user_id', user.id)
      .single();

    let error;
    if (existing) {
      ({ error } = await supabase
        .from('company_settings')
        .update(payload)
        .eq('user_id', user.id));
    } else {
      ({ error } = await supabase
        .from('company_settings')
        .insert([{ ...payload, created_at: new Date().toISOString() }]));
    }

    if (error) {
      setErrorMsg(error.message);
    } else {
      setSuccessMsg('Settings saved successfully.');
    }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-white">Settings</h2>
          <p className="text-slate-400 mt-1">Company details used on service reports and invoices</p>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading settings...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">

            {successMsg && (
              <div className="bg-green-500/10 border border-green-500/30 text-green-400 text-sm rounded-lg px-4 py-3">
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm rounded-lg px-4 py-3">
                {errorMsg}
              </div>
            )}

            {/* Logo */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Company Logo</h3>
              <div className="flex items-center gap-6">
                <div className="w-24 h-24 bg-slate-700 rounded-xl border border-slate-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="text-slate-500 text-xs text-center px-2">No logo</span>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingLogo}
                    className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
                  >
                    {uploadingLogo ? 'Uploading...' : 'Upload Logo'}
                  </button>
                  <p className="text-slate-500 text-xs mt-2">PNG or JPG, max 2MB</p>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </div>

            {/* Company Details */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
              <h3 className="text-white font-semibold mb-4">Company Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Company Name</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={e => setForm({ ...form, company_name: e.target.value })}
                    placeholder="Greyling Industries"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Owner / Technician Name</label>
                  <input
                    type="text"
                    value={form.owner_name}
                    onChange={e => setForm({ ...form, owner_name: e.target.value })}
                    placeholder="Brian Greyling"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    placeholder="info@company.com.au"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Phone</label>
                  <input
                    type="text"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    placeholder="+61 400 000 000"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Licence Number</label>
                  <input
                    type="text"
                    value={form.licence_number}
                    onChange={e => setForm({ ...form, licence_number: e.target.value })}
                    placeholder="TTT31134"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">ABN</label>
                  <input
                    type="text"
                    value={form.abn}
                    onChange={e => setForm({ ...form, abn: e.target.value })}
                    placeholder="12 345 678 901"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-slate-300 text-sm font-medium mb-1">Street Address</label>
                  <input
                    type="text"
                    value={form.address}
                    onChange={e => setForm({ ...form, address: e.target.value })}
                    placeholder="123 Example Street"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">City / Suburb</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                    placeholder="Melbourne"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={e => setForm({ ...form, state: e.target.value })}
                    placeholder="VIC"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Postcode</label>
                  <input
                    type="text"
                    value={form.zip_code}
                    onChange={e => setForm({ ...form, zip_code: e.target.value })}
                    placeholder="3000"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-1">Website</label>
                  <input
                    type="text"
                    value={form.website}
                    onChange={e => setForm({ ...form, website: e.target.value })}
                    placeholder="www.company.com.au"
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
