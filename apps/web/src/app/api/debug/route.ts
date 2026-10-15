import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NODE_ENV: process.env.NODE_ENV,
    // 마이그레이션 플립 디버그 — 값이 아니라 존재 여부만 (boolean)
    DATA_SOURCE: process.env.DATA_SOURCE ?? null,
    has_DATABASE_URL: !!process.env.DATABASE_URL,
    has_VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
    has_VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
    LLM_PROVIDER: process.env.LLM_PROVIDER ?? null,
    LLM_MODEL: process.env.LLM_MODEL ?? null,
    LLM_API_KEY_len: (process.env.LLM_API_KEY ?? '').length,
    has_GITHUB_TOKEN: !!process.env.GITHUB_TOKEN,
    VERCEL_URL_set: !!process.env.VERCEL_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL ?? null,
    VERCEL_ENV: process.env.VERCEL_ENV ?? null,
  });
}
