// Merge an AI condition result into the evidence item that already holds the
// offline pixel analysis. Pixel findings are always kept; AI findings are
// added alongside with clear provenance.

import { Evidence } from '../../types';
import { AiConfig, PhotoConditionAnalysis } from './types';

/** Honesty lines written by inspectFile for photos — replaced when AI runs. */
const HONESTY_LINE = /This does not check for dents|Retake it, then look at the part yourself/;

export function mergePhotoAnalysis(
  base: { metadata: Record<string, any>; aiAnalysis: Evidence['aiAnalysis'] },
  ai: PhotoConditionAnalysis,
  cfg: AiConfig
): { metadata: Record<string, any>; aiAnalysis: Evidence['aiAnalysis'] } {
  const pixel = base.aiAnalysis?.confidence ?? 0.15;
  const aic = ai.aiConfidence;

  // A bad image can't be rescued by AI (the pixels are still bad) — only a
  // small lift. On good pixels, AI leads on content while pixel still gates
  // image quality. Without AI this function never runs, so pixel confidence
  // is untouched by construction.
  let merged =
    pixel < 0.5 ? pixel + 0.1 : 0.4 * pixel + 0.6 * aic;
  merged = Math.min(1, Math.max(0, Math.round(merged * 100) / 100));

  const pixelLines = (base.aiAnalysis?.findings ?? []).filter((f) => !HONESTY_LINE.test(f));
  const findings = [...pixelLines];
  findings.push(
    ai.findings[0]
      ? `AI vision (${cfg.model}) looked at this photo: ${ai.findings[0]}`
      : `AI vision (${cfg.model}) looked at this photo.`
  );
  findings.push('AI can be wrong — check the photo yourself before signing.');
  for (const f of ai.findings.slice(1)) findings.push(`AI: ${f}`);
  if (ai.visibleSerial) findings.push(`Serial visible on part: ${ai.visibleSerial}`);

  return {
    metadata: {
      ...base.metadata,
      // Flattened so PolicyCondition.field resolves directly in the engine.
      damage: ai.damage,
      corrosion: ai.corrosion,
      tamperingSigns: ai.tamperingSigns,
      sealIntact: ai.sealIntact, // null kept as null → condition skips, never fails
      packagingDamaged: ai.packagingDamaged,
      ...(ai.visibleSerial ? { visibleSerial: ai.visibleSerial } : {}),
      ...(ai.visiblePartNumber ? { visiblePartNumber: ai.visiblePartNumber } : {}),
      aiCondition: {
        ...ai,
        model: cfg.model,
        provider: cfg.provider,
        analyzedAt: new Date().toISOString(),
      },
      aiStatus: 'done',
      analysisSource: 'ai',
    },
    aiAnalysis: {
      confidence: merged,
      findings,
      // AI never auto-accepts. A sharp photo (or a confident model) is not a
      // damage check — conditions gate the decision, humans still sign off.
      recommendation: 'needs_review',
    },
  };
}
