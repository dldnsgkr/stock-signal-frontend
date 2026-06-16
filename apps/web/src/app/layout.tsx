import type { Metadata } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { AuthSessionProvider } from '@/components/providers/SessionProvider';

export const metadata: Metadata = {
  title: 'Stock Signal | 데이터 기반 주식 시그널 플랫폼',
  description: '미국/한국 주식 시장 데이터 기반 투자 분석 시그널',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-background">
        <AuthSessionProvider>
          <Suspense fallback={<div className="h-dvh bg-background" />}>
            <LayoutShell>{children}</LayoutShell>
          </Suspense>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
