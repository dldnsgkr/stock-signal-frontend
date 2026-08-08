'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Bell, BellOff, Loader2, X } from 'lucide-react';
import {
  pushSupported, isSubscribed, subscribePush, unsubscribePush, sendTestNotification,
} from '@/lib/push';

export function PushToggle() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 구독 성공 != 알림 도착. OS 에서 브라우저 알림이 꺼져 있으면 권한도 'granted' 이고
  // 구독도 정상인데 화면에는 아무것도 안 뜬다(조용한 실패). 감지할 API 가 없으므로
  // 켜자마자 테스트를 보내고, 안 보일 수 있다는 걸 알려준다.
  const [hint, setHint] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    setSupported(true);
    isSubscribed().then(setSubscribed);
  }, []);

  if (!supported) return null;

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
        setHint(false);
      } else {
        await subscribePush();
        setSubscribed(true);
        await sendTestNotification().catch(() => {});
        setHint(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '알림 설정에 실패했습니다');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative">
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

      {(hint || error) && (
        <div className="absolute right-0 top-full mt-2 z-50 w-72 rounded-lg border bg-card shadow-lg px-3 py-2.5 text-xs">
          <button
            onClick={() => { setHint(false); setError(null); }}
            className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-3 w-3" />
          </button>
          {error ? (
            <p className="text-red-500 pr-4">{error}</p>
          ) : (
            <div className="space-y-1.5 pr-4">
              <p className="font-medium">테스트 알림을 보냈습니다</p>
              <p className="text-muted-foreground">
                화면에 보이지 않았다면 기기에서 브라우저 알림이 꺼져 있는 것입니다.
                그 상태로는 시그널 요약과 운영 경고를 받지 못합니다.
              </p>
              <Link
                href="/settings"
                onClick={() => setHint(false)}
                className="inline-block text-primary hover:underline"
              >
                설정에서 확인하기 →
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
