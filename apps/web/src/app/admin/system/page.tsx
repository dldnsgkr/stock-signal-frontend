'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle, Database, Newspaper, TrendingUp, BarChart2, ShieldAlert } from 'lucide-react';

// ── 타입 ───────────────────────────────────────────────────────────────────
interface Process {
  id: number; name: string; status: string;
  uptimeMs: number | null; restarts: number;
  memoryBytes: number; cpu: number; pid: number;
}
interface SystemStatus {
  processes: Process[]; memory: string; disk: string; uptime: string; error?: string;
}

type HealthStatus = 'ok' | 'warn' | 'danger' | 'unknown';

interface MarketHealth {
  market: string;
  signal:    { lastRunAt: string | null; ageHours: number | null; runCount30d: number; status: HealthStatus };
  price:     { lastDate: string | null; ageDays: number | null; stockCount: number; status: HealthStatus };
  financial: { latestPeriod: string | null; count: number; status: HealthStatus };
}
interface DataHealth {
  checkedAt: string;
  markets: MarketHealth[];
  news: { last24h: number; last7d: number; status: HealthStatus };
  queues: Record<string, { waiting: number; active: number; failed: number } | null>;
  summary: { hasWarning: boolean; hasDanger: boolean; totalFailedJobs: number };
}

interface QualityIssue {
  type: 'price_spike' | 'zero_price' | 'financial_anomaly';
  severity: 'danger' | 'warn';
  symbol: string;
  name: string;
  detail: string;
  date: string;
}
interface DataQuality {
  market: string;
  checkedAt: string;
  total: number;
  danger: number;
  warn: number;
  issues: QualityIssue[];
}
// ──────────────────────────────────────────────────────────────────────────

function fmtBytes(b: number) {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
  if (b >= 1048576)    return `${(b / 1048576).toFixed(0)} MB`;
  return `${(b / 1024).toFixed(0)} KB`;
}
function fmtUptime(ms: number | null) {
  if (ms === null) return '-';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}일 ${h}시간`;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분`;
}
function parseMemory(raw: string) {
  const line = raw.split('\n').find(l => l.startsWith('Mem:'));
  if (!line) return null;
  const p = line.split(/\s+/);
  return { total: +p[1], used: +p[2], available: +(p[6] ?? p[3]) };
}
function parseDisk(raw: string) {
  const p = raw.trim().split(/\s+/);
  return { size: p[1], used: p[2], avail: p[3], usePct: p[4] };
}

// ── 공용 컴포넌트 ──────────────────────────────────────────────────────────
function StatusIcon({ status }: { status: HealthStatus }) {
  if (status === 'ok')      return <CheckCircle  className="h-4 w-4 text-green-500" />;
  if (status === 'warn')    return <AlertCircle  className="h-4 w-4 text-amber-500" />;
  if (status === 'danger')  return <XCircle      className="h-4 w-4 text-red-500" />;
  return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
}

const statusRing: Record<HealthStatus, string> = {
  ok:      'border-green-200  bg-green-50  dark:border-green-900  dark:bg-green-950/30',
  warn:    'border-amber-200  bg-amber-50  dark:border-amber-900  dark:bg-amber-950/30',
  danger:  'border-red-200    bg-red-50    dark:border-red-900    dark:bg-red-950/30',
  unknown: 'border-muted      bg-muted/30',
};
const statusLabel: Record<HealthStatus, string> = {
  ok: '정상', warn: '주의', danger: '위험', unknown: '알 수 없음',
};
const statusText: Record<HealthStatus, string> = {
  ok: 'text-green-600', warn: 'text-amber-600', danger: 'text-red-600', unknown: 'text-muted-foreground',
};

function MemBar({ pct, warn = 70, danger = 90 }: { pct: number; warn?: number; danger?: number }) {
  const color = pct >= danger ? 'bg-red-500' : pct >= warn ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-muted-foreground w-8">{pct.toFixed(0)}%</span>
    </div>
  );
}

function ProcessBadge({ status }: { status: string }) {
  if (status === 'online') return (
    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
      <CheckCircle className="h-3.5 w-3.5" /> online
    </span>
  );
  if (status === 'stopped') return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <XCircle className="h-3.5 w-3.5" /> stopped
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-xs text-amber-500">
      <AlertCircle className="h-3.5 w-3.5" /> {status}
    </span>
  );
}

