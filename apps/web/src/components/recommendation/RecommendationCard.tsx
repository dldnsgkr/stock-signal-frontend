import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { SignalBadge } from './SignalBadge';
import { formatPrice, formatPercent, formatDate } from '@/lib/utils';

interface RecommendationCardProps {
  recommendation: {
    id: number;
    stock: { symbol: string; name: string; sector: string | null; market?: { code: string } | null };
    action: string;
    score: number;
    confidence: number;
    entryPrice: number;
    reasons: string[];
    recommendedAt: string;
    result?: { return7d: number | null; hit7d: boolean | null } | null;
  };
}

export function RecommendationCard({ recommendation: rec }: RecommendationCardProps) {
  const market = rec.stock.market?.code ?? 'US';
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <SignalBadge action={rec.action} />
              <span className="text-xs text-muted-foreground">신뢰도 {rec.confidence}%</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-base">{rec.stock.symbol}</span>
              <span className="text-sm text-muted-foreground truncate">{rec.stock.name}</span>
            </div>
            {rec.stock.sector && (
              <span className="text-xs text-muted-foreground">{rec.stock.sector}</span>
            )}
          </div>
          <div className="text-right shrink-0">
            <div className="text-sm font-semibold">{formatPrice(rec.entryPrice, market)}</div>
            <div className="text-xs text-muted-foreground">점수 {rec.score.toFixed(1)}</div>
            {rec.result?.return7d != null && (
              <div className={`text-xs font-medium ${rec.result.return7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                7일: {formatPercent(rec.result.return7d)}
              </div>
            )}
          </div>
        </div>

        {rec.reasons.length > 0 && (
          <div className="mt-3 space-y-1">
            {rec.reasons.slice(0, 2).map((reason, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary mt-0.5">•</span>
                {reason}
              </p>
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{formatDate(rec.recommendedAt)}</span>
          <Link
            href={`/stocks/${rec.stock.symbol}`}
            className="flex items-center gap-0.5 text-xs text-primary hover:underline"
          >
            상세보기 <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
