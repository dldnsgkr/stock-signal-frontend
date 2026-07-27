'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/Card';
import { Loader2, LogIn, Check, Settings as SettingsIcon } from 'lucide-react';

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
