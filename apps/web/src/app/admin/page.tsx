'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Play, RefreshCw, LogOut, CheckCircle, XCircle, Clock, Loader2, Zap } from 'lucide-react';

type JobStatus = 'idle' | 'waiting' | 'active' | 'completed' | 'failed';

interface JobState {
  jobId: string | null;
  status: JobStatus;
  startedAt: number | null;
  elapsed: number;
  failedReason?: string;
  progress?: number;
  currentStep?: string;
}

function getQueueFromEndpoint(endpoint: string): string {
  return endpoint.replace('/admin/jobs/', '');
}

function fmtElapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}초`;
  return `${Math.floor(s / 60)}분 ${s % 60}초`;
}

function StatusBadge({ status, elapsed, failedReason }: { status: JobStatus; elapsed: number; failedReason?: string }) {
  if (status === 'idle') return null;
  if (status === 'waiting') return (
    <span className="flex items-center gap-1 text-xs text-amber-500">
      <Clock className="h-3 w-3" /> 대기 중
    </span>
  );
  if (status === 'active') return (
    <span className="flex items-center gap-1 text-xs text-blue-500">
      <Loader2 className="h-3 w-3 animate-spin" /> 처리 중 {elapsed > 0 && `(${fmtElapsed(elapsed)})`}
    </span>
  );
  if (status === 'completed') return (
    <span className="flex items-center gap-1 text-xs text-green-600">
      <CheckCircle className="h-3 w-3" /> 완료 {elapsed > 0 && `(${fmtElapsed(elapsed)})`}
    </span>
  );
  if (status === 'failed') return (
    <span className="flex items-center gap-1 text-xs text-red-500" title={failedReason}>
      <XCircle className="h-3 w-3" /> 실패
    </span>
  );
  return null;
}

interface JobButtonProps {
  label: string;
  endpoint: string;
  params?: Record<string, string>;
}

function useJobPoller(queue: string) {
  const [job, setJob] = useState<JobState>({ jobId: null, status: 'idle', startedAt: null, elapsed: 0 });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    pollRef.current = null;
    timerRef.current = null;
  }, []);

  const startPolling = useCallback((jobId: string, startedAt: number) => {
    stopPolling();
    timerRef.current = setInterval(() => {
      setJob(prev => ({ ...prev, elapsed: Date.now() - startedAt }));
    }, 500);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/admin-proxy?queue=${queue}&jobId=${jobId}`);
        const data = await res.json();
        const s: JobStatus = data?.status ?? 'waiting';
        setJob(prev => ({
          ...prev,
          status: s,
          failedReason: data?.failedReason,
          progress: data?.progress,
          currentStep: data?.data?.currentStep,
        }));
        if (s === 'completed' || s === 'failed') stopPolling();
      } catch { /* ignore */ }
    }, 2000);
  }, [queue, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  return { job, setJob, startPolling, stopPolling };
}

