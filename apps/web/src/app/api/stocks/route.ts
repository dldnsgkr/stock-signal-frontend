import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = new URLSearchParams();

  for (const key of ['market', 'cursorId', 'pageSize', 'search']) {
    const v = searchParams.get(key);
    if (v) upstream.set(key, v);
  }

  try {
    const res = await fetch(`${API_URL}/stocks?${upstream}`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
