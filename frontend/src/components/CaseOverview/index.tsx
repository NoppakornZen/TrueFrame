import React from 'react';
import { Badge } from '../ui';
import { useStore } from '../../store';

const CaseOverview: React.FC = () => {
  const currentCase = useStore((state) => state.currentCase);

  if (!currentCase) {
    return (
      <section className="border border-[var(--surface-4)] bg-[var(--surface-2)] px-5 py-4">
        <p className="text-[var(--text-secondary)]">No case on the desk.</p>
      </section>
    );
  }

  const statusVariant = {
    in_transit: 'info' as const,
    delivered: 'success' as const,
    pending_verification: 'warning' as const,
    verified: 'success' as const,
    rejected: 'danger' as const,
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const rows = [
    ['Part', currentCase.partName],
    ['Part no.', currentCase.partNumber],
    ['Supplier', currentCase.supplier],
    ['Destination', currentCase.destination],
    ['Expected', formatDate(currentCase.expectedDeliveryDate)],
    ['Opened', formatDate(currentCase.createdAt)],
  ];

  return (
    <section className="border border-[var(--surface-4)] bg-[var(--surface-2)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--surface-4)] px-5 py-4">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
            Shipment
          </p>
          <h2 className="font-display mt-1 text-2xl font-semibold leading-tight">
            {currentCase.partName}
          </h2>
        </div>
        <Badge variant={statusVariant[currentCase.status]}>
          {currentCase.status.replace('_', ' ')}
        </Badge>
      </div>
      <dl className="grid sm:grid-cols-2">
        {rows.slice(1).map(([label, value]) => (
          <div key={label} className="border-b border-[var(--surface-3)] px-5 py-3 sm:odd:border-r">
            <dt className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              {label}
            </dt>
            <dd className="mt-0.5 text-sm text-[var(--text-primary)]">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
};

export default CaseOverview;