function JobButton({ label, endpoint, params = {} }: JobButtonProps) {
  const queue = getQueueFromEndpoint(endpoint);
  const { job, setJob, startPolling, stopPolling } = useJobPoller(queue);
  const [loading, setLoading] = useState(false);

  const trigger = async () => {
    setLoading(true);
    stopPolling();
    const startedAt = Date.now();
    setJob({ jobId: null, status: 'waiting', startedAt, elapsed: 0 });
    try {
      const query = new URLSearchParams(params).toString();
      const res = await fetch(`/api/admin-proxy?endpoint=${encodeURIComponent(endpoint)}&${query}`, { method: 'POST' });
      const data = await res.json();
      const jobId = String(data.jobId ?? '');
      setJob(prev => ({ ...prev, jobId, status: 'waiting' }));
      if (jobId) startPolling(jobId, startedAt);
    } catch {
      setJob(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || job.status === 'active' || job.status === 'waiting';

  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <StatusBadge status={job.status} elapsed={job.elapsed} failedReason={job.failedReason} />
      </div>
      <button onClick={trigger} disabled={busy}
        className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50">
        {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
        실행
      </button>
    </div>
  );
}

const PIPELINE_STEPS: Record<string, { label: string; phase: number }> = {
  'stock-list':      { label: '종목 목록 동기화', phase: 1 },
  'data-collection': { label: '주가 · 뉴스 · 재무 · 거시 수집 (병렬)', phase: 2 },
  'recommendations': { label: '추천 시그널 생성', phase: 3 },
};

function PipelineButton({ market }: { market: string }) {
  const queue = 'run-pipeline';
  const endpoint = '/admin/jobs/run-pipeline';
  const { job, setJob, startPolling, stopPolling } = useJobPoller(queue);
  const [loading, setLoading] = useState(false);

  const trigger = async () => {
    setLoading(true);
    stopPolling();
    const startedAt = Date.now();
    setJob({ jobId: null, status: 'waiting', startedAt, elapsed: 0 });
    try {
      const res = await fetch(
        `/api/admin-proxy?endpoint=${encodeURIComponent(endpoint)}&market=${market}`,
        { method: 'POST' },
      );
      const data = await res.json();
      const jobId = String(data.jobId ?? '');
      setJob(prev => ({ ...prev, jobId, status: 'waiting' }));
      if (jobId) startPolling(jobId, startedAt);
    } catch {
      setJob(prev => ({ ...prev, status: 'failed' }));
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || job.status === 'active' || job.status === 'waiting';
  const currentPhase = job.currentStep ? PIPELINE_STEPS[job.currentStep]?.phase ?? 0 : 0;
  const progress = job.progress ?? 0;

  const stepStatus = (phase: number) => {
    if (job.status === 'idle') return 'idle';
    if (job.status === 'completed') return 'done';
    if (job.status === 'failed') return phase <= currentPhase ? 'failed' : 'idle';
    if (phase < currentPhase) return 'done';
    if (phase === currentPhase) return 'active';
    return 'pending';
  };

  return (
    <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4 space-y-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">전체 순차 실행</span>
          <span className="text-xs text-muted-foreground">종목 동기화 → 데이터 수집 → 추천 생성</span>
        </div>
        <button onClick={trigger} disabled={busy}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-1.5 text-xs text-white hover:bg-primary/90 disabled:opacity-50 font-medium">
          {busy ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
          {busy ? '실행 중' : '전체 실행'}
        </button>
      </div>

      {/* 단계 표시 */}
      {job.status !== 'idle' && (
        <div className="space-y-2">
          {/* 진행 바 */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
            {job.elapsed > 0 && (
              <span className="text-xs text-muted-foreground">{fmtElapsed(job.elapsed)}</span>
            )}
          </div>

          {/* 3단계 시각화 */}
          <div className="flex items-center gap-1 text-xs">
            {Object.entries(PIPELINE_STEPS).map(([key, step], idx) => {
              const s = stepStatus(step.phase);
              return (
                <div key={key} className="flex items-center gap-1 flex-1 min-w-0">
                  {idx > 0 && <div className={`h-px flex-shrink-0 w-3 ${s === 'done' ? 'bg-green-500' : 'bg-muted'}`} />}
                  <div className={`flex items-center gap-1 truncate px-2 py-1 rounded-md flex-1 min-w-0
                    ${s === 'active' ? 'bg-blue-500/10 text-blue-600' : ''}
                    ${s === 'done' ? 'bg-green-500/10 text-green-600' : ''}
                    ${s === 'pending' ? 'text-muted-foreground' : ''}
                    ${s === 'failed' ? 'bg-red-500/10 text-red-500' : ''}
                  `}>
                    {s === 'done' && <CheckCircle className="h-3 w-3 flex-shrink-0" />}
                    {s === 'active' && <Loader2 className="h-3 w-3 animate-spin flex-shrink-0" />}
                    {s === 'failed' && <XCircle className="h-3 w-3 flex-shrink-0" />}
                    {(s === 'pending' || s === 'idle') && <div className="h-3 w-3 rounded-full border border-current flex-shrink-0" />}
                    <span className="truncate">{step.label}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 최종 상태 */}
          {job.status === 'completed' && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> 전체 파이프라인 완료
            </p>
          )}
          {job.status === 'failed' && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <XCircle className="h-3 w-3" /> 실패: {job.failedReason ?? '알 수 없는 오류'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch('/api/admin-auth', { method: 'DELETE' });
    router.replace('/admin/login');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">관리자</h1>
          <p className="text-sm text-muted-foreground mt-0.5">데이터 수집 및 분석 실행</p>
        </div>
        <button onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">
          <LogOut className="h-3 w-3" />
          로그아웃
        </button>
      </div>

      {/* 미국 */}
      <Card>
        <CardHeader><CardTitle>🇺🇸 미국 시장</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <PipelineButton market="US" />
          <div className="border-t pt-2 space-y-2">
            <p className="text-xs text-muted-foreground pb-1">개별 실행</p>
            <JobButton label="종목 목록 동기화" endpoint="/admin/jobs/collect-stock-list" params={{ market: 'US' }} />
            <JobButton label="주가 수집" endpoint="/admin/jobs/collect-prices" params={{ market: 'US' }} />
            <JobButton label="뉴스 수집" endpoint="/admin/jobs/collect-news" params={{ market: 'US' }} />
            <JobButton label="재무지표 수집 (ROE/PER/PBR)" endpoint="/admin/jobs/collect-financials" params={{ market: 'US' }} />
            <JobButton label="거시지표 수집" endpoint="/admin/jobs/collect-macro" params={{ market: 'US' }} />
            <JobButton label="추천 시그널 생성" endpoint="/admin/jobs/generate-recommendations" params={{ market: 'US' }} />
          </div>
        </CardContent>
      </Card>

      {/* 한국 */}
      <Card>
        <CardHeader><CardTitle>🇰🇷 한국 시장</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <PipelineButton market="KR" />
          <div className="border-t pt-2 space-y-2">
            <p className="text-xs text-muted-foreground pb-1">개별 실행</p>
            <JobButton label="종목 목록 동기화" endpoint="/admin/jobs/collect-stock-list" params={{ market: 'KR' }} />
            <JobButton label="주가 수집" endpoint="/admin/jobs/collect-prices" params={{ market: 'KR' }} />
            <JobButton label="뉴스 수집" endpoint="/admin/jobs/collect-news" params={{ market: 'KR' }} />
            <JobButton label="재무지표 수집 (ROE/PER/PBR)" endpoint="/admin/jobs/collect-financials" params={{ market: 'KR' }} />
            <JobButton label="거시지표 수집 (KOSPI/KOSDAQ)" endpoint="/admin/jobs/collect-macro" params={{ market: 'KR' }} />
            <JobButton label="추천 시그널 생성" endpoint="/admin/jobs/generate-recommendations" params={{ market: 'KR' }} />
          </div>
        </CardContent>
      </Card>

      {/* 공통 */}
      <Card>
        <CardHeader><CardTitle>공통</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <JobButton label="추천 성과 평가" endpoint="/admin/jobs/evaluate-recommendations" />
        </CardContent>
      </Card>
    </div>
  );
}
