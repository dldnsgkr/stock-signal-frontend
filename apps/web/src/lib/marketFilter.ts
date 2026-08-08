/**
 * 화면별 시장 필터 정의 — 필터는 최상단(TopBar)에서만 노출한다.
 *
 * 화면 안에 같은 성격의 필터를 또 두면 사용자가 어느 쪽이 적용된 건지 알 수 없다.
 * 그래서 필터 UI 는 TopBar 한 곳에만 두고, 각 화면은 URL 파라미터를 읽기만 한다.
 *
 * 파라미터를 둘로 나눈 이유:
 *   - `market`    : 미국/한국 (US·KR)
 *   - `submarket` : 한국 내부 구분 (KOSPI·KOSDAQ) — 한국 전용 화면에서만 쓴다
 * Sidebar 가 `market` 값을 그대로 다음 링크에 실어 나르므로(`keepMarket`),
 * 두 필터가 같은 이름을 쓰면 수급 화면의 `KOSPI` 가 종목 검색으로 새어 들어간다.
 */

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterSpec {
  param: 'market' | 'submarket';
  options: FilterOption[];
  fallback: string;
}

const US_KR: FilterSpec = {
  param: 'market',
  options: [
    { value: 'US', label: '🇺🇸 미국' },
    { value: 'KR', label: '🇰🇷 한국' },
  ],
  fallback: 'US',
};

// 백테스트는 원래 한국이 기본이었다. 통일하면서 기본값까지 바꾸지는 않는다.
const US_KR_KR_FIRST: FilterSpec = { ...US_KR, fallback: 'KR' };

const KOSPI_KOSDAQ: FilterSpec = {
  param: 'submarket',
  options: [
    { value: 'KOSPI', label: 'KOSPI' },
    { value: 'KOSDAQ', label: 'KOSDAQ' },
  ],
  fallback: 'KOSPI',
};

// 수급 랭킹만 '전체' 를 함께 제공한다.
const FLOW_SUBMARKET: FilterSpec = {
  param: 'submarket',
  options: [
    { value: 'ALL', label: '전체' },
    { value: 'KOSPI', label: 'KOSPI' },
    { value: 'KOSDAQ', label: 'KOSDAQ' },
  ],
  fallback: 'ALL',
};

export const PAGE_FILTERS: Record<string, FilterSpec> = {
  '/': US_KR,
  '/recommendations': US_KR,
  '/stocks': US_KR,
  '/sectors': US_KR,
  '/performance': US_KR,
  '/simulation': US_KR,
  '/admin/system': US_KR,
  '/admin/scoring': US_KR,
  '/admin/backtest': US_KR_KR_FIRST,
  '/flow': FLOW_SUBMARKET,
  '/investor-trading': KOSPI_KOSDAQ,
  '/foreign-trading': KOSPI_KOSDAQ,
};

/** 해당 경로에서 최상단에 띄울 필터. 없으면 필터를 감춘다. */
export function filterFor(pathname: string): FilterSpec | null {
  return PAGE_FILTERS[pathname] ?? null;
}

/**
 * URL 값을 그 화면의 허용값으로 좁힌다.
 * 다른 화면의 파라미터가 섞여 들어오거나 사용자가 주소를 직접 고쳐도 안전하게 기본값으로 떨어진다.
 */
export function resolveFilterValue(spec: FilterSpec, raw: string | null | undefined): string {
  return spec.options.some((o) => o.value === raw) ? (raw as string) : spec.fallback;
}

/** 화면 코드에서 바로 쓰는 헬퍼 — 경로로 spec 을 찾아 값까지 확정한다. */
export function resolveForPath(pathname: string, raw: string | null | undefined): string {
  const spec = filterFor(pathname);
  return spec ? resolveFilterValue(spec, raw) : '';
}
