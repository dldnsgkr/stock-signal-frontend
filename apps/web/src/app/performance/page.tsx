'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import ReactECharts from 'echarts-for-react';

const PROXY = '/api/proxy';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react';

// ── 타입 ───────────────────────────────────────────────────────────────────
interface Overview {
  period: string;
  totalRecommendations: number;
  hitRate7d: number;
  hitRate30d: number;
  avgReturn7d: number;
  avgReturn30d: number;
}

interface TimelinePoint {
  week: string;
  avgReturn7d: number | null;
  avgBenchmark7d: number | null;
  avgAlpha7d: number | null;
  count: number;
}

interface SectorRow {
  sector: string;
  total: number;
  hitRate: number;
  avgReturn7d: number | null;
  avgAlpha7d: number | null;
}

interface RecRow {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  score: number;
  confidence: number;
  entryPrice: number;
  recommendedAt: string;
  return1d: number | null;
  return7d: number | null;
  return30d: number | null;
  alpha7d: number | null;
  alpha30d: number | null;
  hit1d: boolean | null;
  hit7d: boolean | null;
  hit30d: boolean | null;
}
// ──────────────────────────────────────────────────────────────────────────

type Market = 'US' | 'KR';
type Period = '7d' | '30d' | '90d';

function pct(v: number | null | undefined, digits = 1) {
  if (v == null) return '-';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(digits)}%`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function ReturnCell({ v }: { v: number | null }) {
  if (v == null) return <span className="text-muted-foreground text-xs">-</span>;
  const cls = v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-muted-foreground';
  const Icon = v > 0 ? TrendingUp : v < 0 ? TrendingDown : Minus;
  return (
    <span className={`flex items-center gap-0.5 font-medium text-xs ${cls}`}>
      <Icon className="h-3 w-3" />
      {pct(v)}
    </span>
  );
}

function HitBadge({ hit }: { hit: boolean | null }) {
  if (hit == null) return <span className="text-muted-foreground text-xs">-</span>;
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${hit ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' : 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400'}`}>
      {hit ? '적중' : '미적중'}
    </span>
  );
}

// ── 차트: 주별 수익률 추이 ──────────────────────────────────────────────────
function TimelineChart({ data }: { data: TimelinePoint[] }) {
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

  const weeks = data.map(d => fmtDate(d.week));
  const signals = data.map(d => d.avgReturn7d != null ? +(d.avgReturn7d * 100).toFixed(2) : null);
  const benchmarks = data.map(d => d.avgBenchmark7d != null ? +(d.avgBenchmark7d * 100).toFixed(2) : null);

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any[]) =>
        `${params[0].axisValue}<br/>` +
        params.map((p: any) => `${p.marker}${p.seriesName}: <b>${p.value != null ? (p.value > 0 ? '+' : '') + p.value + '%' : '-'}</b>`).join('<br/>'),
    },
    legend: { data: ['시그널 평균', '벤치마크'], bottom: 0, textStyle: { fontSize: 11 } },
    grid: { top: 16, left: 48, right: 16, bottom: 36 },
    xAxis: { type: 'category', data: weeks, axisLabel: { fontSize: 10 } },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, formatter: (v: number) => `${v > 0 ? '+' : ''}${v}%` },
      splitLine: { lineStyle: { type: 'dashed', color: '#e5e7eb' } },
    },
    series: [
      {
        name: '시그널 평균',
        type: 'line',
        data: signals,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { color: '#3b82f6', width: 2 },
        itemStyle: { color: '#3b82f6' },
        areaStyle: { color: 'rgba(59,130,246,0.08)' },
        connectNulls: true,
      },
      {
        name: '벤치마크',
        type: 'line',
        data: benchmarks,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#94a3b8', width: 1.5, type: 'dashed' },
        itemStyle: { color: '#94a3b8' },
        connectNulls: true,
      },
    ],
  };

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          평가 완료된 추천 데이터가 없습니다
        </div>
      ) : (
        <ReactECharts ref={chartRef} option={option} style={{ height: '220px', width: '100%' }} />
      )}
    </div>
  );
}

