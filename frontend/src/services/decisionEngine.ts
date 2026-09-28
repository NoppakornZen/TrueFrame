import { Evidence, PolicyRule, PolicyCondition, DecisionResult, Conflict, NextBestEvidence, RequirementRow } from '../types';
import { buildRequirements } from './requirements';

export class EvidenceDecisionEngine {
  static analyzeEvidence(
    evidence: Evidence[],
    policies: PolicyRule[]
  ): DecisionResult {
    const enabledPolicies = policies.filter((p) => p.enabled);
    const reasoning: string[] = [];
    // Cross-evidence conflicts (e.g. serial mismatch between barcode and document)
    const conflicts: Conflict[] = [...this.detectConflicts(evidence)];
    let overallConfidence = 0;
    let passedPolicies = 0;

    // Check each policy — skip confidence failure if the evidence is already
    // implicated in a cross-evidence conflict (the conflict is the real story)
    for (const policy of enabledPolicies) {
      const policyResult = this.checkPolicy(evidence, policy, conflicts);

      if (policyResult.passed) {
        passedPolicies++;
        reasoning.push(`✓ ${policy.name}: ${policyResult.reason}`);
        overallConfidence += policyResult.confidence;
      } else {
        reasoning.push(`✗ ${policy.name}: ${policyResult.reason}`);
        if (policyResult.conflict && !conflicts.some((c) => c.id === policyResult.conflict!.id)) {
          conflicts.push(policyResult.conflict);
        }
      }
    }

    // Calculate average confidence
    overallConfidence = enabledPolicies.length > 0
      ? overallConfidence / enabledPolicies.length
      : 0;

    // Determine decision
    let decision: 'accept' | 'reject' | 'needs_review' = 'needs_review';

    if (passedPolicies === enabledPolicies.length && overallConfidence >= 0.90) {
      decision = 'accept';
      reasoning.push(`All ${enabledPolicies.length} policies satisfied with high confidence`);
    } else if (conflicts.filter(c => c.severity === 'critical').length > 0) {
      decision = 'reject';
      reasoning.push('Critical conflicts detected - immediate rejection');
    } else if (passedPolicies < enabledPolicies.length * 0.5) {
      decision = 'reject';
      reasoning.push('Less than 50% of policies satisfied');
    }

    const requirements = buildRequirements(evidence);
    const hold = requirements.filter((row) => row.status !== 'satisfied');
    const blocked = requirements.filter((row) => row.status === 'blocked');
    const disagreed = requirements.filter((row) => row.status === 'review');
    // Accept only when every requirement was actually checked and agreed.
    // A missing AI check or an unread part serial is review, never a guess.
    // Only a failed requirement (an expired certificate) is a reject.
    // A disagreement is not a guess either way: it waits for the inspector.
    if (decision !== 'reject' && blocked.length > 0) {
      decision = 'reject';
      reasoning.push('Rejected. A required source failed.');
      for (const row of blocked) reasoning.push(`${row.label}: ${row.reason}`);
    } else if (decision !== 'reject' && (disagreed.length > 0 || (decision === 'accept' && hold.length > 0))) {
      decision = 'needs_review';
      reasoning.push(
        disagreed.length > 0
          ? 'Not accepted. The sources disagree, so a person has to decide.'
          : 'Not accepted. A required check is missing or has not been read.'
      );
      for (const row of [...disagreed, ...hold.filter((row) => row.status === 'not_checked')]) {
        reasoning.push(`${row.label}: ${row.reason}`);
      }
    }

    const nextBest = this.calculateNextBestEvidence(evidence, policies, conflicts, requirements);

    return {
      decision,
      confidence: overallConfidence,
      reasoning,
      timestamp: new Date().toISOString(),
      evidenceUsed: evidence.map((e) => e.id),
      conflicts,
      nextBestEvidence: nextBest,
    };
  }

  /** Same pass/fail the decision uses, including cross-evidence conflicts. */
  static isPolicySatisfied(
    evidence: Evidence[],
    policy: PolicyRule,
    conflicts: Conflict[] = []
  ): boolean {
    if (!this.checkPolicy(evidence, policy, conflicts).passed) return false;

    const relevantIds = new Set(
      evidence.filter((e) => policy.requiredEvidenceTypes.includes(e.type)).map((e) => e.id)
    );
    const blocked = conflicts.some(
      (c) =>
        !c.resolvedAt &&
        (c.severity === 'critical' || c.severity === 'high') &&
        c.involvedEvidence.some((id) => relevantIds.has(id))
    );
    return !blocked;
  }

