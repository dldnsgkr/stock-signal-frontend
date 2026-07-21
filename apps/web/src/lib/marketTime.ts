/**
 * 시장 이벤트 날짜 표시 유틸.
 *
 * 서버·DB 는 UTC 로 기록한다. 브라우저 기본 로케일(KST)로 그대로 찍으면
 * 미국 장 마감 후 생성된 값이 하루 뒤로 보인다.
 *   예) 2026-07-17 22:08 UTC 에 만들어진 US 추천
 *       = 07-17 18:08 ET (7/17 장 기준)  →  KST 로는 "7월 18일"
 *
 * 추천일·실행일처럼 '어느 장 세션의 결과인가'를 뜻하는 값은 해당 시장
 * 타임존으로 표시해야 의미가 맞다. 반대로 점검 시각·로그 시각 같은 운영
 * 타임스탬프는 보는 사람의 로컬 시간이 맞으므로 이 유틸을 쓰지 않는다.
 */

export type MarketCode = 'US' | 'KR' | string;

const MARKET_TZ: Record<string, string> = {
  US: 'America/New_York',
  KR: 'Asia/Seoul',
};

export function marketTimeZone(market: MarketCode): string {
  return MARKET_TZ[market] ?? 'Asia/Seoul';
}

/** "7월 17일" 형태. 표에서 쓰는 짧은 표기. */
export function fmtMarketDate(d: string | Date | null | undefined, market: MarketCode): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', {
    timeZone: marketTimeZone(market),
    month: 'short',
    day: 'numeric',
  });
}

/** "2026. 7. 17." 형태. 연도까지 필요한 곳. */
export function fmtMarketDateFull(d: string | Date | null | undefined, market: MarketCode): string {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('ko-KR', {
    timeZone: marketTimeZone(market),
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** "7월 17일 18:08" 형태. 실행 시각처럼 시분이 필요한 곳. */
export function fmtMarketDateTime(d: string | Date | null | undefined, market: MarketCode): string {
  if (!d) return '-';
  return new Date(d).toLocaleString('ko-KR', {
    timeZone: marketTimeZone(market),
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** 표시 타임존을 사용자에게 알려줄 때 쓰는 짧은 라벨. */
export function marketTimeZoneLabel(market: MarketCode): string {
  return market === 'US' ? '미 동부시간' : '한국시간';
}
