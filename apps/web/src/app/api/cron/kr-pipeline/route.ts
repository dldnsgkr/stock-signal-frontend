// Vercel Cron → GitHub Actions KR 파이프라인을 제시간(17시대 KST)에 실행한다.
//
// 왜 GitHub 의 cron 이 아니라 여기서 쏘는가: GitHub schedule 은 8~10시간씩 늦게 도착해
// KR 런이 한국 자정을 넘겨 시작했고, 그 시간엔 Yahoo 가 막 끝난 세션 봉을 거의 안 줘서
// 11-02~04 세 세션이 연속으로 데이터 계약 게이트에 막혔다. Vercel Cron 은 지정한 1시간
// 안에 실행된다(Hobby 기준). GitHub cron 은 보험으로 남아 있고, skip_if_recent 덕에 이 런이
// 성공했으면 늦게 도착해도 같은 세션을 다시 채점하지 않는다.
//
// 스케줄: apps/web/vercel.json (UTC 08:00~08:59 = KST 17시대, 평일)
import { NextResponse } from 'next/server';
import { dispatch, GitHubError } from '@/server/github';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // CRON_SECRET 이 설정돼 있으면 Vercel Cron 이 Authorization 헤더로 보낸다
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 평일 KST 16~20시에만 받는다. 장중에 실행되면 전날 세션을 또 채점하게 되므로,
  // 누가 이 주소를 아무 때나 호출해도 정해진 시간대 밖이면 아무 일도 하지 않는다.
  const kst = new Date(Date.now() + 9 * 3600_000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  if (day === 0 || day === 6 || hour < 16 || hour >= 21) {
    return NextResponse.json({ dispatched: false, reason: 'KST 평일 16~21시 외' });
  }

  try {
    await dispatch('pipeline.yml', { market: 'KR', job: 'run-pipeline', skip_if_recent: 'true' });
  } catch (e) {
    const status = e instanceof GitHubError ? e.status : 500;
    console.error('[cron/kr-pipeline] dispatch 실패', status, e instanceof Error ? e.message : e);
    return NextResponse.json({ dispatched: false, error: `GitHub dispatch 실패 (${status})` }, { status: 502 });
  }
  return NextResponse.json({ dispatched: true, market: 'KR', at: new Date().toISOString() });
}
