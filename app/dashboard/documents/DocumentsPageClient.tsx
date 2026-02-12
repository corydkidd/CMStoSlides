'use client';

import { useState } from 'react';
import { DocumentList } from '@/components/documents/DocumentList';
import { ClientSelector } from '@/components/clients/ClientSelector';

interface Document {
  id: string;
  source: string;
  title: string;
  publicationDate: Date | null;
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
  slug: string;
  outputType: string;
  hasClients: boolean;
}

interface DocumentsPageClientProps {
  documents: Document[];
  organization: Organization;
}

export function DocumentsPageClient({ documents, organization }: DocumentsPageClientProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  const handleSelectClients = (document: Document) => {
    setSelectedDocument(document);
    setIsSelectorOpen(true);
  };

  const handleSelectorClose = () => {
    setIsSelectorOpen(false);
    setSelectedDocument(null);
    // Refresh page to show updated data
    window.location.reload();
  };

  const handleGenerateBase = async (documentId: string) => {
    try {
      const response = await fetch(`/api/documents/${documentId}/generate-base`, {
        method: 'POST',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate base output');
      }

      alert('Base output generation started. This may take a few minutes.');
      window.location.reload();
    } catch (error: any) {
      console.error('Error generating base output:', error);
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Regulatory Documents</h1>
          <p className="mt-2 text-gray-600">
            Monitoring documents from subscribed agencies
          </p>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Total Documents</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {documents.length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Processed</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {documents.filter(d => d.documentOutputs.some(o => o.status === 'complete')).length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Pending</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {documents.filter(d => d.documentOutputs.every(o => o.status === 'pending')).length}
              </div>
            </div>
          </div>
        </div>

        {/* Document List */}
        <DocumentList
          documents={documents}
          organization={organization}
          onSelectClients={handleSelectClients}
          onGenerateBase={handleGenerateBase}
        />

        {/* Client Selector Modal */}
        {isSelectorOpen && selectedDocument && (
          <ClientSelector
            document={selectedDocument}
            onClose={handleSelectorClose}
          />
        )}
      </div>
    </div>
  );
}
