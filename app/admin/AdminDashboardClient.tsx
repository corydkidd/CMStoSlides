'use client';

import Link from 'next/link';
import { LayoutDashboard, Users, FileText, LogOut, Settings } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { MainLayout } from '@/components/layout/MainLayout';
import { StatCard } from '@/components/admin/StatCard';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { FederalRegisterMonitor } from '@/components/admin/FederalRegisterMonitor';
import { signOut } from '@/lib/auth/actions';

interface AdminDashboardClientProps {
  user: User;
  profile: any;
  users: any[];
  recentJobs: any[];
}

export function AdminDashboardClient({ user, profile, users, recentJobs }: AdminDashboardClientProps) {
  const activeUsers = users.filter(u => u.is_active).length;
  const totalJobs = recentJobs.length;
  const completedJobs = recentJobs.filter(j => j.status === 'complete').length;
  const failedJobs = recentJobs.filter(j => j.status === 'failed').length;

  const navItems = [
    {
      href: '/admin',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      href: '/admin/users',
      label: 'Users',
      icon: Users,
      badge: users.length.toString(),
    },
    {
      href: '/admin/jobs',
      label: 'All Jobs',
      icon: FileText,
    },
    {
      href: '/dashboard',
      label: 'User View',
      icon: Settings,
    },
  ];

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
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="page-title mb-2">Admin Dashboard</h1>
          <p className="body-text">
            Manage users, monitor conversions, and configure the system.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Users"
            value={users.length}
            icon={Users}
          />
          <StatCard
            title="Active Users"
            value={activeUsers}
            icon={Users}
          />
          <StatCard
            title="Total Conversions"
            value={totalJobs}
            icon={FileText}
          />
          <StatCard
            title="Success Rate"
            value={totalJobs > 0 ? `${Math.round((completedJobs / totalJobs) * 100)}%` : 'N/A'}
            icon={FileText}
          />
        </div>

        {/* Quick Actions */}
        <section>
          <h2 className="section-header mb-6">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link href="/admin/users">
              <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A2332] hover:border-cyan-400/50 hover:shadow-md transition-all cursor-pointer">
                <Users className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mb-3" />
                <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-2">
                  Manage Users
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Create accounts, edit description documents, manage templates
                </p>
              </div>
            </Link>

            <Link href="/admin/jobs">
              <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A2332] hover:border-cyan-400/50 hover:shadow-md transition-all cursor-pointer">
                <FileText className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mb-3" />
                <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-2">
                  View All Jobs
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Monitor conversion queue, review errors, download outputs
                </p>
              </div>
            </Link>

            <Link href="/dashboard">
              <div className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A2332] hover:border-cyan-400/50 hover:shadow-md transition-all cursor-pointer">
                <Settings className="w-8 h-8 text-cyan-600 dark:text-cyan-400 mb-3" />
                <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-2">
                  User View
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Switch to the regular user dashboard view
                </p>
              </div>
            </Link>
          </div>
        </section>

        {/* Federal Register Monitor */}
        <FederalRegisterMonitor />

        {/* Recent Activity */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-header">Recent Conversions</h2>
            <Link href="/admin/jobs">
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </Link>
          </div>

          {recentJobs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                No conversions yet
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-slate-200 dark:border-white/10">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Job ID
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="text-left px-6 py-3 text-xs font-medium text-slate-600 dark:text-slate-400 uppercase tracking-wider">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {recentJobs.map((job) => (
                    <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                      <td className="px-6 py-4 text-sm font-mono text-slate-900 dark:text-white">
                        {job.id.slice(0, 8)}...
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <Badge
                          variant={
                            job.status === 'complete' ? 'success' :
                            job.status === 'processing' ? 'warning' :
                            job.status === 'failed' ? 'error' : 'default'
                          }
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        {new Date(job.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
