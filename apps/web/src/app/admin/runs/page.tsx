'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { RefreshCw, Loader2, CheckCircle, AlertCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react';

interface Run {
  id: number;
  marketCode: string;
  executedAt: string;
  runType: string;
  modelVersion: string;
  count: number;
  notes: string | null;
}

interface Failure {
  queue: string;
  jobId: string;
  market: string | null;
  failedAt: string | null;
  reason: string;
  attemptsMade: number;
}

// ── 에러 진단 ──────────────────────────────────────────────────────────────
interface Diagnosis {
  label: string;
  detail: string;
  severity: 'high' | 'medium' | 'low';
}

function diagnose(reason: string): Diagnosis {
  const r = reason.toLowerCase();

  if (r.includes('econnrefused') || r.includes('connect econnrefused'))
    return { label: '연결 거부', detail: 'Redis 또는 DB 서버에 연결하지 못했습니다. 해당 서비스가 실행 중인지 확인하세요.', severity: 'high' };
  if (r.includes('etimedout') || r.includes('connection timed out'))
    return { label: '연결 타임아웃', detail: '외부 서버 응답이 너무 느리거나 네트워크 문제가 있습니다.', severity: 'high' };
  if (r.includes('timeout') || r.includes('timed out'))
    return { label: '작업 타임아웃', detail: '설정된 시간 내에 작업이 완료되지 않았습니다. 데이터 양이 많거나 외부 API가 느린 경우 발생합니다.', severity: 'medium' };
  if (r.includes('rate limit') || r.includes('429') || r.includes('too many requests'))
    return { label: 'API 속도 제한', detail: '외부 API 호출 횟수가 한도를 초과했습니다. 잠시 후 재시도하거나 API 키를 점검하세요.', severity: 'medium' };
  if (r.includes('401') || r.includes('unauthorized') || r.includes('403') || r.includes('forbidden'))
    return { label: '인증 오류', detail: 'API 키 또는 토큰이 만료되었거나 잘못된 상태입니다. 환경변수를 확인하세요.', severity: 'high' };
  if (r.includes('enotfound') || r.includes('getaddrinfo'))
    return { label: 'DNS 오류', detail: '호스트를 찾을 수 없습니다. 도메인 이름이나 네트워크 연결을 확인하세요.', severity: 'high' };
  if (r.includes('sigkill') || r.includes('killed') || r.includes('oom') || r.includes('out of memory'))
    return { label: 'OOM / 강제 종료', detail: '프로세스가 메모리 부족으로 강제 종료되었습니다. EC2 메모리 사용량을 확인하세요.', severity: 'high' };
  if (r.includes('stalled') || r.includes('stall'))
    return { label: 'Job Stall', detail: 'Bull이 job lock을 갱신하지 못해 stalled 상태로 전환되었습니다. API 또는 worker 재시작 직후 발생할 수 있습니다.', severity: 'medium' };
  if (r.includes('prisma') || r.includes('database') || r.includes('unique constraint') || r.includes('foreign key'))
    return { label: 'DB 오류', detail: 'Prisma / PostgreSQL 쿼리 실패입니다. 데이터 무결성 문제나 DB 연결 상태를 확인하세요.', severity: 'high' };
  if (r.includes('fetch failed') || r.includes('fetcherror') || r.includes('network error'))
    return { label: '네트워크 오류', detail: '외부 API 요청이 실패했습니다. 인터넷 연결 또는 대상 서버 상태를 확인하세요.', severity: 'medium' };
  if (r.includes('500') || r.includes('internal server error'))
    return { label: '서버 내부 오류', detail: '외부 API가 500 에러를 반환했습니다. 외부 서비스 장애일 가능성이 높습니다.', severity: 'medium' };
  if (r.includes('heap') || r.includes('memory') || r.includes('allocation failed'))
    return { label: '메모리 부족', detail: 'Node.js 힙 메모리가 부족합니다. 대용량 데이터 처리 중 발생할 수 있습니다.', severity: 'high' };
  if (r.includes('syntax') || r.includes('parse') || r.includes('json'))
    return { label: '파싱 오류', detail: '외부 API 응답 또는 내부 데이터가 예상한 형식이 아닙니다.', severity: 'low' };

  return { label: '알 수 없는 오류', detail: '패턴과 일치하는 원인을 찾지 못했습니다. 전체 로그를 직접 확인하세요.', severity: 'low' };
}

const severityStyle = {
  high: 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 border border-red-200 dark:border-red-800',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
  low: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
};
// ──────────────────────────────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeDiff(d: string | null) {
  if (!d) return '';
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(h / 24);
  if (days > 0) return `${days}일 전`;
  if (h > 0) return `${h}시간 전`;
  return `${Math.floor(diff / 60000)}분 전`;
}

// ── 개별 실패 카드 ──────────────────────────────────────────────────────────
function FailureCard({ f }: { f: Failure }) {
  const [expanded, setExpanded] = useState(false);
  const diagnosis = diagnose(f.reason);
  const isLong = f.reason.length > 300;

  return (
    <div className="py-4 px-1 flex flex-col gap-2">
      {/* 헤더 */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-semibold text-red-600 dark:text-red-400">{f.queue}</span>
        {f.market && (
          <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-medium">{f.market}</span>
        )}
        <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
          {fmtDate(f.failedAt)} · {timeDiff(f.failedAt)}
        </span>
      </div>

      {/* 진단 */}
      <div className={`rounded-md px-3 py-2 text-xs ${severityStyle[diagnosis.severity]}`}>
        <span className="font-semibold">[{diagnosis.label}]</span>{' '}
        {diagnosis.detail}
      </div>

      {/* 원본 에러 */}
      <div className="rounded-md bg-muted/60 border text-xs font-mono overflow-hidden">
        <div className="px-3 py-2 text-foreground/80 leading-relaxed whitespace-pre-wrap break-all">
          {expanded || !isLong ? f.reason : f.reason.slice(0, 300) + '…'}
        </div>
        {isLong && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-full flex items-center justify-center gap-1 border-t px-3 py-1.5 text-muted-foreground hover:bg-muted text-xs"
          >
            {expanded
              ? <><ChevronUp className="h-3 w-3" />접기</>
              : <><ChevronDown className="h-3 w-3" />전체 보기 ({f.reason.length}자)</>}
          </button>
        )}
      </div>

      {/* 메타 */}
      <p className="text-xs text-muted-foreground">Job #{f.jobId} · 시도 {f.attemptsMade}회</p>
    </div>
  );
}
// ──────────────────────────────────────────────────────────────────────────

