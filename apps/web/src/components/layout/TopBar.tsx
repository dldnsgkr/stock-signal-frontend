'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Menu, LogIn, LogOut } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { PushToggle } from './PushToggle';
import { filterFor, resolveFilterValue } from '@/lib/marketFilter';

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = useSession();

  // 필터는 여기 한 곳에서만 그린다. 각 화면은 URL 파라미터를 읽기만 한다.
  const spec = filterFor(pathname);
  const currentValue = spec ? resolveFilterValue(spec, searchParams.get(spec.param)) : '';

  // 안내 문구가 볼 시장. **필터가 가리키는 값과 반드시 같아야 한다** —
  // URL 의 market 만 보면 백테스트처럼 기본값이 KR 인 화면에서
  // 필터는 '한국'인데 문구는 '(ET 기준)'으로 어긋난다.
  const hintMarket =
    spec?.param === 'market' ? currentValue
      : spec?.param === 'submarket' ? 'KR'          // KOSPI/KOSDAQ 화면은 모두 한국장
        : searchParams.get('market') === 'KR' ? 'KR' : 'US';

  function switchFilter(value: string) {
    if (!spec) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(spec.param, value);
    router.push(`${pathname}?${params.toString()}`);
  }

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
          <div className="flex rounded-lg border divide-x overflow-hidden text-xs font-medium">
            {spec.options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => switchFilter(opt.value)}
                className={`px-3 py-1.5 transition-colors ${
                  currentValue === opt.value
                    ? 'bg-primary text-white'
                    : 'text-muted-foreground hover:bg-muted'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <span className="hidden sm:block text-xs text-muted-foreground">
          {hintMarket === 'KR' ? '장 마감 후 자동 갱신 (KST 기준)' : '장 마감 후 자동 갱신 (ET 기준)'}
        </span>
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
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90"
          >
            <LogIn className="h-3.5 w-3.5" />
            로그인
          </button>
        )}
      </div>
    </header>
  );
}
