// Prompt + lenient JSON parser for photo condition analysis.
// JSON-in-text (not tool-calls) so any OpenAI- or Anthropic-shaped gateway
// works; robustness comes from the parser, not provider-specific features.

import { callVision } from './adapter';
import { getAiConfig } from './config';
import { AiConfig, AiError, PhotoConditionAnalysis } from './types';

const SYSTEM_PROMPT = `You are the assistant of an aviation parts receiving inspector.

Examine the photo of a part or its packaging for what is VISIBLE:
- damage: dents, cracks, deep scratches, deformation
- corrosion: rust, oxidation, pitting
- tamperingSigns: broken tabs, tool marks, opened seals, rework evidence
- seal / packaging: is the packaging seal intact? Is the packaging damaged?

Rules:
- If the seal is not visible in this frame, set sealIntact to null. Never guess.
- Same for packagingDamaged: null when the packaging is not visible.
- If a serial or lot number is clearly legible on the part itself, copy it exactly
  into visibleSerial. Otherwise omit visibleSerial.
- If a part number is clearly legible on the part itself, copy it exactly into
  visiblePartNumber. Otherwise omit it. Do not copy a number you are unsure of.
- Report aiConfidence between 0 and 1 for how certain your visual observations
  are. Use a low value for blurry, dark, or partial views.
- findings: 2 to 5 short factual sentences. Never claim certainty the image does
  not support. When relevant include a line like
  "AI observation — confirm with your own eyes before signing."

Reply with ONLY a JSON object, no markdown, no prose, exactly this shape:
{"damage":false,"corrosion":false,"tamperingSigns":false,"sealIntact":null,"packagingDamaged":null,"visibleSerial":"SN-...","visiblePartNumber":"PART-...","findings":["...","..."],"aiConfidence":0.87}`;

// In-memory cache: the same image bytes + model never double-bill in a session.
const cache = new Map<string, PhotoConditionAnalysis>();

export async function analyzePhotoCondition(
  imageDataUrl: string,
  cfg: AiConfig | null = getAiConfig()
): Promise<PhotoConditionAnalysis> {
  if (!cfg) throw new AiError('AI is not configured', 'not_configured');

  const key = `${djb2(imageDataUrl)}|${cfg.model}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const raw = await callVision(cfg, SYSTEM_PROMPT, imageDataUrl);
  const parsed = parseConditionJson(raw);
  cache.set(key, parsed);
  return parsed;
}

/** Exported for tests: extract + coerce the JSON object from a model reply. */
export function parseConditionJson(text: string): PhotoConditionAnalysis {
  const stripped = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start < 0 || end <= start) {
    throw new AiError('No JSON object found in AI reply', 'parse');
  }

  let obj: any;
  try {
    obj = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new AiError('AI reply was not valid JSON', 'parse');
  }
  if (!obj || typeof obj !== 'object') {
    throw new AiError('AI reply was not a JSON object', 'parse');
  }

  const findings = Array.isArray(obj.findings)
    ? obj.findings.filter((f: unknown): f is string => typeof f === 'string').slice(0, 6)
    : [];
  if (findings.length === 0 && typeof obj.findings === 'string') {
    findings.push(obj.findings);
  }

  let aiConfidence = Number(obj.aiConfidence);
  if (!Number.isFinite(aiConfidence)) aiConfidence = 0.5;
  if (aiConfidence > 1 && aiConfidence <= 100) aiConfidence = aiConfidence / 100;
  aiConfidence = Math.min(1, Math.max(0, aiConfidence));

  const result: PhotoConditionAnalysis = {
    damage: coerceBoolean(obj.damage, false),
    corrosion: coerceBoolean(obj.corrosion, false),
    tamperingSigns: coerceBoolean(obj.tamperingSigns, false),
    sealIntact: coerceNullableBoolean(obj.sealIntact),
    packagingDamaged: coerceNullableBoolean(obj.packagingDamaged),
    findings,
    aiConfidence: Math.round(aiConfidence * 100) / 100,
  };

  if (typeof obj.visibleSerial === 'string' && obj.visibleSerial.trim()) {
    result.visibleSerial = obj.visibleSerial.trim();
  }
  if (typeof obj.visiblePartNumber === 'string' && obj.visiblePartNumber.trim()) {
    result.visiblePartNumber = obj.visiblePartNumber.trim();
  }

  return result;
}

/** undefined → false; "true"/"yes"/1 → true; anything else → false. */
function coerceBoolean(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(s)) return true;
    if (['false', 'no', 'n', '0'].includes(s)) return false;
  }
  if (v === 1) return true;
  if (v === 0) return false;
  return fallback;
}

/** Same as coerceBoolean but null/undefined/unknown stay null ("not visible"). */
function coerceNullableBoolean(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string' && !['true', 'false', 'yes', 'no', 'y', 'n', '1', '0'].includes(v.trim().toLowerCase())) {
    return null; // e.g. "unknown", "not visible"
  }
  return coerceBoolean(v, false);
}

/** Small stable hash for cache keys. */
function djb2(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}
