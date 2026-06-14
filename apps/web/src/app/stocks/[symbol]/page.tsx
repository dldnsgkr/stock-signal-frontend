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
    const market = stock?.market?.code ?? 'US';
    const technicalLevels = await api.get<any>(
      `/stocks/${symbol}/technical-levels?market=${market}`,
    ).catch(() => null);
    return { stock, prices, news, recommendations, scoreHistory, technicalLevels };
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

  const { stock, prices, news, recommendations, scoreHistory, technicalLevels } = data;
  const latestRec = recommendations?.[0];
  const marketCode = stock.market?.code ?? 'US';
  const targets    = technicalLevels?.priceTargets ?? null;
  const forwardPE  = technicalLevels?.forwardPE   ?? null;
  const scenarios  = technicalLevels?.scenarios   ?? null;

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

          {(targets || scenarios || forwardPE) && (
            <Card>
              <CardHeader><CardTitle>가격 전망</CardTitle></CardHeader>
              <CardContent className="space-y-4">

                {/* 단기 범위 (ATR 기반) */}
                {(targets?.week1 || targets?.month1) && (
                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">단기 범위 (기술적)</p>
                    {targets?.week1 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">1주</span>
                          <span className="font-medium">{formatPrice(targets.week1.center, marketCode)}</span>
                        </div>
                        <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                          <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-red-200 via-muted to-green-200" />
                          <div className="absolute inset-y-0 flex items-center justify-between px-2 w-full text-[9px] font-medium">
                            <span className="text-red-600">{formatPrice(targets.week1.low, marketCode)}</span>
                            <span className="text-green-700">{formatPrice(targets.week1.high, marketCode)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    {targets?.month1 && (
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-muted-foreground">1달</span>
                          <span className="font-medium">{formatPrice(targets.month1.center, marketCode)}</span>
                        </div>
                        <div className="relative h-4 rounded-full bg-muted overflow-hidden">
                          <div className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-red-200 via-muted to-green-200" />
                          <div className="absolute inset-y-0 flex items-center justify-between px-2 w-full text-[9px] font-medium">
                            <span className="text-red-600">{formatPrice(targets.month1.low, marketCode)}</span>
                            <span className="text-green-700">{formatPrice(targets.month1.high, marketCode)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Forward P/E 목표가 */}
                {forwardPE && (
                  <div className="pt-1 border-t space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1년 Forward P/E 목표가</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-lg font-bold text-primary">{formatPrice(forwardPE.target, marketCode)}</span>
                      <span className={`text-sm font-semibold ${forwardPE.upside >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {forwardPE.upside >= 0 ? '+' : ''}{(forwardPE.upside * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>EPS 예상 {formatPrice(forwardPE.forwardEps, marketCode)} × P/E {forwardPE.fairPE}배</p>
                      {forwardPE.epsGrowth != null && (
                        <p>EPS 성장률 <span className={forwardPE.epsGrowth >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                          {forwardPE.epsGrowth >= 0 ? '+' : ''}{(forwardPE.epsGrowth * 100).toFixed(1)}%
                        </span></p>
                      )}
                      <p className="text-[10px]">섹터({forwardPE.sector}) 기준 P/E {forwardPE.sectorPE}배 적용</p>
                    </div>
                  </div>
                )}

                {/* Bull / Base / Bear 시나리오 */}
                {scenarios && (
                  <div className="pt-1 border-t space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">1년 시나리오</p>
                      {scenarios.analystCount && (
                        <span className="text-[10px] text-muted-foreground">애널리스트 {scenarios.analystCount}명</span>
                      )}
                    </div>

                    {/* 시나리오 바 */}
                    {(() => {
                      const bear  = scenarios.bear.price;
                      const base  = scenarios.base.price;
                      const bull  = scenarios.bull.price;
                      const cp    = technicalLevels?.currentPrice ?? base;
                      const min   = Math.min(bear, cp) * 0.97;
                      const max   = Math.max(bull, cp) * 1.03;
                      const range = max - min;
                      const pos   = (v: number) => `${Math.min(100, Math.max(0, ((v - min) / range) * 100)).toFixed(1)}%`;
                      return (
                        <div className="relative h-6 rounded-full bg-muted overflow-hidden my-1">
                          {/* bear → bull 그라데이션 */}
                          <div
                            className="absolute inset-y-0 bg-gradient-to-r from-red-300 via-amber-200 to-green-300 rounded-full"
                            style={{ left: pos(bear), right: `${(100 - parseFloat(pos(bull))).toFixed(1)}%` }}
                          />
                          {/* 현재가 마커 */}
                          <div className="absolute inset-y-0 w-0.5 bg-foreground/60" style={{ left: pos(cp) }} />
                          {/* 라벨 */}
                          <div className="absolute inset-0 flex items-center justify-between px-2 text-[9px] font-semibold">
                            <span className="text-red-700">{formatPrice(bear, marketCode)}</span>
                            <span className="text-foreground">{formatPrice(base, marketCode)}</span>
                            <span className="text-green-700">{formatPrice(bull, marketCode)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-3 gap-1 text-center">
                      {[
                        { label: '🐻 Bear', data: scenarios.bear, cls: 'text-red-500' },
                        { label: '⚖ Base',  data: scenarios.base, cls: 'text-foreground' },
                        { label: '🐂 Bull',  data: scenarios.bull, cls: 'text-green-600' },
                      ].map(({ label, data, cls }) => (
                        <div key={label} className="rounded-lg bg-muted/50 py-1.5 px-1">
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                          <p className={`text-xs font-bold ${cls}`}>{formatPrice(data.price, marketCode)}</p>
                          <p className={`text-[10px] font-medium ${cls}`}>
                            {data.upside >= 0 ? '+' : ''}{(data.upside * 100).toFixed(1)}%
                          </p>
                        </div>
                      ))}
                    </div>

                    <p className="text-[10px] text-muted-foreground">
                      출처: {scenarios.source === 'pe+analyst' ? 'Forward P/E + 애널리스트 컨센서스 평균'
                           : scenarios.source === 'analyst'    ? '애널리스트 컨센서스'
                           : 'Forward P/E 모델'}
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground border-t pt-2">
                  * 참고 자료이며 투자 권유가 아닙니다. 실제 결과는 크게 다를 수 있습니다.
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
