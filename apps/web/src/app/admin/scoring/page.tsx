'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';

const ADMIN_PROXY = '/api/admin-proxy';

type Market = 'US' | 'KR';

interface ThresholdRow {
  threshold: number;
  count: number;
  hitRate7d: number | null;
  avgReturn7d: number | null;
  isCurrent: boolean;
}

interface BandRow {
  band: string;
  count: number;
  hitRate7d: number | null;
  avgReturn7d: number | null;
  isCurrentBuyZone: boolean;
}

interface StrategyRow {
  strategy: string;
  label: string;
  count: number;
  hitRate7d: number | null;
  avgReturn7d: number | null;
  currentWeight: number;
}

interface Insight {
  currentThreshold: number;
  currentThresholdHitRate: number | null;
  bestThreshold: number | null;
  bestThresholdHitRate: number | null;
  dominantStrategy: string | null;
  dominantStrategyHitRate: number | null;
}

interface AnalysisResult {
  market: string;
  totalEvaluated: number;
  thresholdSensitivity: ThresholdRow[];
  scoreBands: BandRow[];
  strategyBreakdown: StrategyRow[];
  insight: Insight;
}

function pct(v: number | null, digits = 1) {
  if (v == null) return <span className="text-muted-foreground">-</span>;
  const cls = v > 0 ? 'text-green-600' : v < 0 ? 'text-red-500' : 'text-muted-foreground';
  return <span className={cls}>{v >= 0 ? '+' : ''}{(v * 100).toFixed(digits)}%</span>;
}

