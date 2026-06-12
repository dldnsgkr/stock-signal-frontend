import { NextRequest, NextResponse } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint required' }, { status: 400 });
  }

  const forwardParams = new URLSearchParams();
  for (const [key, value] of searchParams.entries()) {
    if (key !== 'endpoint') forwardParams.append(key, value);
  }

  const query = forwardParams.toString();
  const url = `${API_URL}${endpoint}${query ? `?${query}` : ''}`;

  try {
    const res = await fetch(url, { method: 'POST' });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const endpoint = searchParams.get('endpoint');

  // job 상태 조회 (기존 방식)
  if (!endpoint) {
    const queue = searchParams.get('queue');
    const jobId = searchParams.get('jobId');
    if (!queue || !jobId) {
      return NextResponse.json({ error: 'queue and jobId required' }, { status: 400 });
    }
    try {
      const res = await fetch(`${API_URL}/admin/jobs/${queue}/${jobId}`, { cache: 'no-store' });
      const data = await res.json();
      return NextResponse.json(data);
    } catch {
      return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
    }
  }

  // 범용 GET 프록시 (endpoint 파라미터 방식)
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
