import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { Sidebar } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';

export const metadata: Metadata = {
  title: 'Stock Signal | 데이터 기반 주식 시그널 플랫폼',
  description: '미국/한국 주식 시장 데이터 기반 투자 분석 시그널',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="flex h-screen overflow-hidden bg-background">
        <Suspense fallback={<div className="w-56 shrink-0 border-r bg-card" />}>
          <Sidebar />
        </Suspense>
        <div className="flex flex-1 flex-col overflow-hidden">
          <Suspense fallback={<div className="h-14 border-b bg-card" />}>
            <TopBar />
          </Suspense>
          <main className="flex-1 overflow-y-auto p-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
