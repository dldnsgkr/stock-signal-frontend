'use client';

import { useState, useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Star, Loader2 } from 'lucide-react';

interface WatchlistButtonProps {
  symbol: string;
}

export function WatchlistButton({ symbol }: WatchlistButtonProps) {
  const { data: session, status } = useSession();
  const [inList, setInList] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/watchlist')
      .then(r => (r.ok ? r.json() : []))
      .then((items: { symbol: string }[]) => {
        if (Array.isArray(items)) setInList(items.some(i => i.symbol === symbol));
      })
      .catch(() => {});
  }, [status, symbol]);

  async function toggle() {
    if (status !== 'authenticated') {
      signIn('google');
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch('/api/watchlist', {
        method: inList ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      if (res.ok) setInList(!inList);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
        inList
          ? 'border-amber-400/60 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-400'
          : 'text-muted-foreground hover:bg-muted'
      }`}
      title={
        session
          ? inList ? '관심종목에서 제거' : '관심종목에 추가'
          : '로그인하고 관심종목에 추가'
      }
    >
      {busy
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : <Star className={`h-3.5 w-3.5 ${inList ? 'fill-current' : ''}`} />}
      {inList ? '관심종목' : '관심등록'}
    </button>
  );
}
