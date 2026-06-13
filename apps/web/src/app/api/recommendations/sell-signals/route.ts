import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const params = new URLSearchParams();
  const market = searchParams.get('market');
  const limit = searchParams.get('limit');
  if (market) params.set('market', market);
  if (limit) params.set('limit', limit);

  try {
    const res = await fetch(`${API_URL}/recommendations/sell-signals?${params}`, { cache: 'no-store' });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
