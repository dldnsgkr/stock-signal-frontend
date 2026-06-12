'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { RefreshCw, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface Run {
  id: number;
  marketCode: string;
  executedAt: string;
  runType: string;
  modelVersion: string;
  count: number;
  notes: string | null;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleString('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeDiff(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  const days = Math.floor(h / 24);
  if (days > 0) return `${days}일 전`;
  if (h > 0) return `${h}시간 전`;
  return `${Math.floor(diff / 60000)}분 전`;
}

export default function RunsPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRuns = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/admin-proxy?endpoint=/admin/runs&limit=50');
      const data = await res.json();
      setRuns(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRuns(); }, []);

  const usRuns = runs.filter(r => r.marketCode === 'US');
  const krRuns = runs.filter(r => r.marketCode === 'KR');

  function RunTable({ data, market }: { data: Run[]; market: string }) {
    if (data.length === 0) return (
      <p className="text-sm text-muted-foreground py-4 text-center">실행 이력 없음</p>
    );

    const latest = data[0];
    const latestDate = new Date(latest.executedAt);
    const daysSinceLast = (Date.now() - latestDate.getTime()) / 86400000;
    const isStale = daysSinceLast > 2;

    return (
      <div className="space-y-3">
        {/* 최신 실행 상태 */}
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${isStale ? 'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300'}`}>
          {isStale
            ? <AlertCircle className="h-4 w-4 shrink-0" />
            : <CheckCircle className="h-4 w-4 shrink-0" />
          }
          <span>
            마지막 실행: <strong>{fmtDate(latest.executedAt)}</strong> ({timeDiff(latest.executedAt)}) &middot; {latest.count.toLocaleString()}개 시그널
            {isStale && <span className="ml-2 font-semibold">— {Math.floor(daysSinceLast)}일 지연됨</span>}
          </span>
        </div>

        {/* 이력 테이블 */}
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">실행 시각</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">모델</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">시그널 수</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">유형</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">메모</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.map((run, i) => (
                <tr key={run.id} className={`hover:bg-muted/30 transition-colors ${i === 0 ? 'font-medium' : ''}`}>
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
                      : run.count.toLocaleString()
                    }
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{run.runType}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate max-w-[180px]">{run.notes ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">최근 50회 파이프라인 실행 이력</p>
        <button
          onClick={() => fetchRuns(true)}
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
        <div className="grid gap-5 lg:grid-cols-2">
          <Card>
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <span className="text-base">🇺🇸</span>
              <span className="font-semibold text-sm">미국 시장</span>
              <span className="text-xs text-muted-foreground ml-auto">{usRuns.length}회</span>
            </div>
            <CardContent className="pt-4">
              <RunTable data={usRuns} market="US" />
            </CardContent>
          </Card>

          <Card>
            <div className="border-b px-4 py-3 flex items-center gap-2">
              <span className="text-base">🇰🇷</span>
              <span className="font-semibold text-sm">한국 시장</span>
              <span className="text-xs text-muted-foreground ml-auto">{krRuns.length}회</span>
            </div>
            <CardContent className="pt-4">
              <RunTable data={krRuns} market="KR" />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
