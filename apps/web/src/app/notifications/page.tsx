'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession, signIn } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, LogIn, Bell, TrendingUp, TrendingDown, Radio } from 'lucide-react';

interface NotiItem {
  id: number;
  kind: 'BUY' | 'SELL' | 'BROADCAST';
  title: string;
  body: string;
  url: string | null;
  market: string | null;
  scope: 'personal' | 'broadcast';
  createdAt: string;
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return '방금';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function KindIcon({ kind }: { kind: NotiItem['kind'] }) {
  if (kind === 'BUY') return <TrendingUp className="h-4 w-4 text-green-600" />;
  if (kind === 'SELL') return <TrendingDown className="h-4 w-4 text-red-500" />;
  return <Radio className="h-4 w-4 text-muted-foreground" />;
}

export default function NotificationsPage() {
  const { status } = useSession();
  const [items, setItems] = useState<NotiItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setItems(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
    if (status === 'unauthenticated') setLoading(false);
  }, [status, load]);

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <Bell className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">알림 이력은 로그인 후 볼 수 있습니다</p>
          <p className="text-sm text-muted-foreground mt-1">관심종목·시장 시그널 알림이 여기에 쌓입니다</p>
        </div>
        <button
          onClick={() => signIn('google')}
          className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
        >
          <LogIn className="h-4 w-4" /> Google 로그인
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-xl font-bold">알림 이력</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          관심종목 타겟 알림과 시장 전체 시그널 요약이 최근순으로 쌓입니다
        </p>
      </div>

      {loading || status === 'loading' ? (
        <div className="flex justify-center py-20 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            아직 알림이 없습니다. 다음 시그널 생성(평일 밤)부터 여기에 기록됩니다.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map(n => {
            const inner = (
              <div className="flex items-start gap-3 rounded-lg border bg-card p-3 hover:bg-muted/40 transition-colors">
                <div className="mt-0.5"><KindIcon kind={n.kind} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.scope === 'personal' && (
                      <span className="shrink-0 rounded-full bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 font-medium">관심종목</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{n.body}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground whitespace-nowrap">{relTime(n.createdAt)}</span>
              </div>
            );
            return n.url ? <Link key={n.id} href={n.url} className="block">{inner}</Link> : <div key={n.id}>{inner}</div>;
          })}
        </div>
      )}
    </div>
  );
}
