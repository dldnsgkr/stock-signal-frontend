'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2 } from 'lucide-react';
import { pushSupported, isSubscribed, subscribePush, unsubscribePush } from '@/lib/push';

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    setSupported(true);
    isSubscribed().then(setSubscribed);
  }, []);

  if (!supported) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
      } else {
        await subscribePush();
        setSubscribed(true);
      }
    } catch (e: any) {
      alert(e?.message ?? '알림 설정에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
        subscribed
          ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
          : 'text-muted-foreground hover:bg-muted'
      }`}
      title={subscribed ? '푸시 알림 켜짐 — 클릭하여 끄기' : '푸시 알림 받기 (시그널 요약·운영 경고)'}
    >
      {busy
        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
        : subscribed
          ? <Bell className="h-3.5 w-3.5" />
          : <BellOff className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{subscribed ? '알림 켜짐' : '알림'}</span>
    </button>
  );
}
