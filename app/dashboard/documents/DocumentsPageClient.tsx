'use client';

import { useState } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { DocumentList } from '@/components/documents/DocumentList';
import { ClientSelector } from '@/components/clients/ClientSelector';
import { Home, FileText, History } from 'lucide-react';

interface Document {
  id: string;
  source: string;
  sourceUrl: string | null;
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
  slug: string;
  outputType: string;
  hasClients: boolean;
}

interface DocumentsPageClientProps {
  documents: Document[];
  organization: Organization | null;
  organizations?: Organization[];
  isAdmin?: boolean;
}

export function DocumentsPageClient({
  documents,
  organization,
  organizations = [],
  isAdmin = false
}: DocumentsPageClientProps) {
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');
  const [processingDocuments, setProcessingDocuments] = useState<Set<string>>(new Set());

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

  const handleGenerateBase = async (documentId: string, organizationId: string) => {
    // Add to processing set immediately for UI feedback
    setProcessingDocuments(prev => new Set(prev).add(documentId));

    try {
      const response = await fetch(`/api/documents/${documentId}/generate-base`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ organizationId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate base output');
      }

      // Reload to get updated status (button already shows processing state)
      window.location.reload();
    } catch (error: any) {
      console.error('Error generating base output:', error);
      alert(`Error: ${error.message}`);
      // Remove from processing set on error
      setProcessingDocuments(prev => {
        const next = new Set(prev);
        next.delete(documentId);
        return next;
      });
    }
  };

  // Filter documents by selected organization (admin only)
  const filteredDocuments = isAdmin && selectedOrgFilter !== 'all'
    ? documents.filter(d =>
        d.documentOutputs.some(o => o.organization?.id === selectedOrgFilter)
      )
    : documents;

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: Home },
    { href: '/dashboard/documents', label: 'Documents', icon: FileText },
    { href: '/history', label: 'History', icon: History },
  ];

  return (
    <MainLayout productName="Regulatory Intelligence" navItems={navItems}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Regulatory Documents</h1>
              <p className="body-text mt-2">
                {isAdmin ? 'Admin view - All organizations' : 'Monitoring documents from subscribed agencies'}
              </p>
            </div>

            {/* Organization Filter (Admin Only) */}
            {isAdmin && organizations.length > 0 && (
              <div className="flex items-center gap-2">
                <label htmlFor="org-filter" className="text-sm font-medium text-gray-700">
                  Organization:
                </label>
                <select
                  id="org-filter"
                  value={selectedOrgFilter}
                  onChange={(e) => setSelectedOrgFilter(e.target.value)}
                  className="block rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                >
                  <option value="all">All Organizations</option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Total Documents</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {filteredDocuments.length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Processed</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {filteredDocuments.filter(d => d.documentOutputs.some(o => o.status === 'complete')).length}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500">Pending</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900">
                {filteredDocuments.filter(d => d.documentOutputs.every(o => o.status === 'pending')).length}
              </div>
            </div>
          </div>
        </div>

        {/* Document List */}
        <DocumentList
          documents={filteredDocuments}
          organization={organization}
          onSelectClients={handleSelectClients}
          onGenerateBase={handleGenerateBase}
          isAdmin={isAdmin}
          processingDocuments={processingDocuments}
        />

        {/* Client Selector Modal */}
        {isSelectorOpen && selectedDocument && (
          <ClientSelector
            document={selectedDocument}
            onClose={handleSelectorClose}
          />
        )}
      </div>
    </MainLayout>
  );
}
