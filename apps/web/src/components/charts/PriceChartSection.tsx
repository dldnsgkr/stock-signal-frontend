'use client';

import { useState, useEffect, useRef } from 'react';
import { PriceChart } from './PriceChart';
import { ExternalLink, Loader2 } from 'lucide-react';

interface PriceData {
  date: string;
  close: number;
  volume: number;
}

interface PriceChartSectionProps {
  symbol: string;
  market: string;
  initialData?: PriceData[];
}

const PERIODS = [
  { label: '1M', days: 30 },
  { label: '3M', days: 90 },
  { label: '6M', days: 180 },
  { label: '1Y', days: 365 },
  { label: '3Y', days: 1095 },
  { label: '전체', days: 0 },
] as const;

function getTradingViewUrl(symbol: string, market: string) {
  const clean = symbol.replace(/\.(KS|KQ)$/i, '');
  if (market === 'KR') return `https://www.tradingview.com/chart/?symbol=KRX:${clean}`;
  return `https://www.tradingview.com/chart/?symbol=${symbol}`;
}

export function PriceChartSection({ symbol, market, initialData }: PriceChartSectionProps) {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<PriceData[]>(initialData ?? []);
  const [loading, setLoading] = useState(false);
  const isFirstRender = useRef(true);

  useEffect(() => {
    // 첫 렌더에서 서버 데이터가 있으면 기본 기간(90일) fetch 생략
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (initialData && initialData.length > 0 && days === 90) return;
    }

    setLoading(true);
    fetch(`/api/stocks/${symbol}/prices?days=${days}`)
      .then(r => r.json())
      .then(raw => {
        setData(raw.map((p: any) => ({ date: p.date, close: p.close, volume: p.volume })));
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [symbol, days]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.label}
              onClick={() => setDays(p.days)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                days === p.days
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <a
          href={getTradingViewUrl(symbol, market)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          TradingView <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-[360px]">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : data.length > 0 ? (
        <PriceChart data={data} symbol={symbol} />
      ) : (
        <p className="text-sm text-muted-foreground text-center py-10">
          가격 데이터가 없습니다
        </p>
      )}
    </div>
  );
}
