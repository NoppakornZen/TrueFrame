export interface Evidence {
  id: string;
  type: 'photo' | 'barcode' | 'document' | 'sensor' | 'video';
  status: 'pending' | 'approved' | 'rejected' | 'conflict';
  name: string;
  description: string;
  capturedAt: string;
  uploadedBy: string;
  metadata?: Record<string, any>;
  aiAnalysis?: {
    confidence: number;
    findings: string[];
    recommendation: 'accept' | 'reject' | 'needs_review';
  };
  conflicts?: Conflict[];
}

export interface Conflict {
  id: string;
  type: 'contradiction' | 'inconsistency' | 'missing_dependency';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  involvedEvidence: string[];
  suggestedResolution?: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export type RequirementId = 'identity' | 'certificate' | 'condition' | 'seal';
export type RequirementStatus = 'satisfied' | 'review' | 'not_checked' | 'blocked';

export interface RequirementRow {
  id: RequirementId;
  label: string;
  status: RequirementStatus;
  /** Where the answer came from, in plain language. */
  sources: string[];
  reason: string;
}

export interface IdentityReading {
  source: 'barcode' | 'certificate' | 'part';
  serial?: string;
  partNumber?: string;
}

export interface AuditEvent {
  id: string;
  at: string;
  text: string;
}

export interface EscalationItem {
  id: string;
  reason: string;
  detail: string;
}

export interface PolicyRule {
  id: string;
  name: string;
  description: string;
  requiredEvidenceTypes: string[];
  minimumConfidence: number;
  conditions: PolicyCondition[];
  enabled: boolean;
  // A sharp photo is not enough. Someone on the desk has to say they looked.
  humanCheck?: 'noDamage' | 'sealIntact';
}

export interface PolicyCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: any;
}

export interface DecisionResult {
  decision: 'accept' | 'reject' | 'needs_review';
  confidence: number;
  reasoning: string[];
  timestamp: string;
  evidenceUsed: string[];
  conflicts: Conflict[];
  nextBestEvidence?: NextBestEvidence;
}

export interface NextBestEvidence {
  type: string;
  reason: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  estimatedImpact: number;
}

export interface DeliveryCase {
  id: string;
  partNumber: string;
  partName: string;
  supplier: string;
  destination: string;
  expectedDeliveryDate: string;
  status: 'in_transit' | 'delivered' | 'pending_verification' | 'verified' | 'rejected';
  evidence: Evidence[];
  decision?: DecisionResult;
  createdAt: string;
  updatedAt: string;
}
