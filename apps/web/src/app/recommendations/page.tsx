'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { RecommendationCard } from '@/components/recommendation/RecommendationCard';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, TrendingDown, ArrowRight } from 'lucide-react';
import { formatPrice, formatPercent, formatDate } from '@/lib/utils';
import Link from 'next/link';

interface Recommendation {
  id: number;
  stock: { symbol: string; name: string; sector: string | null };
  action: string;
  score: number;
  confidence: number;
  entryPrice: number;
  reasons: string[];
  recommendedAt: string;
  result?: { return7d: number | null; hit7d: boolean | null } | null;
}

interface SellSignal {
  id: number;
  stock: { symbol: string; name: string; sector: string | null; market: string };
  buyScore: number;
  currentScore: number;
  entryPrice: number;
  exitPrice: number | null;
  reasons: string[];
  buyDate: string;
  sellDate: string;
}

interface FetchResult {
  data: Recommendation[];
  total: number;
  runInfo?: { executedAt: string; modelVersion: string };
}

const PAGE_SIZE = 30;
const SESSION_KEY = 'recs-snapshot';

async function fetchRecommendations(
  market: string,
  action: string | undefined,
  page: number,
): Promise<FetchResult> {
  const params = new URLSearchParams({ market, page: String(page), pageSize: String(PAGE_SIZE) });
  if (action) params.set('action', action);
  const res = await fetch(`/api/recommendations?${params}`);
  if (!res.ok) throw new Error('fetch failed');
  return res.json();
}

async function fetchSellSignals(market: string): Promise<SellSignal[]> {
  const res = await fetch(`/api/recommendations/sell-signals?market=${market}&limit=50`);
  if (!res.ok) return [];
  return res.json();
}

const ACTIONS = [
  { value: undefined, label: '전체' },
  { value: 'BUY', label: '매수 시그널' },
  { value: 'WATCH', label: '관심 종목' },
  { value: 'AVOID', label: '투자 주의' },
  { value: 'SELL', label: '청산 시그널' },
] as const;

