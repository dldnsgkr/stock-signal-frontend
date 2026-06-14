'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';

type MarketCode = 'KOSPI' | 'KOSDAQ';

interface StockEntry {
  code: string;
  name: string;
  netBuyVol: number;
  netBuyVal: number;
  buyVal: number;
  sellVal: number;
}

interface ForeignData {
  market: string;
  date: string;
  topBuy: StockEntry[];
  topSell: StockEntry[];
}

function toYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function toInputDate(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

function fromInputDate(s: string): string {
  return s.replace(/-/g, '');
}

function fmtVal(v: number): string {
  if (v === 0) return '0';
  const sign = v > 0 ? '+' : '';
  const abs = Math.abs(v);
  const bil = abs > 100_000_000 ? abs / 100_000_000 : abs;
  if (bil >= 10000) return `${sign}${(bil / 10000).toFixed(1)}조`;
  return `${sign}${Math.round(bil).toLocaleString()}억`;
}

function netColor(v: number) {
  return v > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-red-500';
}

function StockTable({
  items,
  type,
}: {
  items: StockEntry[];
  type: 'buy' | 'sell';
}) {
  const isBuy = type === 'buy';
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="px-2 py-2 text-center font-medium text-muted-foreground w-8">순위</th>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">종목명</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">
              {isBuy ? '순매수' : '순매도'}
            </th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">매수</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground whitespace-nowrap">매도</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {items.map((s, i) => (
            <tr key={s.code} className="hover:bg-muted/30">
              <td className="px-2 py-2 text-center text-muted-foreground font-medium">{i + 1}</td>
              <td className="px-3 py-2">
                <span className="font-medium">{s.name}</span>
                <span className="ml-1.5 text-muted-foreground">{s.code}</span>
              </td>
              <td className={`px-3 py-2 text-right tabular-nums font-semibold whitespace-nowrap ${netColor(s.netBuyVal)}`}>
                {fmtVal(s.netBuyVal)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {fmtVal(s.buyVal)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-muted-foreground whitespace-nowrap">
                {fmtVal(s.sellVal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ForeignTradingPage() {
  const [market, setMarket] = useState<MarketCode>('KOSPI');
  const [date, setDate] = useState(() => toYYYYMMDD(new Date()));
  const [data, setData] = useState<ForeignData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/proxy?endpoint=/market/foreign-top-stocks&market=${market}&date=${date}&limit=30`,
      );
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? '데이터 조회 실패');
    } finally {
      setLoading(false);
    }
  }, [market, date]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const isEmpty = data && data.topBuy.length === 0 && data.topSell.length === 0;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">외국인 매매 동향</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            KRX 기준 외국인 순매수·순매도 상위 종목 (단위: 억원)
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* 시장 토글 */}
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {(['KOSPI', 'KOSDAQ'] as MarketCode[]).map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  market === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {m}
              </button>
            ))}
          </div>
          {/* 날짜 선택 */}
          <input
            type="date"
            value={toInputDate(date)}
            max={toInputDate(toYYYYMMDD(new Date()))}
            onChange={e => setDate(fromInputDate(e.target.value))}
            className="rounded-lg border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">KRX 데이터 조회 중...</p>
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            데이터 조회 실패: {error}
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            해당 날짜의 데이터가 없습니다. (주말·공휴일이거나 아직 장중일 수 있습니다)
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 순매수 상위 */}
          {data!.topBuy.length > 0 && (
            <Card className="min-w-0">
              <div className="border-b px-4 py-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                <div>
                  <p className="text-sm font-semibold">외국인 순매수 상위</p>
                  <p className="text-xs text-muted-foreground">
                    {data!.market} · {data!.date.slice(0, 4)}-{data!.date.slice(4, 6)}-{data!.date.slice(6, 8)}
                  </p>
                </div>
              </div>
              <StockTable items={data!.topBuy} type="buy" />
            </Card>
          )}

          {/* 순매도 상위 */}
          {data!.topSell.length > 0 && (
            <Card className="min-w-0">
              <div className="border-b px-4 py-3 flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-500" />
                <div>
                  <p className="text-sm font-semibold">외국인 순매도 상위</p>
                  <p className="text-xs text-muted-foreground">
                    {data!.market} · {data!.date.slice(0, 4)}-{data!.date.slice(4, 6)}-{data!.date.slice(6, 8)}
                  </p>
                </div>
              </div>
              <StockTable items={data!.topSell} type="sell" />
            </Card>
          )}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center pb-2">
        * 출처: KRX · 당일 데이터는 장 마감(오후 6시) 후 확정
      </p>
    </div>
  );
}
