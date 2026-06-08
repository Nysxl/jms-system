import React from 'react';
import { Job, Customer } from '@/lib/types';
import Link from 'next/link';

interface JobCardProps {
  job: Job;
  customer?: Customer;
}

const statusColors = {
  pending: 'bg-yellow-500',
  'in-progress': 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

const priorityColors = {
  low: 'text-slate-400',
  medium: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

export const JobCard: React.FC<JobCardProps> = ({ job, customer }) => {
  const formatDate = (date?: string) => {
    if (!date) return 'Not scheduled';
    return new Date(date).toLocaleDateString();
  };

  return (
    <Link href={`/jobs/${job.id}`}>
      <div className="bg-slate-800 rounded-lg border border-slate-700 hover:border-blue-500 transition p-6 cursor-pointer hover:shadow-lg hover:shadow-blue-500/20">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1">{job.title}</h3>
            <p className="text-slate-400 text-sm">{customer?.name || 'Unknown Customer'}</p>
          </div>
          <span className={`${statusColors[job.status]} px-3 py-1 rounded-full text-white text-xs font-semibold`}>
            {job.status}
          </span>
        </div>

        {job.description && (
          <p className="text-slate-300 text-sm mb-4 line-clamp-2">{job.description}</p>
        )}

        <div className="flex justify-between items-center">
          <div className="flex gap-4">
            <div>
              <p className="text-slate-500 text-xs">Priority</p>
              <p className={`${priorityColors[job.priority]} font-semibold text-sm capitalize`}>
                {job.priority}
              </p>
            </div>
            <div>
              <p className="text-slate-500 text-xs">Scheduled</p>
              <p className="text-slate-300 text-sm">{formatDate(job.scheduled_date)}</p>
            </div>
          </div>
          {job.total_amount && (
            <div className="text-right">
              <p className="text-slate-500 text-xs">Amount</p>
              <p className="text-green-400 font-semibold text-sm">${job.total_amount.toFixed(2)}</p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};
