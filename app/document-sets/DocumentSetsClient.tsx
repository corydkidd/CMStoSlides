'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  BookOpen, ArrowRight, History, LogOut, ShieldCheck, FileText
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { DocumentStatusBadge } from '@/components/document-sets/DocumentStatusBadge';

interface DocSet {
  id: string;
  name: string;
  description: string | null;
  docCount: number;
  readyCount: number;
}

interface Props {
  user: { id: string; email: string; name: string | null };
  profile: any;
  organization: { id: string; name: string; slug: string } | null;
}

export function DocumentSetsClient({ user, profile, organization }: Props) {
  const [sets, setSets] = useState<DocSet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/document-sets')
      .then((r) => r.json())
      .then((data) => { setSets(data.sets ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const navItems = [
    { href: '/dashboard/documents', label: 'Documents', icon: FileText },
    { href: '/document-sets', label: 'Document Sets', icon: BookOpen },
    { href: '/history', label: 'History', icon: History },
    ...(profile?.is_admin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  function statusSummary(set: DocSet): string {
    if (set.docCount === 0) return 'No documents';
    if (set.readyCount === set.docCount) return `${set.docCount} document${set.docCount !== 1 ? 's' : ''} · All ready`;
    return `${set.readyCount} of ${set.docCount} ready`;
  }

  return (
    <MainLayout
      productName="Regulatory Intelligence"
      navItems={navItems}
      sidebarFooter={
        <div className="space-y-2">
          <p className="text-xs text-white/40">Signed in as</p>
          <p className="text-sm text-white/80 font-medium truncate">{profile?.full_name || user.email}</p>
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
        <div>
          <h1 className="page-title mb-2">Document Sets</h1>
          <p className="body-text">
            Query curated sets of regulatory documents using natural language. Answers include source citations.
          </p>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-stagger">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 skeleton rounded-xl" />
            ))}
          </div>
        ) : sets.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-1">
              No document sets assigned
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              No document sets have been assigned to your organization yet. Contact your administrator.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-stagger">
            {sets.map((set) => (
              <div
                key={set.id}
                className="bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10 p-6 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-400/50 hover:shadow-[0_4px_20px_rgba(0,217,255,0.15)] dark:hover:shadow-[0_4px_20px_rgba(0,217,255,0.25)]"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-cyan-100 dark:bg-cyan-400/15 flex items-center justify-center flex-shrink-0">
                    <BookOpen className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  </div>
                  {set.readyCount < set.docCount && set.docCount > 0 && (
                    <DocumentStatusBadge status="processing" />
                  )}
                  {set.readyCount === set.docCount && set.docCount > 0 && (
                    <DocumentStatusBadge status="ready" />
                  )}
                </div>

                <h3 className="font-display font-semibold text-slate-900 dark:text-white text-lg mb-1">
                  {set.name}
                </h3>
                {set.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
                    {set.description}
                  </p>
                )}
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                  {statusSummary(set)}
                </p>

                <Link href={`/document-sets/${set.id}`}>
                  <Button
                    variant="primary"
                    size="sm"
                    className="gap-1.5 w-full justify-center"
                    disabled={set.readyCount === 0}
                  >
                    Query this set
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
