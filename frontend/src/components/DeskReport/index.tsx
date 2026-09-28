import React from 'react';
import { Download, FileJson } from 'lucide-react';
import { useStore } from '../../store';
import { buildAuditReport, reportToHtml, downloadFile } from '../../services/reportExport';
import { buildRequirements } from '../../services/requirements';

const DeskReport: React.FC = () => {
  const currentCase = useStore((s) => s.currentCase);
  const evidence = useStore((s) => s.evidence);
  const policies = useStore((s) => s.policies);
  const decision = useStore((s) => s.decision);

  if (!decision) return null;

  const report = buildAuditReport(currentCase, evidence, policies, decision);
  const barcodeSerial = evidence.find((e) => e.type === 'barcode')?.metadata?.serialNumber as string | undefined;
  const certificateSerial = evidence.find((e) => e.type === 'document')?.metadata?.serialNumber as
    | string
    | undefined;
  const serialClash = Boolean(barcodeSerial && certificateSerial && barcodeSerial !== certificateSerial);
  const rows = buildRequirements(evidence);

  const baseName = `TrueFrame-Report-${currentCase?.id ?? 'CASE'}-${new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .slice(0, 19)}`;

  const saveHtml = () => downloadFile(`${baseName}.html`, reportToHtml(report), 'text/html;charset=utf-8');
  const saveJson = () =>
    downloadFile(`${baseName}.json`, JSON.stringify(report, null, 2), 'application/json');

  return (
    <section id="audit-report" className="border border-[var(--surface-4)] bg-[var(--surface-2)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--surface-4)] px-5 py-4">
        <div>
          <h2 className="font-display text-xl font-semibold">Report</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Inspector J. Smith · {currentCase?.id ?? 'No case'} · {currentCase?.partName ?? '—'}
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <button
            type="button"
            onClick={saveHtml}
            className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <Download size={13} /> Report
          </button>
          <button
            type="button"
            onClick={saveJson}
            className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            <FileJson size={13} /> JSON
          </button>
        </div>
      </div>

      <div className="space-y-5 px-5 py-4">
        <p className="font-display text-3xl font-semibold capitalize">{decision.decision.replace('_', ' ')}</p>

        {serialClash && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-l-2 border-[var(--danger)] pl-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Barcode</p>
              <p className="font-display text-xl text-[var(--danger)]">{barcodeSerial}</p>
            </div>
            <div className="border-l-2 border-[var(--danger)] pl-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                Certificate
              </p>
              <p className="font-display text-xl text-[var(--danger)]">{certificateSerial}</p>
            </div>
          </div>
        )}

        <ul className="space-y-1.5">
          {rows.map((row) => (
            <li key={row.id} className="text-sm text-[var(--text-secondary)]">
              <span className="font-medium text-[var(--text-primary)]">{row.label}.</span> {row.reason}
            </li>
          ))}
        </ul>

        <ul className="space-y-1.5">
          {decision.reasoning.map((line, i) => (
            <li key={i} className="text-sm text-[var(--text-secondary)]">
              {line}
            </li>
          ))}
        </ul>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
              <th className="py-1 font-normal">Evidence</th>
              <th className="py-1 font-normal">What was read</th>
            </tr>
          </thead>
          <tbody>
            {evidence.map((item) => (
              <tr key={item.id} className="border-t border-[var(--surface-3)]">
                <td className="py-2 pr-3">
                  {item.name}
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                    {item.type}
                  </span>
                </td>
                <td className="py-2 text-[var(--text-secondary)]">
                  {(item.metadata?.serialNumber as string | undefined) ||
                    item.aiAnalysis?.findings[0] ||
                    '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

export default DeskReport;
