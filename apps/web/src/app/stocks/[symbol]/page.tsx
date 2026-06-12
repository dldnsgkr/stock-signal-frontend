import { api } from '@/lib/api';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { SignalBadge } from '@/components/recommendation/SignalBadge';
import { PriceChartSection } from '@/components/charts/PriceChartSection';
import { ScoreRadarChart } from '@/components/charts/ScoreRadarChart';
import { NewsItem } from '@/components/news/NewsItem';
import { formatPrice, formatDate, formatPercent } from '@/lib/utils';
import { BackButton } from '@/components/ui/BackButton';

interface PageProps {
  params: Promise<{ symbol: string }>;
}

async function getStockData(symbol: string) {
  try {
    const [stock, prices, news, recommendations] = await Promise.all([
      api.get<any>(`/stocks/${symbol}`),
      Promise.resolve([]),
      api.get<any>(`/stocks/${symbol}/news?limit=5`),
      api.get<any>(`/recommendations/stock/${symbol}?limit=5`),
    ]);
    return { stock, prices, news, recommendations };
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

  const { stock, news, recommendations } = data;
  const latestRec = recommendations?.[0];

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
              <PriceChartSection symbol={stock.symbol} market={stock.market?.code ?? 'US'} />
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
                  진입가: {formatPrice(latestRec.entryPrice)} · {formatDate(latestRec.recommendedAt)}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>추천 이력</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {recommendations?.map((rec: any) => (
                  <div key={rec.id} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <SignalBadge action={rec.action} />
                      <span className="text-muted-foreground">{formatDate(rec.recommendedAt)}</span>
                    </div>
                    {rec.result?.return7d != null && (
                      <span className={rec.result.return7d >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {formatPercent(rec.result.return7d)}
                      </span>
                    )}
                  </div>
                )) ?? <p className="text-muted-foreground">이력 없음</p>}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
