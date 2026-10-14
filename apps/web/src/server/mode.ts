// 데이터 소스 전환 스위치 (serverless-migration 5단계).
//
// DATA_SOURCE=neon 이면 이식 라우트/서비스(Neon 직접 조회)를 쓰고,
// 아니면 기존처럼 EC2 API 로 전달한다. Vercel env 로 켜고 끈다 — 롤백은 env 제거.
export const useNeon = () => process.env.DATA_SOURCE === 'neon';

/** EC2 API 베이스 (레거시 경로·미이식 엔드포인트 폴백용) */
export const EC2_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** 자기 자신(이식 라우트)의 절대 베이스 — 서버사이드 fetch 는 절대 URL 이 필요하다.
 *
 * ⚠️ VERCEL_URL(배포별 고유 도메인)을 쓰면 안 된다 — Vercel Deployment Protection 이
 * 배포별 도메인을 로그인 뒤로 숨겨서, 서버 컴포넌트의 자기 호출이 401 로 막힌다
 * (2026-10-15 대시보드가 전부 '-' 로 나온 원인). 프로덕션은 공개 도메인을 쓴다. */
export function selfApiBase(): string {
  if (process.env.SELF_API_URL) return process.env.SELF_API_URL;
  if (process.env.VERCEL_ENV === 'production' && process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}/api`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api`;
  return 'http://localhost:3000/api';
}

/** api.ts·프록시가 쓰는 최종 베이스 */
export function apiBase(): string {
  return useNeon() ? selfApiBase() : EC2_API_URL;
}