  private static checkPolicy(
    evidence: Evidence[],
    policy: PolicyRule,
    runConflicts: Conflict[] = []
  ): {
    passed: boolean;
    confidence: number;
    reason: string;
    conflict?: Conflict;
  } {
    // Check if required evidence types are present
    const requiredTypes = new Set(policy.requiredEvidenceTypes);
    const presentTypes = new Set(evidence.map((e) => e.type));

    const missingTypes = Array.from(requiredTypes).filter(
      (t) => !presentTypes.has(t as any)
    );

    if (missingTypes.length > 0) {
      return {
        passed: false,
        confidence: 0,
        reason: `Missing required evidence: ${missingTypes.join(', ')}`,
      };
    }

    // Damage and the seal are a person's call. Sharpness never satisfies them.
    if (policy.humanCheck) {
      const signed = evidence.some(
        (e) => e.type === 'photo' && e.metadata?.inspectorSignoff?.[policy.humanCheck!] === true
      );
      if (!signed) {
        return {
          passed: false,
          confidence: 0,
          reason:
            policy.humanCheck === 'noDamage'
              ? 'A person still has to look. A sharp photo is not a damage check.'
              : 'A person still has to look. A sharp photo does not prove the seal is intact.',
        };
      }
      // Signed — conditions may still veto (e.g. AI saw damage despite the signoff).
      const cond = this.evaluateConditions(evidence, policy);
      if (!cond.passed) {
        return { passed: false, confidence: 0, reason: cond.failedReason! };
      }
      return {
        passed: true,
        confidence: 1,
        reason:
          (policy.humanCheck === 'noDamage'
            ? 'Inspector confirmed there is no visible damage'
            : 'Inspector confirmed the seal is intact') + this.skipNote(cond.skippedCount),
      };
    }

    // Evaluate policy conditions. Fields with no data anywhere are skipped,
    // never failed — offline evidence must not trip conditions it cannot answer.
    const condCheck = this.evaluateConditions(evidence, policy);
    if (!condCheck.passed) {
      return { passed: false, confidence: 0, reason: condCheck.failedReason! };
    }

    // Check confidence levels
    const relevantEvidence = evidence.filter((e) =>
      policy.requiredEvidenceTypes.includes(e.type)
    );

    let totalConfidence = 0;
    let evidenceCount = 0;

    for (const ev of relevantEvidence) {
      if (ev.aiAnalysis) {
        if (ev.aiAnalysis.confidence < policy.minimumConfidence) {
          return {
            passed: false,
            confidence: ev.aiAnalysis.confidence,
            reason: `Evidence "${ev.name}" confidence (${(ev.aiAnalysis.confidence * 100).toFixed(1)}%) below threshold (${(policy.minimumConfidence * 100).toFixed(1)}%)`,
          };
        }
        totalConfidence += ev.aiAnalysis.confidence;
        evidenceCount++;
      }
    }

    const avgConfidence = evidenceCount > 0 ? totalConfidence / evidenceCount : 0;

    // Critical conflicts relevant to this policy — take from THIS run's
    // detection first (fresh), plus anything already attached to evidence
    // (from an earlier run). Deterministic ids keep the two from duplicating.
    const relevantIds = new Set(
      evidence.filter((e) => policy.requiredEvidenceTypes.includes(e.type)).map((e) => e.id)
    );
    const candidateConflicts = [...runConflicts, ...evidence.flatMap((e) => e.conflicts ?? [])];
    const criticalConflict = candidateConflicts.find(
      (c) =>
        !c.resolvedAt && c.severity === 'critical' && c.involvedEvidence.some((id) => relevantIds.has(id))
    );

    if (criticalConflict) {
      return {
        passed: false,
        confidence: avgConfidence,
        reason: 'Critical conflict detected in evidence',
        conflict: criticalConflict,
      };
    }

    return {
      passed: true,
      confidence: avgConfidence,
      reason:
        `Satisfied with ${(avgConfidence * 100).toFixed(1)}% confidence` +
        this.skipNote(condCheck.skippedCount),
    };
  }

  /** Transparency suffix when some conditions had no data to evaluate. */
  private static skipNote(skippedCount: number): string {
    return skippedCount > 0
      ? ` (${skippedCount} condition(s) not evaluated — data not present)`
      : '';
  }

