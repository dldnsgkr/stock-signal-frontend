import { api } from '@/lib/api';
import { StatCard } from '@/components/ui/StatCard';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { RecommendationCard } from '@/components/recommendation/RecommendationCard';
import { TrendingUp, Activity } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ market?: string }>;
}

async function getData(market: string) {
  try {
    const [recs, buyCount, watchCount, perf] = await Promise.all([
      api.get<any>(`/recommendations/latest?market=${market}&pageSize=6`),
      api.get<any>(`/recommendations/latest?market=${market}&action=BUY&pageSize=1`),
      api.get<any>(`/recommendations/latest?market=${market}&action=WATCH&pageSize=1`),
      api.get<any>(`/performance/overview?market=${market}&period=7d`),
    ]);
    return { recs, buyTotal: buyCount.total ?? 0, watchTotal: watchCount.total ?? 0, perf };
  } catch {
    return { recs: null, buyTotal: 0, watchTotal: 0, perf: null };
  }
}

const MARKET_LABEL: Record<string, string> = {
  US: '미국',
  KR: '한국',
};

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const market = params.market || 'US';
  const marketLabel = MARKET_LABEL[market] ?? market;

  const { recs, buyTotal, watchTotal, perf } = await getData(market);
  const topBuy = recs?.data?.filter((r: any) => r.action === 'BUY').slice(0, 3) ?? [];
  const hitRate = perf?.hitRate7d ?? null;
  const today = new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold">대시보드</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{today} · {marketLabel} 시장</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="오늘 매수 시그널"
          value={recs ? buyTotal : '-'}
          subtitle="종목 수"
        />
        <StatCard
          title="7일 적중률"
          value={hitRate != null ? `${(hitRate * 100).toFixed(1)}%` : '-'}
          subtitle="BUY 시그널 기준"
        />
        <StatCard
          title="관심 종목"
          value={recs ? watchTotal : '-'}
          subtitle="WATCH 시그널"
        />
        <StatCard
          title="총 분석 종목"
          value={recs?.total ?? '-'}
          subtitle={`${marketLabel} 시장`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-green-600" />
              오늘의 상위 매수 시그널
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {topBuy.length > 0 ? (
              topBuy.map((rec: any) => (
                <RecommendationCard key={rec.id} recommendation={rec} />
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                데이터를 불러오는 중입니다
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              시장 요약
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md bg-muted p-3">
                <span className="text-sm font-medium">{marketLabel} 시장</span>
                <span className="text-xs text-muted-foreground">
                  {market === 'KR' ? '장 마감 후 분석 (KST)' : '장 마감 후 분석 (ET)'}
                </span>
              </div>
              {perf && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">7일 평균 수익률</p>
                    <p className={`text-lg font-bold ${perf.avgReturn7d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {perf.avgReturn7d != null ? `${(perf.avgReturn7d * 100).toFixed(2)}%` : '-'}
                    </p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-xs text-muted-foreground">30일 평균 수익률</p>
                    <p className={`text-lg font-bold ${perf.avgReturn30d >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {perf.avgReturn30d != null ? `${(perf.avgReturn30d * 100).toFixed(2)}%` : '-'}
                    </p>
                  </div>
                </div>
              )}
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3">
                <p className="text-xs text-amber-700">
                  본 서비스는 데이터 기반 분석 시그널을 제공합니다. 투자 결정은 개인 책임이며,
                  실제 투자 손익에 대한 법적 책임을 지지 않습니다.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
