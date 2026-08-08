'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { resolveForPath } from '@/lib/marketFilter';

const ADMIN_PROXY = '/api/admin-proxy';

type Market = 'US' | 'KR';

interface ThresholdRow {
  threshold: number;
  count: number;
  hitRate7d: number | null;
  avgReturn7d: number | null;
  avgAlpha7d: number | null;
  isCurrent: boolean;
}

interface BandRow {
  band: string;
  count: number;
  hitRate7d: number | null;
  avgReturn7d: number | null;
  avgAlpha7d: number | null;
  isCurrentBuyZone: boolean;
}

interface StrategyRow {
  strategy: string;
  label: string;
  count: number;
  hitRate7d: number | null;
  avgReturn7d: number | null;
  avgAlpha7d: number | null;
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
  // 시장 선택은 최상단(TopBar) 필터가 URL 로 넘긴다 — 화면 안에 또 두지 않는다.
  const searchParams = useSearchParams();
  const market = resolveForPath('/admin/scoring', searchParams.get('market')) as Market;
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
  // 임계값 권고는 '적중률 최고' 만 보고 내면 안 된다.
  // KR 은 65점 35.4% vs 70점 35.5% 로 적중률은 0.1%p 높지만 평균 수익률은
  // 오히려 나빴다(-2.8% → -3.0%). 그걸 '최적'이라며 권하고 있었다.
  // → **적중률과 수익률이 둘 다 나을 때만** 권고한다. 한쪽만 좋으면 트레이드오프라
  //    사용자가 표를 직접 보고 판단할 문제지, 배너가 밀어붙일 일이 아니다.
  const curRow  = data?.thresholdSensitivity.find(t => t.isCurrent);
  const bestRow = data?.thresholdSensitivity.find(t => t.threshold === ins?.bestThreshold);
  const hitGap  = (bestRow?.hitRate7d ?? 0) - (curRow?.hitRate7d ?? 0);
  const thresholdDiff =
    !!curRow && !!bestRow && bestRow.threshold !== curRow.threshold &&
    curRow.hitRate7d != null && bestRow.hitRate7d != null &&
    curRow.avgReturn7d != null && bestRow.avgReturn7d != null &&
    bestRow.avgAlpha7d != null && curRow.avgAlpha7d != null &&
    bestRow.hitRate7d > curRow.hitRate7d &&
    bestRow.avgAlpha7d > curRow.avgAlpha7d;   // 수익률이 아니라 알파로 판단한다

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold">스코어링 피드백 분석</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            채점된 전 종목의 7일 성과로 임계값·전략 가중치를 검증합니다 (최근 90일)
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !data || data.totalEvaluated === 0 ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <p className="text-sm">평가 완료된 시그널 데이터가 없습니다.</p>
          <p className="text-xs">시그널 생성 후 최소 1일이 지나야 평가 데이터가 쌓입니다.</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">평가 완료 시그널</p>
              <p className="mt-1 text-2xl font-bold">{data.totalEvaluated.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">채점 전 종목 · 7일 평가 기준</p>
            </CardContent></Card>

            <Card><CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">현재 임계값 적중률</p>
              <p className={`mt-1 text-2xl font-bold ${ins?.currentThresholdHitRate != null ? (ins.currentThresholdHitRate >= 0.5 ? 'text-green-600' : 'text-red-500') : ''}`}>
                {ins?.currentThresholdHitRate != null ? `${(ins.currentThresholdHitRate * 100).toFixed(1)}%` : '-'}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">점수 ≥ 65 기준</p>
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
                현재 임계값 <strong>{curRow!.threshold}점</strong> — 적중률{' '}
                <strong>{(curRow!.hitRate7d! * 100).toFixed(1)}%</strong>, 평균 수익{' '}
                <strong>{curRow!.avgReturn7d != null ? `${curRow!.avgReturn7d >= 0 ? '+' : ''}${(curRow!.avgReturn7d * 100).toFixed(2)}%` : '-'}</strong>, 알파{' '}
                <strong>{curRow!.avgAlpha7d != null ? `${curRow!.avgAlpha7d >= 0 ? '+' : ''}${(curRow!.avgAlpha7d * 100).toFixed(2)}%` : '-'}</strong>,
                {' '}시그널 <strong>{curRow!.count.toLocaleString()}건</strong>.
                {' '}<strong>{bestRow!.threshold}점</strong>으로 바꾸면 적중률{' '}
                <strong>{(bestRow!.hitRate7d! * 100).toFixed(1)}%</strong>(+{(hitGap * 100).toFixed(1)}%p), 평균 수익{' '}
                <strong>{bestRow!.avgReturn7d != null ? `${bestRow!.avgReturn7d >= 0 ? '+' : ''}${(bestRow!.avgReturn7d * 100).toFixed(2)}%` : '-'}</strong>, 알파{' '}
                <strong>{bestRow!.avgAlpha7d != null ? `${bestRow!.avgAlpha7d >= 0 ? '+' : ''}${(bestRow!.avgAlpha7d * 100).toFixed(2)}%` : '-'}</strong>,
                {' '}시그널 <strong>{bestRow!.count.toLocaleString()}건</strong>이 됩니다.
              </span>
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2">
            {/* 임계값 민감도 */}
            <Card className="min-w-0">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">임계값 민감도</p>
                <p className="text-xs text-muted-foreground">임계값을 그 점수로 낮췄을 때 잡혔을 종목의 성과</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">임계값</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">시그널 수</th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">7일 적중률</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">평균 수익률</th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground cursor-help" title="지수 대비 초과수익. 시장 방향에 휘둘리지 않아 임계값 판단에는 이쪽이 적합합니다.">알파</th>
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
                        <td className="px-3 py-2 text-right tabular-nums">{row.count.toLocaleString()}</td>
                        <td className="px-3 py-2">{hitRateBar(row.hitRate7d)}</td>
                        <td className="px-3 py-2 text-right">{pct(row.avgReturn7d)}</td>
                        <td className="px-3 py-2 text-right">{pct(row.avgAlpha7d)}</td>
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
                          <span className="text-muted-foreground">{row.count.toLocaleString()}건</span>
                          <span className="text-muted-foreground text-[10px]">수익</span>{pct(row.avgReturn7d)}
                          <span className="text-muted-foreground text-[10px]">알파</span>{pct(row.avgAlpha7d)}
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
              <p className="text-xs text-muted-foreground">채점 시점 점수 구간 → 실제 7일 수익</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">점수 구간</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">시그널 수</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">7일 적중률</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">평균 수익률</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground cursor-help" title="지수 대비 초과수익. 시장 방향이 빠져 있어 구간 비교에 적합합니다.">알파</th>
                    <th className="px-3 py-2 text-center font-medium text-muted-foreground">구분</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.scoreBands.map(row => (
                    <tr key={row.band} className={`${row.isCurrentBuyZone ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td className="px-3 py-2 font-medium tabular-nums">{row.band}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.count.toLocaleString()}</td>
                      <td className="px-3 py-2">{hitRateBar(row.hitRate7d)}</td>
                      <td className="px-3 py-2 text-right">{pct(row.avgReturn7d)}</td>
                      <td className="px-3 py-2 text-right">{pct(row.avgAlpha7d)}</td>
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
