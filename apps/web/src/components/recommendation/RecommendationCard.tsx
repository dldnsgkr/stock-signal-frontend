import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { SignalBadge } from './SignalBadge';
import { AgreementScore } from './AgreementScore';
import { BandPerformance } from './BandPerformance';
import { formatPrice, formatPercent } from '@/lib/utils';
import { fmtMarketDateNum } from '@/lib/marketTime';

interface RecommendationCardProps {
  recommendation: {
    id: number;
    stock: { symbol: string; name: string; sector: string | null; market?: string | { code: string } | null };
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
  // API는 market을 문자열('KR')로 내려주지만, 과거 객체 형태({ code })도 방어적으로 처리
  const market = typeof rec.stock.market === 'string' ? rec.stock.market : rec.stock.market?.code ?? 'US';
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="pt-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <SignalBadge action={rec.action} />
              <AgreementScore
                value={rec.confidence}
                market={market}
                withLabel
                className="text-xs text-muted-foreground border-b border-dotted border-muted-foreground/40"
              />
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

        {/* 이 점수대가 과거에 실제로 어땠는지. 화면은 점수 높은 순으로 정렬하는데
            실측 곡선은 ∩자라 최상단이 가장 나쁘다 — 그 사실을 숨기지 않는다. */}
        <BandPerformance market={market} score={rec.score} />

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">{fmtMarketDateNum(rec.recommendedAt, market)}</span>
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
