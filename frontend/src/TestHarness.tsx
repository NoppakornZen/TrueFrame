// Test harness page — runs the REAL analyzers in-browser and prints results as JSON.
// Route: /test
import { useEffect, useState } from 'react';
import { scanBarcodeFile, extractCertificateText } from './services/realAnalysis';

const TestHarness = () => {
  const [results, setResults] = useState<Record<string, unknown>>({ status: 'running' });

  useEffect(() => {
    (async () => {
      const out: Record<string, unknown> = {};
      const fetchFile = async (path: string, name: string, mime: string) => {
        const res = await fetch(path);
        const buf = await res.arrayBuffer();
        return new File([buf], name, { type: mime });
      };

      // 1. Real barcode decode
      const bcFile = await fetchFile('/barcode.png', 'barcode.png', 'image/png');
      out.barcode = await scanBarcodeFile(bcFile);

      // 2. Real barcode (wrong serial) decode
      const bcWrong = await fetchFile('/barcode-wrong.png', 'barcode-wrong.png', 'image/png');
      out.barcodeWrong = await scanBarcodeFile(bcWrong);

      // 3. Real certificate PDF extraction
      const certFile = await fetchFile('/certificate.pdf', 'certificate.pdf', 'application/pdf');
      out.certificate = await extractCertificateText(certFile);

      // 4. A non-barcode image should return null (honest failure)
      const pdfAsImage = new File([new Uint8Array([1, 2, 3])], 'blank.png', { type: 'image/png' });
      out.blankScan = await scanBarcodeFile(pdfAsImage);

      setResults(out);
    })().catch((err) => setResults({ error: String(err) }));
  }, []);

  return (
    <pre id="test-output" style={{ color: 'white', background: 'black', padding: 16 }}>
      {JSON.stringify(results, null, 2)}
    </pre>
  );
};

export default TestHarness;