// ── 헬스체크 카드 ──────────────────────────────────────────────────────────
function HealthCard({
  icon: Icon, title, status, main, sub,
}: {
  icon: React.ElementType; title: string; status: HealthStatus; main: string; sub: string;
}) {
  return (
    <div className={`rounded-lg border p-4 space-y-2 ${statusRing[status]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{title}</span>
        <span className={`ml-auto text-xs font-semibold ${statusText[status]}`}>{statusLabel[status]}</span>
      </div>
      <p className="text-lg font-bold leading-none">{main}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function MarketHealthSection({ m }: { m: MarketHealth }) {
  const flag = m.market === 'US' ? '🇺🇸' : '🇰🇷';
  const worst: HealthStatus =
    m.signal.status === 'danger' || m.price.status === 'danger' ? 'danger'
    : m.signal.status === 'warn'  || m.price.status === 'warn'  ? 'warn'
    : 'ok';

  return (
    <div className={`rounded-lg border p-4 space-y-3 ${statusRing[worst]}`}>
      <div className="flex items-center gap-2">
        <span className="text-base">{flag}</span>
        <span className="font-semibold text-sm">{m.market}</span>
        <StatusIcon status={worst} />
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        {/* 시그널 */}
        <div className="space-y-0.5">
          <p className="text-muted-foreground flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> 시그널
          </p>
          <p className={`font-semibold ${statusText[m.signal.status]}`}>
            {m.signal.ageHours !== null ? `${m.signal.ageHours}시간 전` : '없음'}
          </p>
          <p className="text-muted-foreground">30일 {m.signal.runCount30d}회 실행</p>
        </div>
        {/* 가격 */}
        <div className="space-y-0.5">
          <p className="text-muted-foreground flex items-center gap-1">
            <BarChart2 className="h-3 w-3" /> 가격 데이터
          </p>
          <p className={`font-semibold ${statusText[m.price.status]}`}>
            {m.price.ageDays !== null ? `${m.price.ageDays}일 전` : '없음'}
          </p>
          <p className="text-muted-foreground">{m.price.stockCount.toLocaleString()}개 종목</p>
        </div>
        {/* 재무 */}
        <div className="col-span-2 space-y-0.5">
          <p className="text-muted-foreground flex items-center gap-1">
            <Database className="h-3 w-3" /> 재무 데이터
          </p>
          <p className="font-semibold">
            {m.financial.latestPeriod
              ? new Date(m.financial.latestPeriod).toLocaleDateString('ko-KR')
              : '-'}
          </p>
          <p className="text-muted-foreground">{m.financial.count.toLocaleString()}건</p>
        </div>
      </div>
    </div>
  );
}

function QueueSection({ queues }: { queues: DataHealth['queues'] }) {
  const LABELS: Record<string, string> = {
    'run-pipeline':             '전체 파이프라인',
    'generate-recommendations': '시그널 생성',
    'collect-prices':           '주가 수집',
    'collect-news':             '뉴스 수집',
    'collect-financials':       '재무 수집',
  };
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">큐</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">대기</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">실행 중</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">실패</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {Object.entries(LABELS).map(([key, label]) => {
            const q = queues[key];
            return (
              <tr key={key} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium">{label}</td>
                <td className="px-3 py-2 text-right">{q?.waiting ?? '-'}</td>
                <td className="px-3 py-2 text-right">
                  {q?.active != null && q.active > 0
                    ? <span className="text-blue-500 font-semibold">{q.active}</span>
                    : (q?.active ?? '-')}
                </td>
                <td className="px-3 py-2 text-right">
                  {q?.failed != null && q.failed > 0
                    ? <span className="text-red-500 font-semibold">{q.failed}</span>
                    : (q?.failed ?? '-')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 데이터 품질 섹션 ───────────────────────────────────────────────────────
const TYPE_LABEL: Record<QualityIssue['type'], string> = {
  price_spike:        '가격 급변',
  zero_price:         '이상 가격',
  financial_anomaly:  '재무 이상치',
};

function QualitySection({ quality, loading, onCheck }: {
  quality: DataQuality | null;
  loading: boolean;
  onCheck: (market: string) => void;
}) {
  const [market, setMarket] = useState<'US' | 'KR'>('US');

  return (
    <Card>
      <div className="border-b px-4 py-3 flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-muted-foreground" />
        <span className="font-semibold text-sm">데이터 품질 검사</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="flex gap-1 rounded-lg bg-muted p-0.5">
            {(['US', 'KR'] as const).map(m => (
              <button key={m} onClick={() => setMarket(m)}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${market === m ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                {m}
              </button>
            ))}
          </div>
          <button
            onClick={() => onCheck(market)}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShieldAlert className="h-3 w-3" />}
            검사 실행
          </button>
        </div>
      </div>
      <CardContent className="pt-4">
        {!quality ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            검사 실행 버튼을 눌러 이상치를 확인하세요
          </p>
        ) : loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : quality.total === 0 ? (
          <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-3">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-sm text-green-700 dark:text-green-400">
              {quality.market} 이상치 없음 — 가격·재무 데이터 정상
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>총 {quality.total}건</span>
              {quality.danger > 0 && <span className="text-red-600 font-semibold">위험 {quality.danger}건</span>}
              {quality.warn > 0   && <span className="text-amber-600 font-semibold">주의 {quality.warn}건</span>}
              <span className="ml-auto">점검: {new Date(quality.checkedAt).toLocaleString('ko-KR')}</span>
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">유형</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">종목</th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">이상 내용</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">날짜</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {quality.issues.map((issue, i) => (
                    <tr key={i} className={`hover:bg-muted/30 ${issue.severity === 'danger' ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`}>
                      <td className="px-3 py-2">
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          issue.severity === 'danger'
                            ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400'
                            : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                        }`}>
                          {TYPE_LABEL[issue.type]}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-semibold">{issue.symbol}</span>
                        <span className="ml-1 text-muted-foreground hidden sm:inline">{issue.name.slice(0, 12)}</span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground font-mono">{issue.detail}</td>
                      <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                        {new Date(issue.date).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
// ──────────────────────────────────────────────────────────────────────────

// ── 메인 페이지 ────────────────────────────────────────────────────────────
export default function SystemPage() {
  const [health,   setHealth]   = useState<DataHealth | null>(null);
  const [status,   setStatus]   = useState<SystemStatus | null>(null);
  const [quality,  setQuality]  = useState<DataQuality | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [qualityLoading, setQualityLoading] = useState(false);

  const fetchAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [hRes, sRes] = await Promise.all([
        fetch('/api/admin-proxy?endpoint=/admin/health'),
        fetch('/api/admin-proxy?endpoint=/admin/system'),
      ]);
      const [h, s] = await Promise.all([hRes.json(), sRes.json()]);
      setHealth(h);
      setStatus(s);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const runQualityCheck = async (market: string) => {
    setQualityLoading(true);
    try {
      const res = await fetch(`/api/admin-proxy?endpoint=/admin/quality&market=${market}`);
      setQuality(await res.json());
    } finally {
      setQualityLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const mem     = status?.memory ? parseMemory(status.memory) : null;
  const disk    = status?.disk   ? parseDisk(status.disk) : null;
  const usedPct = mem ? ((mem.total - mem.available) / mem.total) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">데이터 헬스체크 · EC2 서버 상태</p>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-5">

          {/* ── 헬스체크 요약 배너 ──────────────────────────── */}
          {health && (
            <div className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
              health.summary.hasDanger  ? 'border-red-300   bg-red-50   dark:border-red-900  dark:bg-red-950/30'
              : health.summary.hasWarning ? 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30'
              : 'border-green-300 bg-green-50 dark:border-green-900 dark:bg-green-950/30'
            }`}>
              <StatusIcon status={health.summary.hasDanger ? 'danger' : health.summary.hasWarning ? 'warn' : 'ok'} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${
                  health.summary.hasDanger ? 'text-red-700 dark:text-red-300'
                  : health.summary.hasWarning ? 'text-amber-700 dark:text-amber-300'
                  : 'text-green-700 dark:text-green-300'
                }`}>
                  {health.summary.hasDanger  ? '데이터 이상 감지 — 즉시 확인 필요'
                   : health.summary.hasWarning ? '일부 데이터 지연 — 확인 권장'
                   : '모든 데이터 정상'}
                </p>
                <p className="text-xs text-muted-foreground">
                  점검 시각: {new Date(health.checkedAt).toLocaleString('ko-KR')}
                  {health.summary.totalFailedJobs > 0 && ` · 실패 Job ${health.summary.totalFailedJobs}건`}
                </p>
              </div>
            </div>
          )}

          {/* ── 시장별 데이터 헬스 ──────────────────────────── */}
          {health && (
            <Card>
              <div className="border-b px-4 py-3">
                <span className="font-semibold text-sm">데이터 신선도</span>
              </div>
              <CardContent className="pt-4">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {health.markets.map(m => <MarketHealthSection key={m.market} m={m} />)}

                  <HealthCard
                    icon={Newspaper}
                    title="뉴스 수집"
                    status={health.news.status}
                    main={`24h: ${health.news.last24h.toLocaleString()}건`}
                    sub={`7일: ${health.news.last7d.toLocaleString()}건`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Bull 큐 상태 ────────────────────────────────── */}
          {health && (
            <Card>
              <div className="border-b px-4 py-3">
                <span className="font-semibold text-sm">Bull 큐 현황</span>
              </div>
              <CardContent className="pt-4">
                <QueueSection queues={health.queues} />
              </CardContent>
            </Card>
          )}

          {/* ── 데이터 품질 검사 ─────────────────────────────── */}
          <QualitySection
            quality={quality}
            loading={qualityLoading}
            onCheck={runQualityCheck}
          />

          {/* ── PM2 프로세스 ─────────────────────────────────── */}
          <Card>
            <div className="border-b px-4 py-3">
              <span className="font-semibold text-sm">PM2 프로세스</span>
            </div>
            <CardContent className="pt-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(status?.processes ?? []).map(proc => (
                  <div key={proc.id} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm truncate">{proc.name}</p>
                        <p className="text-xs text-muted-foreground">PID {proc.pid} · #{proc.id}</p>
                      </div>
                      <ProcessBadge status={proc.status} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <p className="text-muted-foreground">메모리</p>
                        <p className="font-medium">{fmtBytes(proc.memoryBytes)}</p>
                        <MemBar pct={(proc.memoryBytes / (1.5 * 1073741824)) * 100} />
                      </div>
                      <div>
                        <p className="text-muted-foreground">CPU</p>
                        <p className="font-medium">{proc.cpu.toFixed(1)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">가동 시간</p>
                        <p className="font-medium">{fmtUptime(proc.uptimeMs)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">재시작</p>
                        <p className={`font-medium ${proc.restarts > 5 ? 'text-red-500' : proc.restarts > 0 ? 'text-amber-500' : ''}`}>
                          {proc.restarts}회
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* ── 서버 리소스 ──────────────────────────────────── */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <div className="border-b px-4 py-3">
                <span className="font-semibold text-sm">메모리 (RAM)</span>
              </div>
              <CardContent className="pt-4 space-y-3">
                {mem ? (
                  <>
                    <MemBar pct={usedPct} />
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div><p className="text-muted-foreground">전체</p><p className="font-medium">{mem.total} MB</p></div>
                      <div><p className="text-muted-foreground">사용 중</p><p className="font-medium">{(mem.total - mem.available).toLocaleString()} MB</p></div>
                      <div><p className="text-muted-foreground">사용 가능</p><p className="font-medium text-green-600">{mem.available.toLocaleString()} MB</p></div>
                    </div>
                    <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre">{status?.memory}</pre>
                  </>
                ) : <p className="text-sm text-muted-foreground">데이터 없음</p>}
              </CardContent>
            </Card>

            <Card>
              <div className="border-b px-4 py-3">
                <span className="font-semibold text-sm">디스크 / 서버 가동</span>
              </div>
              <CardContent className="pt-4 space-y-4">
                {disk && (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">디스크 (루트 파티션)</p>
                    <MemBar pct={parseInt(disk.usePct)} />
                    <div className="grid grid-cols-3 gap-2 text-xs text-center">
                      <div><p className="text-muted-foreground">전체</p><p className="font-medium">{disk.size}</p></div>
                      <div><p className="text-muted-foreground">사용</p><p className="font-medium">{disk.used}</p></div>
                      <div><p className="text-muted-foreground">여유</p><p className="font-medium text-green-600">{disk.avail}</p></div>
                    </div>
                  </div>
                )}
                {status?.uptime && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">서버 가동 시간</p>
                    <p className="text-xs font-mono bg-muted/50 rounded p-2">{status.uptime}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
