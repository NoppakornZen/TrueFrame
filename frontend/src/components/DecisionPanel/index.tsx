import React from 'react';
import { Button } from '../ui';
import { useStore } from '../../store';
import { EvidenceDecisionEngine } from '../../services/decisionEngine';
import { buildRequirements } from '../../services/requirements';
import { RequirementStatus } from '../../types';
import { buildAuditReport, reportToHtml, downloadFile } from '../../services/reportExport';
import { CheckCircle, XCircle, AlertCircle, Download, FileJson } from 'lucide-react';

const DecisionPanel: React.FC = () => {
  const { currentCase, evidence, policies, decision, applyAnalysis } = useStore();

  const handleRunAnalysis = () => {
    const result = EvidenceDecisionEngine.analyzeEvidence(evidence, policies);
    applyAnalysis(result);
    window.setTimeout(() => {
      document.getElementById('audit-report')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const reportBaseName = () =>
    `TrueFrame-Report-${currentCase?.id ?? 'CASE'}-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .slice(0, 19)}`;

  const handleExportHtml = () => {
    if (!decision) return;
    const report = buildAuditReport(currentCase, evidence, policies, decision);
    downloadFile(`${reportBaseName()}.html`, reportToHtml(report), 'text/html;charset=utf-8');
  };

  const handleExportJson = () => {
    if (!decision) return;
    const report = buildAuditReport(currentCase, evidence, policies, decision);
    downloadFile(`${reportBaseName()}.json`, JSON.stringify(report, null, 2), 'application/json');
  };

  const getDecisionIcon = () => {
    if (!decision) return <AlertCircle size={24} className="text-[var(--text-tertiary)]" />;

    switch (decision.decision) {
      case 'accept':
        return <CheckCircle size={24} className="text-[var(--success)]" />;
      case 'reject':
        return <XCircle size={24} className="text-[var(--danger)]" />;
      case 'needs_review':
        return <AlertCircle size={24} className="text-[var(--warning)]" />;
    }
  };

  const getDecisionColor = () => {
    if (!decision) return 'var(--text-tertiary)';

    switch (decision.decision) {
      case 'accept':
        return 'var(--success)';
      case 'reject':
        return 'var(--danger)';
      case 'needs_review':
        return 'var(--warning)';
    }
  };

  const barcodeSerial = evidence.find((e) => e.type === 'barcode')?.metadata?.serialNumber as string | undefined;
  const certificateSerial = evidence.find((e) => e.type === 'document')?.metadata?.serialNumber as string | undefined;
  const serialClash = Boolean(
    decision && barcodeSerial && certificateSerial && barcodeSerial !== certificateSerial
  );
  const rows = decision ? buildRequirements(evidence) : [];
  const rowMark: Record<RequirementStatus, string> = {
    satisfied: '✓',
    review: '!',
    not_checked: '–',
    blocked: '✗',
  };

  return (
    <section className="border border-[var(--surface-4)] bg-[var(--surface-2)]">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--surface-4)] px-5 py-4">
        <h2 className="font-display text-xl font-semibold">Decision</h2>
        <Button onClick={handleRunAnalysis} disabled={evidence.length === 0} variant="primary" size="sm">
          Run
        </Button>
      </div>
      {decision && (
        <div className="flex gap-4 border-b border-[var(--surface-4)] px-5 py-2 text-sm">
          <button onClick={handleExportHtml} className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <Download size={13} /> Report
          </button>
          <button onClick={handleExportJson} className="inline-flex items-center gap-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
            <FileJson size={13} /> JSON
          </button>
        </div>
      )}
      <div className="px-5 py-4">
        {!decision && evidence.length === 0 && (
          <p className="py-6 text-sm text-[var(--text-tertiary)]">
            Add evidence first. The decision waits for it.
          </p>
        )}

        {!decision && evidence.length > 0 && (
          <p className="py-6 text-sm text-[var(--text-secondary)]">
            {evidence.length} item{evidence.length === 1 ? '' : 's'} ready. Press Run.
          </p>
        )}

        {decision && (
          <div className="space-y-6">
            {serialClash && (
              <div className="border border-[var(--danger)] bg-[var(--surface-1)] px-3 py-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--danger)]">
                  Serial numbers do not match
                </p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Barcode
                    </p>
                    <p className="mt-1 break-all font-display text-2xl font-semibold leading-none text-[var(--danger)]">
                      {barcodeSerial}
                    </p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      Certificate
                    </p>
                    <p className="mt-1 break-all font-display text-2xl font-semibold leading-none text-[var(--danger)]">
                      {certificateSerial}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Decision Summary */}
            <div className="border-t-2 pt-4" style={{ borderColor: getDecisionColor() }}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-3xl font-semibold leading-none" style={{ color: getDecisionColor() }}>
                    {decision.decision.replace('_', ' ')}
                  </p>
                  <p className="mt-2 font-mono text-[11px] text-[var(--text-tertiary)]">
                    {new Date(decision.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}{(decision.confidence * 100).toFixed(0)}% confidence
                  </p>
                </div>
                {getDecisionIcon()}
              </div>

              <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-[var(--surface-3)] pt-3">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Evidence</dt>
                  <dd className="font-display text-xl">{decision.evidenceUsed.length}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Conflicts</dt>
                  <dd className="font-display text-xl">{decision.conflicts.length}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">Policies</dt>
                  <dd className="font-display text-xl">{policies.filter((p) => p.enabled).length}</dd>
                </div>
              </dl>
            </div>

            <ul className="space-y-2 border-t border-[var(--surface-3)] pt-3">
              {rows.map((row) => (
                <li key={row.id} className="text-sm">
                  <span className="font-mono text-[var(--text-tertiary)]">{rowMark[row.status]} </span>
                  <span className="font-medium">{row.label}.</span>{' '}
                  <span className="text-[var(--text-secondary)]">{row.reason}</span>
                </li>
              ))}
            </ul>

            {/* Reasoning */}
            <div>
              <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                Why
              </h3>
              <ul className="space-y-2">
                {decision.reasoning.map((reason, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-[var(--text-secondary)]">
                    {reason.startsWith('✓') ? (
                      <CheckCircle size={14} className="mt-0.5 flex-shrink-0 text-[var(--success)]" />
                    ) : reason.startsWith('✗') ? (
                      <XCircle size={14} className="mt-0.5 flex-shrink-0 text-[var(--danger)]" />
                    ) : (
                      <span className="mt-0.5 w-3.5 flex-shrink-0" />
                    )}
                    <span>{reason.replace(/^[✓✗]\s*/, '')}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Conflicts */}
            {decision.conflicts.length > 0 && (
              <div>
                <h3 className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--danger)]">
                  {decision.conflicts.length} conflict{decision.conflicts.length === 1 ? '' : 's'}
                </h3>
                <div className="space-y-3">
                  {decision.conflicts.map((conflict) => (
                    <div key={conflict.id} className="border-l-2 border-[var(--danger)] pl-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--danger)]">
                        {conflict.severity} · {conflict.type.replace('_', ' ')}
                      </p>
                      <p className="mt-1 text-sm">{conflict.description}</p>
                      {conflict.suggestedResolution && (
                        <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                          {conflict.suggestedResolution}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Best Evidence */}
            {decision.nextBestEvidence && (
              <div className="border-t border-[var(--surface-3)] pt-3">
                <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-tertiary)]">
                  Ask for next · {decision.nextBestEvidence.priority}
                </p>
                <p className="mt-1 text-sm font-medium">{decision.nextBestEvidence.type}</p>
                <p className="text-xs text-[var(--text-secondary)]">{decision.nextBestEvidence.reason}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default DecisionPanel;
