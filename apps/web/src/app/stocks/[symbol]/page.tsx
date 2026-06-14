import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SignalBadge } from '@/components/recommendation/SignalBadge';
import { PriceChartSection } from '@/components/charts/PriceChartSection';
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart';
import { NewsItem } from '@/components/news/NewsItem';
import { formatPrice, formatDate, formatPercent } from '@/lib/utils';
import { BackButton } from '@/components/ui/BackButton';
import { SubscriptionWidget } from '@/components/stocks/SubscriptionWidget';
import { ScoreTrendChart } from '@/components/charts/ScoreTrendChart';
import { TrendingDown, ArrowRight } from 'lucide-react';

interface PageProps {
  params: Promise<{ symbol: string }>;
}

async function getStockData(symbol: string) {
  try {
    const [stock, prices, news, recommendations, scoreHistory] = await Promise.all([
      api.get<any>(`/stocks/${symbol}`),
      api.get<any[]>(`/stocks/${symbol}/prices?days=90`).catch(() => []),
      api.get<any>(`/stocks/${symbol}/news?limit=5`),
      api.get<any[]>(`/stocks/${symbol}/recommendations?limit=10`),
      api.get<any[]>(`/stocks/${symbol}/score-history?days=90`).catch(() => []),
    ]);
    return { stock, prices, news, recommendations, scoreHistory };
  } catch {
    return null;
  }
}

export default async function StockDetailPage({ params }: PageProps) {
  const { symbol } = await params;
  const data = await getStockData(symbol.toUpperCase());

  if (!data?.stock) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        종목을 찾을 수 없습니다
      </div>
    );
  }

  const { stock, prices, news, recommendations, scoreHistory } = data;
  const latestRec = recommendations?.[0];
  const marketCode = stock.market?.code ?? 'US';

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <BackButton />
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold">{stock.symbol}</h1>
            {latestRec && <SignalBadge action={latestRec.action} />}
          </div>
          <p className="text-sm text-muted-foreground">
            {stock.name} · {stock.sector} · {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>가격 차트</CardTitle>
            </CardHeader>
            <CardContent>
              <PriceChartSection
                symbol={stock.symbol}
                market={stock.market?.code ?? 'US'}
                initialData={prices?.map((p: any) => ({ date: p.date, close: Number(p.close), volume: Number(p.volume) }))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>관련 뉴스</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-1">
                {news && news.length > 0
                  ? news.map((n: any) => (
                      <NewsItem
                        key={n.id}
                        id={n.id}
                        title={n.title}
                        summary={n.summary}
                        url={n.url}
                        source={n.source}
                        publishedAt={n.publishedAt}
                        sentimentScore={n.sentimentScore}
                      />
                    ))
                  : <p className="text-sm text-muted-foreground py-4 text-center">뉴스 없음</p>
                }
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          {latestRec && (
            <Card>
              <CardHeader><CardTitle>최신 시그널 분석</CardTitle></CardHeader>
              <CardContent>
                <div className="text-center mb-3">
                  <div className="text-3xl font-bold">{Number(latestRec.score).toFixed(1)}</div>
                  <div className="text-xs text-muted-foreground">종합 점수 / 100</div>
                </div>
                {latestRec.scoreDetail && (
                  <ScoreRadarChart scoreDetail={{
                    technicalScore: latestRec.scoreDetail.technical_score,
                    fundamentalScore: latestRec.scoreDetail.fundamental_score,
                    newsScore: latestRec.scoreDetail.news_score,
                    macroScore: latestRec.scoreDetail.macro_score,
                    flowScore: latestRec.scoreDetail.flow_score,
                  }} />
                )}
                <div className="mt-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">시그널 근거</p>
                  {latestRec.reasons?.map((r: string, i: number) => (
                    <p key={i} className="text-xs flex items-start gap-1">
                      <span className="text-primary">•</span>{r}
                    </p>
                  ))}
                </div>
                <div className="mt-3 text-xs text-muted-foreground">
                  진입가: {formatPrice(latestRec.entryPrice, marketCode)} · {formatDate(latestRec.recommendedAt)}
                </div>
              </CardContent>
            </Card>
          )}

          {scoreHistory && scoreHistory.length > 0 && (
            <Card>
              <CardHeader><CardTitle>점수 트렌드</CardTitle></CardHeader>
              <CardContent className="pb-3">
                <ScoreTrendChart data={scoreHistory} />
                <p className="text-[10px] text-muted-foreground mt-1">
                  녹색 점선 BUY(65) · 노란 점선 WATCH(45) 기준
                </p>
              </CardContent>
            </Card>
          )}

          <SubscriptionWidget symbol={stock.symbol} stockName={stock.name} />

          <Card>
            <CardHeader><CardTitle>추천 이력</CardTitle></CardHeader>
            <CardContent>
              {!recommendations || recommendations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">이력 없음</p>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((rec: any) => {
                    const sell = rec.sellSignal;
                    const ret7d = rec.result?.return7d;
                    const hasReturn = ret7d != null;
                    const isPositive = hasReturn && ret7d >= 0;
                    return (
                      <div key={rec.id} className="rounded-lg border bg-muted/20 p-3 text-xs space-y-2">
                        {/* 진입 행 */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <SignalBadge action="BUY" />
                            <span className="font-medium">{formatPrice(rec.entryPrice, marketCode)}</span>
                          </div>
                          <span className="text-muted-foreground">{formatDate(rec.recommendedAt)}</span>
                        </div>

                        {/* 청산 행 (SELL 시그널 있을 때) */}
                        {sell && (
                          <div className="flex items-center justify-between pl-1 border-l-2 border-red-400/60">
                            <div className="flex items-center gap-2 text-red-500">
                              <TrendingDown className="h-3 w-3" />
                              <span className="font-medium">SELL</span>
                              {sell.exitPrice && (
                                <>
                                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                  <span className="text-foreground font-medium">{formatPrice(sell.exitPrice, marketCode)}</span>
                                </>
                              )}
                            </div>
                            <span className="text-muted-foreground">{formatDate(sell.generatedAt)}</span>
                          </div>
                        )}

                        {/* 수익률 */}
                        {hasReturn && (
                          <div className="flex items-center justify-between pt-1 border-t border-border/50">
                            <span className="text-muted-foreground">7일 수익률</span>
                            <span className={isPositive ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>
                              {formatPercent(ret7d)}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
