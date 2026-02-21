'use client';

import { ExternalLink } from 'lucide-react';
import { SourceBadge } from './SourceBadge';

interface Document {
  id: string;
  source: string;
  sourceUrl: string | null;
  title: string;
  publicationDate: Date | null;
  citation: string | null;
  documentType: string | null;
  agency: {
    id: string;
    name: string;
  };
  documentOutputs: Array<{
    id: string;
    status: string;
    outputType: string;
    outputPath: string | null;
    organization?: {
      id: string;
      name: string;
      slug: string;
      outputType: string;
    };
    clientOutputs: Array<{
      id: string;
      status: string;
      client: {
        id: string;
        name: string;
      };
    }>;
  }>;
}

interface Organization {
  id: string;
  name: string;
  outputType: string;
  hasClients: boolean;
}

interface DocumentListProps {
  documents: Document[];
  organization: Organization | null;
  onSelectClients: (document: Document) => void;
  onGenerateBase: (documentId: string, organizationId: string) => void;
  isAdmin?: boolean;
  processingDocuments?: Set<string>;
}

export function DocumentList({
  documents,
  organization,
  onSelectClients,
  onGenerateBase,
  isAdmin = false,
  processingDocuments = new Set()
}: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1A2332] rounded-lg shadow p-12 text-center">
        <p className="text-gray-500 dark:text-slate-400">No documents found. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => {
        // In admin mode, show all outputs. In regular mode, filter by org type
        const outputs = isAdmin
          ? doc.documentOutputs
          : doc.documentOutputs.filter(o => organization && o.outputType === organization.outputType);

        const baseOutput = outputs.find(o => o.organization);
        const isBaseComplete = baseOutput?.status === 'complete';
        const isProcessing = baseOutput?.status === 'processing' || processingDocuments.has(doc.id);
        const clientOutputs = baseOutput?.clientOutputs || [];
        const completedClientOutputs = clientOutputs.filter(co => co.status === 'complete');

        return (
          <div key={doc.id} className="bg-white dark:bg-[#1A2332] rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Title and Badges */}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-start gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex-1">{doc.title}</h3>
                      {doc.sourceUrl && (
                        <a
                          href={doc.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 transition-colors mt-1"
                          title="View source document"
                        >
                          <ExternalLink size={16} />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <SourceBadge source={doc.source} />
                    <span className="px-2 py-1 text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded">
                      {doc.agency.id.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-slate-400">
                  {doc.publicationDate && (
                    <span>
                      {new Date(doc.publicationDate).toLocaleDateString()}
                    </span>
                  )}
                  {doc.citation && <span>{doc.citation}</span>}
                  {doc.documentType && <span>{doc.documentType}</span>}
                </div>

                {/* Output Status */}
                <div className="mt-4 space-y-2">
                  {/* Base Output Status */}
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">
                      Base {baseOutput?.organization?.outputType === 'pptx' ? 'PPTX' : 'Memo'}:
                    </span>
                    {!baseOutput && (
                      <span className="text-sm text-gray-500 dark:text-slate-500">Not started</span>
                    )}
                    {baseOutput && (
                      <>
                        {isProcessing && (
                          <span className="text-sm text-blue-600">⏳ Processing...</span>
                        )}
                        {isBaseComplete && (
                          <span className="text-sm text-green-600 dark:text-green-400">✓ Ready</span>
                        )}
                        {baseOutput.status === 'failed' && (
                          <span className="text-sm text-red-600 dark:text-red-400">✗ Failed</span>
                        )}
                        {baseOutput.status === 'pending' && (
                          <span className="text-sm text-gray-500 dark:text-slate-500">⊙ Pending</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Client Memos Status (if applicable) */}
                  {organization?.hasClients && baseOutput && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700 dark:text-slate-300">Client memos:</span>
                      <span className="text-sm text-gray-600 dark:text-slate-400">
                        {completedClientOutputs.length} of {clientOutputs.length} generated
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="ml-6 flex flex-col gap-2">
                {/* Generate Base */}
                {!isBaseComplete && baseOutput?.organization && (
                  <button
                    onClick={() => onGenerateBase(doc.id, baseOutput.organization!.id)}
                    disabled={isProcessing}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors whitespace-nowrap ${
                      isProcessing
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Processing...
                      </span>
                    ) : (
                      'Generate Base'
                    )}
                  </button>
                )}

                {/* View Base */}
                {isBaseComplete && baseOutput?.outputPath && (
                  <a
                    href={`/api/outputs/${baseOutput.id}/download`}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors text-center whitespace-nowrap"
                  >
                    View Base
                  </a>
                )}

                {/* Select Clients */}
                {organization?.hasClients && isBaseComplete && (
                  <button
                    onClick={() => onSelectClients(doc)}
                    className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors whitespace-nowrap"
                  >
                    Select Clients →
                  </button>
                )}

                {/* Download All (if multiple client outputs) */}
                {completedClientOutputs.length > 0 && (
                  <button
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-white/5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap"
                  >
                    Download All ↓
                  </button>
                )}
              </div>
            </div>

            {/* Client Output List (if any completed) */}
            {completedClientOutputs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-white/10">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300 mb-2">Generated Client Memos:</p>
                <div className="flex flex-wrap gap-2">
                  {completedClientOutputs.map((co) => (
                    <a
                      key={co.id}
                      href={`/api/client-outputs/${co.id}/download`}
                      className="px-3 py-1 text-sm font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                    >
                      {co.client.name}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
