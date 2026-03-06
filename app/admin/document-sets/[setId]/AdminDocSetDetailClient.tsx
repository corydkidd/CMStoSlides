'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, Users, FileText, LogOut, BookOpen,
  ArrowLeft, RotateCcw, Trash2, ShieldCheck
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DocumentStatusBadge } from '@/components/document-sets/DocumentStatusBadge';
import { DocumentUpload } from '@/components/admin/document-sets/DocumentUpload';

interface DocSet {
  id: string;
  name: string;
  description: string | null;
  orgs: Array<{ id: string; name: string; slug: string }>;
}

interface Doc {
  id: string;
  title: string;
  filename: string;
  status: string;
  status_message: string | null;
  word_count: number | null;
  uploaded_at: string;
  processed_at: string | null;
}

interface Props {
  setId: string;
  user: { id: string; email: string; name: string | null };
  profile: any;
}

export function AdminDocSetDetailClient({ setId, user, profile }: Props) {
  const [set, setSet] = useState<DocSet | null>(null);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const [setRes, docsRes] = await Promise.all([
      fetch(`/api/admin/document-sets`),
      fetch(`/api/admin/document-sets/${setId}/documents`),
    ]);
    const setData = await setRes.json();
    const docsData = await docsRes.json();

    const found = setData.sets?.find((s: any) => s.id === setId);
    setSet(found ?? null);
    setDocs(docsData.documents ?? []);
    setLoading(false);
  }, [setId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll every 5 seconds while any doc is pending/processing
  useEffect(() => {
    const hasActive = docs.some(
      (d) => d.status === 'pending' || d.status === 'processing'
    );
    if (!hasActive) return;
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [docs, fetchData]);

  async function handleDelete(docId: string) {
    await fetch(`/api/admin/document-sets/${setId}/documents/${docId}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchData();
  }

  async function handleReindex(docId: string) {
    await fetch(`/api/admin/document-sets/${setId}/documents/${docId}/reindex`, { method: 'POST' });
    fetchData();
  }

  function handleUploaded(doc: { id: string; title: string; status: string }) {
    setDocs((prev) => [
      { id: doc.id, title: doc.title, filename: '', status: doc.status,
        status_message: null, word_count: null, uploaded_at: new Date().toISOString(), processed_at: null },
      ...prev,
    ]);
    // Start polling
    setTimeout(fetchData, 2000);
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/jobs', label: 'All Jobs', icon: FileText },
    { href: '/admin/document-sets', label: 'Manage Sets', icon: BookOpen },
    { href: '/dashboard', label: 'User View', icon: ShieldCheck },
  ];

  if (loading) {
    return (
      <MainLayout productName="Admin Panel" navItems={navItems} sidebarFooter={null}>
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-white/10 rounded w-64" />
          <div className="h-64 bg-slate-100 dark:bg-white/5 rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      productName="Admin Panel"
      navItems={navItems}
      sidebarFooter={
        <div className="space-y-2">
          <Badge variant="default" className="mb-2">Administrator</Badge>
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
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Back + Header */}
        <div>
          <Link
            href="/admin/document-sets"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            All Document Sets
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex-1">
              <h1 className="page-title mb-1">{set?.name ?? 'Document Set'}</h1>
              {set?.description && (
                <p className="body-text">{set.description}</p>
              )}
            </div>
          </div>
          {/* Org access badges */}
          {set && set.orgs.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {set.orgs.map((org) => (
                <Badge key={org.id} variant="cyan">{org.name}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Upload area */}
        <section>
          <h2 className="section-header mb-4">Upload Document</h2>
          <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10 p-6">
            <DocumentUpload setId={setId} onUploaded={handleUploaded} />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
              Large documents (2,000+ pages) may take 10–30 minutes to process.
            </p>
          </div>
        </section>

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#1a2332] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Remove Document?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                This will delete the document, all its chunks, embeddings, and the PDF file from disk.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="bg-red-500 hover:bg-red-400 text-white"
                >
                  Remove
                </Button>
                <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Documents table */}
        <section>
          <h2 className="section-header mb-4">
            Documents
            {docs.some((d) => d.status === 'pending' || d.status === 'processing') && (
              <span className="ml-2 inline-block w-2 h-2 bg-amber-400 rounded-full animate-pulse align-middle" />
            )}
          </h2>

          {docs.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10">
              <FileText className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-500 dark:text-slate-400">No documents yet. Upload a PDF above.</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
              <table className="w-full">
                <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Title</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Filename</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Words</th>
                    <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Uploaded</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {docs.map((doc) => (
                    <tr key={doc.id} className="hover:bg-cyan-50/30 dark:hover:bg-cyan-400/5 transition-colors">
                      <td className="px-5 py-4">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{doc.title}</span>
                        {doc.status_message && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate max-w-xs" title={doc.status_message}>
                            {doc.status_message}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400 font-mono">
                        {doc.filename}
                      </td>
                      <td className="px-5 py-4">
                        <DocumentStatusBadge status={doc.status} />
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                        {doc.word_count ? doc.word_count.toLocaleString() : '—'}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1 justify-end">
                          {(doc.status === 'ready' || doc.status === 'error') && (
                            <button
                              onClick={() => handleReindex(doc.id)}
                              className="p-1.5 text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors rounded"
                              title="Re-index document"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setDeleteConfirm(doc.id)}
                            className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded"
                            title="Remove document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
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
