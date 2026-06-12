'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';

const SERVICES = [
  { value: 'api',          label: 'API 출력 (stdout)' },
  { value: 'api-error',    label: 'API 오류 (stderr)' },
  { value: 'analysis',     label: '분석 서비스 로그' },
];

const LINE_COUNTS = [100, 200, 500, 1000];

function classifyLine(line: string): 'error' | 'warn' | 'info' | 'default' {
  const l = line.toLowerCase();
  if (l.includes('error') || l.includes('exception') || l.includes('failed') || l.includes('fatal')) return 'error';
  if (l.includes('warn') || l.includes('warning') || l.includes('timeout') || l.includes('retry')) return 'warn';
  if (l.includes('[scheduler]') || l.includes('pipeline') || l.includes('completed') || l.includes('done') || l.includes('started')) return 'info';
  return 'default';
}

const lineClass: Record<string, string> = {
  error:   'text-red-400 bg-red-950/30',
  warn:    'text-amber-400 bg-amber-950/20',
  info:    'text-green-400',
  default: 'text-slate-300',
};

export default function LogsPage() {
  const [service, setService] = useState('api');
  const [lineCount, setLineCount] = useState(200);
  const [lines, setLines] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [filter, setFilter] = useState('');
  const [onlyErrors, setOnlyErrors] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin-proxy?endpoint=/admin/logs&service=${service}&lines=${lineCount}`,
      );
      const data = await res.json();
      setLines(data.lines ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [service, lineCount]);

  useEffect(() => {
    setLoading(true);
    fetchLogs();
  }, [fetchLogs]);

  // 자동 새로고침
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 5000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, fetchLogs]);

  // 새 로그 도착 시 맨 아래로 스크롤
  useEffect(() => {
    if (autoRefresh) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines, autoRefresh]);

  const displayed = lines.filter(l => {
    if (onlyErrors && classifyLine(l) !== 'error' && classifyLine(l) !== 'warn') return false;
    if (filter && !l.toLowerCase().includes(filter.toLowerCase())) return false;
    return true;
  });

  const errorCount = lines.filter(l => classifyLine(l) === 'error').length;
  const warnCount = lines.filter(l => classifyLine(l) === 'warn').length;

  return (
    <div className="space-y-3">
      {/* 컨트롤 바 */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={service}
          onChange={e => setService(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {SERVICES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>

        <select
          value={lineCount}
          onChange={e => setLineCount(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {LINE_COUNTS.map(n => <option key={n} value={n}>최근 {n}줄</option>)}
        </select>

        <input
          type="text"
          placeholder="검색..."
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring w-40"
        />

        <label className="flex items-center gap-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={onlyErrors}
            onChange={e => setOnlyErrors(e.target.checked)}
            className="rounded"
          />
          오류/경고만
        </label>

        <label className="flex items-center gap-1.5 text-sm cursor-pointer ml-1">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={e => setAutoRefresh(e.target.checked)}
            className="rounded"
          />
          자동 새로고침 (5s)
        </label>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs hover:bg-muted ml-auto"
        >
          <RefreshCw className="h-3 w-3" />
          새로고침
        </button>
      </div>

      {/* 요약 배지 */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>전체 {total.toLocaleString()}줄 중 최근 {lines.length}줄 표시</span>
        {errorCount > 0 && (
          <span className="text-red-500 font-medium">{errorCount}개 오류</span>
        )}
        {warnCount > 0 && (
          <span className="text-amber-500 font-medium">{warnCount}개 경고</span>
        )}
        {filter && <span>필터 적용: &quot;{filter}&quot; → {displayed.length}줄</span>}
        {autoRefresh && (
          <span className="flex items-center gap-1 text-green-500">
            <Loader2 className="h-3 w-3 animate-spin" /> 실시간
          </span>
        )}
      </div>

      {/* 로그 터미널 */}
      <div className="rounded-lg border bg-slate-950 overflow-auto h-[calc(100vh-320px)] min-h-[400px] font-mono text-xs leading-relaxed p-3">
        {loading ? (
          <div className="flex items-center justify-center h-full text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> 로딩 중...
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            표시할 로그가 없습니다
          </div>
        ) : (
          displayed.map((line, i) => {
            const cls = classifyLine(line);
            return (
              <div
                key={i}
                className={`px-1.5 py-0.5 rounded-sm whitespace-pre-wrap break-all ${lineClass[cls]}`}
              >
                {line}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
