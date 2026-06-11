import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.API_URL || 'http://localhost:3001/api';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ symbol: string }> },
) {
  const { symbol } = await params;
  const days = new URL(req.url).searchParams.get('days') ?? '90';

  try {
    const res = await fetch(`${API_URL}/stocks/${symbol}/prices?days=${days}`, {
      cache: 'no-store',
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}
