// 제공업체 무관 LLM 텍스트 생성 — analysis-service/app/engine/llm.py 의 이식판.
// LLM_PROVIDER(gemini|groq) + LLM_API_KEY (+ LLM_MODEL) 로 동작.

export class LLMError extends Error {}

const TIMEOUT_MS = 30_000;

export const llmEnabled = () => !!process.env.LLM_API_KEY;

export async function generateText(
  prompt: string,
  { maxTokens = 500, temperature = 0.4 }: { maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const provider = (process.env.LLM_PROVIDER || 'gemini').toLowerCase();
  const key = process.env.LLM_API_KEY;
  if (!key) throw new LLMError('LLM_API_KEY not set');
  if (provider === 'gemini') return callGemini(prompt, key, maxTokens, temperature);
  if (provider === 'groq') return callGroq(prompt, key, maxTokens, temperature);
  throw new LLMError(`unknown LLM_PROVIDER: ${provider}`);
}

async function postJson(url: string, body: unknown, headers: Record<string, string> = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

// 과부하로 볼 응답 — 이때만 대체 모델로 한 번 더 시도한다(키·요청 오류는 그대로 실패).
const OVERLOADED = new Set([429, 500, 503, 504]);

async function callGemini(prompt: string, key: string, maxTokens: number, temperature: number) {
  // gemini-2.0-flash 계열은 무료 할당량 429 사례가 있어 flash-latest 가 기본값
  const model = process.env.LLM_MODEL || 'gemini-flash-latest';
  // flash-latest 는 무료 등급에서 503 "high demand"·30초 타임아웃이 잦아 브리핑이 통째로
  // 실패했다(2026-10-26 실측). 더 가벼운 lite 로 한 번만 대체한다.
  const fallback = process.env.LLM_FALLBACK_MODEL || 'gemini-flash-lite-latest';
  try {
    return await callGeminiModel(model, prompt, key, maxTokens, temperature);
  } catch (e) {
    if (!(e instanceof GeminiOverloaded) || fallback === model) throw e;
    return callGeminiModel(fallback, prompt, key, maxTokens, temperature);
  }
}

class GeminiOverloaded extends LLMError {}

async function callGeminiModel(model: string, prompt: string, key: string, maxTokens: number, temperature: number) {
  let res: Response;
  try {
    res = await postJson(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature, maxOutputTokens: maxTokens },
      },
    );
  } catch (e) {
    // TIMEOUT_MS 초과(AbortError)도 과부하로 본다
    throw new GeminiOverloaded(`gemini ${model} request failed: ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) {
    const msg = `gemini ${model} ${res.status}: ${(await res.text()).slice(0, 200)}`;
    throw OVERLOADED.has(res.status) ? new GeminiOverloaded(msg) : new LLMError(msg);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new LLMError(`gemini empty response: ${JSON.stringify(data).slice(0, 200)}`);
  return String(text).trim();
}

async function callGroq(prompt: string, key: string, maxTokens: number, temperature: number) {
  const model = process.env.LLM_MODEL || 'llama-3.3-70b-versatile';
  const res = await postJson(
    'https://api.groq.com/openai/v1/chat/completions',
    { model, messages: [{ role: 'user', content: prompt }], temperature, max_tokens: maxTokens },
    { Authorization: `Bearer ${key}` },
  );
  if (!res.ok) throw new LLMError(`groq ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return String(data.choices[0].message.content).trim();
}
