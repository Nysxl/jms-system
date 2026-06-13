import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { Header } from '@/components/Header';
import { supabase } from '@/lib/supabase';
import { Job, Customer } from '@/lib/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay } from 'date-fns';

interface JobWithCustomer extends Job {
  customer?: Customer;
}

export default function CalendarPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobWithCustomer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<string>('in-progress');
  const [savingBulk, setSavingBulk] = useState(false);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return; }
      loadJobs();
    });
  }, [router]);

  const loadJobs = async () => {
    setIsLoading(true);
    const { data } = await supabase
      .from('jobs')
      .select('*, customer:customers(*)')
      .order('scheduled_date', { ascending: true });
    if (data) setJobs(data);
    setIsLoading(false);
  };

  const handleBulkStatusUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedJobIds.size === 0) return;
    setSavingBulk(true);

    const jobIds = Array.from(selectedJobIds);
    const { error } = await supabase
      .from('jobs')
      .update({
        status: bulkStatus,
        updated_at: new Date().toISOString(),
        ...(bulkStatus === 'completed' && { completed_date: new Date().toISOString() }),
      })
      .in('id', jobIds);

    if (error) {
      alert('Error updating jobs: ' + error.message);
    } else {
      alert(`Updated ${jobIds.length} job(s) to ${bulkStatus}`);
      setSelectedJobIds(new Set());
      setShowBulkModal(false);
      loadJobs();
    }
    setSavingBulk(false);
  };

  const toggleJobSelection = (jobId: string) => {
    const newSet = new Set(selectedJobIds);
    if (newSet.has(jobId)) {
      newSet.delete(jobId);
    } else {
      newSet.add(jobId);
    }
    setSelectedJobIds(newSet);
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const getJobsForDate = (date: Date) =>
    jobs.filter(job => job.scheduled_date && isSameDay(new Date(job.scheduled_date), date));

  const statusColor = (status: string) => {
    const map: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-300',
      'in-progress': 'bg-blue-500/20 text-blue-300',
      completed: 'bg-green-500/20 text-green-300',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return map[status] || 'bg-slate-600 text-slate-300';
  };

  const prevMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1));
  const nextMonth = () => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1));

  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-white">Job Schedule</h2>
          {selectedJobIds.size > 0 && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition"
            >
              Update {selectedJobIds.size} Job{selectedJobIds.size !== 1 ? 's' : ''}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading calendar...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Calendar */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                {/* Month Navigation */}
                <div className="flex items-center justify-between mb-6">
                  <button
                    onClick={prevMonth}
                    className="text-slate-400 hover:text-white transition"
                  >
                    ← Prev
                  </button>
                  <h3 className="text-white font-semibold text-xl">
                    {format(currentDate, 'MMMM yyyy')}
                  </h3>
                  <button
                    onClick={nextMonth}
                    className="text-slate-400 hover:text-white transition"
                  >
                    Next →
                  </button>
                </div>

                {/* Day Headers */}
                <div className="grid grid-cols-7 gap-2 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-slate-400 text-sm font-medium py-2">
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar Days */}
                <div className="grid grid-cols-7 gap-2">
                  {daysInMonth.map(day => {
                    const dayJobs = getJobsForDate(day);
                    const isCurrentMonth = isSameMonth(day, currentDate);
                    return (
                      <button
                        key={day.toString()}
                        onClick={() => setSelectedDate(day)}
                        className={`min-h-24 p-2 rounded-lg border transition text-left ${
                          isCurrentMonth
                            ? 'bg-slate-900 border-slate-600 hover:border-blue-500'
                            : 'bg-slate-800 border-slate-700 text-slate-500'
                        } ${
                          selectedDate && isSameDay(day, selectedDate)
                            ? 'border-blue-500 bg-blue-500/10'
                            : ''
                        }`}
                      >
                        <p className="text-white font-semibold text-sm">{format(day, 'd')}</p>
                        <div className="space-y-1 mt-1">
                          {dayJobs.slice(0, 2).map(job => (
                            <div
                              key={job.id}
                              className={`text-xs px-1.5 py-0.5 rounded truncate cursor-pointer ${statusColor(job.status)}`}
                              onClick={e => {
                                e.stopPropagation();
                                router.push(`/jobs/${job.id}`);
                              }}
                            >
                              {job.title}
                            </div>
                          ))}
                          {dayJobs.length > 2 && (
                            <p className="text-xs text-slate-400">+{dayJobs.length - 2} more</p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Sidebar: Selected Date Jobs */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 h-fit">
              <h3 className="text-white font-semibold mb-4">
                {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a date'}
              </h3>
              {selectedDate ? (
                getJobsForDate(selectedDate).length === 0 ? (
                  <p className="text-slate-500 text-sm">No jobs scheduled</p>
                ) : (
                  <div className="space-y-3">
                    {getJobsForDate(selectedDate).map(job => (
                      <div
                        key={job.id}
                        className="bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition cursor-pointer"
                        onClick={() => router.push(`/jobs/${job.id}`)}
                      >
                        <p className="text-white font-medium text-sm">{job.title}</p>
                        <p className="text-slate-400 text-xs mt-1">{job.customer?.name}</p>
                        <div className="flex items-center justify-between mt-2">
                          <span className={`text-xs px-2 py-0.5 rounded ${statusColor(job.status)}`}>
                            {job.status}
                          </span>
                          {job.total_amount && (
                            <span className="text-slate-300 text-xs">${job.total_amount.toFixed(2)}</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-slate-500 text-sm">Click on a day to see scheduled jobs</p>
              )}
            </div>
          </div>
        )}

        {/* Bulk Update Modal */}
        {showBulkModal && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-md">
              <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
                <h3 className="text-white font-semibold">Update {selectedJobIds.size} Job(s)</h3>
                <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-white transition">✕</button>
              </div>
              <form onSubmit={handleBulkStatusUpdate} className="p-6 space-y-4">
                <div>
                  <label className="block text-slate-300 text-sm font-medium mb-2">New Status</label>
                  <select
                    value={bulkStatus}
                    onChange={e => setBulkStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-600 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="flex-1 bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingBulk}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-2 rounded-lg transition"
                  >
                    {savingBulk ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
