import React, { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { JobCard } from '@/components/JobCard';
import { CreateJobModal } from '@/components/CreateJobModal';
import { Job, Customer } from '@/lib/types';
import { useRouter } from 'next/router';

export default function Dashboard() {
  const router = useRouter();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState({
    totalJobs: 0,
    activeJobs: 0,
    completedJobs: 0,
    pendingJobs: 0,
  });

  useEffect(() => {
    // Load jobs and customers on mount
    loadJobs();
    loadCustomers();
  }, []);

  const loadJobs = async () => {
    // In production, fetch from API
    setJobs([]);
    updateStats([]);
  };

  const loadCustomers = async () => {
    // In production, fetch from API
    setCustomers([]);
  };

  const updateStats = (jobsList: Job[]) => {
    setStats({
      totalJobs: jobsList.length,
      activeJobs: jobsList.filter(j => j.status === 'in-progress').length,
      completedJobs: jobsList.filter(j => j.status === 'completed').length,
      pendingJobs: jobsList.filter(j => j.status === 'pending').length,
    });
  };

  const handleCreateJob = async (jobData: any) => {
    setIsLoading(true);
    try {
      // In production, send to API
      const newJob: Job = {
        id: `job_${Date.now()}`,
        user_id: 'current_user',
        customer_id: jobData.customer_id,
        title: jobData.title,
        description: jobData.description,
        status: 'pending',
        priority: jobData.priority,
        scheduled_date: jobData.scheduled_date,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      setJobs([newJob, ...jobs]);
      updateStats([newJob, ...jobs]);
      setShowCreateModal(false);
    } catch (error) {
      console.error('Error creating job:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Total Jobs</p>
            <p className="text-3xl font-bold text-white mt-2">{stats.totalJobs}</p>
          </div>
          <div className="bg-gradient-to-br from-blue-900 to-slate-900 rounded-lg border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Active</p>
            <p className="text-3xl font-bold text-blue-400 mt-2">{stats.activeJobs}</p>
          </div>
          <div className="bg-gradient-to-br from-yellow-900 to-slate-900 rounded-lg border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Pending</p>
            <p className="text-3xl font-bold text-yellow-400 mt-2">{stats.pendingJobs}</p>
          </div>
          <div className="bg-gradient-to-br from-green-900 to-slate-900 rounded-lg border border-slate-700 p-6">
            <p className="text-slate-400 text-sm">Completed</p>
            <p className="text-3xl font-bold text-green-400 mt-2">{stats.completedJobs}</p>
          </div>
        </div>

        {/* Jobs Section */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white">Recent Jobs</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded transition"
            >
              + Create Job
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-12 text-center">
              <p className="text-slate-400">No jobs yet. Create your first job to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  customer={customers.find(c => c.id === job.customer_id)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      <CreateJobModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateJob}
        customers={customers}
        isLoading={isLoading}
      />
    </div>
  );
}
