// One row per requirement. A row is satisfied only when every source that
// spoke agrees, and when a required source has actually spoken.
// Missing AI is "not checked", never "passed".

import { Evidence, RequirementRow } from '../types';
import {
  barcodeSerial,
  certificateDates,
  certificatePartNumber,
  certificateSerial,
  comparePair,
  partNumberOnPart,
  partSerial,
} from './consistency';

export function buildRequirements(evidence: Evidence[]): RequirementRow[] {
  return [identityRow(evidence), certificateRow(evidence), conditionRow(evidence), sealRow(evidence)];
}

function identityRow(evidence: Evidence[]): RequirementRow {
  const barcode = barcodeSerial(evidence);
  const certificate = certificateSerial(evidence);
  const part = partSerial(evidence);
  const partNo = partNumberOnPart(evidence);
  const certPart = certificatePartNumber(evidence);
  const sources = [
    barcode ? 'Barcode' : null,
    certificate ? 'Certificate' : null,
    part ? 'Part photo' : null,
  ].filter(Boolean) as string[];

  const pairs = [
    ['Barcode', 'Certificate', comparePair(barcode, certificate), barcode, certificate],
    ['Part', 'Certificate', comparePair(part, certificate), part, certificate],
    ['Part', 'Barcode', comparePair(part, barcode), part, barcode],
    ['Part number', 'Certificate', comparePair(partNo, certPart), partNo, certPart],
  ] as const;

  const mismatch = pairs.find((p) => p[2] === 'mismatch');
  if (mismatch) {
    return {
      id: 'identity',
      label: 'Identity',
      status: 'review',
      sources,
      reason: `${mismatch[0]} ${mismatch[3]} does not match ${mismatch[1]} ${mismatch[4]}. Not accepted.`,
    };
  }

  if (!barcode || !certificate) {
    return {
      id: 'identity',
      label: 'Identity',
      status: 'not_checked',
      sources,
      reason: !barcode && !certificate
        ? 'Barcode and certificate have not been read.'
        : !barcode
          ? 'Barcode has not been read.'
          : 'Certificate serial has not been read.',
    };
  }

  if (!part) {
    return {
      id: 'identity',
      label: 'Identity',
      status: 'not_checked',
      sources: [...sources, 'Part photo not read'],
      reason: `Barcode and certificate agree on ${barcode}. The serial on the part itself has not been read, so identity is not complete.`,
    };
  }

  return {
    id: 'identity',
    label: 'Identity',
    status: 'satisfied',
    sources,
    reason: `Barcode, certificate and the part all read ${barcode}.`,
  };
}

function certificateRow(evidence: Evidence[]): RequirementRow {
  const dates = certificateDates(evidence);
  if (!evidence.some((e) => e.type === 'document')) {
    return {
      id: 'certificate',
      label: 'Certificate validity',
      status: 'not_checked',
      sources: [],
      reason: dates.reason,
    };
  }
  if (dates.valid === false) {
    return {
      id: 'certificate',
      label: 'Certificate validity',
      status: 'blocked',
      sources: ['Certificate'],
      reason: dates.reason,
    };
  }
  if (dates.valid !== true) {
    return {
      id: 'certificate',
      label: 'Certificate validity',
      status: 'not_checked',
      sources: ['Certificate'],
      reason: dates.reason,
    };
  }
  return {
    id: 'certificate',
    label: 'Certificate validity',
    status: 'satisfied',
    sources: ['Certificate'],
    reason: dates.reason,
  };
}

