'use client';

interface Client {
  id: string;
  name: string;
  context: string;
  industry: string | null;
  focusAreas: string[];
  isActive: boolean;
}

interface ClientListProps {
  clients: Client[];
  onEdit: (client: Client) => void;
  onDelete: (clientId: string) => void;
  showInactive?: boolean;
}

export function ClientList({ clients, onEdit, onDelete, showInactive = false }: ClientListProps) {
  const handleDelete = async (client: Client) => {
    if (!confirm(`Are you sure you want to deactivate ${client.name}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/clients/${client.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to deactivate client');
      }

      onDelete(client.id);
    } catch (error) {
      console.error('Error deactivating client:', error);
      alert('Failed to deactivate client');
    }
  };

  if (clients.length === 0) {
    return (
      <div className="bg-white dark:bg-[#1A2332] rounded-lg shadow p-12 text-center">
        <p className="text-gray-500 dark:text-slate-400">
          {showInactive ? 'No inactive clients' : 'No clients yet. Add your first client to get started.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {clients.map((client) => (
        <div
          key={client.id}
          className={`bg-white dark:bg-[#1A2332] rounded-lg shadow p-6 ${!client.isActive ? 'opacity-60' : ''}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{client.name}</h3>
                {!client.isActive && (
                  <span className="px-2 py-1 text-xs font-medium bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400 rounded">
                    Inactive
                  </span>
                )}
              </div>

              {client.industry && (
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                  Industry: {client.industry}
                </p>
              )}

              {client.focusAreas && client.focusAreas.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {client.focusAreas.map((area, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
                    >
                      {area}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <p className="text-sm font-medium text-gray-700 dark:text-slate-300">Context:</p>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-400 whitespace-pre-wrap">
                  {client.context}
                </p>
              </div>
            </div>

            <div className="ml-4 flex flex-col gap-2">
              <button
                onClick={() => onEdit(client)}
                className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
              >
                Edit
              </button>
              {client.isActive && (
                <button
                  onClick={() => handleDelete(client)}
                  className="px-3 py-1 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
                >
                  Deactivate
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
