'use client';

import { useState, useEffect } from 'react';
import { estimateMemoGenerationCost } from '@/lib/memo-generator';

interface Client {
  id: string;
  name: string;
  industry: string | null;
  focusAreas: string[];
}

interface Document {
  id: string;
  title: string;
  documentOutputs: Array<{
    id: string;
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

interface ClientSelectorProps {
  document: Document;
  onClose: () => void;
}

export function ClientSelector({ document, onClose }: ClientSelectorProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch clients
  useEffect(() => {
    async function fetchClients() {
      try {
        const response = await fetch('/api/clients');
        if (!response.ok) throw new Error('Failed to fetch clients');

        const data = await response.json();
        setClients(data.clients);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    fetchClients();
  }, []);

  const handleToggleClient = (clientId: string) => {
    const newSelected = new Set(selectedClientIds);
    if (newSelected.has(clientId)) {
      newSelected.delete(clientId);
    } else {
      newSelected.add(clientId);
    }
    setSelectedClientIds(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedClientIds.size === filteredClients.length) {
      setSelectedClientIds(new Set());
    } else {
      setSelectedClientIds(new Set(filteredClients.map(c => c.id)));
    }
  };

  const handleGenerate = async () => {
    if (selectedClientIds.size === 0) {
      alert('Please select at least one client');
      return;
    }

    if (!confirm(`Generate ${selectedClientIds.size} client memo(s)? This will use AI tokens.`)) {
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/${document.id}/generate-clients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_ids: Array.from(selectedClientIds),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate client memos');
      }

      const data = await response.json();
      const successCount = data.results.filter((r: any) => r.status === 'success').length;

      alert(`Successfully generated ${successCount} of ${selectedClientIds.size} client memos`);
      onClose();
    } catch (err: any) {
      setError(err.message);
      setIsGenerating(false);
    }
  };

  // Filter clients by search query
  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.industry?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    client.focusAreas.some(area => area.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const costEstimate = estimateMemoGenerationCost(selectedClientIds.size);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900">Select Clients for Memo Generation</h2>
              <p className="mt-2 text-sm text-gray-600">
                {document.title.substring(0, 100)}{document.title.length > 100 ? '...' : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Cost Estimate */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-900">
              <span className="font-medium">Estimated cost:</span> ${costEstimate.clientCost.toFixed(2)}
              {selectedClientIds.size > 0 && ` (${selectedClientIds.size} × $0.02)`}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Select All & Search */}
          <div className="mb-4 space-y-3">
            <button
              onClick={handleSelectAll}
              className="w-full px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
            >
              {selectedClientIds.size === filteredClients.length ? 'Deselect All' : `Select All (${filteredClients.length} clients)`}
            </button>

            <input
              type="text"
              placeholder="Search clients by name, industry, or focus areas..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Client List */}
          {isLoading ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Loading clients...</p>
            </div>
          ) : error ? (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No clients found</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClients.map((client) => (
                <label
                  key={client.id}
                  className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedClientIds.has(client.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start">
                    <input
                      type="checkbox"
                      checked={selectedClientIds.has(client.id)}
                      onChange={() => handleToggleClient(client.id)}
                      className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <div className="ml-3 flex-1">
                      <div className="font-medium text-gray-900">{client.name}</div>
                      {client.industry && (
                        <div className="text-sm text-gray-600 mt-1">{client.industry}</div>
                      )}
                      {client.focusAreas && client.focusAreas.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {client.focusAreas.map((area, idx) => (
                            <span
                              key={idx}
                              className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700 rounded"
                            >
                              {area}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Selected: <span className="font-medium">{selectedClientIds.size}</span> clients
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Est. cost: ${costEstimate.clientCost.toFixed(2)}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || selectedClientIds.size === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {isGenerating ? 'Generating...' : `Generate ${selectedClientIds.size} Memo${selectedClientIds.size !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
