'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

interface SectorStock {
  symbol: string;
  name: string;
  score: number | null;
  action: string;
}

interface SectorEntry {
  sector: string;
  stockCount: number;
  signals: { BUY?: number; WATCH?: number; AVOID?: number };
  avgScore: number | null;
  topStocks: SectorStock[];
}

const ACTION_COLOR: Record<string, string> = {
  BUY:   'bg-green-500',
  WATCH: 'bg-amber-400',
  AVOID: 'bg-red-400',
};

const SCORE_COLOR = (s: number | null) => {
  if (s == null) return 'text-muted-foreground';
  if (s >= 65) return 'text-green-600 font-bold';
  if (s >= 45) return 'text-amber-500 font-bold';
  return 'text-red-500 font-bold';
};

function SignalBar({ signals, total }: { signals: SectorEntry['signals']; total: number }) {
  if (total === 0) return <div className="h-2 rounded-full bg-muted" />;
  const buy   = ((signals.BUY   ?? 0) / total) * 100;
  const watch = ((signals.WATCH ?? 0) / total) * 100;
  const avoid = ((signals.AVOID ?? 0) / total) * 100;
  return (
    <div className="h-2 rounded-full overflow-hidden flex">
      <div style={{ width: `${buy}%` }}   className="bg-green-500" />
      <div style={{ width: `${watch}%` }} className="bg-amber-400" />
      <div style={{ width: `${avoid}%` }} className="bg-red-400" />
    </div>
  );
}

export default function SectorsPage() {
  const searchParams = useSearchParams();
  const market = searchParams.get('market') ?? 'US';

  const [data, setData] = useState<SectorEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy?endpoint=/stocks/sector-summary&market=${market}`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
    } catch (e: any) {
      setError(e.message ?? '조회 실패');
    } finally {
      setLoading(false);
    }
  }, [market]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">섹터 분석</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {market} 시장 섹터별 시그널 집계 — 최신 추천 기준
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs">데이터 불러오는 중...</p>
        </div>
      ) : error ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          조회 실패: {error}
        </CardContent></Card>
      ) : data.length === 0 ? (
        <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">
          데이터가 없습니다
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((entry) => {
            const total = (entry.signals.BUY ?? 0) + (entry.signals.WATCH ?? 0) + (entry.signals.AVOID ?? 0);
            return (
              <Card key={entry.sector} className="flex flex-col">
                <div className="px-4 pt-4 pb-3 border-b">
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-semibold text-sm truncate">{entry.sector}</p>
                    <span className={`text-sm tabular-nums ${SCORE_COLOR(entry.avgScore)}`}>
                      {entry.avgScore != null ? entry.avgScore.toFixed(1) : '-'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <span>종목 {entry.stockCount}개</span>
                    <span>·</span>
                    <span className="text-green-600">BUY {entry.signals.BUY ?? 0}</span>
                    <span className="text-amber-500">WATCH {entry.signals.WATCH ?? 0}</span>
                    <span className="text-red-500">AVOID {entry.signals.AVOID ?? 0}</span>
                  </div>
                  <SignalBar signals={entry.signals} total={total} />
                </div>

                <div className="px-4 py-3 flex-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2">상위 종목</p>
                  <div className="space-y-1.5">
                    {entry.topStocks.length === 0 ? (
                      <p className="text-xs text-muted-foreground">시그널 없음</p>
                    ) : entry.topStocks.map((s) => (
                      <Link
                        key={s.symbol}
                        href={`/stocks/${s.symbol}`}
                        className="flex items-center justify-between hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${ACTION_COLOR[s.action] ?? 'bg-muted-foreground'}`} />
                          <span className="text-xs font-medium truncate">{s.name}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{s.symbol}</span>
                        </div>
                        <span className={`text-xs tabular-nums shrink-0 ml-2 ${SCORE_COLOR(s.score)}`}>
                          {s.score != null ? s.score.toFixed(0) : '-'}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
