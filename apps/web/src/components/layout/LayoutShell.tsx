'use client';

import { useState, Suspense } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { MobileDrawer } from './MobileDrawer';

export function LayoutShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <Suspense fallback={<div className="hidden md:block w-56 shrink-0 border-r bg-card" />}>
        <Sidebar />
      </Suspense>
      <Suspense fallback={null}>
        <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />
      </Suspense>
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Suspense fallback={<div className="h-14 border-b bg-card" />}>
          <TopBar onMenuClick={() => setMobileOpen(true)} />
        </Suspense>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
