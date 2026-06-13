'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { BarChart2, TrendingUp, Search, Award, Settings, Home, FlaskConical, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/',               label: '대시보드',    icon: Home,         keepMarket: true },
  { href: '/recommendations', label: '시그널 목록', icon: TrendingUp,   keepMarket: true },
  { href: '/stocks',         label: '종목 검색',   icon: Search,       keepMarket: true },
  { href: '/performance',    label: '성과 리포트', icon: Award,        keepMarket: true },
  { href: '/simulation',     label: '시뮬레이션',  icon: FlaskConical, keepMarket: true },
  { href: '/admin',          label: '관리자',      icon: Settings,     keepMarket: false },
];

interface MobileDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function MobileDrawer({ open, onClose }: MobileDrawerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const market = searchParams.get('market') || 'US';

  // 라우트 변경 시 자동 닫힘
  useEffect(() => { onClose(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function buildHref(href: string, keepMarket: boolean) {
    if (!keepMarket) return href;
    return `${href}?market=${market}`;
  }

  if (!open) return null;

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/50 z-40 md:hidden"
        onClick={onClose}
      />
      {/* 드로어 */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-card border-r z-50 flex flex-col md:hidden animate-in slide-in-from-left duration-200">
        <div className="flex h-14 items-center justify-between border-b px-4">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-5 w-5 text-primary" />
            <span className="font-bold text-sm">Stock Signal</span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon, keepMarket }) => (
            <Link
              key={href}
              href={buildHref(href, keepMarket)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                (href === '/' ? pathname === href : pathname.startsWith(href))
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
    </>
  );
}
