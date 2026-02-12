'use client';

import { FileText, Download, CheckCircle, Clock, AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

interface Job {
  id: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  inputFilename: string;
  outputFilename?: string | null;
  createdAt: string;
  processingCompletedAt?: string | null;
  errorMessage?: string | null;
  // Federal Register metadata
  documentTitle?: string | null;
  documentUrl?: string | null;
  citation?: string | null;
  documentNumber?: string | null;
  publicationDate?: string | null;
}

interface JobCardProps {
  job: Job;
  onDownload?: (jobId: string) => void;
}

export function JobCard({ job, onDownload }: JobCardProps) {
  const getStatusConfig = (status: Job['status']) => {
    switch (status) {
      case 'complete':
        return {
          icon: CheckCircle,
          label: 'Complete',
          variant: 'success' as const,
          color: 'text-green-600 dark:text-green-400',
        };
      case 'processing':
        return {
          icon: Loader2,
          label: 'Processing',
          variant: 'warning' as const,
          color: 'text-yellow-600 dark:text-yellow-400',
          animate: true,
        };
      case 'pending':
        return {
          icon: Clock,
          label: 'Pending',
          variant: 'default' as const,
          color: 'text-slate-600 dark:text-slate-400',
        };
      case 'failed':
        return {
          icon: AlertCircle,
          label: 'Failed',
          variant: 'error' as const,
          color: 'text-red-600 dark:text-red-400',
        };
    }
  };

  const config = getStatusConfig(job.status);
  const StatusIcon = config.icon;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // Display title: prefer FR document title, fall back to filename
  const displayTitle = job.documentTitle || job.inputFilename;

  return (
    <div className={cn(
      "p-5 rounded-xl border transition-all duration-200",
      "bg-white dark:bg-[#1A2332]",
      "border-slate-200 dark:border-white/10",
      "hover:shadow-md hover:border-cyan-400/30"
    )}>
      <div className="flex items-start justify-between gap-4">
        {/* File Icon & Info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className={cn(
            "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0",
            "bg-red-100 dark:bg-red-400/20"
          )}>
            <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-slate-900 dark:text-white mb-1 leading-snug">
              {job.documentUrl ? (
                <a
                  href={job.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors inline-flex items-start gap-1.5"
                >
                  <span className="line-clamp-2">{displayTitle}</span>
                  <ExternalLink className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 opacity-50" />
                </a>
              ) : (
                <span className="line-clamp-2">{displayTitle}</span>
              )}
            </h3>

            {/* Citation & document number */}
            {(job.citation || job.documentNumber) && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-1">
                {job.citation || job.documentNumber}
                {job.inputFilename && (
                  <span className="ml-2 text-xs opacity-60">({job.inputFilename})</span>
                )}
              </p>
            )}

            {job.status === 'complete' && job.outputFilename && (
              <p className="text-sm text-green-600 dark:text-green-400 truncate mb-1">
                ✓ {job.outputFilename}
              </p>
            )}

            {job.status === 'failed' && job.errorMessage && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-1">
                {job.errorMessage}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
              {job.createdAt && <span>{formatDate(job.createdAt)}</span>}
              {job.publicationDate && (
                <span>• Published {new Date(job.publicationDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              )}
              {job.processingCompletedAt && (
                <span>• Completed {formatDate(job.processingCompletedAt)}</span>
              )}
            </div>
          </div>
        </div>

        {/* Status & Action */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <Badge variant={config.variant} className="flex items-center gap-1.5">
            <StatusIcon className={cn(
              "w-3.5 h-3.5",
              config.animate && "animate-spin"
            )} />
            {config.label}
          </Badge>

          {job.status === 'complete' && onDownload && (
            <Button
              onClick={() => onDownload(job.id)}
              size="sm"
              variant="outline"
              className="gap-2"
            >
              <Download className="w-4 h-4" />
              Download
            </Button>
          )}
        </div>
      </div>

      {/* Processing Progress (for processing status) */}
      {job.status === 'processing' && (
        <div className="mt-4">
          <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-cyan-400 to-cyan-600 rounded-full animate-pulse w-3/4" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Converting document to presentation...
          </p>
        </div>
      )}
    </div>
  );
}
