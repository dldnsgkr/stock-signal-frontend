'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/Card';
import { SignalBadge } from '@/components/recommendation/SignalBadge';
import { formatPrice } from '@/lib/utils';
import { fmtMarketDateNum } from '@/lib/marketTime';
import { Loader2, Search, X, Plus } from 'lucide-react';

interface CompareItem {
  symbol: string;
  notFound?: boolean;
  name?: string;
  sector?: string | null;
  market?: string;
  currentPrice?: number | null;
  changeRate?: number | null;
  action?: string | null;
  score?: number | null;
  confidence?: number | null;
  recommendedAt?: string | null;
  scoreDetail?: { momentum: number | null; value: number | null; sentiment: number | null } | null;
  result?: { return7d: number | null; return30d: number | null } | null;
  fundamentals?: { roe: number | null; per: number | null; pbr: number | null; debtRatio: number | null } | null;
}

interface SearchHit { symbol: string; name: string; market?: { code: string } | null; sector: string | null; }

const MAX = 4;

function pct(v: number | null | undefined, digits = 2): string {
  if (v == null) return '-';
  const s = v > 0 ? '+' : '';
  return `${s}${(v * 100).toFixed(digits)}%`;
}
function changeColor(v: number | null | undefined) {
  if (v == null) return 'text-muted-foreground';
  return v > 0 ? 'text-red-500' : v < 0 ? 'text-blue-600' : 'text-muted-foreground';
}
function fmtChange(v: number | null | undefined): string {
  if (v == null) return '-';
  const s = v > 0 ? '▲' : v < 0 ? '▼' : '';
  return `${s}${Math.abs(v).toFixed(2)}%`;
}

function ScoreBar({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-10 text-[11px] text-muted-foreground shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full bg-primary/70 rounded-full" style={{ width: `${value != null ? Math.max(0, Math.min(100, value)) : 0}%` }} />
      </div>
      <span className="w-8 text-[11px] tabular-nums text-right shrink-0">{value != null ? value.toFixed(0) : '-'}</span>
    </div>
  );
}

