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

export function BandPerformance({ market, score }: { market: string; score: number | null | undefined }) {
  const stat = useBandStat(market, score);
  // 표본 부족이거나 아직 안 왔으면 아무것도 그리지 않는다 — 빈 값을 보여줄 이유가 없다
  if (!stat || stat.alpha7d == null || stat.hitRate7d == null) return null;

  const bad = stat.alpha7d < 0;
  const alphaTxt = `${stat.alpha7d >= 0 ? '+' : ''}${(stat.alpha7d * 100).toFixed(2)}%`;
  const hitTxt = `${(stat.hitRate7d * 100).toFixed(1)}%`;

  return (
    <div
      className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] leading-snug ${
        bad
          ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-500'
          : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-500'
      }`}
      title="같은 점수대 시그널들이 최근 90일 동안 실제로 낸 성과입니다. 이 종목의 예측이 아닙니다."
    >
      <span className="font-medium">{bad ? '⚠ ' : ''}{stat.label} 구간 과거 성과</span>{' '}
      <span className="whitespace-nowrap">알파 {alphaTxt}</span>
      {' · '}
      <span className="whitespace-nowrap">적중 {hitTxt}</span>
      <span className="ml-1 opacity-70">(최근 90일 · {market} · n={stat.sample.toLocaleString()})</span>
    </div>
  );
}
