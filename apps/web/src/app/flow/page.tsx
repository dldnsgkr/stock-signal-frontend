'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { resolveForPath } from '@/lib/marketFilter';

type MarketFilter = 'ALL' | 'KOSPI' | 'KOSDAQ';
type Investor = 'foreign' | 'institution' | 'individual';

interface RankEntry {
  symbol: string;
  name: string;
  sector: string | null;
  totalNet: number;
  activeDays: number;
  streak: number;
  daily: number[];
  intensity: number | null;
  currentPrice: number | null;
  changeRate: number | null;
}

interface FlowRanking {
  market: string;
  investor: string;
  days: number;
  top: RankEntry[];
  bottom: RankEntry[];
}

const DAYS_OPTIONS = [5, 20, 60] as const;
const INVESTOR_LABEL: Record<Investor, string> = { foreign: '외국인', institution: '기관', individual: '개인' };

function fmtNet(v: number): string {
  const sign = v > 0 ? '+' : '';
  const eok = Math.abs(v) / 1e8;
  if (eok >= 10000) return `${sign}${(v / 1e12).toFixed(2)}조`;
  return `${sign}${Math.round(v / 1e8).toLocaleString('ko-KR')}억`;
}

function fmtPrice(v: number | null): string {
  return v == null ? '-' : `${Math.round(v).toLocaleString('ko-KR')}원`;
}

function changeColor(v: number | null) {
  if (v == null) return 'text-muted-foreground';
  return v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-600' : 'text-muted-foreground';
}

function fmtChange(v: number | null): string {
  if (v == null) return '-';
  const sign = v > 0 ? '▲' : v < 0 ? '▼' : '';
  return `${sign}${Math.abs(v).toFixed(2)}%`;
}

/** 일별 순매수 미니 바 차트. 양수=파랑(순매수), 음수=빨강(순매도) — 표 색상 관례와 동일. */
function Sparkline({ daily }: { daily: number[] }) {
  if (!daily.length) return <span className="text-muted-foreground">-</span>;
  const W = 84;
  const H = 22;
  const mid = H / 2;
  const maxAbs = Math.max(...daily.map(Math.abs), 1);
  const barW = Math.max(1, Math.floor(W / daily.length) - 1);
  const step = W / daily.length;
  return (
    <svg width={W} height={H} className="block" aria-hidden>
      <line x1={0} y1={mid} x2={W} y2={mid} stroke="currentColor" strokeOpacity={0.15} />
      {daily.map((v, i) => {
        const h = Math.max(1, (Math.abs(v) / maxAbs) * (mid - 1));
        return (
          <rect
            key={i}
            x={i * step}
            y={v >= 0 ? mid - h : mid}
            width={barW}
            height={h}
            fill={v >= 0 ? '#2563eb' : '#ef4444'}
            fillOpacity={0.8}
          />
        );
      })}
    </svg>
  );
}

function fmtIntensity(v: number | null): string {
  if (v == null) return '-';
  return `${(Math.abs(v) * 100).toFixed(1)}%`;
}