// ── 차트: 섹터별 수익률 ────────────────────────────────────────────────────
function SectorChart({ data }: { data: SectorRow[] }) {
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

  const sorted = [...data].sort((a, b) => (a.avgReturn7d ?? 0) - (b.avgReturn7d ?? 0));
  const sectors = sorted.map(d => d.sector);
  const returns = sorted.map(d => d.avgReturn7d != null ? +(d.avgReturn7d * 100).toFixed(2) : 0);
  const colors = returns.map(v => v >= 0 ? '#22c55e' : '#ef4444');

  const option = {
    tooltip: {
      trigger: 'axis',
      formatter: (p: any[]) => {
        const row = sorted[p[0].dataIndex];
        return `${p[0].axisValue}<br/>수익률: <b>${p[0].value > 0 ? '+' : ''}${p[0].value}%</b><br/>적중률: <b>${(row.hitRate * 100).toFixed(0)}%</b> (${row.total}건)`;
      },
    },
    grid: { top: 8, left: 8, right: 52, bottom: 8, containLabel: true },
    xAxis: { type: 'value', axisLabel: { fontSize: 10, formatter: (v: number) => `${v}%` } },
    yAxis: { type: 'category', data: sectors, axisLabel: { fontSize: 10 } },
    series: [{
      type: 'bar',
      data: returns.map((v, i) => ({ value: v, itemStyle: { color: colors[i] } })),
      label: { show: true, position: 'right', fontSize: 10, formatter: (p: any) => `${p.value > 0 ? '+' : ''}${p.value}%` },
      barMaxWidth: 20,
    }],
  };

  return (
    <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
      {data.length === 0 ? (
        <div className="flex h-52 items-center justify-center text-sm text-muted-foreground">
          데이터 없음
        </div>
      ) : (
        <ReactECharts ref={chartRef} option={option} style={{ height: `${Math.max(180, sorted.length * 32)}px`, width: '100%' }} />
      )}
    </div>
  );
}

