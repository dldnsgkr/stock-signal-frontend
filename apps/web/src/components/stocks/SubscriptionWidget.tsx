'use client';

import { useState, useEffect } from 'react';
import { Bell, BellOff, Loader2, CheckCircle, X } from 'lucide-react';

interface Props {
  symbol: string;
  stockName: string;
}

const EMAIL_KEY = 'stock_signal_sub_email';

export function SubscriptionWidget({ symbol, stockName }: Props) {
  const [email, setEmail]         = useState('');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading]     = useState(false);
  const [status, setStatus]       = useState<'idle' | 'success' | 'error'>('idle');
  const [message, setMessage]     = useState('');

  // 저장된 이메일 로드 + 구독 여부 확인
  useEffect(() => {
    const saved = localStorage.getItem(EMAIL_KEY);
    if (saved) {
      setEmail(saved);
      checkSubscription(saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol]);

  async function checkSubscription(em: string) {
    try {
      const res = await fetch(`/api/proxy?endpoint=/subscriptions&email=${encodeURIComponent(em)}`);
      if (!res.ok) return;
      const list: { symbol: string }[] = await res.json();
      setSubscribed(list.some(s => s.symbol === symbol));
    } catch { /* ignore */ }
  }

  async function handleSubscribe() {
    if (!email.trim() || !email.includes('@')) {
      setStatus('error');
      setMessage('올바른 이메일 주소를 입력해주세요');
      return;
    }
    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/proxy?endpoint=/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), symbol }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setMessage(data.message ?? '구독에 실패했습니다');
      } else {
        localStorage.setItem(EMAIL_KEY, email.trim());
        setSubscribed(true);
        setStatus('success');
        setMessage(`${symbol} BUY 시그널 발생 시 이메일로 알려드립니다`);
      }
    } catch {
      setStatus('error');
      setMessage('서버 연결에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  async function handleUnsubscribe() {
    setLoading(true);
    setStatus('idle');
    try {
      const res = await fetch('/api/proxy?endpoint=/subscriptions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), symbol }),
      });
      if (res.ok) {
        setSubscribed(false);
        setStatus('success');
        setMessage('알림 구독이 해제되었습니다');
      }
    } catch {
      setStatus('error');
      setMessage('서버 연결에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Bell className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">BUY 시그널 이메일 알림</span>
      </div>

      {subscribed ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2">
            <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
            <span className="text-xs text-green-700 dark:text-green-400">
              <span className="font-semibold">{email}</span> 구독 중
            </span>
          </div>
          <button
            onClick={handleUnsubscribe}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {loading
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <BellOff className="h-3 w-3" />}
            알림 해제
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {stockName}에 BUY 시그널이 발생하면 이메일로 알려드립니다
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubscribe()}
              placeholder="이메일 주소"
              className="flex-1 rounded-md border bg-background px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              onClick={handleSubscribe}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Bell className="h-3 w-3" />}
              알림 받기
            </button>
          </div>
        </div>
      )}

      {status !== 'idle' && (
        <div className={`flex items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs ${
          status === 'success'
            ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400'
            : 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400'
        }`}>
          {status === 'error' && <X className="h-3 w-3 mt-0.5 shrink-0" />}
          {status === 'success' && <CheckCircle className="h-3 w-3 mt-0.5 shrink-0" />}
          {message}
        </div>
      )}
    </div>
  );
}
