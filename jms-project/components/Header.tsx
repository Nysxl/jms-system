import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '@/lib/supabase';

export const Header: React.FC<{ username?: string }> = ({ username }) => {
  const router = useRouter();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">JMS</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Job Management System</h1>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/dashboard" className="text-slate-300 hover:text-white transition">
            Dashboard
          </Link>
          <Link href="/jobs" className="text-slate-300 hover:text-white transition">
            Jobs
          </Link>
          <Link href="/quotations" className="text-slate-300 hover:text-white transition">
            Quotations
          </Link>
          <Link href="/invoices" className="text-slate-300 hover:text-white transition">
            Invoices
          </Link>
          <Link href="/calendar" className="text-slate-300 hover:text-white transition">
            Calendar
          </Link>
          <Link href="/customers" className="text-slate-300 hover:text-white transition">
            Contacts
          </Link>
          <Link href="/inventory" className="text-slate-300 hover:text-white transition">
            Inventory
          </Link>
          <Link href="/portal-management" className="text-slate-300 hover:text-white transition">
            Portal
          </Link>
          <Link href="/settings" className="text-slate-300 hover:text-white transition">
            Settings
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {username && <span className="text-slate-300 text-sm">{username}</span>}
          <button
            onClick={handleSignOut}
            className="text-slate-400 hover:text-white text-sm px-3 py-1.5 rounded-lg border border-slate-700 hover:border-slate-500 transition"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};
