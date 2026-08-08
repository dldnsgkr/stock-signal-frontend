import type { Metadata, Viewport } from 'next';
import { Suspense } from 'react';
import './globals.css';
import { LayoutShell } from '@/components/layout/LayoutShell';
import { AuthSessionProvider } from '@/components/providers/SessionProvider';

export const metadata: Metadata = {
  title: 'Stock Signal | 데이터 기반 주식 시그널 플랫폼',
  description: '미국/한국 주식 시장 데이터 기반 투자 분석 시그널',
  // 앱으로 설치하면 알림 주체가 브라우저가 아니라 이 앱이 되어,
  // OS 알림의 좌측 큰 아이콘이 크롬 로고 대신 우리 로고로 바뀐다.
  // (설치 전에는 브라우저가 보낸 알림이므로 OS 가 브라우저 아이콘을 쓴다 — 사이트가 덮어쓸 수 없다)
  manifest: '/manifest.webmanifest',
  icons: {
    icon: '/icon-192.png',
    apple: '/icon-192.png',
  },
  appleWebApp: {
    capable: true,
    title: 'Stock Signal',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#2563eb',
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
