'use client';

import { useState } from 'react';
import { signOut } from 'next-auth/react';
import { LayoutDashboard, Users, FileText, LogOut, Settings, Search, Filter } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { JobCard } from '@/components/dashboard/JobCard';
import { Badge } from '@/components/ui/Badge';

interface JobsManagementClientProps {
  user: { id: string; email: string; name: string | null };
  profile: any;
  jobs: any[];
}

export function JobsManagementClient({ user, profile, jobs }: JobsManagementClientProps) {
  const [filter, setFilter] = useState<'all' | 'complete' | 'processing' | 'failed' | 'pending'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredJobs = jobs.filter((job: any) => {
    const matchesFilter = filter === 'all' || job.status === filter;
    const matchesSearch = searchTerm === '' ||
      job.inputFilename?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/jobs', label: 'All Jobs', icon: FileText, badge: jobs.length.toString() },
    { href: '/dashboard', label: 'User View', icon: Settings },
  ];

  const getStatusCount = (status: string) => {
    return jobs.filter((job: any) => job.status === status).length;
  };

  return (
    <MainLayout
      productName="Admin Panel"
      navItems={navItems}
      sidebarFooter={
        <div className="space-y-2">
          <Badge variant="default" className="mb-2">Administrator</Badge>
          <p className="text-xs text-white/40">Signed in as</p>
          <p className="text-sm text-white/80 font-medium truncate">
            {profile?.full_name || user.email}
          </p>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors w-full"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      }
    >
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="page-title mb-2">All Conversion Jobs</h1>
          <p className="body-text">
            Monitor all conversions across users, review errors, and manage the queue.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by filename or user..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1A2332] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="w-5 h-5 text-slate-400" />
            <div className="flex gap-2 flex-wrap">
              <Badge variant={filter === 'all' ? 'cyan' : 'default'} className="cursor-pointer" onClick={() => setFilter('all')}>All ({jobs.length})</Badge>
              <Badge variant={filter === 'pending' ? 'cyan' : 'default'} className="cursor-pointer" onClick={() => setFilter('pending')}>Pending ({getStatusCount('pending')})</Badge>
              <Badge variant={filter === 'processing' ? 'warning' : 'default'} className="cursor-pointer" onClick={() => setFilter('processing')}>Processing ({getStatusCount('processing')})</Badge>
              <Badge variant={filter === 'complete' ? 'success' : 'default'} className="cursor-pointer" onClick={() => setFilter('complete')}>Complete ({getStatusCount('complete')})</Badge>
              <Badge variant={filter === 'failed' ? 'error' : 'default'} className="cursor-pointer" onClick={() => setFilter('failed')}>Failed ({getStatusCount('failed')})</Badge>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {filteredJobs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">No jobs found</p>
            </div>
          ) : (
            filteredJobs.map((job: any) => (
              <div key={job.id}>
                <div className="mb-2 px-2">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    User: {job.profiles?.full_name || job.profiles?.email || 'Unknown'}
                  </span>
                </div>
                <JobCard job={job} />
              </div>
            ))
          )}
        </div>
      </div>
    </MainLayout>
  );
}
