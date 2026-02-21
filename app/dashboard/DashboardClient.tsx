'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { Home, History, LogOut, ArrowRight, ShieldCheck } from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { UploadZone } from '@/components/dashboard/UploadZone';
import { JobCard } from '@/components/dashboard/JobCard';
import { Button } from '@/components/ui/Button';

interface DashboardClientProps {
  user: { id: string; email: string; name: string | null };
  profile: any;
  initialJobs: any[];
}

export function DashboardClient({ user, profile, initialJobs }: DashboardClientProps) {
  const [jobs, setJobs] = useState(initialJobs);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Polling: refresh jobs every 5 seconds while any are pending/processing
  // ---------------------------------------------------------------------------
  const hasActiveJobs = jobs.some(
    (j) => j.status === 'pending' || j.status === 'processing'
  );

  const refreshJobs = useCallback(async () => {
    try {
      const res = await fetch(`/api/jobs?userId=${user.id}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        if (data.jobs) setJobs(data.jobs);
      }
    } catch {
      // Silently ignore polling errors
    }
  }, [user.id]);

  useEffect(() => {
    if (hasActiveJobs) {
      pollingRef.current = setInterval(refreshJobs, 5000);
    }
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [hasActiveJobs, refreshJobs]);

  // ---------------------------------------------------------------------------
  // Upload handler
  // ---------------------------------------------------------------------------
  const handleUpload = async (file: File) => {
    console.log('Uploading file:', file.name);
    await new Promise(resolve => setTimeout(resolve, 1000));
    throw new Error('Upload functionality will be implemented in Phase 2');
  };

  // ---------------------------------------------------------------------------
  // Download handler
  // ---------------------------------------------------------------------------
  const handleDownload = async (jobId: string) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/download`);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Download failed');
      }

      // The response IS the file now (served directly)
      // Extract filename from Content-Disposition header
      const disposition = response.headers.get('Content-Disposition');
      let filename = 'presentation.pptx';
      if (disposition) {
        const match = disposition.match(/filename="?([^";\n]+)"?/);
        if (match?.[1]) filename = match[1];
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      alert(
        err instanceof Error ? err.message : 'Failed to download file'
      );
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/history', label: 'History', icon: History },
    ...(profile?.is_admin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  return (
    <MainLayout
      productName="Regulatory Intelligence"
      navItems={navItems}
      sidebarFooter={
        <div className="space-y-2">
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
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Welcome Header */}
        <div>
          <h1 className="page-title mb-2">
            Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
          </h1>
          <p className="body-text">
            Upload a CMS document to transform it into a client-ready presentation.
          </p>
        </div>

        {/* Upload Section */}
        <section>
          <UploadZone onUpload={handleUpload} />
        </section>

        {/* Recent Conversions */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="section-header">
              Recent Conversions
              {hasActiveJobs && (
                <span className="ml-2 inline-block w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
              )}
            </h2>
            {jobs.length > 0 && (
              <Link href="/history">
                <Button variant="ghost" size="sm" className="gap-2">
                  View All
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>

          {jobs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                No conversions yet
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Upload your first document to get started
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onDownload={handleDownload}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </MainLayout>
  );
}
