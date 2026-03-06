import { Badge } from '@/components/ui/Badge';

interface Props {
  status: 'pending' | 'processing' | 'ready' | 'error' | string;
}

const statusConfig: Record<string, { label: string; variant: 'warning' | 'success' | 'error' | 'default' }> = {
  pending:    { label: 'Pending',    variant: 'warning' },
  processing: { label: 'Processing…', variant: 'warning' },
  ready:      { label: 'Ready',      variant: 'success' },
  error:      { label: 'Error',      variant: 'error' },
};

export function DocumentStatusBadge({ status }: Props) {
  const config = statusConfig[status] ?? { label: status, variant: 'default' };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
