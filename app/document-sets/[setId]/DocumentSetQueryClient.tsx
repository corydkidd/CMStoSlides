'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import {
  BookOpen, ArrowLeft, Send, History, LogOut, ShieldCheck,
  ChevronDown, ChevronUp, FileText, Clock
} from 'lucide-react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/Button';
import { DocumentStatusBadge } from '@/components/document-sets/DocumentStatusBadge';
import { SourceChip } from '@/components/document-sets/SourceChip';

interface DocSetInfo {
  id: string;
  name: string;
  description: string | null;
}

interface DocInfo {
  id: string;
  title: string;
  filename: string;
  status: string;
  word_count: number | null;
}

interface Source {
  document_title: string;
  section: string | null;
  section_title: string | null;
}

interface QueryResult {
  answer: string;
  sources: Source[];
}

interface LogEntry {
  id: string;
  query_text: string;
  response_text: string | null;
  created_at: string;
}

interface Props {
  setId: string;
  user: { id: string; email: string; name: string | null };
  profile: any;
}

export function DocumentSetQueryClient({ setId, user, profile }: Props) {
  const [setInfo, setSetInfo] = useState<DocSetInfo | null>(null);
  const [docs, setDocs] = useState<DocInfo[]>([]);
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [querying, setQuerying] = useState(false);
  const [error, setError] = useState('');
  const [showDocs, setShowDocs] = useState(false);
  const [queryLog, setQueryLog] = useState<LogEntry[]>([]);
  const [showLog, setShowLog] = useState(false);
  const [loading, setLoading] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchSetData = useCallback(async () => {
    const res = await fetch(`/api/document-sets/${setId}`);
    if (!res.ok) return;
    const data = await res.json();
    setSetInfo(data.set);
    setDocs(data.documents ?? []);
    setLoading(false);
  }, [setId]);

  const fetchQueryLog = useCallback(async () => {
    const res = await fetch(`/api/document-sets/${setId}/query-log`);
    if (!res.ok) return;
    const data = await res.json();
    setQueryLog(data.log ?? []);
  }, [setId]);

  useEffect(() => {
    fetchSetData();
    fetchQueryLog();
  }, [fetchSetData, fetchQueryLog]);

  async function handleQuery() {
    if (!question.trim() || querying) return;
    setQuerying(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch(`/api/document-sets/${setId}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: question.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Query failed');
      setResult(data);
      fetchQueryLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed. Please try again.');
    } finally {
      setQuerying(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleQuery();
    }
  }

  const readyDocs = docs.filter((d) => d.status === 'ready');
  const totalWords = readyDocs.reduce((sum, d) => sum + (d.word_count ?? 0), 0);
  const hasReady = readyDocs.length > 0;

  const navItems = [
    { href: '/dashboard/documents', label: 'Documents', icon: FileText },
    { href: '/document-sets', label: 'Document Sets', icon: BookOpen },
    { href: '/history', label: 'History', icon: History },
    ...(profile?.is_admin ? [{ href: '/admin', label: 'Admin', icon: ShieldCheck }] : []),
  ];

  if (loading) {
    return (
      <MainLayout productName="Regulatory Intelligence" navItems={navItems} sidebarFooter={null}>
        <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
          <div className="h-8 bg-slate-200 dark:bg-white/10 rounded w-64" />
          <div className="h-64 bg-slate-100 dark:bg-white/5 rounded-xl" />
        </div>
      </MainLayout>
    );
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
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <Link
            href="/document-sets"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Document Sets
          </Link>
          <h1 className="page-title mb-1">{setInfo?.name ?? 'Document Set'}</h1>
          {setInfo?.description && (
            <p className="body-text">{setInfo.description}</p>
          )}
          <div className="flex items-center gap-4 mt-2">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              {docs.length} document{docs.length !== 1 ? 's' : ''}
              {totalWords > 0 && ` · ~${(totalWords / 1000).toFixed(0)}K words`}
            </span>
            <button
              onClick={() => setShowDocs(!showDocs)}
              className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
            >
              {showDocs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showDocs ? 'Hide' : 'Show'} documents
            </button>
          </div>
        </div>

        {/* Collapsible document list */}
        {showDocs && (
          <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 min-w-0 truncate">
                  {doc.title}
                </span>
                {doc.word_count && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 flex-shrink-0">
                    {doc.word_count.toLocaleString()} words
                  </span>
                )}
                <DocumentStatusBadge status={doc.status} />
              </div>
            ))}
          </div>
        )}

        {/* Query interface */}
        <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10 p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Ask a question about these documents
            </label>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={3}
              placeholder="e.g. What are the key changes to the Hospital Readmissions Reduction Program?"
              disabled={!hasReady || querying}
              className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-white/20 bg-white dark:bg-[#0A1628] text-slate-900 dark:text-white text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Press ⌘+Enter to submit. Large document sets may take 10–15 seconds.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={handleQuery}
              disabled={!question.trim() || !hasReady || querying}
              className="gap-2"
            >
              {querying ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#0A1628]/30 border-t-[#0A1628] rounded-full animate-spin" />
                  Searching…
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Ask
                </>
              )}
            </Button>
            {!hasReady && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Waiting for documents to finish processing…
              </p>
            )}
          </div>

          {/* Skeleton loader */}
          {querying && (
            <div className="space-y-3 pt-2">
              <div className="h-4 skeleton rounded w-3/4" />
              <div className="h-4 skeleton rounded w-full" />
              <div className="h-4 skeleton rounded w-5/6" />
              <div className="h-4 skeleton rounded w-2/3" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-400/10 border border-red-200 dark:border-red-400/20">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Answer */}
          {result && !querying && (
            <div className="space-y-4 pt-2 animate-fade-in">
              <div className="prose prose-slate dark:prose-invert prose-sm max-w-none">
                {result.answer.split('\n').map((paragraph, i) => (
                  paragraph.trim() ? (
                    <p key={i} className="text-slate-700 dark:text-slate-200 leading-relaxed mb-3 last:mb-0">
                      {paragraph}
                    </p>
                  ) : null
                ))}
              </div>

              {/* Sources */}
              {result.sources.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
                    Sources
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {result.sources.map((source, i) => (
                      <SourceChip key={i} source={source} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Query log */}
        {queryLog.length > 0 && (
          <div>
            <button
              onClick={() => setShowLog(!showLog)}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors mb-3"
            >
              <Clock className="w-4 h-4" />
              {showLog ? 'Hide' : 'Show'} recent queries ({Math.min(queryLog.length, 5)})
              {showLog ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showLog && (
              <div className="bg-white dark:bg-[#1a2332] rounded-xl border border-slate-200 dark:border-white/10 divide-y divide-slate-100 dark:divide-white/5">
                {queryLog.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">
                        {entry.query_text}
                      </p>
                      <span className="text-xs text-slate-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                        {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {entry.response_text && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                        {entry.response_text}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