function CompareInner() {
  const params = useSearchParams();
  const [symbols, setSymbols] = useState<string[]>([]);
  const [items, setItems] = useState<CompareItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ?symbols= 딥링크 초기화
  useEffect(() => {
    const s = params.get('symbols');
    if (s) setSymbols(s.split(',').map(x => x.trim().toUpperCase()).filter(Boolean).slice(0, MAX));
  }, [params]);

  // 비교 데이터 로드
  useEffect(() => {
    if (symbols.length === 0) { setItems([]); return; }
    setLoading(true);
    fetch(`/api/proxy?endpoint=/stocks/compare&symbols=${encodeURIComponent(symbols.join(','))}`)
      .then(r => (r.ok ? r.json() : []))
      .then((d) => { if (Array.isArray(d)) setItems(d); })
      .finally(() => setLoading(false));
  }, [symbols]);

  // 검색 (디바운스)
  const onQuery = useCallback((v: string) => {
    setQ(v);
    if (debounce.current) clearTimeout(debounce.current);
    if (!v.trim()) { setHits([]); return; }
    debounce.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/stocks?search=${encodeURIComponent(v.trim())}&pageSize=6`);
        const j = await res.json();
        setHits(Array.isArray(j.data) ? j.data : []);
      } catch { setHits([]); }
      finally { setSearching(false); }
    }, 250);
  }, []);

  function add(sym: string) {
    const s = sym.toUpperCase();
    if (symbols.includes(s) || symbols.length >= MAX) return;
    setSymbols([...symbols, s]);
    setQ(''); setHits([]);
  }
  function remove(sym: string) {
    setSymbols(symbols.filter(s => s !== sym));
  }

  const rows: { label: string; render: (it: CompareItem) => React.ReactNode }[] = [
    { label: '최신 시그널', render: it => it.action ? <SignalBadge action={it.action} /> : <span className="text-muted-foreground">-</span> },
    { label: '종합 점수', render: it => <span className="font-bold tabular-nums">{it.score != null ? it.score.toFixed(1) : '-'}</span> },
    { label: '신뢰도', render: it => <span className="tabular-nums cursor-help" title="세 전략의 일치도 기반 확신도 — 적중 확률이 아닙니다.">{it.confidence != null ? `${it.confidence}%` : '-'}</span> },
    { label: '현재가', render: it => <span className="tabular-nums">{it.currentPrice != null ? formatPrice(it.currentPrice, it.market ?? 'US') : '-'}</span> },
    { label: '등락률', render: it => <span className={`tabular-nums ${changeColor(it.changeRate)}`}>{fmtChange(it.changeRate)}</span> },
    { label: '점수 구성', render: it => it.scoreDetail ? (
      <div className="space-y-1 w-full min-w-[140px]">
        <ScoreBar label="모멘텀" value={it.scoreDetail.momentum} />
        <ScoreBar label="가치" value={it.scoreDetail.value} />
        <ScoreBar label="감성" value={it.scoreDetail.sentiment} />
      </div>
    ) : <span className="text-muted-foreground">-</span> },
    { label: 'ROE', render: it => <span className="tabular-nums">{it.fundamentals?.roe != null ? pct(it.fundamentals.roe) : '-'}</span> },
    { label: 'PER', render: it => <span className="tabular-nums">{it.fundamentals?.per != null ? `${it.fundamentals.per.toFixed(1)}배` : '-'}</span> },
    { label: 'PBR', render: it => <span className="tabular-nums">{it.fundamentals?.pbr != null ? `${it.fundamentals.pbr.toFixed(2)}배` : '-'}</span> },
    { label: '7일 수익률', render: it => <span className={`tabular-nums ${changeColor(it.result?.return7d)}`}>{it.result?.return7d != null ? pct(it.result.return7d) : '-'}</span> },
    { label: '30일 수익률', render: it => <span className={`tabular-nums ${changeColor(it.result?.return30d)}`}>{it.result?.return30d != null ? pct(it.result.return30d) : '-'}</span> },
    { label: '추천일', render: it => <span className="text-xs text-muted-foreground">{it.recommendedAt ? fmtMarketDateNum(it.recommendedAt, it.market ?? 'US') : '-'}</span> },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold">종목 비교</h1>
        <p className="text-sm text-muted-foreground mt-0.5">최대 {MAX}개 종목을 나란히 비교합니다 (시그널·점수 구성·재무·수익률)</p>
      </div>

      {/* 검색 추가 */}
      <div className="relative max-w-md">
        <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={q}
            onChange={e => onQuery(e.target.value)}
            placeholder={symbols.length >= MAX ? `최대 ${MAX}개까지 비교 가능` : '종목명·심볼로 검색해 추가'}
            disabled={symbols.length >= MAX}
            className="flex-1 bg-transparent text-sm focus:outline-none disabled:cursor-not-allowed"
          />
          {searching && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </div>
        {hits.length > 0 && (
          <div className="absolute z-10 mt-1 w-full rounded-lg border bg-card shadow-lg overflow-hidden">
            {hits.map(h => {
              const already = symbols.includes(h.symbol.toUpperCase());
              return (
                <button
                  key={h.symbol}
                  onClick={() => add(h.symbol)}
                  disabled={already}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-40"
                >
                  <span className="min-w-0">
                    <span className="font-medium">{h.name}</span>
                    <span className="text-muted-foreground ml-1.5 text-xs">{h.symbol}</span>
                  </span>
                  {already ? <span className="text-[10px] text-muted-foreground">추가됨</span> : <Plus className="h-3.5 w-3.5 text-primary" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {symbols.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            비교할 종목을 검색해 추가하세요. (관심종목·종목 상세에서도 비교로 넘어올 수 있습니다)
          </CardContent>
        </Card>
      ) : (
        <Card className="min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="w-28 px-3 py-3 text-left text-xs font-medium text-muted-foreground align-bottom">지표</th>
                  {items.map(it => (
                    <th key={it.symbol} className="px-3 py-3 text-left align-bottom min-w-[150px]">
                      {it.notFound ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">{it.symbol}</span>
                          <span className="text-[10px] text-red-500">없음</span>
                          <button onClick={() => remove(it.symbol)} className="text-muted-foreground hover:text-red-500"><X className="h-3 w-3" /></button>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1">
                            <Link href={`/stocks/${it.symbol}`} className="font-bold hover:underline truncate max-w-[120px]">{it.name}</Link>
                            <button onClick={() => remove(it.symbol)} className="text-muted-foreground hover:text-red-500 shrink-0"><X className="h-3 w-3" /></button>
                          </div>
                          <div className="text-[11px] text-muted-foreground">{it.symbol}{it.sector ? ` · ${it.sector}` : ''}</div>
                        </div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={items.length + 1} className="py-16 text-center"><Loader2 className="h-5 w-5 animate-spin inline text-muted-foreground" /></td></tr>
                ) : rows.map(row => (
                  <tr key={row.label} className="border-b last:border-0">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground align-top">{row.label}</td>
                    {items.map(it => (
                      <td key={it.symbol} className="px-3 py-2.5 align-top">
                        {it.notFound ? <span className="text-muted-foreground">-</span> : row.render(it)}
                      </td>
                    ))}
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

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}>
      <CompareInner />
    </Suspense>
  );
}
