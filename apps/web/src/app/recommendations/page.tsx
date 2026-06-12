'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { RecommendationCard } from '@/components/recommendation/RecommendationCard';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2 } from 'lucide-react';

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

const ACTIONS = [
  { value: undefined, label: '전체' },
  { value: 'BUY', label: '매수 시그널' },
  { value: 'WATCH', label: '관심 종목' },
  { value: 'AVOID', label: '투자 주의' },
] as const;

function RecommendationsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const market = searchParams.get('market') || 'US';
  const action = searchParams.get('action') || undefined;

  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [total, setTotal] = useState(0);
  const [runInfo, setRunInfo] = useState<FetchResult['runInfo']>();
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // 언마운트 시점에 최신 상태를 읽기 위한 스냅샷 ref
  const snapshotRef = useRef({ recs, nextPage, hasMore, total, runInfo, market, action });
  snapshotRef.current = { recs, nextPage, hasMore, total, runInfo, market, action };

  // 첫 마운트 여부 추적 - 이후 market/action 변경은 항상 새로 로드
  const isMountedRef = useRef(false);

  // 복원 후 렌더링 완료되면 스크롤 이동
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

  // 언마운트 시 현재 상태를 sessionStorage에 저장
  useEffect(() => {
    return () => {
      const s = snapshotRef.current;
      if (s.recs.length === 0) return;
      try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({
          ...s,
          scrollY: window.scrollY,
        }));
      } catch {}
    };
  }, []);

  // market/action 변경 처리 + 초기 마운트 시 sessionStorage 복원 통합
  useEffect(() => {
    // 첫 마운트가 아니면 (필터/마켓 변경) 항상 새로 로드
    if (isMountedRef.current) {
      setRecs([]);
      setNextPage(null);
      setHasMore(true);
      load(1, true);
      return;
    }

    isMountedRef.current = true;

    // 첫 마운트: sessionStorage 복원 시도
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
          return; // 복원 성공 → 새로 로드 안 함
        }
      } catch {}
    }

    // 복원 실패 또는 조건 불일치 → 새로 로드
    load(1, true);
  }, [market, action]); // eslint-disable-line react-hooks/exhaustive-deps

  // recs가 채워진 뒤 스크롤 복원
  useEffect(() => {
    if (pendingScrollRef.current === null || recs.length === 0) return;
    const y = pendingScrollRef.current;
    pendingScrollRef.current = null;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [recs]);

  // IntersectionObserver: sentinel이 뷰포트에 들어오면 다음 페이지 로드
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

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
  }, [hasMore, nextPage, load]);

  function setActionFilter(value: string | undefined) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set('action', value);
    else params.delete('action');
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">시그널 목록</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}
          {runInfo?.executedAt
            ? ` · 분석 ${new Date(runInfo.executedAt).toLocaleDateString('ko-KR')} · ${runInfo.modelVersion}`
            : ''}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {ACTIONS.map(({ value, label }) => (
          <button
            key={label}
            onClick={() => setActionFilter(value)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium transition-colors ${
              action === value
                ? 'bg-primary text-white border-primary'
                : 'hover:bg-muted text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          총 {total}개
        </span>
      </div>

      {initialLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
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
