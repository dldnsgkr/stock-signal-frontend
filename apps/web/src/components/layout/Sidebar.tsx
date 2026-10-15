'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart2, TrendingUp, Search, Award, Settings, Home, FlaskConical, Users, Globe, LayoutGrid, Waves, Star, SlidersHorizontal, Bell, GitCompare } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/',                label: '대시보드',    icon: Home,        keepMarket: true  },
  { href: '/recommendations', label: '시그널 목록', icon: TrendingUp,  keepMarket: true  },
  { href: '/stocks',          label: '종목 검색',   icon: Search,      keepMarket: true  },
  { href: '/compare',         label: '종목 비교',   icon: GitCompare,  keepMarket: false },
  { href: '/watchlist',       label: '관심종목',    icon: Star,        keepMarket: false },
  { href: '/notifications',   label: '알림 이력',   icon: Bell,        keepMarket: false },
  { href: '/sectors',         label: '섹터 분석',   icon: LayoutGrid,  keepMarket: true  },
  { href: '/performance',     label: '성과 리포트', icon: Award,       keepMarket: true  },
  { href: '/simulation',      label: '시뮬레이션',  icon: FlaskConical,keepMarket: true  },
  { href: '/investor-trading',label: '투자자 동향', icon: Users,       keepMarket: false },
  { href: '/foreign-trading', label: '외국인 동향', icon: Globe,       keepMarket: false },
  { href: '/flow',            label: '수급 랭킹',   icon: Waves,       keepMarket: false },
  { href: '/settings',        label: '설정',        icon: SlidersHorizontal, keepMarket: false },
  { href: '/admin',           label: '관리자',      icon: Settings,    keepMarket: false },
];

type NavItem = (typeof navItems)[number];

function NavLink({ item, href, active }: { item: NavItem; href: string; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

/** ?market= 을 실어 나르는 링크 — useSearchParams 는 이 안에서만 쓴다. */
function MarketNavLink({ item, active }: { item: NavItem; active: boolean }) {
  const market = useSearchParams().get('market') || 'US';
  return <NavLink item={item} href={`${item.href}?market=${market}`} active={active} />;
}

export function Sidebar() {
  // ⚠️ useSearchParams 를 Sidebar 최상단에서 쓰지 말 것. 그러면 정적 렌더 페이지에서 사이드바
  // 전체가 서버 렌더를 포기하고(CSR bailout) 빈 칸으로 내려왔다가 브라우저에서 다시 그려진다 —
  // 새로고침·첫 접속·배포 직후 클릭마다 메뉴가 사라졌다 '재선택' 되듯 깜빡였다(2026-10-15 제보).
  // 선택 표시는 usePathname(서버에서도 동작)으로 그리고, market 이 필요한 링크 주소만
  // 링크 단위 Suspense 안에서 보정한다. fallback 은 같은 모양의 링크라 겉보기 변화가 없다.
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex w-56 shrink-0 border-r bg-card flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <BarChart2 className="h-5 w-5 text-primary" />
        <span className="font-bold text-sm">Stock Signal</span>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const active = item.href === '/' ? pathname === item.href : pathname.startsWith(item.href);
          return item.keepMarket ? (
            <Suspense key={item.href} fallback={<NavLink item={item} href={item.href} active={active} />}>
              <MarketNavLink item={item} active={active} />
            </Suspense>
          ) : (
            <NavLink key={item.href} item={item} href={item.href} active={active} />
          );
        })}
      </nav>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        투자는 개인 책임입니다
      </div>
    </aside>
  );
}
