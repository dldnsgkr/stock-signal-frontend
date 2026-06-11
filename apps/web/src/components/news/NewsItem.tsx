'use client';

import { useState } from 'react';
import { ExternalLink, ChevronDown, ChevronUp, Languages, Loader2, FileText, AlignLeft } from 'lucide-react';

interface NewsItemProps {
  id: number;
  title: string;
  summary?: string | null;
  url: string;
  source: string;
  publishedAt: string;
  sentimentScore?: number | string | null;
}

const LANG_OPTIONS = [
  { code: 'original', label: 'EN' },
  { code: 'ko', label: '한국어' },
  { code: 'ja', label: '日本語' },
  { code: 'zh-CN', label: '中文' },
];

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function SentimentBadge({ score }: { score?: number | string | null }) {
  const num = Number(score);
  if (score == null || isNaN(num)) return null;
  const color = num > 0.05 ? 'text-green-600' : num < -0.05 ? 'text-red-500' : 'text-muted-foreground';
  const label = num > 0.05 ? '긍정' : num < -0.05 ? '부정' : '중립';
  return <span className={`${color} font-medium`}>{label} {num.toFixed(2)}</span>;
}

type ViewMode = 'none' | 'summary' | 'full';

export function NewsItem({ id, title, summary, url, source, publishedAt, sentimentScore }: NewsItemProps) {
  const [lang, setLang] = useState<string>('original');
  const [viewMode, setViewMode] = useState<ViewMode>('none');
  const [loadingLang, setLoadingLang] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);

  // 번역 캐시: { [lang]: { title, summary, full } }
  const [cache, setCache] = useState<Record<string, { title?: string; summary?: string; full?: string }>>({});

  const displayTitle = lang !== 'original' && cache[lang]?.title ? cache[lang].title! : title;
  const displaySummary = lang !== 'original' && cache[lang]?.summary ? cache[lang].summary! : summary;
  const displayFull = lang !== 'original' && cache[lang]?.full
    ? cache[lang].full!
    : cache['original']?.full ?? null;

  async function handleLangChange(targetLang: string) {
    if (targetLang === lang) return;
    if (targetLang === 'original') { setLang('original'); return; }
    if (cache[targetLang]?.title) { setLang(targetLang); return; }

    setLoadingLang(targetLang);
    try {
      const texts = [title, ...(summary ? [summary] : [])];
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts, target: targetLang }),
      });
      if (res.ok) {
        const data = await res.json();
        setCache((prev) => ({
          ...prev,
          [targetLang]: {
            ...prev[targetLang],
            title: data.translated[0],
            summary: summary ? data.translated[1] : undefined,
          },
        }));
        setLang(targetLang);
      }
    } catch { /* 원문 유지 */ }
    finally { setLoadingLang(null); }
  }

  async function handleFetchFull() {
    // 본문이 이미 있으면 토글만
    if (cache['original']?.full) {
      setViewMode((v) => (v === 'full' ? 'none' : 'full'));
      return;
    }

    setLoadingFull(true);
    setViewMode('full');
    try {
      const res = await fetch(`/api/translate?type=article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, target: lang === 'original' ? 'original' : lang }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCache((prev) => ({ ...prev, original: { ...prev['original'], full: `⚠️ ${data.error || '본문을 가져올 수 없습니다'}` } }));
        return;
      }
      const fullText = data.translated || data.original || '';
      setCache((prev) => ({
        ...prev,
        original: { ...prev['original'], full: data.original },
        ...(data.translated && lang !== 'original' ? { [lang]: { ...prev[lang], full: data.translated } } : {}),
      }));
    } catch {
      setCache((prev) => ({ ...prev, original: { ...prev['original'], full: '⚠️ 본문을 가져오는 중 오류가 발생했습니다' } }));
    } finally {
      setLoadingFull(false);
    }
  }

  // 본문이 이미 로딩됐는데 언어가 바뀐 경우 → 해당 언어 번역 요청
  async function handleFullLangChange(targetLang: string) {
    if (!cache['original']?.full) return;
    if (cache[targetLang]?.full) return;
    if (targetLang === 'original' || targetLang === 'en') return;

    setLoadingFull(true);
    try {
      const res = await fetch(`/api/translate?type=article`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, target: targetLang }),
      });
      const data = await res.json();
      if (res.ok && data.translated) {
        setCache((prev) => ({
          ...prev,
          [targetLang]: { ...prev[targetLang], full: data.translated },
        }));
      }
    } catch { /* 무시 */ }
    finally { setLoadingFull(false); }
  }

  function toggleView(mode: ViewMode) {
    setViewMode((v) => (v === mode ? 'none' : mode));
  }

  return (
    <div className="border-b pb-4 last:border-0 last:pb-0 space-y-2 pt-1">
      {/* 제목 + 외부 링크 아이콘 */}
      <div className="flex items-start gap-2">
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium hover:text-primary flex-1 leading-snug"
        >
          {displayTitle}
        </a>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary"
          title="원문 기사 바로가기"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* 메타 */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
        <span className="font-medium">{source}</span>
        <span>·</span>
        <span>{formatDate(publishedAt)}</span>
        <span>·</span>
        <SentimentBadge score={sentimentScore} />
      </div>

      {/* 액션 바 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* 언어 선택 */}
        <div className="flex items-center gap-1.5">
          <Languages className="h-3 w-3 text-muted-foreground" />
          <div className="flex rounded-md border divide-x overflow-hidden text-xs">
            {LANG_OPTIONS.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => {
                  handleLangChange(code);
                  if (viewMode === 'full') handleFullLangChange(code);
                }}
                disabled={loadingLang !== null}
                className={`px-2 py-0.5 transition-colors ${
                  lang === code
                    ? 'bg-primary text-white'
                    : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                {loadingLang === code ? <Loader2 className="h-3 w-3 animate-spin inline" /> : label}
              </button>
            ))}
          </div>
        </div>

        {/* 축약본 / 전체 본문 버튼 */}
        <div className="flex items-center gap-2 text-xs">
          {summary && (
            <button
              onClick={() => toggleView('summary')}
              className={`flex items-center gap-1 transition-colors ${
                viewMode === 'summary' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <AlignLeft className="h-3 w-3" />
              축약본
              {viewMode === 'summary' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
          <button
            onClick={handleFetchFull}
            disabled={loadingFull && viewMode !== 'full'}
            className={`flex items-center gap-1 transition-colors ${
              viewMode === 'full' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {loadingFull ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <FileText className="h-3 w-3" />
            )}
            전체 본문
            {viewMode === 'full' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* 축약본 패널 */}
      {viewMode === 'summary' && displaySummary && (
        <div className="rounded-md bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground leading-relaxed">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60 mb-1.5">축약본</p>
          {displaySummary}
        </div>
      )}

      {/* 전체 본문 패널 */}
      {viewMode === 'full' && (
        <div className="rounded-md border bg-muted/30 px-4 py-3 text-xs leading-relaxed space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">전체 본문</p>
          {loadingFull && !displayFull ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>기사 본문을 불러오는 중...</span>
            </div>
          ) : displayFull ? (
            <div className="whitespace-pre-line text-foreground/80 max-h-96 overflow-y-auto">
              {displayFull}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
