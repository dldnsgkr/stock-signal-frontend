'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/Card';
import { ChevronRight, Search, Loader2 } from 'lucide-react';

interface Stock {
  id: number;
  symbol: string;
  name: string;
  sector: string | null;
  exchange: string | null;
  market: { code: string };
}

interface FetchResult {
  data: Stock[];
  nextCursor: number | null;
  hasMore: boolean;
}

const PAGE_SIZE = 50;
const SESSION_KEY = 'stocks-snapshot';

async function fetchStocks(market: string, search: string, cursorId: number | null): Promise<FetchResult> {
  const params = new URLSearchParams({ market, pageSize: String(PAGE_SIZE) });
  if (cursorId) params.set('cursorId', String(cursorId));
  if (search.trim()) params.set('search', search.trim());
  const res = await fetch(`/api/stocks?${params}`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

function StocksContent() {
  const searchParams = useSearchParams();
  const market = searchParams.get('market') || 'US';

  const [search, setSearch] = useState('');
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 언마운트 시점에 최신 상태를 읽기 위한 스냅샷 ref
  const snapshotRef = useRef({ stocks, nextCursor, hasMore, market, search });
  snapshotRef.current = { stocks, nextCursor, hasMore, market, search };

  // 첫 마운트 여부 추적
  const isMountedRef = useRef(false);

  // 복원 후 렌더링 완료되면 스크롤 이동
  const pendingScrollRef = useRef<number | null>(null);

  const load = useCallback(async (cursor: number | null, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) setInitialLoading(true);
    else setLoading(true);

    try {
      const result = await fetchStocks(market, search, cursor);
      setStocks(prev => reset ? result.data : [...prev, ...result.data]);
      setNextCursor(result.nextCursor);
      setHasMore(result.hasMore);
    } catch {
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setInitialLoading(false);
      setLoading(false);
    }
  }, [market, search]);

  // 언마운트 시 현재 상태를 sessionStorage에 저장 (검색 중이면 저장 안 함)
  useEffect(() => {
    return () => {
      const s = snapshotRef.current;
      if (s.stocks.length === 0 || s.search !== '') return;
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          ...s,
          scrollY: window.scrollY,
        }));
      } catch {}
    };
  }, []);

  // stocks가 채워진 뒤 스크롤 복원
  useEffect(() => {
    if (pendingScrollRef.current === null || stocks.length === 0) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [stocks]);

  // market/search 변경 처리 + 초기 마운트 시 sessionStorage 복원 통합
  useEffect(() => {
    if (isMountedRef.current) {
      setStocks([]);
      setNextCursor(null);
      setHasMore(true);
      load(null, true);
      return;
    }

    isMountedRef.current = true;

    const raw = sessionStorage.getItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);

    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.market === market && s.search === '') {
          setStocks(s.stocks);
          setNextCursor(s.nextCursor);
          setHasMore(s.hasMore);
          setInitialLoading(false);
          pendingScrollRef.current = s.scrollY;
          return;
        }
      } catch {}
    }

    load(null, true);
  }, [market, search]); // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver: sentinel이 화면에 들어오면 다음 페이지 로드
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current) {
          load(nextCursor, false);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, nextCursor, load]);

  // 검색어 디바운스 (300ms)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const handleSearchChange = (value: string) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => setSearch(value), 300);
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">종목 목록</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })} · {stocks.length}개 표시 중{hasMore ? '' : ` / 전체 ${stocks.length}개`}
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="종목명 또는 심볼 검색..."
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {initialLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : stocks.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            검색 결과가 없습니다
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-1.5">
            {stocks.map((stock) => (
              <Link key={stock.id} href={`/stocks/${stock.symbol}`}>
                <Card className="hover:shadow-sm transition-shadow cursor-pointer">
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-semibold text-sm shrink-0">{stock.symbol}</span>
                        <span className="text-sm text-muted-foreground truncate">{stock.name}</span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        {stock.sector && (
                          <span className="text-xs text-muted-foreground hidden md:block">{stock.sector}</span>
                        )}
                        <span className="text-xs text-muted-foreground">{stock.exchange}</span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          <div ref={sentinelRef} className="h-4" />

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!hasMore && stocks.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">
              모든 종목을 불러왔습니다
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function StocksPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <StocksContent />
    </Suspense>
  );
}
