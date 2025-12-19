'use client';

import { useState } from 'react';
import { Home, History, LogOut, Search, Filter } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { MainLayout } from '@/components/layout/MainLayout';
import { JobCard } from '@/components/dashboard/JobCard';
import { Badge } from '@/components/ui/Badge';
import { signOut } from '@/lib/auth/actions';

interface HistoryClientProps {
  user: User;
  profile: any;
  jobs: any[];
}

export function HistoryClient({ user, profile, jobs }: HistoryClientProps) {
  const [filter, setFilter] = useState<'all' | 'complete' | 'processing' | 'failed'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredJobs = jobs.filter(job => {
    const matchesFilter = filter === 'all' || job.status === filter;
    const matchesSearch = searchTerm === '' ||
      job.input_filename.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.output_filename?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleDownload = async (jobId: string) => {
    // TODO: Implement download functionality in Phase 2
    console.log('Downloading job:', jobId);
  };

  const navItems = [
    {
      href: '/dashboard',
      label: 'Dashboard',
      icon: Home,
    },
    {
      href: '/history',
      label: 'History',
      icon: History,
    },
  ];

  const getStatusCount = (status: string) => {
    return jobs.filter(job => job.status === status).length;
  };

  return (
    <MainLayout
      productName="CMS Converter"
      navItems={navItems}
      sidebarFooter={
        <div className="space-y-2">
          <p className="text-xs text-white/40">Signed in as</p>
          <p className="text-sm text-white/80 font-medium truncate">
            {profile?.full_name || user.email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors w-full"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </form>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="page-title mb-2">Conversion History</h1>
          <p className="body-text">
            View and download all your document conversions.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search conversions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1A2332] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
            />
          </div>

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <div className="flex gap-2">
              <Badge
                variant={filter === 'all' ? 'default' : 'default'}
                className="cursor-pointer"
                onClick={() => setFilter('all')}
              >
                All ({jobs.length})
              </Badge>
              <Badge
                variant={filter === 'complete' ? 'success' : 'default'}
                className="cursor-pointer"
                onClick={() => setFilter('complete')}
              >
                Complete ({getStatusCount('complete')})
              </Badge>
              <Badge
                variant={filter === 'processing' ? 'warning' : 'default'}
                className="cursor-pointer"
                onClick={() => setFilter('processing')}
              >
                Processing ({getStatusCount('processing')})
              </Badge>
              <Badge
                variant={filter === 'failed' ? 'error' : 'default'}
                className="cursor-pointer"
                onClick={() => setFilter('failed')}
              >
                Failed ({getStatusCount('failed')})
              </Badge>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No conversions found
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                {searchTerm || filter !== 'all'
                  ? 'Try adjusting your search or filter'
                  : 'Upload your first document to get started'}
              </p>
            </div>
          ) : (
            filteredJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onDownload={handleDownload}
              />
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