function RankTable({ items, type }: { items: RankEntry[]; type: 'buy' | 'sell' }) {
  const netColor = type === 'buy' ? 'text-blue-600 dark:text-blue-400' : 'text-red-500';
  const streakBadge = type === 'buy'
    ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300'
    : 'bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300';

  const Streak = ({ n }: { n: number }) =>
    n >= 3
      ? <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${streakBadge}`}>{n}일 연속</span>
      : <span className="text-muted-foreground tabular-nums">{n}일</span>;

  return (
    <>
      {/* 모바일: 표를 가로 스크롤시키면 강도·연속·등락률이 화면 밖에 숨는다.
          좁은 폭에서는 한 종목을 3줄 카드로 펼쳐 전부 보이게 한다(2026-08-10). */}
      <ul className="sm:hidden divide-y">
        {items.map((s, i) => (
          <li key={s.symbol} className="px-3 py-2.5">
            <Link href={`/stocks/${s.symbol}`} className="block hover:opacity-80">
              <div className="flex items-baseline gap-2">
                <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${netColor}`}>{fmtNet(s.totalNet)}</span>
              </div>
              <div className="mt-0.5 flex items-baseline gap-2 pl-7 text-xs text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{s.symbol}</span>
                <span className="shrink-0 tabular-nums">{fmtPrice(s.currentPrice)}</span>
                <span className={`shrink-0 tabular-nums ${changeColor(s.changeRate)}`}>{fmtChange(s.changeRate)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-3 pl-7">
                <Sparkline daily={s.daily} />
                <span className="text-xs text-muted-foreground tabular-nums">강도 {fmtIntensity(s.intensity)}</span>
                <span className="ml-auto text-xs"><Streak n={s.streak} /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* 데스크톱: xl 에서 2열이 되면 카드 폭이 ~494px 이라 여백을 넉넉히 주면 표가 넘친다.
          px-2 + 종목명 100px 상한으로 맞춰 두었다. */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="px-2 py-2 text-left font-medium">종목</th>
              <th className="px-2 py-2 text-left font-medium">일별 추이</th>
              <th className="px-2 py-2 text-right font-medium">누적 순매수</th>
              <th className="px-2 py-2 text-right font-medium" title="구간 거래대금 대비 순매수 비중">강도</th>
              <th className="px-2 py-2 text-right font-medium">연속</th>
              <th className="px-2 py-2 text-right font-medium">등락률</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s, i) => (
              <tr key={s.symbol} className="border-b last:border-0 hover:bg-muted/40">
                <td className="px-2 py-2">
                  <Link href={`/stocks/${s.symbol}`} className="flex items-center gap-2 hover:underline">
                    <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                    <span className="min-w-0">
                      <span className="font-medium block truncate max-w-[100px]">{s.name}</span>
                      <span className="text-muted-foreground">{s.symbol}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-2 py-2"><Sparkline daily={s.daily} /></td>
                <td className={`px-2 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${netColor}`}>
                  {fmtNet(s.totalNet)}
                  <span className="block font-normal text-muted-foreground">{fmtPrice(s.currentPrice)}</span>
                </td>
                <td className="px-2 py-2 text-right tabular-nums whitespace-nowrap">{fmtIntensity(s.intensity)}</td>
                <td className="px-2 py-2 text-right whitespace-nowrap"><Streak n={s.streak} /></td>
                <td className={`px-2 py-2 text-right tabular-nums whitespace-nowrap ${changeColor(s.changeRate)}`}>
                  {fmtChange(s.changeRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function FlowRankingPage() {
  // 시장 구분은 최상단(TopBar) 필터가 URL 로 넘긴다 — 화면 안에 또 두지 않는다.
  const searchParams = useSearchParams();
  const market = resolveForPath('/flow', searchParams.get('submarket')) as MarketFilter;
  const [investor, setInvestor] = useState<Investor>('foreign');
  const [days, setDays] = useState<number>(20);
  const [data, setData] = useState<FlowRanking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy?endpoint=/market/flow-ranking&market=${market}&investor=${investor}&days=${days}&limit=20`,
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [market, investor, days]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">수급 랭킹</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            기간 <b>누적</b> 순매수 랭킹 — 하루 반짝이 아닌 꾸준한 매집·이탈을 포착합니다
            (당일 기준은 투자자·외국인 동향 참조)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(Object.keys(INVESTOR_LABEL) as Investor[]).map(inv => (
              <button key={inv} onClick={() => setInvestor(inv)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  investor === inv ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {INVESTOR_LABEL[inv]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {DAYS_OPTIONS.map(d => (
              <button key={d} onClick={() => setDays(d)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === d ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {d}일
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">수급 데이터 집계 중...</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            데이터 조회 실패: {error}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <Card className="min-w-0">
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <div>
                <p className="text-sm font-semibold">{INVESTOR_LABEL[investor]} 순매수 상위</p>
                <p className="text-xs text-muted-foreground">최근 {data?.days}거래일 누적</p>
              </div>
            </div>
            <RankTable items={data?.top ?? []} type="buy" />
          </Card>

          <Card className="min-w-0">
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <div>
                <p className="text-sm font-semibold">{INVESTOR_LABEL[investor]} 순매도 상위</p>
                <p className="text-xs text-muted-foreground">최근 {data?.days}거래일 누적</p>
              </div>
            </div>
            <RankTable items={data?.bottom ?? []} type="sell" />
          </Card>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pb-2">
        * 출처: KRX (일별 적재) · 강도 = 구간 거래대금 대비 순매수 비중 · 연속 = 최근일부터 같은 방향 연속 일수
        · 상장폐지·거래정지 종목은 제외될 수 있습니다
      </p>
    </div>
  );
}
