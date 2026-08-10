import { Badge } from '@/components/ui/Badge';
import { getActionLabel } from '@/lib/utils';

interface SignalBadgeProps {
  action: string;
}

export function SignalBadge({ action }: SignalBadgeProps) {
  const variant =
    action === 'BUY' ? 'buy' : action === 'WATCH' ? 'watch' : action === 'AVOID' ? 'avoid' : 'outline';
  // whitespace-nowrap 을 빼지 말 것 — 좁은 폭에서 '매수 시그널' 이
  // '매수 시그' / '널' 로 쪼개진다(2026-08-10 모바일에서 확인).
  return <Badge variant={variant} className="whitespace-nowrap">{getActionLabel(action)}</Badge>;
}
