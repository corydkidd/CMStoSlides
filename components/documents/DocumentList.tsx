'use client';

import { SourceBadge } from './SourceBadge';

interface Document {
  id: string;
  source: string;
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
  organization: Organization;
  onSelectClients: (document: Document) => void;
  onGenerateBase: (documentId: string) => void;
}

export function DocumentList({ documents, organization, onSelectClients, onGenerateBase }: DocumentListProps) {
  if (documents.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <p className="text-gray-500">No documents found. Check back later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {documents.map((doc) => {
        const baseOutput = doc.documentOutputs.find(o => o.outputType === organization.outputType);
        const isBaseComplete = baseOutput?.status === 'complete';
        const isProcessing = baseOutput?.status === 'processing';
        const clientOutputs = baseOutput?.clientOutputs || [];
        const completedClientOutputs = clientOutputs.filter(co => co.status === 'complete');

        return (
          <div key={doc.id} className="bg-white rounded-lg shadow p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                {/* Title and Badges */}
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">{doc.title}</h3>
                  </div>
                  <div className="flex gap-2">
                    <SourceBadge source={doc.source} />
                    <span className="px-2 py-1 text-xs font-medium bg-purple-50 text-purple-700 rounded">
                      {doc.agency.id.toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* Metadata */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
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
                    <span className="text-sm font-medium text-gray-700">
                      Base {organization.outputType === 'pptx' ? 'PPTX' : 'Memo'}:
                    </span>
                    {!baseOutput && (
                      <span className="text-sm text-gray-500">Not started</span>
                    )}
                    {baseOutput && (
                      <>
                        {isProcessing && (
                          <span className="text-sm text-blue-600">⏳ Processing...</span>
                        )}
                        {isBaseComplete && (
                          <span className="text-sm text-green-600">✓ Ready</span>
                        )}
                        {baseOutput.status === 'failed' && (
                          <span className="text-sm text-red-600">✗ Failed</span>
                        )}
                        {baseOutput.status === 'pending' && (
                          <span className="text-sm text-gray-500">⊙ Pending</span>
                        )}
                      </>
                    )}
                  </div>

                  {/* Client Memos Status (if applicable) */}
                  {organization.hasClients && baseOutput && (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-700">Client memos:</span>
                      <span className="text-sm text-gray-600">
                        {completedClientOutputs.length} of {clientOutputs.length} generated
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="ml-6 flex flex-col gap-2">
                {/* Generate Base */}
                {!isBaseComplete && !isProcessing && (
                  <button
                    onClick={() => onGenerateBase(doc.id)}
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    Generate Base
                  </button>
                )}

                {/* View Base */}
                {isBaseComplete && baseOutput?.outputPath && (
                  <a
                    href={`/api/outputs/${baseOutput.id}/download`}
                    className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors text-center whitespace-nowrap"
                  >
                    View Base
                  </a>
                )}

                {/* Select Clients */}
                {organization.hasClients && isBaseComplete && (
                  <button
                    onClick={() => onSelectClients(doc)}
                    className="px-4 py-2 text-sm font-medium text-green-600 bg-green-50 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
                  >
                    Select Clients →
                  </button>
                )}

                {/* Download All (if multiple client outputs) */}
                {completedClientOutputs.length > 0 && (
                  <button
                    className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors whitespace-nowrap"
                  >
                    Download All ↓
                  </button>
                )}
              </div>
            </div>

            {/* Client Output List (if any completed) */}
            {completedClientOutputs.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-2">Generated Client Memos:</p>
                <div className="flex flex-wrap gap-2">
                  {completedClientOutputs.map((co) => (
                    <a
                      key={co.id}
                      href={`/api/client-outputs/${co.id}/download`}
                      className="px-3 py-1 text-sm font-medium text-green-700 bg-green-50 rounded hover:bg-green-100 transition-colors"
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
