'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { RefreshCw, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface Process {
  id: number;
  name: string;
  status: string;
  uptimeMs: number | null;
  restarts: number;
  memoryBytes: number;
  cpu: number;
  pid: number;
}

interface SystemStatus {
  processes: Process[];
  memory: string;
  disk: string;
  uptime: string;
  error?: string;
}

function fmtBytes(bytes: number) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(1)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
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
  const lines = raw.split('\n');
  const memLine = lines.find(l => l.startsWith('Mem:'));
  if (!memLine) return null;
  const parts = memLine.split(/\s+/);
  const total = parseInt(parts[1]);
  const used = parseInt(parts[2]);
  const free = parseInt(parts[3]);
  const available = parseInt(parts[6] ?? parts[3]);
  return { total, used, free, available };
}

function parseDisk(raw: string) {
  const parts = raw.trim().split(/\s+/);
  return {
    size: parts[1],
    used: parts[2],
    avail: parts[3],
    usePct: parts[4],
  };
}

function StatusBadge({ status }: { status: string }) {
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

export default function SystemPage() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStatus = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch('/api/admin-proxy?endpoint=/admin/system');
      const data = await res.json();
      setStatus(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const mem = status?.memory ? parseMemory(status.memory) : null;
  const disk = status?.disk ? parseDisk(status.disk) : null;
  const usedPct = mem ? ((mem.total - mem.available) / mem.total) * 100 : 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">EC2 서버 실시간 상태</p>
        <button
          onClick={() => fetchStatus(true)}
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
      ) : status?.error ? (
        <Card>
          <CardContent className="py-8 text-center text-sm text-red-500">
            시스템 정보를 불러올 수 없습니다: {status.error}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-5">
          {/* PM2 프로세스 */}
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
                      <StatusBadge status={proc.status} />
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

          {/* 서버 리소스 */}
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
                      <div>
                        <p className="text-muted-foreground">전체</p>
                        <p className="font-medium">{mem.total} MB</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">사용 중</p>
                        <p className="font-medium">{(mem.total - mem.available).toLocaleString()} MB</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">사용 가능</p>
                        <p className="font-medium text-green-600">{mem.available.toLocaleString()} MB</p>
                      </div>
                    </div>
                    <pre className="text-xs text-muted-foreground bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre">
                      {status?.memory}
                    </pre>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">데이터 없음</p>
                )}
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
                      <div>
                        <p className="text-muted-foreground">전체</p>
                        <p className="font-medium">{disk.size}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">사용</p>
                        <p className="font-medium">{disk.used}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">여유</p>
                        <p className="font-medium text-green-600">{disk.avail}</p>
                      </div>
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
