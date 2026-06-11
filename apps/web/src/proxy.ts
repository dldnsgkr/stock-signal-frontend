import { NextRequest, NextResponse } from 'next/server';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const COOKIE_NAME = 'admin_auth';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith('/admin')) {
    return NextResponse.next();
  }

  // 로그인 페이지는 인증 없이 접근 허용
  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(COOKIE_NAME);
  if (ADMIN_PASSWORD && cookie?.value === ADMIN_PASSWORD) {
    return NextResponse.next();
  }

  // 미인증 → 로그인 페이지로
  const loginUrl = new URL('/admin/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*'],
};
