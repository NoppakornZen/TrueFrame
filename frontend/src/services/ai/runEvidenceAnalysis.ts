// Async orchestrator: runs AI vision on an uploaded photo, outside the
// synchronous upload path. Fire-and-forget — store updates drive the UI.
//
// Invariants:
// - No AI config → no-op (fully offline behavior, identical to pre-AI app).
// - AI failure → offline pixel analysis stays untouched; status records the error.
// - Cached per evidence (metadata.aiCondition) so Run/refresh never re-bills.

import { useStore } from '../../store';
import { getAiConfig } from './config';
import { analyzePhotoCondition } from './photoCondition';
import { mergePhotoAnalysis } from './merge';
import { AiError } from './types';

export async function runEvidenceAiAnalysis(evidenceId: string): Promise<void> {
  const state = useStore.getState();
  const ev = state.evidence.find((e) => e.id === evidenceId);
  if (!ev || ev.type !== 'photo') return;

  const cfg = getAiConfig();
  if (!cfg) {
    if (ev.metadata?.aiStatus !== 'idle') {
      state.updateEvidence(evidenceId, { metadata: { ...ev.metadata, aiStatus: 'skipped' } });
    }
    return;
  }

  const preview = ev.metadata?.preview;
  if (typeof preview !== 'string' || !preview) return;

  // Persisted cache hit — already analyzed in an earlier run or session.
  if (ev.metadata?.aiCondition) {
    if (ev.metadata?.aiStatus !== 'done') {
      state.updateEvidence(evidenceId, {
        metadata: { ...ev.metadata, aiStatus: 'done', analysisSource: 'ai' },
      });
    }
    return;
  }

  state.updateEvidence(evidenceId, {
    metadata: { ...ev.metadata, aiStatus: 'running', aiError: undefined },
  });

  try {
    const ai = await analyzePhotoCondition(preview, cfg);
    const current = useStore.getState().evidence.find((e) => e.id === evidenceId);
    if (!current) return; // removed mid-flight
    const merged = mergePhotoAnalysis(
      { metadata: current.metadata ?? {}, aiAnalysis: current.aiAnalysis },
      ai,
      cfg
    );
    useStore.getState().updateEvidence(evidenceId, {
      metadata: merged.metadata,
      aiAnalysis: merged.aiAnalysis,
    });
  } catch (err) {
    const kind = err instanceof AiError ? err.kind : 'network';
    const current = useStore.getState().evidence.find((e) => e.id === evidenceId);
    if (!current) return;
    // Keep the pixel-based aiAnalysis exactly as it was — offline fallback.
    useStore.getState().updateEvidence(evidenceId, {
      metadata: { ...current.metadata, aiStatus: 'error', aiError: kind },
    });
  }
}

/** Explicit user retry after an AI error. */
export async function retryEvidenceAiAnalysis(evidenceId: string): Promise<void> {
  const ev = useStore.getState().evidence.find((e) => e.id === evidenceId);
  if (!ev) return;
  const { aiCondition, aiError, ...rest } = ev.metadata ?? {};
  void aiCondition;
  void aiError;
  useStore.getState().updateEvidence(evidenceId, { metadata: { ...rest, aiStatus: 'running' } });
  await runEvidenceAiAnalysis(evidenceId);
}
