import { apiBase } from '@/server/mode';

// DATA_SOURCE=neon 이면 자기 오리진의 이식 라우트(Neon 직접 조회)를 쓴다.
// 서버 컴포넌트 전용 헬퍼 — 클라이언트에서 import 하지 말 것.
const API_URL = apiBase();

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${path}`);
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => fetchApi<T>(path),
  post: <T>(path: string, body?: unknown) =>
    fetchApi<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
};
