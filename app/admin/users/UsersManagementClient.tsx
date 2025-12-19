'use client';

import { useState } from 'react';
import { LayoutDashboard, Users, FileText, LogOut, Settings, Plus, Search } from 'lucide-react';
import type { User } from '@supabase/supabase-js';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { signOut } from '@/lib/auth/actions';

interface UsersManagementClientProps {
  user: User;
  profile: any;
  users: any[];
}

export function UsersManagementClient({ user, profile, users }: UsersManagementClientProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title mb-2">User Management</h1>
            <p className="body-text">
              Create and manage user accounts, description documents, and templates.
            </p>
          </div>
          <Button className="gap-2">
            <Plus className="w-4 h-4" />
            New User
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search users by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 dark:border-white/10 bg-white dark:bg-[#1A2332] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:border-transparent"
          />
        </div>

        {/* Users List */}
        <div className="space-y-4">
          {filteredUsers.map((u) => (
            <div
              key={u.id}
              className="p-6 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#1A2332] hover:border-cyan-400/30 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-display font-semibold text-slate-900 dark:text-white">
                      {u.full_name || 'No name set'}
                    </h3>
                    {u.is_admin && (
                      <Badge variant="default">Admin</Badge>
                    )}
                    {!u.is_active && (
                      <Badge variant="error">Inactive</Badge>
                    )}
                    {u.is_active && !u.is_admin && (
                      <Badge variant="success">Active</Badge>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {u.email}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <span>
                      {u.conversion_jobs?.[0]?.count || 0} conversions
                    </span>
                    <span>•</span>
                    <span>Joined {formatDate(u.created_at)}</span>
                    {u.template_path && (
                      <>
                        <span>•</span>
                        <span className="text-cyan-600 dark:text-cyan-400">Template configured</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="secondary">
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary">
                    Description
                  </Button>
                  <Button size="sm" variant="secondary">
                    Template
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {filteredUsers.length === 0 && (
            <div className="text-center py-12 bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10">
              <Users className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">
                No users found
              </p>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
