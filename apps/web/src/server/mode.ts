// 데이터 소스 전환 스위치 (serverless-migration 5단계).
//
// DATA_SOURCE=neon 이면 이식 라우트/서비스(Neon 직접 조회)를 쓰고,
// 아니면 기존처럼 EC2 API 로 전달한다. Vercel env 로 켜고 끈다 — 롤백은 env 제거.
export const useNeon = () => process.env.DATA_SOURCE === 'neon';

/** EC2 API 베이스 (레거시 경로·미이식 엔드포인트 폴백용) */
export const EC2_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

/** 자기 자신(이식 라우트)의 절대 베이스 — 서버사이드 fetch 는 절대 URL 이 필요하다 */
export function selfApiBase(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}/api`;
  return 'http://localhost:3000/api';
}

/** api.ts·프록시가 쓰는 최종 베이스 */
export function apiBase(): string {
  return useNeon() ? selfApiBase() : EC2_API_URL;
}
