'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/Card';
import { SignalBadge } from '@/components/recommendation/SignalBadge';
import { Star, Loader2, LogIn, Trash2 } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { fmtMarketDateNum } from '@/lib/marketTime';

interface WatchItem {
  symbol: string;
  name: string;
  sector: string | null;
  market: string;
  addedAt: string;
  currentPrice: number | null;
  changeRate: number | null;
  latestAction: string | null;
  latestScore: number | null;
  latestRecommendedAt: string | null;
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

export default function WatchlistPage() {
  const { status } = useSession();
  const [items, setItems] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/watchlist');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
    if (status === 'unauthenticated') setLoading(false);
  }, [status, load]);

  async function remove(symbol: string) {
    setRemoving(symbol);
    try {
      const res = await fetch('/api/watchlist', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      if (res.ok) setItems(prev => prev.filter(i => i.symbol !== symbol));
    } finally {
      setRemoving(null);
    }
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Star className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">관심종목은 로그인 후 사용할 수 있습니다</p>
          <p className="text-sm text-muted-foreground mt-1">구글 계정으로 1초 만에 시작하세요</p>
        </div>
        <button
          onClick={() => signIn('google')}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <LogIn className="h-4 w-4" /> Google 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">관심종목</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          종목 상세에서 ⭐ 관심등록 → 여기에 모입니다. 상단 🔔 알림을 켜면 관심종목에 BUY/SELL 시그널이 뜰 때 푸시로 받습니다.
        </p>
      </div>

      {loading || status === 'loading' ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            아직 관심종목이 없습니다. <Link href="/stocks" className="text-primary hover:underline">종목 검색</Link>에서 추가해보세요.
          </CardContent>
        </Card>
      ) : (
        <Card className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="px-3 py-2 text-left font-medium">종목</th>
                  <th className="px-3 py-2 text-left font-medium">최신 시그널</th>
                  <th className="px-3 py-2 text-right font-medium">점수</th>
                  <th className="px-3 py-2 text-right font-medium">현재가</th>
                  <th className="px-3 py-2 text-right font-medium">등락률</th>
                  <th className="px-3 py-2 text-right font-medium">추천일</th>
                  <th className="px-3 py-2 text-right font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.symbol} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="px-3 py-2.5">
                      <Link href={`/stocks/${item.symbol}`} className="hover:underline">
                        <span className="font-medium block truncate max-w-[180px]">{item.name}</span>
                        <span className="text-muted-foreground">{item.symbol}{item.sector ? ` · ${item.sector}` : ''}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      {item.latestAction ? <SignalBadge action={item.latestAction} /> : <span className="text-muted-foreground">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                      {item.latestScore != null ? item.latestScore.toFixed(1) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums whitespace-nowrap">
                      {item.currentPrice != null ? formatPrice(item.currentPrice, item.market) : '-'}
                    </td>
                    <td className={`px-3 py-2.5 text-right tabular-nums whitespace-nowrap ${changeColor(item.changeRate)}`}>
                      {fmtChange(item.changeRate)}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                      {item.latestRecommendedAt ? fmtMarketDateNum(item.latestRecommendedAt, item.market) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => remove(item.symbol)}
                        disabled={removing === item.symbol}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-red-500 hover:bg-muted"
                        title="관심종목에서 제거"
                      >
                        {removing === item.symbol
                          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
