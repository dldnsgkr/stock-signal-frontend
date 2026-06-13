import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const ALLOWED_PREFIXES = [
  '/performance/',
  '/stocks/',
  '/recommendations/',
  '/subscriptions',
];

function isAllowed(endpoint: string) {
  return ALLOWED_PREFIXES.some(p => endpoint.startsWith(p));
}

function buildUrl(endpoint: string, searchParams: URLSearchParams) {
  const forwardParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'endpoint') forwardParams.append(key, value);
  }
  const query = forwardParams.toString();
  return `${API_URL}${endpoint}${query ? `?${query}` : ''}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint');
  if (!endpoint) return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  if (!isAllowed(endpoint)) return NextResponse.json({ error: 'endpoint not allowed' }, { status: 403 });

  try {
    const res = await fetch(buildUrl(endpoint, searchParams), { cache: 'no-store' });
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
    const res = await fetch(`${API_URL}${endpoint}`, {
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
    const res = await fetch(`${API_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