  /**
   * Evaluate a policy's conditions against the evidence the policy requires.
   *
   * Semantics that keep offline behavior safe:
   * - `exists`: always evaluated (pass = at least one non-null value).
   * - any other operator with NO values anywhere → SKIP, never fail.
   *   (AI-absent photos have no `damage` field; unwritten fields like
   *   `certificateType` never fail a policy that cannot see them.)
   * - `null` values (e.g. AI "seal not visible") count as absent → skip.
   * - values present but none matching → hard fail.
   */
  private static evaluateConditions(
    evidence: Evidence[],
    policy: PolicyRule
  ): { passed: boolean; failedReason?: string; skippedCount: number } {
    if (!policy.conditions || policy.conditions.length === 0) {
      return { passed: true, skippedCount: 0 };
    }

    const contexts = evidence.filter((e) => policy.requiredEvidenceTypes.includes(e.type));
    let skippedCount = 0;

    for (const cond of policy.conditions) {
      const values = contexts
        .map((e) => e.metadata?.[cond.field])
        .filter((v) => v !== undefined && v !== null);

      if (cond.operator === 'exists') {
        if (values.length === 0) {
          return {
            passed: false,
            skippedCount,
            failedReason: `Condition failed: ${cond.field} exists (no value found)`,
          };
        }
        continue;
      }

      if (values.length === 0) {
        skippedCount++; // not evaluable with the data on the desk
        continue;
      }

      if (!values.some((v) => this.conditionMatches(v, cond))) {
        const actual = values.map((v) => String(v)).join(', ');
        const expected =
          typeof cond.value === 'boolean' ? String(cond.value) : String(cond.value);
        return {
          passed: false,
          skippedCount,
          failedReason: `Condition failed: ${cond.field} ${cond.operator} ${expected} (actual: ${actual})`,
        };
      }
    }

    return { passed: true, skippedCount };
  }

  private static conditionMatches(value: unknown, cond: PolicyCondition): boolean {
    switch (cond.operator) {
      case 'equals': {
        if (typeof cond.value === 'boolean' || typeof value === 'boolean') {
          return this.toBool(value) === this.toBool(cond.value);
        }
        return value === cond.value || String(value) === String(cond.value);
      }
      case 'contains':
        return String(value).toLowerCase().includes(String(cond.value).toLowerCase());
      case 'greater_than': {
        const n = Number(value);
        const t = Number(cond.value);
        return Number.isFinite(n) && Number.isFinite(t) && n > t;
      }
      case 'less_than': {
        const n = Number(value);
        const t = Number(cond.value);
        return Number.isFinite(n) && Number.isFinite(t) && n < t;
      }
      case 'exists':
        return true;
      default:
        return false;
    }
  }

