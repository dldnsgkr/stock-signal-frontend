'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { RefreshCw, Menu, LogIn, LogOut } from 'lucide-react';
import { useSession, signIn, signOut } from 'next-auth/react';
import Image from 'next/image';

const MARKET_PAGES = ['/', '/recommendations', '/stocks', '/sectors', '/performance', '/simulation'];

interface TopBarProps {
  onMenuClick?: () => void;
}

export function TopBar({ onMenuClick }: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentMarket = searchParams.get('market') || 'US';
  const { data: session } = useSession();

  const isMarketPage = MARKET_PAGES.some((p) => pathname === p);

  function switchMarket(market: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('market', market);
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

        {isMarketPage && (
          <div className="flex rounded-lg border divide-x overflow-hidden text-xs font-medium">
            <button
              onClick={() => switchMarket('US')}
              className={`px-3 py-1.5 transition-colors ${
                currentMarket === 'US'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              🇺🇸 미국
            </button>
            <button
              onClick={() => switchMarket('KR')}
              className={`px-3 py-1.5 transition-colors ${
                currentMarket === 'KR'
                  ? 'bg-primary text-white'
                  : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              🇰🇷 한국
            </button>
          </div>
        )}
        <span className="hidden sm:block text-xs text-muted-foreground">
          {currentMarket === 'KR' ? '장 마감 후 자동 갱신 (KST 기준)' : '장 마감 후 자동 갱신 (ET 기준)'}
        </span>
      </div>
      <div className="flex items-center gap-2">
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
              <Image
                src={session.user.image}
                alt={session.user.name ?? '프로필'}
                width={28}
                height={28}
                className="rounded-full ring-1 ring-border"
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