function SellSignalCard({ signal }: { signal: SellSignal }) {
  const scoreDrop = signal.currentScore - signal.buyScore;
  const priceChange = signal.exitPrice != null
    ? (signal.exitPrice - signal.entryPrice) / signal.entryPrice
    : null;

  return (
    <Link href={`/stocks/${signal.stock.symbol}`} className="block">
      <div className="rounded-xl border bg-card p-4 space-y-3 hover:shadow-md transition-shadow cursor-pointer">
        {/* 헤더 */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm">{signal.stock.symbol}</span>
              <span className="text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400 px-2 py-0.5 font-medium">SELL</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[180px]">{signal.stock.name}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted-foreground">점수 변화</div>
            <div className="flex items-center gap-1 text-xs font-medium">
              <span className="text-muted-foreground">{signal.buyScore.toFixed(0)}</span>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <span className="text-red-500 font-bold">{signal.currentScore.toFixed(0)}</span>
              <span className="text-red-500">({scoreDrop > 0 ? '+' : ''}{scoreDrop.toFixed(0)})</span>
            </div>
          </div>
        </div>

        {/* 가격 */}
        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center gap-1 text-muted-foreground">
            <span>진입</span>
            <span className="font-medium text-foreground">{formatPrice(signal.entryPrice)}</span>
          </div>
          {signal.exitPrice != null && (
            <>
              <ArrowRight className="h-3 w-3 text-muted-foreground" />
              <div className="flex items-center gap-1 text-muted-foreground">
                <span>청산</span>
                <span className={`font-medium ${priceChange != null && priceChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatPrice(signal.exitPrice)}
                </span>
              </div>
              {priceChange != null && (
                <span className={`ml-auto font-semibold ${priceChange >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {formatPercent(priceChange)}
                </span>
              )}
            </>
          )}
        </div>

        {/* 청산 근거 */}
        {signal.reasons.length > 0 && (
          <div className="space-y-0.5">
            {signal.reasons.slice(0, 2).map((r, i) => (
              <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <TrendingDown className="h-3 w-3 text-red-400 mt-0.5 shrink-0" />{r}
              </p>
            ))}
          </div>
        )}

        {/* 날짜 */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
          <span>매수 {formatDate(signal.buyDate)}</span>
          <span>청산 {formatDate(signal.sellDate)}</span>
        </div>
      </div>
    </Link>
  );
}

function RecommendationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const market = searchParams.get('market') || 'US';
  const action = (searchParams.get('action') as any) || undefined;
  const isSellTab = action === 'SELL';

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [sellSignals, setSellSignals] = useState<SellSignal[]>([]);
  const [total, setTotal] = useState(0);
  const [runInfo, setRunInfo] = useState<FetchResult['runInfo']>();
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const snapshotRef = useRef({ recs, nextPage, hasMore, total, runInfo, market, action });
  snapshotRef.current = { recs, nextPage, hasMore, total, runInfo, market, action };

  const isMountedRef = useRef(false);
  const pendingScrollRef = useRef<number | null>(null);

  const load = useCallback(async (page: number, reset: boolean) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (reset) setInitialLoading(true);
    else setLoading(true);

    try {
      const result = await fetchRecommendations(market, action, page);
      setRecs(prev => {
        if (reset) return result.data;
        const seen = new Set(prev.map(r => r.id));
        return [...prev, ...result.data.filter(r => !seen.has(r.id))];
      });
      setTotal(result.total);
      if (result.runInfo) setRunInfo(result.runInfo);
      const more = result.data.length === PAGE_SIZE;
      setHasMore(more);
      setNextPage(more ? page + 1 : null);
    } catch {
      setHasMore(false);
      setNextPage(null);
    } finally {
      loadingRef.current = false;
      setInitialLoading(false);
      setLoading(false);
    }
  }, [market, action]);

  const loadSell = useCallback(async () => {
    setInitialLoading(true);
    try {
      const signals = await fetchSellSignals(market);
      setSellSignals(signals);
    } catch {
      setSellSignals([]);
    } finally {
      setInitialLoading(false);
    }
  }, [market]);

  useEffect(() => {
    return () => {
      const s = snapshotRef.current;
      if (s.recs.length === 0) return;
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...s, scrollY: window.scrollY }));
      } catch {}
    };
  }, []);

  useEffect(() => {
    if (isMountedRef.current) {
      setRecs([]);
      setSellSignals([]);
      setNextPage(null);
      setHasMore(true);
      if (isSellTab) loadSell();
      else load(1, true);
      return;
    }

    isMountedRef.current = true;

    if (isSellTab) {
      loadSell();
      return;
    }

    const raw = sessionStorage.getItem(SESSION_KEY);
    sessionStorage.removeItem(SESSION_KEY);

    if (raw) {
      try {
        const s = JSON.parse(raw);
        if (s.market === market && (s.action ?? undefined) === action) {
          setRecs(s.recs);
          setNextPage(s.nextPage);
          setHasMore(s.hasMore);
          setTotal(s.total);
          if (s.runInfo) setRunInfo(s.runInfo);
          setInitialLoading(false);
          pendingScrollRef.current = s.scrollY;
          return;
        }
      } catch {}
    }

    load(1, true);
  }, [market, action]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingScrollRef.current === null || recs.length === 0) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [recs]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || isSellTab) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingRef.current && nextPage !== null) {
          load(nextPage, false);
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, nextPage, load, isSellTab]);

  function setMarketFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('market', value);
    params.delete('action');
    router.push(`${pathname}?${params.toString()}`);
  }

  function setActionFilter(value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('action', value);
    else params.delete('action');
    router.push(`${pathname}?${params.toString()}`);
  }

  const marketLabel = market === 'KR' ? 'KOSPI/KOSDAQ' : 'US';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">시그널 목록</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
            {runInfo?.executedAt && !isSellTab
              ? ` · 분석 ${new Date(runInfo.executedAt).toLocaleDateString('ko-KR')} · ${runInfo.modelVersion}`
              : ''}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(['US', 'KR'] as const).map(m => (
            <button
              key={m}
              onClick={() => setMarketFilter(m)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                market === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {m === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {ACTIONS.map(({ value, label }) => (
          <button
            key={label}
            onClick={() => setActionFilter(value)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              action === value
                ? value === 'SELL'
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-primary text-white border-primary'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {isSellTab ? `${sellSignals.length}건` : `총 ${total}개`}
        </span>
      </div>

      {initialLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : isSellTab ? (
        sellSignals.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              {marketLabel} 시장에서 감지된 청산 시그널이 없습니다.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {sellSignals.map(s => <SellSignalCard key={s.id} signal={s} />)}
          </div>
        )
      ) : recs.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            아직 분석 데이터가 없습니다. 관리자 페이지에서 데이터 수집을 먼저 실행하세요.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {recs.map((rec) => (
              <RecommendationCard key={rec.id} recommendation={rec} />
            ))}
          </div>

          <div ref={sentinelRef} className="h-4" />

          {loading && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!hasMore && recs.length > 0 && (
            <p className="text-center text-xs text-muted-foreground py-4">
              모든 시그널을 불러왔습니다
            </p>
          )}
        </>
      )}
    </div>
  );
}

export default function RecommendationsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <RecommendationsContent />
    </Suspense>
  );
}
