'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { RefreshCw, Loader2, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

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
      <CardContent className="pt-0 pb-0">
        <div className="divide-y">
          {failures.map((f, i) => (
            <div key={i} className="py-3 px-1 flex flex-col gap-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">{f.queue}</span>
                {f.market && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{f.market}</span>
                )}
                <span className="text-xs text-muted-foreground ml-auto whitespace-nowrap">
                  {fmtDate(f.failedAt)} ({timeDiff(f.failedAt)})
                </span>
              </div>
              <p className="text-xs font-mono bg-muted/60 rounded px-2 py-1.5 break-all text-foreground/80 leading-relaxed">
                {f.reason.slice(0, 400)}
              </p>
              <p className="text-xs text-muted-foreground">
                Job #{f.jobId} · 시도 {f.attemptsMade}회
              </p>
            </div>
          ))}
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
        {/* 서브탭 */}
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
