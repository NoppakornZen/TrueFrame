// Reads AI vision settings from the environment.
// Nothing configured → the whole feature is silently off and the app behaves
// exactly as it did before AI existed (fully offline pixel analysis).

import { AiConfig } from './types';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

/**
 * Returns config when the app should attempt AI calls, null otherwise.
 *
 * Test hook (dev only): opening the app with `?aiMock=1` points the adapter
 * at a fake local endpoint so E2E can exercise the AI code path without any
 * env vars — puppeteer intercepts the request. Tree-shaken out of prod builds.
 */
export function getAiConfig(): AiConfig | null {
  if (import.meta.env.DEV && typeof location !== 'undefined') {
    if (new URLSearchParams(location.search).has('aiMock')) {
      return {
        provider: 'openai',
        baseUrl: '/__mock-ai/v1',
        model: 'mock-vision',
        apiKey: 'mock',
        timeoutMs: 5000,
      };
    }
  }

  const provider = import.meta.env.VITE_AI_PROVIDER;
  const baseUrl = import.meta.env.VITE_AI_BASE_URL;
  const model = import.meta.env.VITE_AI_MODEL;
  const apiKey = import.meta.env.VITE_AI_API_KEY;

  if (!provider || !baseUrl || !model || apiKey === undefined || apiKey === null) return null;
  if (provider !== 'openai' && provider !== 'anthropic') return null;

  // Dev proxy mode: key lives server-side in vite.config.ts, not in the browser.
  const useProxy = import.meta.env.VITE_AI_USE_PROXY === 'true';
  const effectiveKey = useProxy ? '' : apiKey;

  const timeoutRaw = Number(import.meta.env.VITE_AI_TIMEOUT_MS);
  const timeoutMs = Number.isFinite(timeoutRaw) && timeoutRaw > 0 ? timeoutRaw : 15000;

  return {
    provider,
    baseUrl: normalizeBaseUrl(baseUrl),
    model,
    apiKey: effectiveKey,
    timeoutMs,
  };
}

export function isAiEnabled(): boolean {
  return getAiConfig() !== null;
}
