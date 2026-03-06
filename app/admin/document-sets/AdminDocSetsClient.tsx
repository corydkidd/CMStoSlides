'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, Users, FileText, LogOut, BookOpen,
  Plus, Pencil, Trash2, ChevronRight, ShieldCheck
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { DocSetForm } from '@/components/admin/document-sets/DocSetForm';

interface DocSet {
  id: string;
  name: string;
  description: string | null;
  doc_count: string;
  orgs: Array<{ id: string; name: string; slug: string }>;
  created_at: string;
}

interface Props {
  user: { id: string; email: string; name: string | null };
  profile: any;
}

type ModalState =
  | { type: 'none' }
  | { type: 'create' }
  | { type: 'edit'; set: DocSet };

export function AdminDocSetsClient({ user, profile }: Props) {
  const [sets, setSets] = useState<DocSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const fetchSets = useCallback(async () => {
    const res = await fetch('/api/admin/document-sets');
    const data = await res.json();
    setSets(data.sets ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSets(); }, [fetchSets]);

  async function handleCreate(data: { name: string; description: string; orgIds: string[] }) {
    const res = await fetch('/api/admin/document-sets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Create failed');
    }
    setModal({ type: 'none' });
    fetchSets();
  }

  async function handleEdit(set: DocSet, data: { name: string; description: string; orgIds: string[] }) {
    const res = await fetch(`/api/admin/document-sets/${set.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Update failed');
    setModal({ type: 'none' });
    fetchSets();
  }

  async function handleDelete(setId: string) {
    await fetch(`/api/admin/document-sets/${setId}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchSets();
  }

  const navItems = [
    { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/users', label: 'Users', icon: Users },
    { href: '/admin/jobs', label: 'All Jobs', icon: FileText },
    { href: '/admin/document-sets', label: 'Manage Sets', icon: BookOpen },
    { href: '/dashboard', label: 'User View', icon: ShieldCheck },
  ];

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="page-title mb-1">Manage Document Sets</h1>
            <p className="body-text">Create and configure document sets for organization access.</p>
          </div>
          <Button onClick={() => setModal({ type: 'create' })} className="gap-2">
            <Plus className="w-4 h-4" />
            New Document Set
          </Button>
        </div>

        {/* Create/Edit Modal */}
        {(modal.type === 'create' || modal.type === 'edit') && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#1a2332] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-lg p-6">
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-white mb-5">
                {modal.type === 'create' ? 'New Document Set' : 'Edit Document Set'}
              </h2>
              <DocSetForm
                initial={
                  modal.type === 'edit'
                    ? {
                        id: modal.set.id,
                        name: modal.set.name,
                        description: modal.set.description,
                        orgIds: modal.set.orgs.map((o) => o.id),
                      }
                    : undefined
                }
                onSave={
                  modal.type === 'create'
                    ? handleCreate
                    : (data) => handleEdit(modal.set, data)
                }
                onCancel={() => setModal({ type: 'none' })}
              />
            </div>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-[#1a2332] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl w-full max-w-md p-6">
              <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-white mb-2">
                Delete Document Set?
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
                This will permanently delete the set, all its documents, all chunks, and all embeddings. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <Button
                  onClick={() => handleDelete(deleteConfirm)}
                  className="bg-red-500 hover:bg-red-400 text-white"
                >
                  Delete Permanently
                </Button>
                <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Sets table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 skeleton rounded-xl" />
            ))}
          </div>
        ) : sets.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10">
            <BookOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="font-display font-semibold text-slate-900 dark:text-white mb-1">No document sets yet</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Create a set to start uploading regulatory documents.</p>
            <Button onClick={() => setModal({ type: 'create' })} className="gap-2">
              <Plus className="w-4 h-4" /> New Document Set
            </Button>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Docs</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Orgs with Access</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Created</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {sets.map((set) => (
                  <tr key={set.id} className="hover:bg-cyan-50/30 dark:hover:bg-cyan-400/5 transition-colors">
                    <td className="px-5 py-4">
                      <Link
                        href={`/admin/document-sets/${set.id}`}
                        className="font-medium text-slate-900 dark:text-white hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
                      >
                        {set.name}
                      </Link>
                      {set.description && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate max-w-xs">
                          {set.description}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">
                      {parseInt(set.doc_count, 10)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        {set.orgs.length === 0 ? (
                          <span className="text-xs text-slate-400 dark:text-slate-500">None</span>
                        ) : (
                          set.orgs.map((org) => (
                            <Badge key={org.id} variant="cyan">{org.name}</Badge>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-500 dark:text-slate-400">
                      {new Date(set.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-1 justify-end">
                        <Link href={`/admin/document-sets/${set.id}`}>
                          <button
                            className="p-1.5 text-slate-400 hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors rounded"
                            title="Manage documents"
                          >
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </Link>
                        <button
                          onClick={() => setModal({ type: 'edit', set })}
                          className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded"
                          title="Edit set"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(set.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors rounded"
                          title="Delete set"
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
      </div>
    </MainLayout>
  );
}
