import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

export const PortalHeader: React.FC<{ portalUserEmail?: string }> = ({ portalUserEmail }) => {
  const router = useRouter();

  const handleSignOut = async () => {
    const { supabase } = await import('@/lib/supabase');
    await supabase.auth.signOut();
    router.push('/portal/login');
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 shadow-lg">
      <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">P</span>
          </div>
          <h1 className="text-xl font-bold text-white">My Jobs</h1>
        </div>

        <nav className="hidden md:flex items-center gap-8">
          <Link href="/portal/jobs" className="text-slate-300 hover:text-white transition text-sm">
            Jobs
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {portalUserEmail && <span className="text-slate-400 text-sm">{portalUserEmail}</span>}
          <button onClick={handleSignOut}
            className="bg-slate-700 hover:bg-slate-600 text-white text-sm px-4 py-2 rounded-lg transition">
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};
