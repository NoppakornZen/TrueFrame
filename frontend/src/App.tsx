import { RotateCcw } from 'lucide-react';
import { useStore } from './store';
import CaseOverview from './components/CaseOverview';
import EvidenceCollection from './components/EvidenceCollection';
import PolicyDashboard from './components/PolicyDashboard';
import DecisionPanel from './components/DecisionPanel';
import EvidenceGraph from './components/EvidenceGraph';
import DeskReport from './components/DeskReport';
import ConsistencyPanel from './components/ConsistencyPanel';
import AuditTimeline from './components/AuditTimeline';

function App() {
  const resetState = useStore((s) => s.resetState);
  const currentCase = useStore((s) => s.currentCase);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--surface-4)] bg-[var(--surface-1)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
              TrueFrame
            </span>
            <span className="hidden text-sm text-[var(--text-tertiary)] sm:inline">
              Receiving desk
            </span>
          </div>
          <div className="flex items-center gap-5 text-sm">
            <span className="hidden text-[var(--text-secondary)] md:inline">
              Inspector <span className="font-medium text-[var(--text-primary)]">J. Smith</span>
            </span>
            <button
              onClick={() => {
                if (window.confirm('Clear this inspection and start again?')) resetState();
              }}
              title="Clear all evidence, policies and decision"
              className="inline-flex items-center gap-1.5 text-[var(--text-tertiary)] hover:text-[var(--danger)]"
            >
              <RotateCcw size={13} />
              Clear
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        <p className="mb-4 font-mono text-xs uppercase tracking-[0.16em] text-[var(--text-tertiary)]">
          {currentCase?.id ?? 'No case'} · Incoming shipment
        </p>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-5">
            <CaseOverview />
            <EvidenceCollection />
            <ConsistencyPanel />
            <AuditTimeline />
            <EvidenceGraph />
            <DeskReport />
          </div>
          <aside className="space-y-5 lg:sticky lg:top-5">
            <DecisionPanel />
            <PolicyDashboard />
          </aside>
        </div>
      </main>

      <footer className="mx-auto max-w-6xl px-5 py-8 text-xs text-[var(--text-tertiary)]">
        TrueFrame · barcode, certificate and the part are compared here · AI is advisory
      </footer>
    </div>
  );
}

export default App;
