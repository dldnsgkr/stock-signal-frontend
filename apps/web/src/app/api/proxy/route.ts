import { NextRequest, NextResponse } from 'next/server';
import { useNeon, EC2_API_URL } from '@/server/mode';

// DATA_SOURCE=neon 이면 이식 라우트(자기 오리진)로, 미이식(실시간 KRX·브리핑 등
// analysis 의존)만 EC2 로 폴백한다. 플립 전엔 전부 EC2 — 롤백은 env 제거.
const EC2_ONLY = [
  /^\/market\/(investor-trading|investor-top-stocks|foreign-top-stocks)/,
  /\/briefing($|\?)/,
  /\/technical-levels($|\?)/,
];

function targetBase(endpoint: string, reqUrl: string): string {
  if (!useNeon()) return EC2_API_URL;
  if (EC2_ONLY.some((r) => r.test(endpoint))) return EC2_API_URL;
  // 자기 오리진은 들어온 요청에서 유도 — 로컬 포트/프리뷰 도메인 무관하게 맞는다
  return `${new URL(reqUrl).origin}/api`;
}

const ALLOWED_PREFIXES = [
  '/performance/',
  '/stocks/',
  '/recommendations/',
  '/subscriptions',
  '/market/',
  '/push/',
];

function isAllowed(endpoint: string) {
  return ALLOWED_PREFIXES.some(p => endpoint.startsWith(p));
}

function buildUrl(endpoint: string, searchParams: URLSearchParams, reqUrl: string) {
  const forwardParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'endpoint') forwardParams.append(key, value);
  }
  const query = forwardParams.toString();
  return `${targetBase(endpoint, reqUrl)}${endpoint}${query ? `?${query}` : ''}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  if (!isAllowed(endpoint)) return NextResponse.json({ error: 'endpoint not allowed' }, { status: 403 });

  try {
    const res = await fetch(buildUrl(endpoint, searchParams, req.url), { cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint') ?? '/subscriptions';
  if (!isAllowed(endpoint)) return NextResponse.json({ error: 'endpoint not allowed' }, { status: 403 });

  try {
    const body = await req.json();
    const res = await fetch(`${targetBase(endpoint, req.url)}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint') ?? '/subscriptions';
  if (!isAllowed(endpoint)) return NextResponse.json({ error: 'endpoint not allowed' }, { status: 403 });

  try {
    const body = await req.json();
    const res = await fetch(`${targetBase(endpoint, req.url)}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