function hitRateBar(v: number | null) {
  if (v == null) return <span className="text-muted-foreground text-xs">-</span>;
  const pctVal = Math.round(v * 100);
  const color = pctVal >= 60 ? 'bg-green-500' : pctVal >= 50 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pctVal}%` }} />
      </div>
      <span className="text-xs tabular-nums">{pctVal}%</span>
    </div>
  );
}

export default function ScoringAnalysisPage() {
  const [market, setMarket] = useState<Market>('US');
  const [data, setData] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setData(null);
    fetch(`${ADMIN_PROXY}?endpoint=/admin/scoring-analysis&market=${market}`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [market]);

  const ins = data?.insight;
  const thresholdDiff = ins?.bestThreshold != null && ins.bestThreshold !== ins.currentThreshold;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">스코어링 피드백 분석</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            누적 BUY 시그널 성과 데이터로 임계값·전략 가중치를 검증합니다
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['US', 'KR'] as Market[]).map(m => (
            <button key={m} onClick={() => setMarket(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${market === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              {m === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.totalEvaluated === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <p className="text-sm">평가 완료된 BUY 시그널 데이터가 없습니다.</p>
          <p className="text-xs">시그널 생성 후 최소 1일이 지나야 평가 데이터가 쌓입니다.</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">평가 완료 시그널</p>
              <p className="mt-1 text-2xl font-bold">{data.totalEvaluated.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">BUY 7일 평가 기준</p>
            </CardContent></Card>

            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">현재 임계값 적중률</p>
              <p className={`mt-1 text-2xl font-bold ${ins?.currentThresholdHitRate != null ? (ins.currentThresholdHitRate >= 0.5 ? 'text-green-600' : 'text-red-500') : ''}`}>
                {ins?.currentThresholdHitRate != null ? `${(ins.currentThresholdHitRate * 100).toFixed(1)}%` : '-'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">BUY ≥ 65점 기준</p>
            </CardContent></Card>

            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">최적 임계값 (히트율)</p>
              <p className="mt-1 text-2xl font-bold text-primary">
                {ins?.bestThreshold != null ? `${ins.bestThreshold}점` : '-'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ins?.bestThresholdHitRate != null ? `적중률 ${(ins.bestThresholdHitRate * 100).toFixed(1)}%` : ''}
              </p>
            </CardContent></Card>

            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">최고 성과 전략</p>
              <p className="mt-1 text-2xl font-bold">
                {ins?.dominantStrategy ?? '-'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ins?.dominantStrategyHitRate != null ? `적중률 ${(ins.dominantStrategyHitRate * 100).toFixed(1)}%` : ''}
              </p>
            </CardContent></Card>
          </div>

          {/* 인사이트 배너 */}
          {thresholdDiff && (
            <div className="flex items-start gap-2 rounded-lg border bg-primary/5 border-primary/20 px-4 py-3 text-xs">
              <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
              <span>
                현재 BUY 임계값 <strong>65점</strong> 기준 적중률은{' '}
                <strong>{ins?.currentThresholdHitRate != null ? `${(ins.currentThresholdHitRate * 100).toFixed(1)}%` : '-'}</strong>이며,
                데이터 기준 최적 임계값은 <strong>{ins?.bestThreshold}점</strong>{' '}
                (적중률 <strong>{ins?.bestThresholdHitRate != null ? `${(ins.bestThresholdHitRate * 100).toFixed(1)}%` : '-'}</strong>)입니다.
                임계값 조정을 고려해 보세요.
              </span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* 임계값 민감도 */}
            <Card className="min-w-0">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">임계값 민감도</p>
                <p className="text-xs text-muted-foreground">점수 기준 이상 BUY 시그널의 성과</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">임계값</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">시그널 수</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">7일 적중률</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">평균 수익률</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.thresholdSensitivity.map(row => (
                      <tr key={row.threshold} className={`${row.isCurrent ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                        <td className="px-3 py-2 font-medium">
                          {row.threshold}점 이상
                          {row.isCurrent && <span className="ml-1.5 rounded bg-primary/10 text-primary px-1 py-0.5 text-[10px]">현재</span>}
                          {row.threshold === ins?.bestThreshold && !row.isCurrent && <span className="ml-1.5 rounded bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400 px-1 py-0.5 text-[10px]">최적</span>}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                        <td className="px-3 py-2">{hitRateBar(row.hitRate7d)}</td>
                        <td className="px-3 py-2 text-right">{pct(row.avgReturn7d)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 전략 기여도 */}
            <Card className="min-w-0">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">전략 기여도 분석</p>
                <p className="text-xs text-muted-foreground">주도 전략별 성과 비교</p>
              </div>
              <CardContent className="pt-4 space-y-4">
                {data.strategyBreakdown.map(row => {
                  const hitPct = row.hitRate7d != null ? Math.round(row.hitRate7d * 100) : null;
                  const color = hitPct != null ? (hitPct >= 60 ? 'bg-green-500' : hitPct >= 50 ? 'bg-yellow-400' : 'bg-red-400') : 'bg-muted';
                  return (
                    <div key={row.strategy} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.label} 주도</span>
                          <span className="text-muted-foreground">현재 가중치 {(row.currentWeight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{row.count}건</span>
                          {pct(row.avgReturn7d)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${color}`} style={{ width: hitPct != null ? `${hitPct}%` : '0%' }} />
                        </div>
                        <span className="text-xs tabular-nums w-8 text-right">{hitPct != null ? `${hitPct}%` : '-'}</span>
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-muted-foreground pt-1">
                  * 주도 전략 = momentum·value·sentiment 중 서브스코어가 가장 높은 전략
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 점수 구간별 성과 */}
          <Card className="min-w-0">
            <div className="border-b px-4 py-3">
              <p className="text-sm font-semibold">점수 구간별 성과</p>
              <p className="text-xs text-muted-foreground">BUY 추천 시점 점수 구간 → 실제 7일 수익</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">점수 구간</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">시그널 수</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">7일 적중률</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">평균 수익률</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">구분</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.scoreBands.map(row => (
                    <tr key={row.band} className={`${row.isCurrentBuyZone ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td className="px-3 py-2 font-medium tabular-nums">{row.band}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.count}</td>
                      <td className="px-3 py-2">{hitRateBar(row.hitRate7d)}</td>
                      <td className="px-3 py-2 text-right">{pct(row.avgReturn7d)}</td>
                      <td className="px-3 py-2 text-center">
                        {row.isCurrentBuyZone
                          ? <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">BUY 구간</span>
                          : <span className="text-muted-foreground text-[10px]">WATCH/AVOID</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <p className="text-xs text-muted-foreground text-center pb-2">
            * 적중률은 7일 후 양의 수익이 발생한 비율입니다. 표본이 적을수록 신뢰도가 낮습니다.
          </p>
        </>
      )}
    </div>
  );
}
