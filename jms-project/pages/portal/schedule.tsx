import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { PortalHeader } from '@/components/PortalHeader';
import { supabase } from '@/lib/supabase'; // used for session check
import { PortalUser } from '@/lib/types';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns';

export default function PortalSchedule() {
  const router = useRouter();
  const [portalUser, setPortalUser] = useState<PortalUser | null>(null);
  const [jobs, setJobs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  useEffect(() => { checkSession(); }, []);

  const checkSession = async () => {
    const stored = localStorage.getItem('portal_session');
    if (!stored) { router.push('/portal/login'); return; }
    const pu = JSON.parse(stored);
    setPortalUser(pu);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { localStorage.removeItem('portal_session'); router.push('/portal/login'); return; }
    loadJobs(pu.customer_id);
  };

  const loadJobs = async (_customerId: string) => {
    setIsLoading(true);
    try {
      const stored = localStorage.getItem('portal_session');
      const pu = stored ? JSON.parse(stored) : null;
      if (!pu) return;
      const res = await fetch(`/api/portal/get-data?portalUserId=${pu.id}`);
      if (res.ok) {
        const data = await res.json();
        setJobs((data.jobs || []).filter((j: any) => j.scheduled_date));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentDate),
    end: endOfMonth(currentDate),
  });

  const getJobsForDate = (date: Date) =>
    jobs.filter(j => j.scheduled_date && isSameDay(new Date(j.scheduled_date), date));

  const statusColor = (s: string) => {
    const map: Record<string, string> = {
      requested: 'bg-purple-500/20 text-purple-300',
      pending: 'bg-yellow-500/20 text-yellow-300',
      'in-progress': 'bg-blue-500/20 text-blue-300',
      completed: 'bg-green-500/20 text-green-300',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return map[s] || 'bg-slate-600 text-slate-300';
  };

  if (!portalUser) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><p className="text-slate-400">Loading...</p></div>;

  return (
    <div className="min-h-screen bg-slate-950">
      <PortalHeader portalUserEmail={portalUser.email} />
      <main className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-3xl font-bold text-white mb-8">Schedule</h2>

        {isLoading ? (
          <div className="text-center py-20 text-slate-400">Loading schedule...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <div className="flex items-center justify-between mb-6">
                  <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1))}
                    className="text-slate-400 hover:text-white transition">← Prev</button>
                  <h3 className="text-white font-semibold text-xl">{format(currentDate, 'MMMM yyyy')}</h3>
                  <button onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1))}
                    className="text-slate-400 hover:text-white transition">Next →</button>
                </div>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                    <div key={d} className="text-center text-slate-500 text-xs font-medium py-1">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {/* leading blank days */}
                  {Array.from({ length: daysInMonth[0].getDay() }).map((_, i) => (
                    <div key={`blank-${i}`} />
                  ))}
                  {daysInMonth.map(day => {
                    const dayJobs = getJobsForDate(day);
                    const isThisMonth = isSameMonth(day, currentDate);
                    return (
                      <button key={day.toString()} onClick={() => setSelectedDate(day)}
                        className={`min-h-16 p-1.5 rounded-lg border text-left transition ${
                          isThisMonth ? 'bg-slate-900 border-slate-700 hover:border-blue-500' : 'bg-slate-850 border-slate-800'
                        } ${selectedDate && isSameDay(day, selectedDate) ? 'border-blue-500 bg-blue-500/10' : ''}`}>
                        <p className="text-white text-xs font-semibold mb-1">{format(day, 'd')}</p>
                        {dayJobs.slice(0, 2).map(j => (
                          <div key={j.id} className={`text-xs px-1 py-0.5 rounded truncate mb-0.5 ${statusColor(j.status)}`}>{j.title}</div>
                        ))}
                        {dayJobs.length > 2 && <p className="text-xs text-slate-500">+{dayJobs.length - 2}</p>}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

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
                      <Link key={job.id} href={`/portal/jobs/${job.id}`}
                        className="block bg-slate-700/50 rounded-lg p-3 hover:bg-slate-700 transition">
                        <p className="text-white font-medium text-sm">{job.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded mt-1 inline-block ${statusColor(job.status)}`}>{job.status}</span>
                      </Link>
                    ))}
                  </div>
                )
              ) : (
                <p className="text-slate-500 text-sm">Click on a day to see scheduled jobs</p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
