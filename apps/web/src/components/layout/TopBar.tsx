'use client';

import { Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Menu, LogIn, LogOut } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { PushToggle } from './PushToggle';
import { filterFor, resolveFilterValue } from '@/lib/marketFilter';

interface TopBarProps {
  onMenuClick?: () => void;
}

type Spec = NonNullable<ReturnType<typeof filterFor>>;

/** 필터 토글 + 안내 문구의 '그림'. 값과 클릭 처리는 밖에서 받는다. */
function FilterView({ spec, value, hintMarket, onSwitch }: {
  spec: Spec; value: string; hintMarket: string; onSwitch?: (v: string) => void;
}) {
  return (
    <>
      <div className="flex rounded-lg border divide-x overflow-hidden text-xs font-medium">
        {spec.options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onSwitch?.(opt.value)}
            className={`px-3 py-1.5 transition-colors ${
              value === opt.value
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {/* 필터가 없는 화면(관심종목·비교·알림이력·설정)은 시장 개념이 없다.
          거기서도 문구를 띄우면 근거 없이 '(ET 기준)'이 붙는다 — spec 이 있을 때만 보여준다. */}
      <span className="hidden sm:block text-xs text-muted-foreground">
        {hintMarket === 'KR' ? '장 마감 후 자동 갱신 (KST 기준)' : '장 마감 후 자동 갱신 (ET 기준)'}
      </span>
    </>
  );
}

// 안내 문구가 볼 시장. **필터가 가리키는 값과 반드시 같아야 한다** —
// URL 의 market 만 보면 백테스트처럼 기본값이 KR 인 화면에서
// 필터는 '한국'인데 문구는 '(ET 기준)'으로 어긋난다.
function hintFor(spec: Spec, value: string, marketParam: string | null) {
  return spec.param === 'market' ? value
    : spec.param === 'submarket' ? 'KR'          // KOSPI/KOSDAQ 화면은 모두 한국장
      : marketParam === 'KR' ? 'KR' : 'US';
}

/** URL 파라미터를 읽는 필터 — useSearchParams 는 이 안에서만 쓴다(Sidebar 와 같은 이유). */
function FilterControl({ spec }: { spec: Spec }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const value = resolveFilterValue(spec, searchParams.get(spec.param));

  function switchFilter(v: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(spec.param, v);
    router.push(`${pathname}?${params.toString()}`);
  }

  return <FilterView spec={spec} value={value} hintMarket={hintFor(spec, value, searchParams.get('market'))} onSwitch={switchFilter} />;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  // ⚠️ useSearchParams 를 TopBar 최상단에서 쓰지 말 것 — 정적 렌더 페이지에서 상단 바 전체가
  // 서버 렌더를 포기해 빈 칸으로 내려왔다가 나타났다(Sidebar 와 같은 깜빡임, 2026-10-15).
  // URL 파라미터는 FilterControl 안에서만 읽고, 서버 렌더에는 기본값으로 같은 모양을 그린다.
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = useSession();

  // 필터는 여기 한 곳에서만 그린다. 각 화면은 URL 파라미터를 읽기만 한다.
  const spec = filterFor(pathname);

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* 모바일 햄버거 버튼 */}
        <button
          className="md:hidden p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          onClick={onMenuClick}
          aria-label="메뉴 열기"
        >
          <Menu className="h-5 w-5" />
        </button>

        {spec && (
          <Suspense
            fallback={(() => {
              const v = resolveFilterValue(spec, null);
              return <FilterView spec={spec} value={v} hintMarket={hintFor(spec, v, null)} />;
            })()}
          >
            <FilterControl spec={spec} />
          </Suspense>
        )}
      </div>
      <div className="flex items-center gap-2">
        <PushToggle />
        <button
          onClick={() => router.refresh()}
          className="flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">새로고침</span>
        </button>

        {session ? (
          <div className="flex items-center gap-2">
            {session.user.image && (
              // 서드파티(Google) 아바타는 일반 img로 렌더 — next/image 호스트 화이트리스트
              // 의존을 제거하고, 로드 실패 시 조용히 숨겨 레이아웃이 깨지지 않게 한다.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={session.user.name ?? '프로필'}
                width={28}
                height={28}
                referrerPolicy="no-referrer"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                className="h-7 w-7 rounded-full ring-1 ring-border object-cover"
              />
            )}
            <span className="hidden sm:block text-xs text-muted-foreground max-w-[80px] truncate">
              {session.user.name}
            </span>
            <button
              onClick={() => signOut()}
              className="flex items-center gap-1 rounded-md border px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted"
              title="로그아웃"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => signIn('google')}
            className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" />
            로그인
          </button>
        )}
      </div>
    </header>
  );
}
