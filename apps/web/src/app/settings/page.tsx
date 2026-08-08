'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, LogIn, Check, Settings as SettingsIcon, Bell, BellOff } from 'lucide-react';
import { pushSupported, isSubscribed, subscribePush, unsubscribePush, sendTestNotification, notificationGuide } from '@/lib/push';

interface UserSettings {
  defaultMarket: string;
  alertOnBuy: boolean;
  alertOnSell: boolean;
  minAlertScore: number | null;
}

export default function SettingsPage() {
  const { status } = useSession();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user-settings');
      if (res.ok) setSettings(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === 'authenticated') load();
    if (status === 'unauthenticated') setLoading(false);
  }, [status, load]);

  async function patch(update: Partial<UserSettings>) {
    if (!settings) return;
    const next = { ...settings, ...update };
    setSettings(next);
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/user-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      });
      if (res.ok) {
        setSettings(await res.json());
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setSaving(false);
    }
  }

  if (status === 'unauthenticated') {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <SettingsIcon className="h-10 w-10 text-muted-foreground/40" />
        <div>
          <p className="font-semibold">개인 설정은 로그인 후 사용할 수 있습니다</p>
          <p className="text-sm text-muted-foreground mt-1">기본 마켓·알림 조건을 저장하세요</p>
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

  if (loading || status === 'loading' || !settings) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">개인 설정</h1>
          <p className="text-sm text-muted-foreground mt-0.5">변경 즉시 저장됩니다</p>
        </div>
        {saving ? (
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> 저장 중</span>
        ) : saved ? (
          <span className="flex items-center gap-1 text-xs text-green-600"><Check className="h-3 w-3" /> 저장됨</span>
        ) : null}
      </div>

      {/* 기본 마켓 */}
      <Card>
        <CardContent className="pt-4 space-y-2">
          <div>
            <p className="text-sm font-semibold">기본 마켓</p>
            <p className="text-xs text-muted-foreground">로그인 후 대시보드가 이 마켓으로 시작합니다</p>
          </div>
          <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
            {(['US', 'KR'] as const).map(m => (
              <button
                key={m}
                onClick={() => patch({ defaultMarket: m })}
                className={`rounded-md px-4 py-1.5 text-xs font-medium transition-colors ${
                  settings.defaultMarket === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'US' ? '🇺🇸 미국' : '🇰🇷 한국'}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 웹푸시 채널 (이 기기) */}
      <PushChannelCard />

      {/* 알림 조건 */}
      <Card>
        <CardContent className="pt-4 space-y-4">
          <div>
            <p className="text-sm font-semibold">관심종목 알림 조건</p>
            <p className="text-xs text-muted-foreground">관심종목에 시그널이 뜰 때 받을 푸시 알림을 설정합니다 (상단 🔔 알림 켜짐 필요)</p>
          </div>

          <Toggle
            label="매수(BUY) 시그널 알림"
            desc="관심종목에 매수 시그널이 발생하면 알림"
            checked={settings.alertOnBuy}
            onChange={v => patch({ alertOnBuy: v })}
          />
          <Toggle
            label="청산(SELL) 시그널 알림"
            desc="관심종목에 청산 시그널이 발생하면 알림"
            checked={settings.alertOnSell}
            onChange={v => patch({ alertOnSell: v })}
          />

          <div className="pt-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">매수 알림 최소 점수</p>
                <p className="text-xs text-muted-foreground">이 점수 미만의 매수 시그널은 알리지 않음</p>
              </div>
              <span className="text-sm font-bold tabular-nums w-16 text-right">
                {settings.minAlertScore == null ? '제한 없음' : `${settings.minAlertScore}점`}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={settings.minAlertScore ?? 0}
              onChange={e => {
                const v = Number(e.target.value);
                patch({ minAlertScore: v === 0 ? null : v });
              }}
              className="w-full mt-2"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 이 기기의 웹푸시 구독 상태 관리 (권한 요청 → 구독/해제)
function PushChannelCard() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // 구독 성공 != 알림 도착. OS 에서 브라우저 알림이 꺼져 있으면 권한도 'granted' 이고
  // 구독도 정상인데 화면에는 아무것도 안 뜬다(조용한 실패). 감지할 API 가 없으므로
  // 테스트를 보내고 사용자에게 확인받는다.
  const [testSent, setTestSent] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const guide = notificationGuide();

  useEffect(() => {
    if (!pushSupported()) return;
    setSupported(true);
    isSubscribed().then(setSubscribed);
  }, []);

  async function toggle() {
    if (busy) return;
    setBusy(true);
    setErr(null);
    try {
      if (subscribed) {
        await unsubscribePush();
        setSubscribed(false);
        setTestSent(false);
        setShowGuide(false);
      } else {
        await subscribePush();
        setSubscribed(true);
        // 켜자마자 바로 확인시킨다 — 나중에 확인하면 '못 받는 줄 모르는' 기간이 생긴다
        await sendTest();
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '알림 설정 실패');
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setErr(null);
    try {
      await sendTestNotification();
      setTestSent(true);
      setShowGuide(false);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : '테스트 알림 발송 실패');
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold">웹푸시 알림 (이 기기)</p>
            <p className="text-xs text-muted-foreground">
              {supported
                ? '이 브라우저에서 알림을 받을지 설정합니다. 기기마다 따로 켜야 합니다.'
                : '이 브라우저는 웹푸시를 지원하지 않습니다.'}
            </p>
          </div>
          {supported && (
            <button
              onClick={toggle}
              disabled={busy}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs shrink-0 transition-colors ${
                subscribed
                  ? 'border-primary/40 bg-primary/10 text-primary hover:bg-primary/15'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : subscribed ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
              {subscribed ? '켜짐 — 끄기' : '알림 켜기'}
            </button>
          )}
        </div>
        {err && <p className="text-xs text-red-500">{err}</p>}

        {supported && subscribed && (
          <div className="rounded-lg border bg-muted/30 px-3 py-2.5 space-y-2">
            {!testSent ? (
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  알림이 실제로 도착하는지 확인해 보세요. 기기 설정 때문에 안 보이는 경우가 있습니다.
                </p>
                <button
                  onClick={sendTest}
                  className="rounded-md border px-2.5 py-1 text-xs shrink-0 hover:bg-muted"
                >
                  테스트 알림
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs">테스트 알림을 보냈습니다. 화면에 보였나요?</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setTestSent(false); setShowGuide(false); }}
                    className="rounded-md border border-primary/40 bg-primary/10 text-primary px-2.5 py-1 text-xs hover:bg-primary/15"
                  >
                    네, 보였어요
                  </button>
                  <button
                    onClick={() => setShowGuide(true)}
                    className="rounded-md border px-2.5 py-1 text-xs hover:bg-muted"
                  >
                    아니요, 안 보여요
                  </button>
                  <button onClick={sendTest} className="rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">
                    다시 보내기
                  </button>
                </div>
              </div>
            )}

            {showGuide && (
              <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30 px-3 py-2.5 space-y-1.5">
                <p className="text-xs font-medium">
                  브라우저는 알림을 받았는데 {guide.os} 가 화면에 띄우지 않는 상태입니다
                </p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  {guide.steps.map((step, i) => <li key={i}>{step}</li>)}
                </ul>
                <p className="text-[11px] text-muted-foreground pt-0.5">
                  설정을 바꾼 뒤 <b>다시 보내기</b> 로 확인하세요. 이 설정을 켜지 않으면
                  시그널 요약과 운영 경고를 받지 못합니다.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Toggle({ label, desc, checked, onChange }: {
  label: string; desc: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-primary' : 'bg-muted-foreground/30'}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}