function conditionRow(evidence: Evidence[]): RequirementRow {
  const photos = evidence.filter((e) => e.type === 'photo');
  const signed = photos.some((e) => e.metadata?.inspectorSignoff?.noDamage === true);
  const aiDone = photos.filter((e) => e.metadata?.aiStatus === 'done' && e.metadata?.damage !== undefined);
  const aiSawDamage = aiDone.some((e) => e.metadata?.damage === true || e.metadata?.corrosion === true || e.metadata?.tamperingSigns === true);
  const aiFailed = photos.some((e) => e.metadata?.aiStatus === 'error' || e.metadata?.aiStatus === 'skipped');
  const aiRunning = photos.some((e) => e.metadata?.aiStatus === 'running');

  if (photos.length === 0) {
    return {
      id: 'condition',
      label: 'Physical condition',
      status: 'not_checked',
      sources: [],
      reason: 'No part photo yet.',
    };
  }
  if (aiSawDamage && signed) {
    return {
      id: 'condition',
      label: 'Physical condition',
      status: 'review',
      sources: ['AI inspection', 'Human inspection'],
      reason: 'The inspector signed no damage, but AI inspection reports damage, corrosion, or tampering. Neither side is assumed right.',
    };
  }
  if (aiSawDamage) {
    return {
      id: 'condition',
      label: 'Physical condition',
      status: 'review',
      sources: ['AI inspection'],
      reason: 'AI inspection reports visible damage, corrosion, or tampering. A person still has to look.',
    };
  }
  if (signed && aiDone.length > 0 && !aiSawDamage) {
    return {
      id: 'condition',
      label: 'Physical condition',
      status: 'satisfied',
      sources: ['Human inspection', 'AI inspection'],
      reason: 'Inspector confirmed no visible damage, and AI inspection did not disagree.',
    };
  }
  if (signed && (aiFailed || aiRunning || aiDone.length === 0)) {
    return {
      id: 'condition',
      label: 'Physical condition',
      status: 'not_checked',
      sources: ['Human inspection'],
      reason: aiRunning
        ? 'Inspector signed, but AI inspection has not finished. Not accepted yet.'
        : 'Inspector signed, but AI inspection has not checked this photo. Not accepted on a signature alone.',
    };
  }
  return {
    id: 'condition',
    label: 'Physical condition',
    status: 'not_checked',
    sources: aiDone.length ? ['AI inspection'] : [],
    reason: 'A person still has to look. A sharp photo is not a damage check.',
  };
}

function sealRow(evidence: Evidence[]): RequirementRow {
  const photos = evidence.filter((e) => e.type === 'photo');
  const signed = photos.some((e) => e.metadata?.inspectorSignoff?.sealIntact === true);
  const aiSpoke = photos.filter((e) => e.metadata?.aiCondition && e.metadata.aiCondition.sealIntact !== undefined);
  const aiBroken = aiSpoke.some((e) => e.metadata?.aiCondition?.sealIntact === false);
  const aiIntact = aiSpoke.some((e) => e.metadata?.aiCondition?.sealIntact === true);

  if (photos.length === 0) {
    return {
      id: 'seal',
      label: 'Seal',
      status: 'not_checked',
      sources: [],
      reason: 'No packaging photo yet.',
    };
  }
  if (signed && aiBroken) {
    return {
      id: 'seal',
      label: 'Seal',
      status: 'review',
      sources: ['Human inspection', 'AI inspection'],
      reason: 'The inspector signed the seal intact, but AI inspection says it is not. Neither side is assumed right.',
    };
  }
  if (signed && aiIntact) {
    return {
      id: 'seal',
      label: 'Seal',
      status: 'satisfied',
      sources: ['Human inspection', 'AI inspection'],
      reason: 'Inspector confirmed the seal is intact, and AI inspection did not disagree.',
    };
  }
  if (signed) {
    return {
      id: 'seal',
      label: 'Seal',
      status: 'not_checked',
      sources: ['Human inspection'],
      reason: 'Inspector signed the seal intact, but AI inspection could not see the seal. Not accepted on a signature alone.',
    };
  }
  return {
    id: 'seal',
    label: 'Seal',
    status: 'not_checked',
    sources: aiSpoke.length ? ['AI inspection'] : [],
    reason: 'A person still has to look. A sharp photo does not prove the seal is intact.',
  };
}
