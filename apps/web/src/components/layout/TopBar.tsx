'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw } from 'lucide-react';

const MARKET_PAGES = ['/', '/recommendations', '/stocks', '/performance'];

export function TopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMarket = searchParams.get('market') || 'US';

  const isMarketPage = MARKET_PAGES.some((p) => pathname === p);

  function switchMarket(market: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('market', market);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-6">
      <div className="flex items-center gap-3">
        {isMarketPage && (
          <div className="flex rounded-lg border divide-x overflow-hidden text-xs font-medium">
            <button
              onClick={() => switchMarket('US')}
              className={`px-3 py-1.5 transition-colors ${
                currentMarket === 'US'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              🇺🇸 미국
            </button>
            <button
              onClick={() => switchMarket('KR')}
              className={`px-3 py-1.5 transition-colors ${
                currentMarket === 'KR'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              🇰🇷 한국
            </button>
          </div>
        )}
        <span className="text-xs text-muted-foreground">
          {currentMarket === 'KR' ? '장 마감 후 자동 갱신 (KST 기준)' : '장 마감 후 자동 갱신 (ET 기준)'}
        </span>
      </div>
      <button
        onClick={() => router.refresh()}
        className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        새로고침
      </button>
    </header>
  );
}