// ── 메인 페이지 ────────────────────────────────────────────────────────────
export default function PerformancePage() {
  const [market, setMarket] = useState<Market>('US');
  const [period, setPeriod] = useState<Period>('30d');

  const [overview, setOverview] = useState<Overview | null>(null);
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [sectors, setSectors] = useState<SectorRow[]>([]);
  const [recs, setRecs] = useState<RecRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const tlPeriod = period === '7d' ? '30d' : period === '30d' ? '90d' : '90d';
    try {
      const [ovRes, tlRes, secRes, recRes] = await Promise.all([
        fetch(`${PROXY}?endpoint=/performance/overview&market=${market}&period=${period}`),
        fetch(`${PROXY}?endpoint=/performance/timeline&market=${market}&period=${tlPeriod}`),
        fetch(`${PROXY}?endpoint=/performance/by-sector&market=${market}&period=${period}`),
        fetch(`${PROXY}?endpoint=/performance/recommendations&market=${market}&period=${period}&limit=100`),
      ]);
      const [ov, tl, sec, rec] = await Promise.all([ovRes.json(), tlRes.json(), secRes.json(), recRes.json()]);
      setOverview(ov);
      setTimeline(Array.isArray(tl) ? tl : []);
      setSectors(Array.isArray(sec) ? sec : []);
      setRecs(Array.isArray(rec) ? rec : []);
    } finally {
      setLoading(false);
    }
  }, [market, period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const noData = !loading && overview?.totalRecommendations === 0;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">성과 리포트</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            BUY 시그널 이후 실제 수익률 및 벤치마크 대비 알파 분석
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* 마켓 토글 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['US', 'KR'] as Market[]).map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${market === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {m === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}
              </button>
            ))}
          </div>
          {/* 기간 토글 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['7d', '30d', '90d'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${period === p ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                {p === '7d' ? '7일' : p === '30d' ? '30일' : '90일'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : noData ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-2">
          <p className="text-sm">선택한 기간에 평가 완료된 시그널이 없습니다.</p>
          <p className="text-xs">시그널 생성 후 1일/7일/30일이 지나야 성과가 집계됩니다.</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: '평가 완료 추천', value: overview?.totalRecommendations?.toLocaleString() ?? '-', sub: 'BUY 시그널' },
              { label: '7일 적중률', value: overview?.hitRate7d != null ? `${(overview.hitRate7d * 100).toFixed(1)}%` : '-', sub: '양의 수익 발생 비율', trend: overview?.hitRate7d != null ? overview.hitRate7d - 0.5 : null },
              { label: '30일 적중률', value: overview?.hitRate30d != null ? `${(overview.hitRate30d * 100).toFixed(1)}%` : '-', sub: '양의 수익 발생 비율', trend: overview?.hitRate30d != null ? overview.hitRate30d - 0.5 : null },
              { label: '7일 평균 수익률', value: pct(overview?.avgReturn7d ?? null), sub: '시그널 포트폴리오', trend: overview?.avgReturn7d ?? null },
            ].map(card => (
              <Card key={card.label}>
                <CardContent className="pt-4 pb-4">
                  <p className="text-xs text-muted-foreground">{card.label}</p>
                  <p className={`mt-1 text-2xl font-bold tabular-nums ${card.trend != null ? (card.trend > 0 ? 'text-green-600' : card.trend < 0 ? 'text-red-500' : '') : ''}`}>
                    {card.value}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* 차트 2열 */}
          <div className="grid gap-4 lg:grid-cols-5">
            <Card className="lg:col-span-3 min-w-0 overflow-hidden">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">주별 평균 수익률 추이</p>
                <p className="text-xs text-muted-foreground">시그널 vs 벤치마크 (7일 기준)</p>
              </div>
              <CardContent className="pt-3">
                <TimelineChart data={timeline} />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2 min-w-0 overflow-hidden">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">섹터별 평균 수익률</p>
                <p className="text-xs text-muted-foreground">7일 기준 · BUY 시그널</p>
              </div>
              <CardContent className="pt-3">
                <SectorChart data={sectors} />
              </CardContent>
            </Card>
          </div>

          {/* 개별 추천 테이블 */}
          <Card>
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <p className="text-sm font-semibold">개별 추천 성과</p>
              <span className="text-xs text-muted-foreground ml-auto">{recs.length}건</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">종목</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">섹터</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">신뢰도</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">진입가</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">7일</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">30일</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">7일 적중</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">알파(7d)</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">추천일</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {recs.map(r => (
                    <tr key={r.id} className="hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <span className="font-semibold">{r.symbol}</span>
                        <span className="ml-1 text-muted-foreground">{r.name.slice(0, 14)}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">{r.sector?.split(' ')[0] ?? '-'}</td>
                      <td className="px-3 py-2 text-right">
                        <span className="rounded bg-primary/10 text-primary px-1 py-0.5">{r.confidence}%</span>
                      </td>
                      <td className="px-3 py-2 text-right text-muted-foreground">{r.entryPrice.toLocaleString()}</td>
                      <td className="px-3 py-2 text-right"><ReturnCell v={r.return7d} /></td>
                      <td className="px-3 py-2 text-right"><ReturnCell v={r.return30d} /></td>
                      <td className="px-3 py-2 text-center"><HitBadge hit={r.hit7d} /></td>
                      <td className="px-3 py-2 text-right"><ReturnCell v={r.alpha7d} /></td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">{fmtDate(r.recommendedAt)}</td>
                    </tr>
                  ))}
                  {recs.length === 0 && (
                    <tr>
                      <td colSpan={10} className="px-3 py-10 text-center text-muted-foreground">
                        해당 기간의 추천 데이터가 없습니다
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-xs text-muted-foreground text-center pb-2">
            * 적중률은 BUY 시그널 이후 해당 기간 내 수익이 발생한 비율입니다. 과거 성과가 미래 수익을 보장하지 않습니다.
          </p>
        </>
      )}
    </div>
  );
}
