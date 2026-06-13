'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

// ── 타입 ───────────────────────────────────────────────────────────────────
interface StrategyStats {
  count: number;
  portfolioReturn: number;
  benchmarkReturn: number | null;
  alpha: number | null;
  stdDev: number;
  sharpe: number | null;
  hitRate: number | null;
  bestReturn: number;
  worstReturn: number;
}

interface Position {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  score: number;
  confidence: number;
  entryPrice: number;
  recommendedAt: string;
  return: number | null;
  benchmark: number | null;
  alpha: number | null;
  hit: boolean | null;
  scoreRank: number;
}

interface DistPoint { range: string; count: number }

interface SimResult {
  market: string;
  period: string;
  horizon: string;
  totalRuns: number;
  strategies: {
    top5:  StrategyStats | null;
    top10: StrategyStats | null;
    top20: StrategyStats | null;
    all:   StrategyStats | null;
  };
  positions: Position[];
  distribution: DistPoint[];
}

type Market  = 'US' | 'KR';
type Period  = '30d' | '90d' | '180d';
type Horizon = '7d' | '30d';
type Strategy = 'top5' | 'top10' | 'top20' | 'all';
// ──────────────────────────────────────────────────────────────────────────

function pct(v: number | null, digits = 2) {
  if (v == null) return '-';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function ReturnPill({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground text-xs">-</span>;
  const cls = v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-muted-foreground';
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
  return (
    <span className={`inline-flex items-center gap-0.5 font-semibold text-xs ${cls}`}>
      <Icon className="h-3 w-3" />{pct(v)}
    </span>
  );
}

function HitBadge({ hit }: { hit: boolean | null }) {
  if (hit == null) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${hit ? 'bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400'}`}>
      {hit ? '수익' : '손실'}
    </span>
  );
}

// ── 전략 비교 카드 ──────────────────────────────────────────────────────────
const STRATEGY_META: Record<Strategy, { label: string; desc: string }> = {
  top5:  { label: 'Top 5',  desc: '런당 최고 점수 5종목' },
  top10: { label: 'Top 10', desc: '런당 최고 점수 10종목' },
  top20: { label: 'Top 20', desc: '런당 최고 점수 20종목' },
  all:   { label: '전체 BUY', desc: '모든 BUY 시그널' },
};

function StrategyCard({
  strategy, stats, selected, onClick,
}: {
  strategy: Strategy; stats: StrategyStats | null; selected: boolean; onClick: () => void;
}) {
  const meta = STRATEGY_META[strategy];
  const ret  = stats?.portfolioReturn ?? null;

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border p-4 text-left transition-all space-y-2 w-full ${
        selected ? 'border-primary ring-1 ring-primary bg-primary/5' : 'hover:bg-muted/50'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{meta.label}</span>
        <span className="text-xs text-muted-foreground">{stats?.count ?? '-'}건</span>
      </div>
      <p className={`text-2xl font-bold tabular-nums ${ret != null ? (ret > 0 ? 'text-green-600' : ret < 0 ? 'text-red-500' : '') : 'text-muted-foreground'}`}>
        {pct(ret)}
      </p>
      <div className="grid grid-cols-2 gap-x-3 text-xs text-muted-foreground">
        <span>알파 {pct(stats?.alpha ?? null, 2)}</span>
        <span>적중률 {stats?.hitRate != null ? `${(stats.hitRate * 100).toFixed(0)}%` : '-'}</span>
        <span>표준편차 {stats?.stdDev != null ? pct(stats.stdDev) : '-'}</span>
        <span>Sharpe {stats?.sharpe?.toFixed(2) ?? '-'}</span>
      </div>
      <p className="text-xs text-muted-foreground border-t pt-1">{meta.desc}</p>
    </button>
  );
}

// ── 수익률 분포 차트 ────────────────────────────────────────────────────────
function DistributionChart({ data }: { data: DistPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReactECharts>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) chartRef.current?.getEchartsInstance()?.resize({ width });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const option = {
    tooltip: { trigger: 'axis', formatter: (p: any[]) => `${p[0].axisValue}: ${p[0].value}건` },
    grid: { top: 8, left: 8, right: 16, bottom: 24, containLabel: true },
    xAxis: { type: 'category', data: data.map(d => d.range), axisLabel: { fontSize: 10, rotate: 30 } },
    yAxis: { type: 'value', axisLabel: { fontSize: 10 } },
    series: [{
      type: 'bar',
      data: data.map(d => ({
        value: d.count,
        itemStyle: {
          color: d.range.startsWith('+') || d.range === '0%' ? '#22c55e' : '#ef4444',
        },
      })),
      barMaxWidth: 32,
    }],
  };

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      {data.length === 0 ? null : (
        <ReactECharts ref={chartRef} option={option} style={{ height: '200px', width: '100%' }} />
      )}
    </div>
  );
}

// ── 메인 ────────────────────────────────────────────────────────────────────
export default function SimulationPage() {
  const [market,   setMarket]   = useState<Market>('US');
  const [period,   setPeriod]   = useState<Period>('90d');
  const [horizon,  setHorizon]  = useState<Horizon>('7d');
  const [strategy, setStrategy] = useState<Strategy>('top10');
  const [result,   setResult]   = useState<SimResult | null>(null);
  const [loading,  setLoading]  = useState(true);

  const fetchSim = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy?endpoint=/performance/simulation&market=${market}&period=${period}&horizon=${horizon}`,
      );
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }, [market, period, horizon]);

  useEffect(() => { fetchSim(); }, [fetchSim]);

  const stats     = result?.strategies[strategy] ?? null;
  const positions = result?.positions.filter(p =>
    strategy === 'all'  ? true :
    strategy === 'top5' ? p.scoreRank <= 5 :
    strategy === 'top10'? p.scoreRank <= 10 : p.scoreRank <= 20
  ) ?? [];

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">포트폴리오 시뮬레이션</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            과거 BUY 시그널을 동일 비중으로 매수했을 때의 가상 성과
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* 마켓 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['US', 'KR'] as Market[]).map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${market === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {m === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}
              </button>
            ))}
          </div>
          {/* 기간 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {([['30d','30일'],['90d','90일'],['180d','180일']] as [Period,string][]).map(([v,l]) => (
              <button key={v} onClick={() => setPeriod(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${period === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
          {/* 수익률 기준 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {([['7d','7일 수익률'],['30d','30일 수익률']] as [Horizon,string][]).map(([v,l]) => (
              <button key={v} onClick={() => setHorizon(v)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${horizon === v ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !result ? (
        <p className="text-center text-muted-foreground py-16">데이터를 불러올 수 없습니다</p>
      ) : (
        <div className="space-y-5">
          {/* 안내 배너 */}
          <div className="flex items-start gap-2 rounded-lg border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              {result.totalRuns}회 파이프라인 실행 기간 ({period}) 동안 BUY 시그널 종목을
              동일 비중으로 매수했다고 가정한 백테스트입니다.
              슬리피지·수수료 미반영, 과거 성과가 미래를 보장하지 않습니다.
            </span>
          </div>

          {/* 전략 선택 카드 */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(['top5','top10','top20','all'] as Strategy[]).map(s => (
              <StrategyCard
                key={s}
                strategy={s}
                stats={result.strategies[s]}
                selected={strategy === s}
                onClick={() => setStrategy(s)}
              />
            ))}
          </div>

          {/* 선택된 전략 상세 + 분포 차트 */}
          {stats && (
            <div className="grid gap-4 lg:grid-cols-5">
              {/* 상세 지표 */}
              <Card className="lg:col-span-2">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">{STRATEGY_META[strategy].label} 상세 지표</p>
                </div>
                <CardContent className="pt-4">
                  <dl className="space-y-3 text-sm">
                    {[
                      { label: '포트폴리오 수익률', value: pct(stats.portfolioReturn), trend: stats.portfolioReturn },
                      { label: '벤치마크 수익률',   value: pct(stats.benchmarkReturn), trend: stats.benchmarkReturn },
                      { label: '초과 수익 (Alpha)', value: pct(stats.alpha),           trend: stats.alpha },
                      { label: '적중률',            value: stats.hitRate != null ? `${(stats.hitRate*100).toFixed(1)}%` : '-', trend: stats.hitRate != null ? stats.hitRate - 0.5 : null },
                      { label: '변동성 (StdDev)',   value: pct(stats.stdDev), trend: null },
                      { label: 'Sharpe Ratio',      value: stats.sharpe?.toFixed(2) ?? '-', trend: stats.sharpe },
                      { label: '최고 수익',          value: pct(stats.bestReturn),  trend: stats.bestReturn },
                      { label: '최저 수익',          value: pct(stats.worstReturn), trend: stats.worstReturn },
                      { label: '총 포지션',          value: `${stats.count}개`, trend: null },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between gap-4">
                        <dt className="text-muted-foreground">{row.label}</dt>
                        <dd className={`font-semibold tabular-nums ${row.trend != null ? (row.trend > 0 ? 'text-green-600' : row.trend < 0 ? 'text-red-500' : '') : ''}`}>
                          {row.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>

              {/* 수익률 분포 */}
              <Card className="lg:col-span-3">
                <div className="border-b px-4 py-3">
                  <p className="text-sm font-semibold">전체 시그널 수익률 분포</p>
                  <p className="text-xs text-muted-foreground">5% 구간별 종목 수</p>
                </div>
                <CardContent className="pt-3">
                  <DistributionChart data={result.distribution} />
                </CardContent>
              </Card>
            </div>
          )}

          {/* 포지션 테이블 */}
          <Card>
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <p className="text-sm font-semibold">포지션 목록</p>
              <span className="text-xs text-muted-foreground">{STRATEGY_META[strategy].label} · {positions.length}건</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">순위</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">종목</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">섹터</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">점수</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">진입가</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">수익률</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">알파</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">결과</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">추천일</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {positions.map(p => (
                    <tr key={p.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2 text-muted-foreground">#{p.scoreRank}</td>
                      <td className="px-3 py-2">
                        <span className="font-semibold">{p.symbol}</span>
                        <span className="ml-1 text-muted-foreground">{p.name.slice(0,14)}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{p.sector?.split(' ')[0] ?? '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="rounded bg-primary/10 text-primary px-1 py-0.5">{p.score.toFixed(0)}</span>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{p.entryPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right"><ReturnPill v={p.return} /></td>
                      <td className="px-3 py-2 text-right"><ReturnPill v={p.alpha} /></td>
                      <td className="px-3 py-2 text-center"><HitBadge hit={p.hit} /></td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{fmtDate(p.recommendedAt)}</td>
                    </tr>
                  ))}
                  {positions.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">
                        데이터가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
