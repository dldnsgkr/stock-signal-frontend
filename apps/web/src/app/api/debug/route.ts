import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  // 값은 노출하지 않고 존재 여부(boolean)와 길이만 반환 — OAuth 진단용(임시)
  const present = (v?: string) => ({ present: !!v, len: v ? v.length : 0 });
  return NextResponse.json({
    API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
    AUTH_SECRET: present(process.env.AUTH_SECRET),
    GOOGLE_CLIENT_ID: present(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: present(process.env.GOOGLE_CLIENT_SECRET),
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
