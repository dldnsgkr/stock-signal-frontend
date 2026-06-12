import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
const COOKIE_NAME = 'admin_auth';

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAdminRoute = pathname.startsWith('/admin');
  const isLoginPage = pathname.startsWith('/admin/login');
  const isAdminProxy = pathname.startsWith('/api/admin-proxy');

  if (!isAdminRoute && !isAdminProxy) return NextResponse.next();

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const isAuthenticated = ADMIN_PASSWORD && cookie === ADMIN_PASSWORD;

  // 로그인 페이지: 이미 인증됐으면 /admin으로
  if (isLoginPage) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
    return NextResponse.next();
  }

  // admin 페이지 & proxy: 인증 안 됐으면 로그인으로
  if (!isAuthenticated) {
    if (isAdminProxy) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin-proxy/:path*'],
};
