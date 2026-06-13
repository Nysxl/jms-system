import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface Props {
  portalUserEmail?: string;
  customerType?: string; // 'contractor' | 'direct' | 'sub_contact'
}

export const PortalHeader: React.FC<Props> = ({ portalUserEmail, customerType }) => {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabase');
    await supabase.auth.signOut();
    localStorage.removeItem('portal_session');
    router.push('/portal/login');
  };

  const isActive = (path: string) =>
    router.pathname === path || router.pathname.startsWith(path + '/');

  const navLink = (href: string, label: string) => (
    <Link
      href={href}
      className={`text-sm transition ${isActive(href) ? 'text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
    >
      {label}
    </Link>
  );

  const isContractor = customerType === 'contractor';

  return (
    <header className="bg-slate-900 border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <span className="text-white font-bold text-lg hidden sm:block">Client Portal</span>
        </div>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLink('/portal/jobs', 'Jobs')}
          {navLink('/portal/invoices', 'Invoices')}
          {navLink('/portal/schedule', 'Schedule')}
          {isContractor && navLink('/portal/clients', 'My Clients')}
        </nav>

        <div className="flex items-center gap-3">
          {portalUserEmail && <span className="text-slate-500 text-xs hidden lg:block">{portalUserEmail}</span>}
          <button onClick={handleSignOut}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition">
            Sign Out
          </button>
          {/* Mobile menu toggle */}
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden text-slate-400 hover:text-white transition p-1">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {menuOpen && (
        <div className="md:hidden border-t border-slate-800 px-6 py-4 flex flex-col gap-4">
          <Link href="/portal/jobs" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white text-sm transition">Jobs</Link>
          <Link href="/portal/invoices" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white text-sm transition">Invoices</Link>
          <Link href="/portal/schedule" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white text-sm transition">Schedule</Link>
          {isContractor && <Link href="/portal/clients" onClick={() => setMenuOpen(false)} className="text-slate-300 hover:text-white text-sm transition">My Clients</Link>}
        </div>
      )}
    </header>
  );
};
