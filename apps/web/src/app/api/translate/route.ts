import { NextRequest, NextResponse } from 'next/server';

const ANALYSIS_URL = process.env.ANALYSIS_SERVICE_URL || 'http://localhost:8000';

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('type') === 'article' ? '/translate/article' : '/translate';

    const body = await request.json();
    const res = await fetch(`${ANALYSIS_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json(
        { error: err.detail || 'Translation failed' },
        { status: res.status },
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Translation service unavailable' }, { status: 503 });
  }
}
