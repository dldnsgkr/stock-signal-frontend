import { NextRequest, NextResponse } from 'next/server';
import { useNeon } from '@/server/mode';
import { adminService } from '@/server';
import { HttpException } from '@/server/http-errors';

// 인증은 src/proxy.ts(미들웨어)가 /api/admin-proxy 전체에 건다 — 여기선 다시 확인하지 않는다.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// DATA_SOURCE=neon 이면 EC2 대신 서버리스 관리자 서비스로 처리한다(서버리스 이전 6단계 준비).
async function handleLocal(method: 'GET' | 'POST', sp: URLSearchParams): Promise<NextResponse> {
  const endpoint = sp.get('endpoint');
  const market = sp.get('market') ?? 'US';
  try {
    if (method === 'GET') {
      if (!endpoint) return NextResponse.json(await adminService.getJobStatus(sp.get('jobId') ?? ''));
      switch (endpoint) {
        case '/admin/runs': return NextResponse.json(await adminService.getRecentRunsDetailed(Number(sp.get('limit') ?? 50)));
        case '/admin/jobs/failures': return NextResponse.json(await adminService.getRecentFailures(Number(sp.get('limit') ?? 30)));
        case '/admin/health': return NextResponse.json(await adminService.getDataHealth());
        case '/admin/system': return NextResponse.json(await adminService.getSystemStatus());
        case '/admin/quality': return NextResponse.json(await adminService.getDataQualityIssues(market));
        case '/admin/logs': return NextResponse.json(await adminService.getLogs(sp.get('service') ?? 'api', Number(sp.get('lines') ?? 100)));
        case '/admin/scoring-analysis': return NextResponse.json(await adminService.getScoringAnalysis(market));
      }
    } else {
      if (endpoint === '/admin/backtest/rescore') {
        return NextResponse.json({
          error: '백테스트 재채점은 서버리스 전환으로 화면에서 비활성화됐습니다. '
            + '같은 기능은 저장소의 apps/analysis-service/scripts/(sweep_weights.py 등)로 실행하세요.',
        }, { status: 501 });
      }
      if (endpoint?.startsWith('/admin/jobs/')) {
        return NextResponse.json(await adminService.triggerJob(endpoint, market));
      }
    }
    return NextResponse.json({ error: `지원하지 않는 관리자 엔드포인트: ${endpoint}` }, { status: 404 });
  } catch (e) {
    if (e instanceof HttpException) return NextResponse.json({ error: e.message }, { status: e.status });
    console.error('[admin]', e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (useNeon()) return handleLocal('POST', searchParams);
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
    // JSON body 가 있으면 그대로 전달 (백테스트 등 body 기반 POST)
    let body: string | undefined;
    try {
      const json = await req.json();
      body = JSON.stringify(json);
    } catch {
      body = undefined;
    }
    const res = await fetch(url, {
      method: 'POST',
      ...(body ? { headers: { 'Content-Type': 'application/json' }, body } : {}),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'proxy failed' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (useNeon()) return handleLocal('GET', searchParams);
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
