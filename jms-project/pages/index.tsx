import React, { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Auto-redirect to dashboard if user is authenticated
    // In production, check auth status
    const isAuthenticated = localStorage.getItem('auth_token');
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex items-center justify-center">
      <div className="text-center max-w-2xl mx-auto px-6">
        <div className="w-20 h-20 bg-blue-500 rounded-lg flex items-center justify-center mx-auto mb-6">
          <span className="text-white font-bold text-4xl">JMS</span>
        </div>

        <h1 className="text-5xl font-bold text-white mb-4">
          Job Management System
        </h1>

        <p className="text-slate-300 text-lg mb-8">
          Professional, secure, and beautiful job management software for your business.
          Create jobs, manage customers, generate invoices, and more.
        </p>

        <div className="flex gap-4 justify-center mb-12">
          <Link
            href="/login"
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded transition"
          >
            Sign In
          </Link>
          <Link
            href="/signup"
            className="bg-slate-700 hover:bg-slate-600 text-white font-semibold py-3 px-8 rounded transition"
          >
            Sign Up
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-16">
          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="text-3xl mb-3">📋</div>
            <h3 className="text-white font-semibold mb-2">Job Management</h3>
            <p className="text-slate-400 text-sm">Create and track jobs with ease. Assign priorities and schedules.</p>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="text-3xl mb-3">👥</div>
            <h3 className="text-white font-semibold mb-2">Customer Portal</h3>
            <p className="text-slate-400 text-sm">Manage customers and get digital signatures for approvals.</p>
          </div>

          <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-white font-semibold mb-2">Invoicing & Reports</h3>
            <p className="text-slate-400 text-sm">Generate professional invoices, contracts, and service reports.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
