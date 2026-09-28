// Cross-source consistency. Reads what is actually on the desk — barcode,
// certificate text, and a serial the vision model could read on the part.
// Never invents a reading. A missing field stays missing.

import { Evidence } from '../types';

export function normId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const cleaned = value.trim().toUpperCase().replace(/[\s_]+/g, '-');
  return cleaned.length >= 4 ? cleaned : undefined;
}

export function barcodeSerial(evidence: Evidence[]): string | undefined {
  return normId(evidence.find((e) => e.type === 'barcode')?.metadata?.serialNumber);
}

export function certificateSerial(evidence: Evidence[]): string | undefined {
  return normId(evidence.find((e) => e.type === 'document')?.metadata?.serialNumber);
}

export function certificatePartNumber(evidence: Evidence[]): string | undefined {
  return normId(evidence.find((e) => e.type === 'document')?.metadata?.partNumber);
}

/** Serial the model read off the part itself. Absent until AI has actually seen it. */
export function partSerial(evidence: Evidence[]): string | undefined {
  for (const photo of evidence.filter((e) => e.type === 'photo')) {
    const fromAi = normId(photo.metadata?.visibleSerial) ?? normId(photo.metadata?.aiCondition?.visibleSerial);
    if (fromAi) return fromAi;
  }
  return undefined;
}

export function partNumberOnPart(evidence: Evidence[]): string | undefined {
  for (const photo of evidence.filter((e) => e.type === 'photo')) {
    const value = normId(photo.metadata?.visiblePartNumber) ?? normId(photo.metadata?.aiCondition?.visiblePartNumber);
    if (value) return value;
  }
  return undefined;
}

export type PairState = 'match' | 'mismatch' | 'not_read';

export function comparePair(a?: string, b?: string): PairState {
  if (!a || !b) return 'not_read';
  return a === b ? 'match' : 'mismatch';
}

/** Certificate dates are real only when the PDF parser found them. */
export function certificateDates(evidence: Evidence[]): {
  issued?: string;
  expiry?: string;
  valid: boolean | null;
  reason: string;
} {
  const doc = evidence.find((e) => e.type === 'document');
  const issued = asDate(doc?.metadata?.issuedDate);
  const expiry = asDate(doc?.metadata?.expiryDate);
  if (!doc) {
    return { valid: null, reason: 'No certificate on the desk.' };
  }
  if (!expiry) {
    return {
      issued,
      valid: null,
      reason: 'Certificate was read, but no expiry date was found. Not treated as valid.',
    };
  }
  const today = new Date().toISOString().slice(0, 10);
  if (expiry < today) {
    return { issued, expiry, valid: false, reason: `Certificate expired on ${expiry}.` };
  }
  if (issued && issued > today) {
    return { issued, expiry, valid: false, reason: `Certificate issue date ${issued} is in the future.` };
  }
  return {
    issued,
    expiry,
    valid: true,
    reason: issued
      ? `Issued ${issued}, valid through ${expiry}.`
      : `Valid through ${expiry}. Issue date was not on the certificate.`,
  };
}

function asDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const m = value.match(/(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (!m) return undefined;
  return `${m[1]}-${m[2]}-${m[3]}`;
}
