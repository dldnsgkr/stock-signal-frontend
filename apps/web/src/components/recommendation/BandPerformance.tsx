'use client';

import { useEffect, useState } from 'react';

/**
 * 점수 밴드별 과거 성과 — 이 제품의 취지를 화면에서 지키는 장치.
 *
 * 시그널 목록은 점수 높은 순으로 보여주는데, 실측하면 점수-알파 곡선이 ∩자라
 * **최상단이 가장 나쁘다**(2026-08-19, 최근 90일):
 *     화면 상위3 알파  KR -4.29% / US -1.52%
 *     55~75 구간      KR -0.37% / US +0.26%
 * 정렬을 바꾸는 건 선택 규칙 변경이라 3단계 검증을 통과해야 하지만,
 * **이미 측정한 것을 사용자에게 보여주는 것**은 스코어링 변경이 아니다.
 *
 * 표본이 부족한 밴드는 백엔드가 null 로 내려준다 — 근거처럼 읽히면 안 되므로
 * 여기서도 아무것도 그리지 않는다.
 */

export interface BandStat {
  label: string;
  alpha7d: number | null;
  hitRate7d: number | null;
  sample: number;
}

function bandLabelFor(score: number): string {
  if (score >= 90) return '90점 이상';
  if (score >= 85) return '85~90점';
  if (score >= 80) return '80~85점';
  if (score >= 75) return '75~80점';
  if (score >= 70) return '70~75점';
  if (score >= 65) return '65~70점';
  return '65점 미만';
}

/** 시장별 밴드 통계를 한 번만 받아 재사용한다 (카드마다 부르면 목록에서 수십 번이 된다) */
const cache = new Map<string, Promise<BandStat[]>>();

function fetchBands(market: string): Promise<BandStat[]> {
  const hit = cache.get(market);
  if (hit) return hit;
  const p = fetch(`/api/proxy?endpoint=/recommendations/band-stats&market=${market}`)
    .then(r => (r.ok ? r.json() : []))
    .catch(() => [] as BandStat[]);
  cache.set(market, p);
  return p;
}

export function useBandStat(market: string, score: number | null | undefined) {
  const [stat, setStat] = useState<BandStat | null>(null);
  useEffect(() => {
    if (score == null) return;
    let alive = true;
    fetchBands(market).then(list => {
      if (!alive) return;
      const want = bandLabelFor(score);
      setStat(list.find(b => b.label === want) ?? null);
    });
    return () => { alive = false; };
  }, [market, score]);
  return stat;
}

/**
 * 카드에 붙는 **작은 칩**. 전체 배너를 카드마다 반복하면 정보가 아니라 소음이 된다 —
 * 목록 20개가 전부 같은 밴드라 같은 경고가 20번 찍혔다(2026-08-19 화면에서 확인).
 * 맥락 설명은 목록 상단 `BandContextBar` 가 한 번만 하고, 여기서는 수치만 짧게 단다.
 */
export function BandPerformance({ market, score }: { market: string; score: number | null | undefined }) {
  const stat = useBandStat(market, score);
  if (!stat || stat.alpha7d == null) return null;

  const bad = stat.alpha7d < 0;
  const alphaTxt = `${stat.alpha7d >= 0 ? '+' : ''}${(stat.alpha7d * 100).toFixed(2)}%`;

  return (
    <span
      className={`mt-2 inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] ${
        bad
          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-500'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-500'
      }`}
      title={`같은 점수대(${stat.label}) 시그널들이 최근 90일 동안 실제로 낸 성과입니다. `
        + `알파 ${alphaTxt} · 적중 ${stat.hitRate7d != null ? (stat.hitRate7d * 100).toFixed(1) + '%' : '-'} `
        + `(n=${stat.sample.toLocaleString()}). 이 종목의 예측이 아닙니다.`}
    >
      {bad ? '⚠' : '✓'} {stat.label} 과거 알파 {alphaTxt}
    </span>
  );
}

/**
 * 목록 상단에 **한 번만** 나오는 맥락 바.
 * 점수-알파 곡선이 ∩자라는 사실(= 이 화면 정렬이 최선이 아니라는 사실)을 여기서 설명한다.
 */
export function BandContextBar({ market }: { market: string }) {
  const [bands, setBands] = useState<BandStat[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetchBands(market).then(b => { if (alive) setBands(b); });
    return () => { alive = false; };
  }, [market]);

  const usable = (bands ?? []).filter(b => b.alpha7d != null);
  if (usable.length < 3) return null;

  const best = usable.reduce((a, b) => ((b.alpha7d ?? -1) > (a.alpha7d ?? -1) ? b : a));
  const top = usable.find(b => b.label === '90점 이상');

  return (
    <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
      <strong className="text-amber-600 dark:text-amber-500">점수가 높을수록 좋은 건 아닙니다</strong>{' '}
      최근 90일 실측에서 점수-성과 곡선은 <strong>∩자</strong>였습니다
      {top?.alpha7d != null && (
        <> — 90점 이상 구간의 알파는 <strong>{(top.alpha7d * 100).toFixed(2)}%</strong>인 반면, </>
      )}
      {best.alpha7d != null && (
        <><strong>{best.label}</strong> 구간이 <strong>{(best.alpha7d * 100).toFixed(2)}%</strong>로 가장 좋았습니다.</>
      )}{' '}
      아래 목록은 <strong>점수 순</strong>이므로, 맨 위가 가장 유망하다는 뜻이 아닙니다.
      각 카드의 칩은 그 점수대의 과거 성과입니다.
    </div>
  );
}
