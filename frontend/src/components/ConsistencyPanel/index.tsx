import React from 'react';
import { useStore } from '../../store';
import { buildRequirements } from '../../services/requirements';
import { barcodeSerial, certificateDates, certificateSerial, partSerial } from '../../services/consistency';
import { RequirementStatus } from '../../types';

const mark: Record<RequirementStatus, string> = {
  satisfied: '✓',
  review: '!',
  not_checked: '–',
  blocked: '✗',
};

const tone: Record<RequirementStatus, string> = {
  satisfied: 'text-[var(--success)]',
  review: 'text-[var(--warning)]',
  not_checked: 'text-[var(--text-tertiary)]',
  blocked: 'text-[var(--danger)]',
};

/** What each source said, and whether they agree. Shown before Run. */
const ConsistencyPanel: React.FC = () => {
  const evidence = useStore((s) => s.evidence);
  const decision = useStore((s) => s.decision);
  const resolveReview = useStore((s) => s.resolveReview);
  if (evidence.length === 0) return null;

  const rows = buildRequirements(evidence);
  const barcode = barcodeSerial(evidence);
  const certificate = certificateSerial(evidence);
  const part = partSerial(evidence);
  const dates = certificateDates(evidence);
  const open = rows.filter((row) => row.status === 'review' || row.status === 'blocked');

  return (
    <section className="border border-[var(--surface-4)] bg-[var(--surface-2)]">
      <div className="border-b border-[var(--surface-4)] px-5 py-4">
        <h2 className="font-display text-xl font-semibold">Do the sources agree?</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Barcode, certificate, the part, AI inspection and a person. A blank is not a pass.
        </p>
      </div>
      <div className="space-y-4 px-5 py-4">
        <dl className="grid gap-3 sm:grid-cols-3">
          <Reading label="Barcode" value={barcode} />
          <Reading label="Certificate" value={certificate} />
          <Reading label="On the part" value={part} empty="Not read" />
        </dl>
        <p className="text-sm text-[var(--text-secondary)]">
          Certificate: {dates.reason}
        </p>
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.id} className="border-t border-[var(--surface-3)] pt-3">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-medium">
                  <span className={`mr-2 font-mono ${tone[row.status]}`}>{mark[row.status]}</span>
                  {row.label}
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                  {row.sources.length ? row.sources.join(' · ') : 'No source yet'}
                </p>
              </div>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{row.reason}</p>
            </li>
          ))}
        </ul>

        {decision && decision.decision !== 'reject' && open.length > 0 && (
          <div className="border border-[var(--warning)] bg-[var(--surface-1)] px-3 py-3">
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--warning)]">
              Manual review
            </p>
            <ul className="mt-2 space-y-2">
              {open.map((row) => (
                <li key={row.id} className="text-sm">
                  <span className="font-medium">{row.label}.</span> {row.reason}
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                resolveReview(
                  'Inspector reviewed the disagreement and accepted the shipment anyway.'
                )
              }
              className="mt-3 border border-[var(--surface-5)] px-3 py-1.5 text-sm hover:bg-[var(--surface-3)]"
            >
              I reviewed this. Accept anyway.
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

const Reading: React.FC<{ label: string; value?: string; empty?: string }> = ({
  label,
  value,
  empty = 'Not on the desk',
}) => (
  <div>
    <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">{label}</dt>
    <dd className={`mt-1 break-all font-display text-lg ${value ? '' : 'text-[var(--text-tertiary)]'}`}>
      {value ?? empty}
    </dd>
  </div>
);

export default ConsistencyPanel;
