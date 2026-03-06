'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

interface Props {
  setId: string;
  onUploaded: (doc: { id: string; title: string; status: string }) => void;
}

export function DocumentUpload({ setId, onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setError('Only PDF files are accepted');
      return;
    }
    setSelectedFile(file);
    setTitle(file.name.replace(/\.pdf$/i, '').replace(/[-_]/g, ' '));
    setError('');
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  async function handleUpload() {
    if (!selectedFile) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', selectedFile);
      form.append('title', title.trim() || selectedFile.name);

      const res = await fetch(`/api/admin/document-sets/${setId}/documents`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      onUploaded(data);
      setSelectedFile(null);
      setTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onClick={() => !selectedFile && inputRef.current?.click()}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer',
          dragging
            ? 'border-cyan-400 bg-cyan-50/50 dark:bg-cyan-400/10'
            : 'border-slate-200 dark:border-white/20 hover:border-cyan-400/50 dark:hover:border-cyan-400/40',
          selectedFile && 'cursor-default'
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="w-6 h-6 text-cyan-500 dark:text-cyan-400 flex-shrink-0" />
            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedFile.name}</span>
          </div>
        ) : (
          <>
            <Upload className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Drag &amp; drop a PDF here, or <span className="text-cyan-600 dark:text-cyan-400 font-medium">click to browse</span>
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">PDF files only</p>
          </>
        )}
      </div>

      {/* Title input (shown after file selected) */}
      {selectedFile && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Document Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-[#1a2332] text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpload} disabled={uploading} size="sm">
              {uploading ? 'Uploading…' : 'Upload & Queue'}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setSelectedFile(null); setTitle(''); setError(''); }}
              disabled={uploading}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
