'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';

type MarketFilter = 'ALL' | 'KOSPI' | 'KOSDAQ';
type Investor = 'foreign' | 'institution';

interface RankEntry {
  symbol: string;
  name: string;
  sector: string | null;
  totalNet: number;
  activeDays: number;
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
const INVESTOR_LABEL: Record<Investor, string> = { foreign: '외국인', institution: '기관' };

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

function RankTable({ items, type }: { items: RankEntry[]; type: 'buy' | 'sell' }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="px-3 py-2 text-left font-medium">종목</th>
            <th className="px-3 py-2 text-right font-medium">누적 순매수</th>
            <th className="px-3 py-2 text-right font-medium">현재가</th>
            <th className="px-3 py-2 text-right font-medium">등락률</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => (
            <tr key={s.symbol} className="border-b last:border-0 hover:bg-muted/40">
              <td className="px-3 py-2">
                <Link href={`/stocks/${s.symbol}`} className="flex items-center gap-2 hover:underline">
                  <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0">
                    <span className="font-medium block truncate max-w-[160px]">{s.name}</span>
                    <span className="text-muted-foreground">{s.symbol}</span>
                  </span>
                </Link>
              </td>
              <td className={`px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${
                type === 'buy' ? 'text-blue-600 dark:text-blue-400' : 'text-red-500'
              }`}>
                {fmtNet(s.totalNet)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtPrice(s.currentPrice)}</td>
              <td className={`px-3 py-2 text-right tabular-nums whitespace-nowrap ${changeColor(s.changeRate)}`}>
                {fmtChange(s.changeRate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function FlowRankingPage() {
  const [market, setMarket] = useState<MarketFilter>('ALL');
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
            최근 N거래일 누적 순매수 거래대금 상위·하위 (자체 적재 데이터 · 단위: 억원)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['ALL', 'KOSPI', 'KOSDAQ'] as MarketFilter[]).map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  market === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {m === 'ALL' ? '전체' : m}
              </button>
            ))}
          </div>
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
        * 출처: KRX (일별 적재) · 상장폐지·거래정지 종목은 제외될 수 있습니다
      </p>
    </div>
  );
}
