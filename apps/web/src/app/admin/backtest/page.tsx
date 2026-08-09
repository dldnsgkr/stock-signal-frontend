'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Loader2, Play } from 'lucide-react';
import { resolveForPath } from '@/lib/marketFilter';

const ADMIN_PROXY = '/api/admin-proxy';

interface AccSummary {
  count: number;
  avgReturn: number | null;
  avgAlpha: number | null;
  hitRate: number | null;
}

interface RescoreResult {
  market: string;
  horizon: string;
  weights: Record<string, number>;
  buyThreshold: number | null;
  topN: number | null;
  runs: number;
  skippedSnapshots: number;
  variant: AccSummary;
  baseline: AccSummary;
  error?: string;
}

const DEFAULT_WEIGHTS = { momentum: 45, value: 25, sentiment: 30 };

function pct(v: number | null | undefined, digits = 2): string {
  if (v == null) return '-';
  const sign = v > 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(digits)}%`;
}

function valColor(v: number | null | undefined) {
  if (v == null) return '';
  return v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : '';
}

function SummaryCard({ title, sub, acc, highlight }: {
  title: string; sub: string; acc: AccSummary | undefined; highlight?: boolean;
}) {
  return (
    <Card className={highlight ? 'border-primary/50' : ''}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div>
            <p className="text-muted-foreground">평균 수익률</p>
            <p className={`text-lg font-bold tabular-nums ${valColor(acc?.avgReturn)}`}>{pct(acc?.avgReturn)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">평균 알파</p>
            <p className={`text-lg font-bold tabular-nums ${valColor(acc?.avgAlpha)}`}>{pct(acc?.avgAlpha)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">적중률</p>
            <p className="text-lg font-bold tabular-nums">{acc?.hitRate != null ? `${(acc.hitRate * 100).toFixed(1)}%` : '-'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">표본 수</p>
            <p className="text-lg font-bold tabular-nums">{acc?.count?.toLocaleString() ?? '-'}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function BacktestPage() {
  // 시장 선택은 최상단(TopBar) 필터가 URL 로 넘긴다 — 화면 안에 또 두지 않는다.
  // 이 화면만 기본값이 KR 이라 marketFilter 설정에서도 KR 을 기본으로 둔다.
  const searchParams = useSearchParams();
  const market = resolveForPath('/admin/backtest', searchParams.get('market')) as 'US' | 'KR';
  const [horizon, setHorizon] = useState<'7d' | '30d'>('7d');
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const [mode, setMode] = useState<'threshold' | 'topn'>('threshold');
  const [threshold, setThreshold] = useState(65);
  const [topN, setTopN] = useState(10);
  const [fromdate, setFromdate] = useState('');
  const [todate, setTodate] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RescoreResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const weightSum = weights.momentum + weights.value + weights.sentiment;

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const body: Record<string, unknown> = {
        market,
        horizon,
        weights: {
          momentum: weights.momentum / 100,
          value: weights.value / 100,
          sentiment: weights.sentiment / 100,
        },
      };
      if (mode === 'threshold') body.buy_threshold = threshold;
      else body.top_n = topN;
      if (fromdate) body.fromdate = fromdate;
      if (todate) body.todate = todate;

      const res = await fetch(`${ADMIN_PROXY}?endpoint=/admin/backtest/rescore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setResult(json);
    } catch (e: any) {
      setError(e?.message ?? '실행 실패');
    } finally {
      setRunning(false);
    }
  }

  const sliders: { key: keyof typeof DEFAULT_WEIGHTS; label: string; color: string }[] = [
    { key: 'momentum', label: '모멘텀', color: 'accent-blue-500' },
    { key: 'value', label: '가치', color: 'accent-green-500' },
    { key: 'sentiment', label: '감성', color: 'accent-amber-500' },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">백테스트 실험실</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          저장된 피처 스냅샷을 다른 가중치·선택규칙으로 재점수화해 실제 운영 결과(baseline)와 비교합니다.
          피처 계산 자체는 바꿀 수 없습니다.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              {(['7d', '30d'] as const).map(h => (
                <button key={h} onClick={() => setHorizon(h)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${horizon === h ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                  {h === '7d' ? '7일 수익률' : '30일 수익률'}
                </button>
              ))}
            </div>
            <div className="flex gap-1 rounded-lg bg-muted p-1">
              <button onClick={() => setMode('threshold')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'threshold' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                임계값 기준
              </button>
              <button onClick={() => setMode('topn')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium ${mode === 'topn' ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>
                상위 N종목
              </button>
            </div>
            {mode === 'threshold' ? (
              <label className="flex items-center gap-2 text-xs">
                BUY 임계값
                <input type="number" value={threshold} min={0} max={100}
                  onChange={e => setThreshold(Number(e.target.value))}
                  className="w-16 rounded-md border bg-background px-2 py-1.5 tabular-nums" />
              </label>
            ) : (
              <label className="flex items-center gap-2 text-xs">
                런당 상위
                <input type="number" value={topN} min={1} max={100}
                  onChange={e => setTopN(Number(e.target.value))}
                  className="w-16 rounded-md border bg-background px-2 py-1.5 tabular-nums" />
                종목
              </label>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {sliders.map(({ key, label, color }) => (
              <div key={key} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>{label}</span>
                  <span className="tabular-nums font-medium">{weights[key]}%</span>
                </div>
                <input type="range" min={0} max={100} value={weights[key]}
                  onChange={e => setWeights(w => ({ ...w, [key]: Number(e.target.value) }))}
                  className={`w-full ${color}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            합계 {weightSum}% — 합이 100이 아니어도 비율대로 정규화됩니다. 기본값 45/25/30.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs">
              기간
              <input type="date" value={fromdate} onChange={e => setFromdate(e.target.value)}
                className="rounded-md border bg-background px-2 py-1.5" />
              ~
              <input type="date" value={todate} onChange={e => setTodate(e.target.value)}
                className="rounded-md border bg-background px-2 py-1.5" />
              <span className="text-muted-foreground">(비우면 전체 구간)</span>
            </label>
            <button onClick={run} disabled={running}
              className="ml-auto flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {running ? '재점수화 중... (최대 수 분)' : '백테스트 실행'}
            </button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card><CardContent className="py-8 text-center text-sm text-red-500">실행 실패: {error}</CardContent></Card>
      )}

      {result && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <SummaryCard
              title="실험 설정 (variant)"
              sub={`가중치 ${Object.values(result.weights).map(v => Math.round(v * 100)).join('/')}${result.topN ? ` · 상위 ${result.topN}종목` : ` · 임계값 ${result.buyThreshold}`}`}
              acc={result.variant}
              highlight
            />
            <SummaryCard
              title="실제 운영 (baseline)"
              sub="당시 실제 BUY 시그널의 성과"
              acc={result.baseline}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {result.market} · {result.horizon === '7d' ? '7일' : '30일'} 수익률 · run {result.runs}개
            {result.skippedSnapshots > 0 && ` · 스냅샷 ${result.skippedSnapshots}건 제외(구조 불일치)`}
            {' '}· 알파 = 동일가중 유니버스(같은 날 시장 전 종목 평균) 대비 초과수익
          </p>
        </>
      )}
    </div>
  );
}
