'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart2, TrendingUp, Search, Award, Settings, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/', label: '대시보드', icon: Home, keepMarket: true },
  { href: '/recommendations', label: '시그널 목록', icon: TrendingUp, keepMarket: true },
  { href: '/stocks', label: '종목 검색', icon: Search, keepMarket: true },
  { href: '/performance', label: '성과 리포트', icon: Award, keepMarket: true },
  { href: '/admin', label: '관리자', icon: Settings, keepMarket: false },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const market = searchParams.get('market') || 'US';

  function buildHref(href: string, keepMarket: boolean) {
    if (!keepMarket) return href;
    return `${href}?market=${market}`;
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-card flex flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <BarChart2 className="h-5 w-5 text-primary" />
        <span className="font-bold text-sm">Stock Signal</span>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map(({ href, label, icon: Icon, keepMarket }) => (
          <Link
            key={href}
            href={buildHref(href, keepMarket)}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              pathname === href
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="border-t px-4 py-3 text-xs text-muted-foreground">
        투자는 개인 책임입니다
      </div>
    </aside>
  );
}
