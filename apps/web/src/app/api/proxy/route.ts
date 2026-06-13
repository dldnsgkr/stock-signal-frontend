import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const ALLOWED_PREFIXES = [
  '/performance/',
  '/stocks/',
  '/recommendations/',
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  const allowed = ALLOWED_PREFIXES.some(p => endpoint.startsWith(p));
  if (!allowed) {
    return NextResponse.json({ error: 'endpoint not allowed' }, { status: 403 });
  }

  const forwardParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'endpoint') forwardParams.append(key, value);
  }
  const query = forwardParams.toString();
  const url = `${API_URL}${endpoint}${query ? `?${query}` : ''}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
