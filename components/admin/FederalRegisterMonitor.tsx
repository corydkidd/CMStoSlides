'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Settings, CheckCircle, XCircle, Clock, FileText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';

interface FederalRegisterDocument {
  id: string;
  document_number: string;
  citation: string;
  title: string;
  document_type: string;
  publication_date: string;
  processing_status: string;
  conversion_job_id: string | null;
  detected_at: string;
  error_message?: string;
}

interface FederalRegisterSettings {
  is_enabled: boolean;
  last_poll_at: string | null;
  last_poll_status: string | null;
  last_poll_documents_found: number | null;
  initialized: boolean;
}

interface FederalRegisterStatus {
  settings: FederalRegisterSettings;
  recentDocuments: FederalRegisterDocument[];
  stats: {
    total: number;
    today: number;
  };
}

export function FederalRegisterMonitor() {
  const [status, setStatus] = useState<FederalRegisterStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/federal-register/status');
      if (!response.ok) throw new Error('Failed to fetch status');
      const data = await response.json();
      setStatus(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const triggerCheck = async () => {
    try {
      setChecking(true);
      const response = await fetch('/api/admin/federal-register/check-now', {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Check failed');
      const result = await response.json();

      // Refresh status after check
      await fetchStatus();

      alert(`Check complete: ${result.result.new_documents} new documents found`);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    // Refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !status) {
    return (
      <section>
        <h2 className="section-header mb-6">Federal Register Monitor</h2>
        <div className="bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10 p-8">
          <p className="text-slate-600 dark:text-slate-400">Loading...</p>
        </div>
      </section>
    );
  }

  if (error || !status) {
    return (
      <section>
        <h2 className="section-header mb-6">Federal Register Monitor</h2>
        <div className="bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10 p-8">
          <p className="text-red-600">Error: {error || 'Failed to load status'}</p>
          <Button onClick={fetchStatus} className="mt-4">
            Retry
          </Button>
        </div>
      </section>
    );
  }

  const getStatusIcon = () => {
    if (!status.settings.is_enabled) {
      return <XCircle className="w-5 h-5 text-slate-400" />;
    }
    if (status.settings.last_poll_status?.includes('error')) {
      return <XCircle className="w-5 h-5 text-red-500" />;
    }
    if (status.settings.last_poll_status === 'success') {
      return <CheckCircle className="w-5 h-5 text-green-500" />;
    }
    return <Clock className="w-5 h-5 text-yellow-500" />;
  };

  const getLastCheckTime = () => {
    if (!status.settings.last_poll_at) return 'Never';
    const date = new Date(status.settings.last_poll_at);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    if (diffHours < 24) return `${diffHours} hours ago`;

    return date.toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'complete':
      case 'processing':
        return <Badge variant="success">✓ Complete</Badge>;
      case 'pending':
      case 'downloading':
      case 'queued':
        return <Badge variant="warning">⏳ Processing</Badge>;
      case 'failed':
        return <Badge variant="error">✗ Failed</Badge>;
      case 'skipped':
        return <Badge variant="default">Skipped</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between mb-6">
        <h2 className="section-header">Federal Register Monitor</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchStatus}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={triggerCheck}
            disabled={checking}
          >
            {checking ? 'Checking...' : 'Check Now'}
          </Button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1A2332] rounded-xl border border-slate-200 dark:border-white/10 p-6 space-y-6">
        {/* Status Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon()}
            <div>
              <p className="font-medium text-slate-900 dark:text-white">
                {status.settings.is_enabled ? 'Active' : 'Disabled'}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Last check: {getLastCheckTime()}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900 dark:text-white">
              {status.stats.total}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Total Documents
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 pt-6 border-t border-slate-200 dark:border-white/10">
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Found Today
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {status.stats.today}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Last Check Found
            </p>
            <p className="text-xl font-semibold text-slate-900 dark:text-white">
              {status.settings.last_poll_documents_found ?? 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">
              Status
            </p>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              {status.settings.last_poll_status || 'Pending'}
            </p>
          </div>
        </div>

        {/* Recent Documents */}
        <div className="pt-6 border-t border-slate-200 dark:border-white/10">
          <h3 className="font-medium text-slate-900 dark:text-white mb-4">
            Recent Documents
          </h3>

          {status.recentDocuments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 dark:text-slate-400">
                No documents yet
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {status.recentDocuments.slice(0, 5).map((doc) => (
                <div
                  key={doc.id}
                  className="p-4 rounded-lg border border-slate-200 dark:border-white/10 hover:border-cyan-400/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                          {doc.document_number}
                        </span>
                        {doc.citation && (
                          <span className="text-xs text-slate-500 dark:text-slate-500">
                            • {doc.citation}
                          </span>
                        )}
                      </div>
                      <p className="font-medium text-slate-900 dark:text-white text-sm mb-1">
                        {doc.title}
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {new Date(doc.publication_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    <div className="ml-4">
                      {getStatusBadge(doc.processing_status)}
                    </div>
                  </div>

                  {doc.error_message && (
                    <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 rounded text-xs text-red-700 dark:text-red-400">
                      {doc.error_message}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {status.recentDocuments.length > 5 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Showing 5 of {status.recentDocuments.length} documents
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
