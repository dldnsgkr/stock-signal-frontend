import { Badge } from '@/components/ui/Badge';
import { getActionLabel } from '@/lib/utils';

interface SignalBadgeProps {
  action: string;
}

export function SignalBadge({ action }: SignalBadgeProps) {
  const variant =
    action === 'BUY' ? 'buy' : action === 'WATCH' ? 'watch' : action === 'AVOID' ? 'avoid' : 'outline';
  return <Badge variant={variant}>{getActionLabel(action)}</Badge>;
}
