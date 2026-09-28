import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Badge, Button } from '../ui';
import { useStore } from '../../store';
import { Evidence } from '../../types';
import { Camera, FileText, ScanBarcode, Trash2, CheckCircle, XCircle, AlertCircle, Video, VideoOff, X, ChevronDown } from 'lucide-react';
import { captureVideoFrame, BarcodeScanResult } from '../../services/realAnalysis';
import { scanFromCamera, CameraScanHandle } from '../../services/cameraScan';
import { inspectFile } from '../../services/inspectFile';
import { loadDemoShipment } from '../../services/demoLoad';
import { isAiEnabled } from '../../services/ai/config';
import { runEvidenceAiAnalysis, retryEvidenceAiAnalysis } from '../../services/ai/runEvidenceAnalysis';

const EvidenceCollection: React.FC = () => {
  const { evidence, addEvidence, removeEvidence, loadEvidence, setInspectorSignoff } = useStore();
  const [uploading, setUploading] = useState(false);
  const [analysisMode, setAnalysisMode] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [openFindings, setOpenFindings] = useState<Record<string, boolean>>({});

  // Build a barcode evidence item from a real decode (file or camera)
  const addBarcodeEvidence = useCallback(
    (scan: BarcodeScanResult, name: string, preview?: string | null) => {
      addEvidence({
        id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'barcode',
        status: 'pending',
        name,
        description: 'Barcode evidence',
        capturedAt: new Date().toISOString(),
        uploadedBy: 'Inspector John Smith',
        metadata: {
          serialNumber: scan.serialNumber,
          barcodeFormat: scan.format,
          rawText: scan.rawText,
          source: 'real',
          ...(preview ? { preview } : {}),
        },
        aiAnalysis: {
          confidence: 0.99,
          findings: [
            `Barcode decoded successfully (${scan.format})`,
            `Serial number: ${scan.serialNumber}`,
            `Raw value: ${scan.rawText}`,
            'Decoded locally with ZXing — no external API',
          ],
          recommendation: 'accept',
        },
      });
    },
    [addEvidence]
  );

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>, type: Evidence['type']) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      setUploading(true);

      for (const file of Array.from(files)) {
        setAnalysisMode(`Reading ${file.name}`);
        const ev = await inspectFile(file, type);
        addEvidence(ev);
        // AI vision runs async — upload never blocks on it.
        if (ev.type === 'photo') void runEvidenceAiAnalysis(ev.id);
      }

      setUploading(false);
      setAnalysisMode('');
      e.target.value = '';
    },
    [addEvidence]
  );

  const loadSample = useCallback(
    async (kind: 'match' | 'mismatch') => {
      setUploading(true);
      setAnalysisMode(kind === 'match' ? 'Loading the matching shipment…' : 'Loading the mismatched shipment…');
      try {
        const items = await loadDemoShipment(kind);
        loadEvidence(items);
        for (const item of items) {
          if (item.type === 'photo') void runEvidenceAiAnalysis(item.id);
        }
      } finally {
        setUploading(false);
        setAnalysisMode('');
      }
    },
    [loadEvidence]
  );

  const getEvidenceIcon = (type: Evidence['type']) => {
    switch (type) {
      case 'photo':
        return <Camera size={16} />;
      case 'barcode':
        return <ScanBarcode size={16} />;
      case 'document':
        return <FileText size={16} />;
      default:
        return <FileText size={16} />;
    }
  };

  const getStatusBadge = (status: Evidence['status']) => {
    const variants = {
      pending: 'warning' as const,
      approved: 'success' as const,
      rejected: 'danger' as const,
      conflict: 'danger' as const,
    };
    return <Badge variant={variants[status]}>{status.toUpperCase()}</Badge>;
  };

  return (
    <section className="border border-[var(--surface-4)] bg-[var(--surface-2)]">
      <div className="border-b border-[var(--surface-4)] px-5 py-4">
        <h2 className="font-display text-xl font-semibold">Evidence</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Photo, barcode and certificate. Read on this machine.
        </p>
      </div>
      <div className="px-5 py-4">
        <div className="mb-5 grid grid-cols-1 gap-px bg-[var(--surface-4)] sm:grid-cols-3">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e, 'photo')}
              disabled={uploading}
            />
            <div className="flex h-full flex-col items-center justify-center bg-[var(--surface-1)] px-3 py-5 text-center hover:bg-[var(--surface-2)]">
              <Camera size={18} className="mb-2 text-[var(--text-tertiary)]" />
              <span className="text-sm font-medium">Photo</span>
              <span className="mt-0.5 text-xs text-[var(--text-tertiary)]">
                {isAiEnabled() ? 'Pixels + AI vision' : 'Sharpness only'}
              </span>
            </div>
          </label>

          <div className="flex flex-col gap-2">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handleFileUpload(e, 'barcode')}
                disabled={uploading}
              />
              <div className="flex h-full flex-col items-center justify-center bg-[var(--surface-1)] px-3 py-5 text-center hover:bg-[var(--surface-2)]">
                <ScanBarcode size={18} className="mb-2 text-[var(--text-tertiary)]" />
                <span className="text-sm font-medium">Barcode</span>
                <span className="mt-0.5 text-xs text-[var(--text-tertiary)]">From a photo</span>
              </div>
            </label>
            <button
              onClick={() => setCameraOpen(true)}
              disabled={uploading}
              className="flex w-full items-center justify-center gap-1.5 bg-[var(--surface-1)] px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
            >
              <Video size={13} />
              Use the camera
            </button>
          </div>

          <label className="cursor-pointer">
            <input
              type="file"
              accept=".pdf,image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileUpload(e, 'document')}
              disabled={uploading}
            />
            <div className="flex h-full flex-col items-center justify-center bg-[var(--surface-1)] px-3 py-5 text-center hover:bg-[var(--surface-2)]">
              <FileText size={18} className="mb-2 text-[var(--text-tertiary)]" />
              <span className="text-sm font-medium">Certificate</span>
              <span className="mt-0.5 text-xs text-[var(--text-tertiary)]">PDF</span>
            </div>
          </label>
        </div>

        {uploading && (
          <p className="py-3 text-sm text-[var(--text-secondary)]">
            {analysisMode || 'Reading the file…'}
          </p>
        )}

        {cameraOpen && (
          <CameraScannerModal
            onClose={() => setCameraOpen(false)}
            onDetected={(scan, preview) =>
              addBarcodeEvidence(scan, `camera-scan-${new Date().toLocaleTimeString()}.png`, preview)
            }
          />
        )}

        <div className="mt-4 divide-y divide-[var(--surface-3)] border-t border-[var(--surface-3)]">
          {evidence.length === 0 && !uploading && (
            <div className="py-8 text-center">
              <p className="text-sm text-[var(--text-tertiary)]">Nothing on the desk yet.</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                Or load a sample. Both were read from the real files.
              </p>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => loadSample('match')}
                  className="border border-[var(--surface-5)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-3)]"
                >
                  Matching serial
                </button>
                <button
                  type="button"
                  onClick={() => loadSample('mismatch')}
                  className="border border-[var(--danger)] px-3 py-1.5 text-sm text-[var(--danger)] hover:bg-[var(--surface-3)]"
                >
                  Wrong serial
                </button>
              </div>
            </div>
          )}

          {evidence.map((ev) => (
            <div key={ev.id} className="flex items-start gap-4 py-4">
              <div className="flex-shrink-0">
                {typeof ev.metadata?.preview === 'string' ? (
                  <img
                    src={ev.metadata.preview}
                    alt={ev.name}
                    className="h-16 w-16 border border-[var(--surface-4)] bg-white object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center border border-[var(--surface-4)] bg-[var(--surface-1)] text-[var(--text-tertiary)]">
                    {getEvidenceIcon(ev.type)}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="truncate text-sm font-medium">{ev.name}</h4>
                    <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                      {ev.type}
                    </p>
                  </div>
                  {getStatusBadge(ev.status)}
                </div>

                {ev.aiAnalysis && (
                  <div className="mt-3 border-l-2 border-[var(--surface-4)] pl-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-tertiary)]">
                        Reading
                      </span>
                      <div className="flex items-center gap-1.5">
                        {ev.aiAnalysis.recommendation === 'accept' ? (
                          <CheckCircle size={14} className="text-[var(--success)]" />
                        ) : ev.aiAnalysis.recommendation === 'needs_review' ? (
                          <AlertCircle size={14} className="text-[var(--warning)]" />
                        ) : (
                          <XCircle size={14} className="text-[var(--danger)]" />
                        )}
                        <span className="font-mono text-xs">
                          {(ev.aiAnalysis.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    {ev.type === 'photo' && (
                      <p className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.12em]">
                        {ev.metadata?.aiStatus === 'running' ? (
                          <span className="text-[var(--text-tertiary)]">AI vision analyzing…</span>
                        ) : ev.metadata?.aiStatus === 'done' ? (
                          <span className="text-[var(--success)]">
                            AI vision · {String(ev.metadata?.aiCondition?.model ?? 'vision')}
                          </span>
                        ) : isAiEnabled() && ev.metadata?.aiStatus === 'error' ? (
                          <span className="text-[var(--warning)]">AI unavailable</span>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">Offline pixel analysis</span>
                        )}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {(openFindings[ev.id] ? ev.aiAnalysis.findings : ev.aiAnalysis.findings.slice(0, 3)).map(
                        (finding, idx) => (
                          <li key={idx} className="text-xs text-[var(--text-secondary)] flex items-start gap-1.5">
                            <span className="text-[var(--accent)] mt-0.5">•</span>
                            <span>{finding}</span>
                          </li>
                        )
                      )}
                    </ul>
                    {ev.aiAnalysis.findings.length > 3 && (
                      <button
                        type="button"
                        onClick={() => setOpenFindings((prev) => ({ ...prev, [ev.id]: !prev[ev.id] }))}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                      >
                        <ChevronDown
                          size={12}
                          className={openFindings[ev.id] ? 'rotate-180' : ''}
                        />
                        {openFindings[ev.id]
                          ? 'Show less'
                          : `Show ${ev.aiAnalysis.findings.length - 3} more`}
                      </button>
                    )}
                    {ev.type === 'photo' && isAiEnabled() && ev.metadata?.aiStatus === 'error' && (
                      <div className="mt-2 flex items-start justify-between gap-2">
                        <p className="text-xs text-[var(--warning)]">
                          AI vision unavailable ({String(ev.metadata?.aiError ?? 'error')}) —
                          fell back to offline pixel checks.
                        </p>
                        <button
                          type="button"
                          onClick={() => void retryEvidenceAiAnalysis(ev.id)}
                          className="flex-shrink-0 text-xs text-[var(--accent)] hover:underline"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {ev.type === 'photo' && ev.metadata?.aiCondition && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={ev.metadata.damage ? 'danger' : 'success'}>
                      Damage: {ev.metadata.damage ? 'seen' : 'none'}
                    </Badge>
                    <Badge variant={ev.metadata.corrosion ? 'danger' : 'success'}>
                      Corrosion: {ev.metadata.corrosion ? 'seen' : 'none'}
                    </Badge>
                    <Badge
                      variant={
                        ev.metadata.sealIntact === true
                          ? 'success'
                          : ev.metadata.sealIntact === false
                            ? 'danger'
                            : 'default'
                      }
                    >
                      Seal:{' '}
                      {ev.metadata.sealIntact === true
                        ? 'intact'
                        : ev.metadata.sealIntact === false
                          ? 'damaged'
                          : 'n/a'}
                    </Badge>
                    {ev.metadata.tamperingSigns && <Badge variant="danger">Tampering: seen</Badge>}
                  </div>
                )}

                {ev.type === 'photo' && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setInspectorSignoff(ev.id, 'noDamage')}
                      className={`border px-2.5 py-1 text-xs ${
                        ev.metadata?.inspectorSignoff?.noDamage
                          ? 'border-[var(--success)] text-[var(--success)]'
                          : 'border-[var(--surface-5)] text-[var(--text-secondary)]'
                      }`}
                    >
                      No damage
                    </button>
                    <button
                      type="button"
                      onClick={() => setInspectorSignoff(ev.id, 'sealIntact')}
                      className={`border px-2.5 py-1 text-xs ${
                        ev.metadata?.inspectorSignoff?.sealIntact
                          ? 'border-[var(--success)] text-[var(--success)]'
                          : 'border-[var(--surface-5)] text-[var(--text-secondary)]'
                      }`}
                    >
                      Seal intact
                    </button>
                  </div>
                )}

                <div className="mt-3 flex items-center justify-between">
                  <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
                    {new Date(ev.capturedAt).toLocaleString('en-GB', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}
                  </span>
                  <button
                    onClick={() => removeEvidence(ev.id)}
                    aria-label={`Remove ${ev.name}`}
                    className="text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Live camera barcode scanner — real ZXing video decoding, fully offline.
const CameraScannerModal: React.FC<{
  onClose: () => void;
  onDetected: (scan: BarcodeScanResult, preview?: string | null) => void;
}> = ({ onClose, onDetected }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const handleRef = useRef<CameraScanHandle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState('Point the camera at a barcode…');

  const stop = useCallback(() => {
    handleRef.current?.stop();
    handleRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const handle = await scanFromCamera(videoRef.current!, (scan) => {
          if (cancelled) return;
          const preview = videoRef.current ? captureVideoFrame(videoRef.current) : null;
          setHint(`Decoded: ${scan.serialNumber ?? scan.rawText}`);
          onDetected(scan, preview);
          stop();
          onClose();
        });
        if (cancelled) {
          handle.stop();
          return;
        }
        handleRef.current = handle;
      } catch {
        if (!cancelled) {
          setError('No camera here. Take a photo of the barcode and add it above instead.');
        }
      }
    })();

    return () => {
      cancelled = true;
      handleRef.current?.stop();
      handleRef.current = null;
    };
  }, [onDetected, onClose, stop]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1c1915]/70 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg border border-[var(--surface-4)] bg-[var(--surface-2)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h4 className="font-display text-lg font-semibold">Hold the barcode to the camera</h4>
          <button onClick={onClose} aria-label="Close scanner" className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            <X size={16} />
          </button>
        </div>

        <div className="flex aspect-video items-center justify-center overflow-hidden bg-black">
          <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        </div>

        {error ? (
          <p className="mt-3 flex items-start gap-2 text-sm text-[var(--danger)]">
            <VideoOff size={15} className="mt-0.5 flex-shrink-0" />
            {error}
          </p>
        ) : (
          <p className="mt-3 text-center text-sm text-[var(--text-secondary)]">{hint}</p>
        )}

        <div className="mt-4 flex justify-end">
          <Button onClick={onClose} variant="secondary" size="sm">Close</Button>
        </div>
      </div>
    </div>
  );
};

export default EvidenceCollection;
