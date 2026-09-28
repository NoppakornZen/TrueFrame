import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Evidence, PolicyRule, DecisionResult, DeliveryCase, Conflict, AuditEvent } from '../types';

interface AppState {
  currentCase: DeliveryCase | null;
  evidence: Evidence[];
  policies: PolicyRule[];
  decision: DecisionResult | null;
  conflicts: Conflict[];
  audit: AuditEvent[];
  reviewNote?: string;

  setCurrentCase: (deliveryCase: DeliveryCase) => void;
  addEvidence: (evidence: Evidence) => void;
  updateEvidence: (id: string, updates: Partial<Evidence>) => void;
  removeEvidence: (id: string) => void;
  loadEvidence: (items: Evidence[]) => void;
  setInspectorSignoff: (id: string, check: 'noDamage' | 'sealIntact') => void;

  setPolicies: (policies: PolicyRule[]) => void;
  addPolicy: (policy: PolicyRule) => void;
  updatePolicy: (id: string, updates: Partial<PolicyRule>) => void;
  removePolicy: (id: string) => void;

  setDecision: (decision: DecisionResult) => void;
  applyAnalysis: (decision: DecisionResult) => void;
  addConflict: (conflict: Conflict) => void;
  resolveConflict: (id: string, resolution: string) => void;
  resolveReview: (note: string) => void;
  resetState: () => void;
}

const mockCase: DeliveryCase = {
  id: 'CASE-2024-001',
  partNumber: 'PART-787-ENG-0451',
  partName: 'CFM LEAP-1B Turbine Blade Assembly',
  supplier: 'Boeing Supplier Network',
  destination: 'United Airlines Maintenance Facility - SFO',
  expectedDeliveryDate: '2024-09-25T14:00:00Z',
  status: 'pending_verification',
  evidence: [],
  createdAt: '2024-09-24T08:00:00Z',
  updatedAt: '2024-09-24T12:30:00Z',
};

const mockPolicies: PolicyRule[] = [
  {
    id: 'policy-1',
    name: 'Serial Number Verification',
    description: 'All aircraft parts must have a valid serial number that matches the shipping manifest',
    requiredEvidenceTypes: ['barcode', 'document'],
    minimumConfidence: 0.95,
    conditions: [
      { field: 'serialNumber', operator: 'exists', value: true },
      // Cross-evidence serial mismatch is handled by the conflict detector,
      // not by a condition — a dotted placeholder here would always fail.
    ],
    enabled: true,
  },
  {
    id: 'policy-2',
    name: 'Certificate of Conformity',
    description: 'Critical parts require an FAA-approved Certificate of Conformity',
    requiredEvidenceTypes: ['document'],
    minimumConfidence: 0.90,
    conditions: [
      { field: 'certificateType', operator: 'equals', value: 'FAA-CoC' },
      { field: 'certificateValid', operator: 'equals', value: true },
    ],
    enabled: true,
  },
  {
    id: 'policy-3',
    name: 'Physical Condition Check',
    description: 'Parts must be free from visible damage, corrosion, or tampering',
    requiredEvidenceTypes: ['photo'],
    minimumConfidence: 0.85,
    humanCheck: 'noDamage',
    conditions: [
      { field: 'damage', operator: 'equals', value: false },
      { field: 'corrosion', operator: 'equals', value: false },
      { field: 'tamperingSigns', operator: 'equals', value: false },
    ],
    enabled: true,
  },
  {
    id: 'policy-4',
    name: 'Packaging Integrity',
    description: 'Original packaging must be sealed and undamaged',
    requiredEvidenceTypes: ['photo'],
    minimumConfidence: 0.90,
    humanCheck: 'sealIntact',
    conditions: [
      { field: 'sealIntact', operator: 'equals', value: true },
      { field: 'packagingDamaged', operator: 'equals', value: false },
    ],
    enabled: true,
  },
];

function note(text: string): AuditEvent {
  return {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    text,
  };
}

