import React, { useState } from 'react';
import Link from 'next/link';

export const Header: React.FC<{ username?: string }> = ({ username }) => {
  const [menuOpen, setMenuOpen] = useState(false);

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
          <Link href="/customers" className="text-slate-300 hover:text-white transition">
            Customers
          </Link>
          <Link href="/inventory" className="text-slate-300 hover:text-white transition">
            Inventory
          </Link>
        </nav>

        <div className="flex items-center gap-4">
          {username && <span className="text-slate-300">{username}</span>}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="text-slate-300 hover:text-white"
          >
            ⚙️
          </button>
        </div>
      </div>
    </header>
  );
};
