// Provider-agnostic vision transport. One entry point, two request shapes:
//   - openai:    OpenAI-compatible gateways (OpenAI, LiteLLM, OpenRouter, vLLM, Ollama…)
//   - anthropic: the Anthropic Messages API
// A future gateway of another shape only needs a new builder here.

import { AiConfig, AiError } from './types';

/**
 * Send one image + prompt to the model, return the raw text reply.
 * Never includes the API key in thrown error messages.
 */
export async function callVision(
  cfg: AiConfig,
  prompt: string,
  imageDataUrl: string,
  signal?: AbortSignal
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  const onOuterAbort = () => controller.abort();
  signal?.addEventListener('abort', onOuterAbort);

  try {
    const { url, init } =
      cfg.provider === 'anthropic'
        ? buildAnthropicRequest(cfg, prompt, imageDataUrl)
        : buildOpenAiRequest(cfg, prompt, imageDataUrl);
    init.signal = controller.signal;

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') {
        throw new AiError(`AI request timed out after ${cfg.timeoutMs}ms`, 'timeout');
      }
      throw new AiError(`AI request failed: ${(err as Error)?.message ?? 'network error'}`, 'network');
    }

    if (!res.ok) {
      // Status only — never echo request headers or the key.
      throw new AiError(`AI request failed with HTTP ${res.status}`, 'http');
    }

    let body: any;
    try {
      body = await res.json();
    } catch {
      throw new AiError('AI response was not valid JSON', 'parse');
    }

    const text = extractText(cfg, body);
    if (!text) throw new AiError('AI response contained no text', 'parse');
    return text;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onOuterAbort);
  }
}

function buildOpenAiRequest(
  cfg: AiConfig,
  prompt: string,
  imageDataUrl: string
): { url: string; init: RequestInit } {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cfg.apiKey) headers['Authorization'] = `Bearer ${cfg.apiKey}`;

  const body: Record<string, unknown> = {
    model: cfg.model,
    temperature: 0,
    messages: [
      { role: 'system', content: prompt },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze this evidence photo. Return only the JSON object.' },
          { type: 'image_url', image_url: { url: imageDataUrl } },
        ],
      },
    ],
  };

  // Only sent when explicitly enabled — many open-source gateways reject it.
  if (import.meta.env.VITE_AI_JSON_MODE === 'true') {
    body.response_format = { type: 'json_object' };
  }

  return {
    url: `${cfg.baseUrl}/chat/completions`,
    init: { method: 'POST', headers, body: JSON.stringify(body) },
  };
}

function buildAnthropicRequest(
  cfg: AiConfig,
  prompt: string,
  imageDataUrl: string
): { url: string; init: RequestInit } {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'anthropic-version': '2023-06-01',
  };
  if (cfg.apiKey) headers['x-api-key'] = cfg.apiKey;

  const comma = imageDataUrl.indexOf(',');
  const mediaType = imageDataUrl.slice(5, comma); // "data:image/jpeg;base64,..." → "image/jpeg"
  const b64 = imageDataUrl.slice(comma + 1);

  const body = {
    model: cfg.model,
    max_tokens: 1024,
    system: prompt,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: b64 } },
          { type: 'text', text: 'Analyze this evidence photo. Return only the JSON object.' },
        ],
      },
    ],
  };

  return {
    url: `${cfg.baseUrl}/v1/messages`,
    init: { method: 'POST', headers, body: JSON.stringify(body) },
  };
}

function extractText(cfg: AiConfig, body: any): string {
  if (cfg.provider === 'anthropic') {
    const blocks = Array.isArray(body?.content) ? body.content : [];
    return blocks
      .filter((b: any) => b?.type === 'text' && typeof b.text === 'string')
      .map((b: any) => b.text)
      .join('\n')
      .trim();
  }
  const content = body?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}
