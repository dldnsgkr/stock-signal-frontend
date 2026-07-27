import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

async function userId(): Promise<number | null> {
  try {
    const s = await auth();
    return s?.user?.id ? Number(s.user.id) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const res = await fetch(`${API_URL}/user-settings?userId=${uid}`, { cache: 'no-store' });
  return NextResponse.json(await res.json(), { status: res.status });
}

export async function PUT(req: NextRequest) {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const patch = await req.json();
  const res = await fetch(`${API_URL}/user-settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...patch, userId: uid }),
  });
  return NextResponse.json(await res.json(), { status: res.status });
}
