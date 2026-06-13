'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Zap, History, Terminal, Server, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/admin',        label: '파이프라인 실행', icon: Zap },
  { href: '/admin/runs',   label: '실행 이력',       icon: History },
  { href: '/admin/logs',   label: '서버 로그',       icon: Terminal },
  { href: '/admin/system', label: '시스템 상태',     icon: Server },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // 로그인 페이지는 레이아웃 제외
  if (pathname.startsWith('/admin/login')) return <>{children}</>;

  const handleLogout = async () => {
    await fetch('/api/admin-auth', { method: 'DELETE' });
    router.replace('/admin/login');
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">관리자</h1>
          <p className="text-sm text-muted-foreground mt-0.5">시스템 관리 및 모니터링</p>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <LogOut className="h-3 w-3" />
          로그아웃
        </button>
      </div>

      <div className="flex gap-1 border-b overflow-x-auto scrollbar-none">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 sm:px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap shrink-0',
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Link>
          );
        })}
      </div>

      <div>{children}</div>
    </div>
  );
}