function evidenceNote(item: Evidence): string {
  if (item.type === 'barcode') {
    return item.metadata?.serialNumber
      ? `Barcode read: ${item.metadata.serialNumber}.`
      : 'Barcode photo added, but no serial could be read.';
  }
  if (item.type === 'document') {
    const serial = item.metadata?.serialNumber ? ` serial ${item.metadata.serialNumber}` : '';
    const expiry = item.metadata?.expiryDate ? `, expiry ${item.metadata.expiryDate}` : ', no expiry date found';
    return `Certificate read${serial}${expiry}.`;
  }
  if (item.type === 'photo') return `Part photo added: ${item.name}. Waiting on AI inspection and a person.`;
  return `${item.type} added: ${item.name}.`;
}

function clearDecision(state: { currentCase: DeliveryCase | null }, evidence: Evidence[]) {
  return {
    evidence,
    decision: null as DecisionResult | null,
    conflicts: [] as Conflict[],
    reviewNote: undefined as string | undefined,
    currentCase: state.currentCase
      ? {
          ...state.currentCase,
          status: 'pending_verification' as const,
          evidence,
          decision: undefined,
          updatedAt: new Date().toISOString(),
        }
      : null,
  };
}

// Persisted so a browser refresh (or an accidental tab close mid-demo) never
// loses the evidence and policy work already done.
export const useStore = create<AppState>()(
  persist(
    (set) => ({
      currentCase: mockCase,
      evidence: [],
      policies: mockPolicies,
      decision: null,
      conflicts: [],
      audit: [],

  setCurrentCase: (deliveryCase) => set({ currentCase: deliveryCase }),

  addEvidence: (evidence) =>
    set((state) => {
      const next = [...state.evidence.map((e) => ({ ...e, status: 'pending' as const })), evidence];
      return { ...clearDecision(state, next), audit: [...state.audit, note(evidenceNote(evidence))] };
    }),

  updateEvidence: (id, updates) =>
    set((state) => {
      const prev = state.evidence.find((e) => e.id === id);
      const evidence = state.evidence.map((e) => (e.id === id ? { ...e, ...updates } : e));
      const audit = [...state.audit];
      const becameDone = updates.metadata?.aiStatus === 'done' && prev?.metadata?.aiStatus !== 'done';
      if (becameDone) {
        const serial = updates.metadata?.visibleSerial;
        audit.push(
          note(
            serial
              ? `AI inspection finished on ${prev?.name ?? 'the photo'}. Serial read on the part: ${serial}.`
              : `AI inspection finished on ${prev?.name ?? 'the photo'}. No serial was readable on the part.`
          )
        );
      }
      if (updates.metadata?.aiStatus === 'error' && prev?.metadata?.aiStatus !== 'error') {
        audit.push(note(`AI inspection could not check ${prev?.name ?? 'the photo'}. Pixel checks only.`));
      }
      return { evidence, audit };
    }),

  removeEvidence: (id) =>
    set((state) => clearDecision(state, state.evidence.filter((e) => e.id !== id))),

  loadEvidence: (items) =>
    set((state) => ({
      ...clearDecision(state, items),
      audit: [...state.audit, ...items.map((item) => note(evidenceNote(item)))],
    })),

  setInspectorSignoff: (id, check) =>
    set((state) => {
      const evidence = state.evidence.map((e) => {
        if (e.id !== id) return e;
        const prev = (e.metadata?.inspectorSignoff ?? {}) as { noDamage?: boolean; sealIntact?: boolean };
        return {
          ...e,
          metadata: {
            ...e.metadata,
            inspectorSignoff: { ...prev, [check]: !prev[check] },
          },
        };
      });
      return { ...clearDecision(state, evidence), audit: [...state.audit, note(`Inspector signed ${check === 'noDamage' ? 'no visible damage' : 'seal intact'}.`)] };
    }),

  setPolicies: (policies) => set({ policies }),

  updatePolicy: (id, updates) =>
    set((state) => ({
      policies: state.policies.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    })),

  addPolicy: (policy) =>
    set((state) => ({
      policies: [...state.policies, policy],
    })),

  removePolicy: (id) =>
    set((state) => ({
      policies: state.policies.filter((p) => p.id !== id),
    })),

  setDecision: (decision) => set({ decision }),

  applyAnalysis: (result) =>
    set((state) => {
      const blocking = result.conflicts.filter(
        (c) => !c.resolvedAt && (c.severity === 'critical' || c.severity === 'high')
      );
      const blockedIds = new Set(blocking.flatMap((c) => c.involvedEvidence));
      const evidence = state.evidence.map((e) => {
        const status: Evidence['status'] = blockedIds.has(e.id)
          ? 'conflict'
          : e.aiAnalysis?.recommendation === 'accept'
            ? 'approved'
            : e.aiAnalysis?.recommendation === 'reject'
              ? 'rejected'
              : 'pending';
        return {
          ...e,
          status,
          conflicts: result.conflicts.filter((c) => c.involvedEvidence.includes(e.id)),
        };
      });
      const caseStatus =
        result.decision === 'accept'
          ? 'verified'
          : result.decision === 'reject'
            ? 'rejected'
            : 'pending_verification';
      return {
        evidence,
        decision: result,
        conflicts: result.conflicts,
        reviewNote: undefined,
        audit: [
          ...state.audit,
          note(
            result.decision === 'accept'
              ? 'Decision: accept. Every required source agreed.'
              : result.decision === 'reject'
                ? 'Decision: reject. A required source failed.'
                : 'Decision: manual review. A required check is missing or the sources disagree.'
          ),
        ],
        currentCase: state.currentCase
          ? {
              ...state.currentCase,
              status: caseStatus,
              evidence,
              decision: result,
              updatedAt: new Date().toISOString(),
            }
          : null,
      };
    }),

  addConflict: (conflict) =>
    set((state) => ({
      conflicts: [...state.conflicts, conflict],
    })),

  resolveReview: (reviewNote) =>
    set((state) => {
      // Reject stays reject. Manual accept covers a missing reading or a
      // disagreement the inspector has looked at — never a failed certificate.
      if (!state.decision || state.decision.decision === 'reject') return state;
      const decision: DecisionResult = {
        ...state.decision,
        decision: 'accept',
        reasoning: [...state.decision.reasoning, `Manual review: ${reviewNote}`],
      };
      return {
        reviewNote,
        decision,
        audit: [...state.audit, note(`Inspector accepted after review. ${reviewNote}`)],
        currentCase: state.currentCase
          ? { ...state.currentCase, status: 'verified', decision, updatedAt: new Date().toISOString() }
          : null,
      };
    }),

  resolveConflict: (id, _resolution) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id
          ? { ...c, resolvedAt: new Date().toISOString(), resolvedBy: 'Inspector J. Smith' }
          : c
      ),
    })),

  resetState: () => {
    useStore.persist.clearStorage();
    set({
      currentCase: mockCase,
      evidence: [],
      policies: mockPolicies,
      decision: null,
      conflicts: [],
      audit: [],
      reviewNote: undefined,
    });
  },
}),
    {
      name: 'trueframe-state',
      // Only persist the data, never the action functions
      partialize: (state) => ({
        currentCase: state.currentCase,
        evidence: state.evidence,
        policies: state.policies,
        decision: state.decision,
        conflicts: state.conflicts,
        audit: state.audit,
        reviewNote: state.reviewNote,
      }),
      // Older saved sessions predate the "a person has to look" rule.
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<AppState>;
        const policies = (saved.policies ?? current.policies).map((pol) => {
          let next = pol;
          if (pol.id === 'policy-3') next = { ...next, humanCheck: 'noDamage' as const };
          if (pol.id === 'policy-4') next = { ...next, humanCheck: 'sealIntact' as const };
          // Drop the old always-fail placeholder condition from saved sessions.
          if (Array.isArray(next.conditions)) {
            const filtered = next.conditions.filter((c) => c.value !== 'manifest.serialNumber');
            if (filtered.length !== next.conditions.length) {
              next = { ...next, conditions: filtered };
            }
          }
          return next;
        });
        // An AI call mid-flight when the tab closed comes back as a stale
        // 'running' — surface it as an error so the card offers Retry.
        const evidence = (saved.evidence ?? current.evidence).map((ev) =>
          ev.metadata?.aiStatus === 'running'
            ? { ...ev, metadata: { ...ev.metadata, aiStatus: 'error', aiError: 'interrupted' } }
            : ev
        );
        return { ...current, ...saved, policies, evidence, audit: saved.audit ?? [] };
      },
    }
  )
);