  private static toBool(v: unknown): boolean {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      const s = v.trim().toLowerCase();
      if (['true', 'yes', 'y', '1'].includes(s)) return true;
      if (['false', 'no', 'n', '0'].includes(s)) return false;
    }
    return Boolean(v);
  }

  private static calculateNextBestEvidence(
    currentEvidence: Evidence[],
    policies: PolicyRule[],
    conflicts: Conflict[],
    requirements: RequirementRow[] = []
  ): NextBestEvidence | undefined {
    const identity = requirements.find((r) => r.id === 'identity');
    if (identity && identity.status !== 'satisfied' && identity.reason.includes('part itself')) {
      return {
        type: 'photo',
        reason: 'The serial on the part has not been read. A clearer photo of the part marking is needed before accept.',
        priority: 'high',
        estimatedImpact: 0.8,
      };
    }
    // Find missing evidence types
    const currentTypes = new Set(currentEvidence.map((e) => e.type));
    const allRequiredTypes = new Set(
      policies.flatMap((p) => p.requiredEvidenceTypes)
    );

    const missingTypes = Array.from(allRequiredTypes).filter(
      (t) => !currentTypes.has(t as any)
    );

    if (missingTypes.length > 0) {
      const priority = this.determinePriority(missingTypes[0], policies);
      return {
        type: missingTypes[0],
        reason: `Required by ${policies.filter((p) => p.requiredEvidenceTypes.includes(missingTypes[0])).length} active policies`,
        priority,
        estimatedImpact: 0.85,
      };
    }

    // Check if any evidence has low confidence
    const lowConfidenceEvidence = currentEvidence.filter(
      (e) => e.aiAnalysis && e.aiAnalysis.confidence < 0.85
    );

    if (lowConfidenceEvidence.length > 0) {
      const ev = lowConfidenceEvidence[0];
      return {
        type: `Additional ${ev.type}`,
        reason: `Current ${ev.type} has low confidence (${(ev.aiAnalysis!.confidence * 100).toFixed(1)}%)`,
        priority: 'high',
        estimatedImpact: 0.75,
      };
    }

    // Check conflicts
    if (conflicts.length > 0) {
      const highestSeverity = conflicts.reduce((max, c) =>
        this.severityToNumber(c.severity) > this.severityToNumber(max.severity) ? c : max
      );

      return {
        type: 'document',
        reason: `Resolve conflict: ${highestSeverity.description}`,
        priority: highestSeverity.severity === 'critical' ? 'critical' : 'high',
        estimatedImpact: 0.90,
      };
    }

    return undefined;
  }

  private static determinePriority(
    evidenceType: string,
    policies: PolicyRule[]
  ): 'low' | 'medium' | 'high' | 'critical' {
    const policiesRequiring = policies.filter((p) =>
      p.requiredEvidenceTypes.includes(evidenceType)
    );

    if (policiesRequiring.length >= 3) return 'critical';
    if (policiesRequiring.length === 2) return 'high';
    if (policiesRequiring.length === 1) return 'medium';
    return 'low';
  }

  private static severityToNumber(severity: string): number {
    const map: Record<string, number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 4,
    };
    return map[severity] || 0;
  }

  static detectConflicts(evidence: Evidence[]): Conflict[] {
    const conflicts: Conflict[] = [];

    // Serial mismatch between barcode and certificate.
    // Id is content-derived so re-running analysis dedupes instead of
    // appending a fresh Date.now() duplicate every time.
    const barcodeEvidence = evidence.filter((e) => e.type === 'barcode');
    const documentEvidence = evidence.filter((e) => e.type === 'document');

    if (barcodeEvidence.length > 0 && documentEvidence.length > 0) {
      const barcode = barcodeEvidence[0];
      const document = documentEvidence[0];
      const barcodeSerial = barcode.metadata?.serialNumber;
      const documentSerial = document.metadata?.serialNumber;

      if (barcodeSerial && documentSerial && barcodeSerial !== documentSerial) {
        conflicts.push({
          id: `conflict-serial-${barcode.id}-${document.id}`,
          type: 'contradiction',
          severity: 'critical',
          description: `Serial number mismatch: Barcode shows "${barcodeSerial}" but document shows "${documentSerial}"`,
          involvedEvidence: [barcode.id, document.id],
          suggestedResolution: 'Verify original shipping manifest and re-scan both barcode and document',
        });
      }
    }

    // Photo evidence: condition facts come from AI vision (metadata.damage etc).
    // Offline photos have no such fields — they join neither side, no conflict.
    const photoEvidence = evidence.filter((e) => e.type === 'photo');
    const withDamage = photoEvidence.filter((e) => e.metadata?.damage === true);
    const withoutDamage = photoEvidence.filter((e) => e.metadata?.damage === false);

    if (withDamage.length > 0 && withoutDamage.length > 0) {
      const involved = [...withDamage, ...withoutDamage].map((e) => e.id);
      conflicts.push({
        id: `conflict-photo-damage-${involved.join('-')}`,
        type: 'inconsistency',
        severity: 'high',
        description: 'One photo shows visible damage while another does not',
        involvedEvidence: involved,
        suggestedResolution: 'Request additional high-resolution photos from multiple angles',
      });
    }

    // Inspector signed off, but AI vision saw the opposite — surface it.
    for (const ev of photoEvidence) {
      const signoff = ev.metadata?.inspectorSignoff;
      if (signoff?.noDamage === true && ev.metadata?.damage === true) {
        conflicts.push({
          id: `conflict-signoff-damage-${ev.id}`,
          type: 'contradiction',
          severity: 'high',
          description: `Inspector signed "no damage" but AI vision reports visible damage on "${ev.name}" — re-inspect before accepting`,
          involvedEvidence: [ev.id],
          suggestedResolution: 'Re-examine the photo and confirm or revoke the signoff',
        });
      }
      if (signoff?.sealIntact === true && ev.metadata?.aiCondition?.sealIntact === false) {
        conflicts.push({
          id: `conflict-signoff-seal-${ev.id}`,
          type: 'contradiction',
          severity: 'high',
          description: `Inspector signed "seal intact" but AI vision reports the seal is not intact on "${ev.name}" — re-inspect before accepting`,
          involvedEvidence: [ev.id],
          suggestedResolution: 'Re-examine the packaging photo and confirm or revoke the signoff',
        });
      }
    }

    return conflicts;
  }
}
