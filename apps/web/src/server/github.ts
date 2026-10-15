// GitHub Actions 클라이언트 — 서버리스 이전 후 관리자 화면의 '작업 실행·실패 로그·시스템 상태'
// 가 Bull 큐/PM2 대신 Actions 런을 보도록 한다.
//
// GITHUB_TOKEN (fine-grained, 이 저장소의 Actions read/write) 이 있어야 실행 버튼이 동작한다.
// 조회는 공개 저장소라 토큰 없이도 되지만, Vercel 은 IP 를 공유해 비인증 한도(시간당 60회)에
// 금방 걸리므로 토큰을 쓰는 게 맞다.
export const GH_REPO = process.env.GITHUB_REPO || 'dldnsgkr/stock-signal-backend';

export class GitHubError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

async function gh(path: string, init: RequestInit = {}) {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/repos/${GH_REPO}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers as Record<string, string>) },
    cache: 'no-store',
  });
  if (!res.ok) throw new GitHubError(res.status, `GitHub ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.status === 204 ? null : res.json();
}

export type WorkflowRun = {
  id: number;
  name: string;
  display_title: string;
  event: string;
  status: 'queued' | 'in_progress' | 'completed' | 'waiting' | 'requested' | 'pending';
  conclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'timed_out' | null;
  created_at: string;
  updated_at: string;
  run_started_at?: string;
  html_url: string;
  path: string;
};

export async function listRuns(workflowFile: string, perPage = 20, query = ''): Promise<WorkflowRun[]> {
  const data = await gh(`/actions/workflows/${workflowFile}/runs?per_page=${perPage}${query}`);
  return data.workflow_runs as WorkflowRun[];
}

export async function dispatch(workflowFile: string, inputs: Record<string, string>) {
  if (!process.env.GITHUB_TOKEN) {
    throw new GitHubError(503, 'GITHUB_TOKEN 미설정 — 관리자 실행 버튼은 GitHub 토큰이 필요합니다');
  }
  await gh(`/actions/workflows/${workflowFile}/dispatches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs }),
  });
}
