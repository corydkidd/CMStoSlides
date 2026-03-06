'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { X } from 'lucide-react';

interface Org {
  id: string;
  name: string;
  slug: string;
}

interface Props {
  initial?: { id: string; name: string; description: string | null; orgIds: string[] };
  onSave: (data: { name: string; description: string; orgIds: string[] }) => Promise<void>;
  onCancel: () => void;
}

export function DocSetForm({ initial, onSave, onCancel }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>(initial?.orgIds ?? []);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/organizations')
      .then((r) => r.json())
      .then((data) => setOrgs(data.organizations ?? []))
      .catch(() => {});
  }, []);

  function toggleOrg(id: string) {
    setSelectedOrgIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ name: name.trim(), description: description.trim(), orgIds: selectedOrgIds });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Set Name <span className="text-red-500">*</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. FY 2026 CMS Final Rules"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-[#1a2332] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional description of this document set"
          className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-[#1a2332] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50 resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
          Organization Access
        </label>
        <div className="space-y-2">
          {orgs.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">Loading organizations…</p>
          )}
          {orgs.map((org) => (
            <label key={org.id} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selectedOrgIds.includes(org.id)}
                onChange={() => toggleOrg(org.id)}
                className="w-4 h-4 rounded border-slate-300 dark:border-white/30 text-cyan-500 focus:ring-cyan-400/50"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">
                {org.name}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-500">({org.slug})</span>
            </label>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={saving}>
          {saving ? 'Saving…' : (initial ? 'Save Changes' : 'Create Set')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
