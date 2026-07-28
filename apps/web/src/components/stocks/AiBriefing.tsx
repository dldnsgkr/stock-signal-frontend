'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/Card';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';

interface Props {
  symbol: string;
  market: string;
}

interface BriefingResp {
  briefing?: string;
  generatedAt?: string;
  cached?: boolean;
  error?: string;
}

export function AiBriefing({ symbol, market }: Props) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ cached?: boolean } | null>(null);

  async function generate() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/proxy?endpoint=/stocks/${symbol}/briefing&market=${market}`);
      const data: BriefingResp = await res.json();
      if (!res.ok || data.error || !data.briefing) {
        setErr(res.status === 503 ? 'AI 브리핑이 아직 설정되지 않았습니다.' : '브리핑 생성에 실패했습니다.');
      } else {
        setText(data.briefing);
        setMeta({ cached: data.cached });
      }
    } catch {
      setErr('서버 연결에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">AI 브리핑</span>
            <span className="text-[10px] rounded-full bg-primary/10 text-primary px-1.5 py-0.5">참고용</span>
          </div>
          {text != null && (
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              title="다시 생성"
            >
              <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> 다시
            </button>
          )}
        </div>

        {text == null && !err && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              시그널 근거·최근 뉴스{market === 'KR' ? '·수급' : ''}을 AI가 한국어로 요약합니다.
            </p>
            <button
              onClick={generate}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {loading ? '생성 중...' : 'AI 브리핑 생성'}
            </button>
          </div>
        )}

        {text != null && (
          <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/90">{text}</p>
        )}

        {err && <p className="text-xs text-muted-foreground">{err}</p>}
      </CardContent>
    </Card>
  );
}