function RunTable({ data }: { data: Run[] }) {
  if (data.length === 0) return (
    <p className="text-sm text-muted-foreground py-8 text-center">실행 이력 없음</p>
  );

  const latest = data[0];
  const daysSinceLast = (Date.now() - new Date(latest.executedAt).getTime()) / 86400000;
  const isStale = daysSinceLast > 2;

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${isStale ? 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300'}`}>
        {isStale ? <AlertCircle className="h-4 w-4 shrink-0" /> : <CheckCircle className="h-4 w-4 shrink-0" />}
        <span>
          마지막 실행: <strong>{fmtDate(latest.executedAt)}</strong> ({timeDiff(latest.executedAt)}) · {latest.count.toLocaleString()}개 시그널
          {isStale && <span className="ml-2 font-semibold">— {Math.floor(daysSinceLast)}일 지연</span>}
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">실행 시각</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">모델</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">시그널 수</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">유형</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {data.map((run, i) => (
              <tr key={run.id} className={`hover:bg-muted/30 ${i === 0 ? 'font-medium' : ''}`}>
                <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                  {fmtDate(run.executedAt)}
                  <span className="ml-1 text-muted-foreground/60">({timeDiff(run.executedAt)})</span>
                </td>
                <td className="px-3 py-2">
                  <span className="rounded bg-primary/10 text-primary px-1.5 py-0.5">{run.modelVersion}</span>
                </td>
                <td className="px-3 py-2 text-right">
                  {run.count === 0
                    ? <span className="text-red-500 flex items-center justify-end gap-1"><AlertCircle className="h-3 w-3" />0</span>
                    : run.count.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{run.runType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PipelineTab({ runs, loading }: { runs: Run[]; loading: boolean }) {
  const usRuns = runs.filter(r => r.marketCode === 'US');
  const krRuns = runs.filter(r => r.marketCode === 'KR');

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <span className="text-base">🇺🇸</span>
          <span className="font-semibold text-sm">미국 시장</span>
          <span className="text-xs text-muted-foreground ml-auto">{usRuns.length}회</span>
        </div>
        <CardContent className="pt-4">
          <RunTable data={usRuns} />
        </CardContent>
      </Card>
      <Card>
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <span className="text-base">🇰🇷</span>
          <span className="font-semibold text-sm">한국 시장</span>
          <span className="text-xs text-muted-foreground ml-auto">{krRuns.length}회</span>
        </div>
        <CardContent className="pt-4">
          <RunTable data={krRuns} />
        </CardContent>
      </Card>
    </div>
  );
}

function FailureTab({ failures, loading }: { failures: Failure[]; loading: boolean }) {
  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (failures.length === 0) return (
    <div className="flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-4">
      <CheckCircle className="h-4 w-4 text-green-600" />
      <span className="text-sm text-green-700 dark:text-green-400">최근 실패한 job이 없습니다</span>
    </div>
  );

  return (
    <Card className="border-red-200 dark:border-red-900">
      <div className="border-b border-red-200 dark:border-red-900 px-4 py-3 flex items-center gap-2 bg-red-50 dark:bg-red-950/30 rounded-t-lg">
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="font-semibold text-sm text-red-700 dark:text-red-400">실패 로그</span>
        <span className="ml-auto text-xs text-red-500 font-medium">{failures.length}건</span>
      </div>
      <CardContent className="pt-0 pb-2">
        <div className="divide-y">
          {failures.map((f, i) => <FailureCard key={i} f={f} />)}
        </div>
      </CardContent>
    </Card>
  );
}

type SubTab = 'pipeline' | 'failures';

export default function RunsPage() {
  const [subTab, setSubTab] = useState<SubTab>('pipeline');
  const [runs, setRuns] = useState<Run[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [runsRes, failRes] = await Promise.all([
        fetch('/api/admin-proxy?endpoint=/admin/runs&limit=50'),
        fetch('/api/admin-proxy?endpoint=/admin/jobs/failures&limit=30'),
      ]);
      const [runsData, failData] = await Promise.all([runsRes.json(), failRes.json()]);
      setRuns(Array.isArray(runsData) ? runsData : []);
      setFailures(Array.isArray(failData) ? failData : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const SUB_TABS: { key: SubTab; label: string; badge?: number }[] = [
    { key: 'pipeline', label: '파이프라인 실행 이력' },
    { key: 'failures', label: '실패 로그', badge: failures.length || undefined },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {SUB_TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setSubTab(t.key)}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                subTab === t.key
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
              {t.badge != null && t.badge > 0 && (
                <span className="rounded-full bg-red-500 text-white text-[10px] leading-none px-1.5 py-0.5 font-semibold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted"
        >
          <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
          새로고침
        </button>
      </div>

      {subTab === 'pipeline' && <PipelineTab runs={runs} loading={loading} />}
      {subTab === 'failures' && <FailureTab failures={failures} loading={loading} />}
    </div>
  );
}
