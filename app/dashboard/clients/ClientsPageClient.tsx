'use client';

import { useState } from 'react';
import { ClientList } from '@/components/clients/ClientList';
import { ClientForm } from '@/components/clients/ClientForm';

interface Client {
  id: string;
  name: string;
  context: string;
  industry: string | null;
  focusAreas: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface Organization {
  id: string;
  name: string;
  slug: string;
}

interface ClientsPageClientProps {
  clients: Client[];
  organization: Organization;
}

export function ClientsPageClient({ clients: initialClients, organization }: ClientsPageClientProps) {
  const [clients, setClients] = useState<Client[]>(initialClients);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  const handleClientCreated = (newClient: Client) => {
    setClients([...clients, newClient]);
    setIsFormOpen(false);
  };

  const handleClientUpdated = (updatedClient: Client) => {
    setClients(clients.map(c => c.id === updatedClient.id ? updatedClient : c));
    setEditingClient(null);
  };

  const handleClientDeleted = (clientId: string) => {
    setClients(clients.map(c => c.id === clientId ? { ...c, isActive: false } : c));
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingClient(null);
  };

  const activeClients = clients.filter(c => c.isActive);
  const inactiveClients = clients.filter(c => !c.isActive);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0A1628]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clients</h1>
              <p className="mt-2 text-gray-600 dark:text-slate-400">
                Manage clients for {organization.name}
              </p>
            </div>
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              + Add Client
            </button>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="bg-white dark:bg-[#1A2332] rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Active Clients</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                {activeClients.length}
              </div>
            </div>
            <div className="bg-white dark:bg-[#1A2332] rounded-lg shadow p-6">
              <div className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Clients</div>
              <div className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
                {clients.length}
              </div>
            </div>
          </div>
        </div>

        {/* Client Form Modal */}
        {isFormOpen && (
          <ClientForm
            client={editingClient}
            onSuccess={editingClient ? handleClientUpdated : handleClientCreated}
            onCancel={handleCloseForm}
          />
        )}

        {/* Client List */}
        <ClientList
          clients={activeClients}
          onEdit={handleEdit}
          onDelete={handleClientDeleted}
        />

        {/* Inactive Clients */}
        {inactiveClients.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Inactive Clients</h2>
            <ClientList
              clients={inactiveClients}
              onEdit={handleEdit}
              onDelete={handleClientDeleted}
              showInactive
            />
          </div>
        )}
      </div>
    </div>
  );
}
