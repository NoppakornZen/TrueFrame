import React from 'react';
import { useStore } from '../../store';

/** What happened, in order. Only events the desk actually recorded. */
const AuditTimeline: React.FC = () => {
  const events = useStore((s) => s.audit);
  if (events.length === 0) return null;

  return (
    <section className="border border-[var(--surface-4)] bg-[var(--surface-2)]">
      <div className="border-b border-[var(--surface-4)] px-5 py-4">
        <h2 className="font-display text-xl font-semibold">What happened</h2>
      </div>
      <ol className="space-y-3 px-5 py-4">
        {events.map((event) => (
          <li key={event.id} className="flex gap-3 text-sm">
            <time className="w-12 flex-shrink-0 font-mono text-[11px] text-[var(--text-tertiary)]">
              {new Date(event.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </time>
            <span className="text-[var(--text-secondary)]">{event.text}</span>
          </li>
        ))}
      </ol>
    </section>
  );
};

export default AuditTimeline;
