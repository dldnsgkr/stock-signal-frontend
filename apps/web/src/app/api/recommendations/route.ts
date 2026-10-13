import { NextRequest, NextResponse } from 'next/server';

import { apiBase } from '@/server/mode';

const API_URL = apiBase();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upstream = new URLSearchParams();

  for (const key of ['market', 'action', 'page', 'pageSize']) {
    const v = searchParams.get(key);
    if (v) upstream.set(key, v);
  }

  try {
    const res = await fetch(`${API_URL}/recommendations/latest?${upstream}`, { cache: 'no-store' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
