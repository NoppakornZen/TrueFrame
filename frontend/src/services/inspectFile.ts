import { Evidence } from '../types';
import {
  analyzePhotoQuality,
  extractCertificateText,
  makeImagePreview,
  scanBarcodeFile,
} from './realAnalysis';

/** Read one file the same way a manual upload does. Nothing leaves the browser. */
export async function inspectFile(file: File, type: Evidence['type']): Promise<Evidence> {
  let metadata: Record<string, any> = {};
  let aiAnalysis: Evidence['aiAnalysis'];

  if (type === 'barcode') {
    const scan = await scanBarcodeFile(file);
    if (scan) {
      metadata = {
        serialNumber: scan.serialNumber,
        barcodeFormat: scan.format,
        rawText: scan.rawText,
        source: 'real',
      };
      aiAnalysis = {
        confidence: 0.99,
        findings: [
          `Barcode decoded successfully (${scan.format})`,
          `Serial number: ${scan.serialNumber}`,
          `Raw value: ${scan.rawText}`,
          'Decoded locally with ZXing — no external API',
        ],
        recommendation: 'accept',
      };
    } else {
      metadata = { source: 'real', decodeFailed: true };
      aiAnalysis = {
        confidence: 0.2,
        findings: [
          'Could not decode a barcode from this image',
          'Ensure the barcode is sharp, well-lit, and fills the frame',
        ],
        recommendation: 'needs_review',
      };
    }
  } else if (type === 'document' && (file.type === 'application/pdf' || /\.pdf$/i.test(file.name))) {
    const cert = await extractCertificateText(file);
    if (cert) {
      const found = [
        cert.serialNumber && `Serial number: ${cert.serialNumber}`,
        cert.certificateNumber && `Certificate No: ${cert.certificateNumber}`,
        cert.issuer && `Issuer: ${cert.issuer}`,
        cert.expiryDate && `Expiry: ${cert.expiryDate}`,
        cert.issuedDate && `Issued: ${cert.issuedDate}`,
        cert.partNumber && `Part number: ${cert.partNumber}`,
      ].filter(Boolean) as string[];
      metadata = {
        documentType: 'Certificate of Conformity',
        serialNumber: cert.serialNumber,
        certificateNumber: cert.certificateNumber,
        issuer: cert.issuer,
        expiryDate: cert.expiryDate,
        issuedDate: cert.issuedDate,
        partNumber: cert.partNumber,
        source: 'real',
      };
      aiAnalysis = {
        confidence: Math.min(0.99, 0.9 + 0.02 * found.length),
        findings:
          found.length > 0
            ? ['PDF parsed locally with pdf.js', ...found]
            : ['PDF read but no certificate fields detected', 'Verify this is a Certificate of Conformity'],
        recommendation: found.length > 0 ? 'accept' : 'needs_review',
      };
    } else {
      metadata = { source: 'real', parseFailed: true };
      aiAnalysis = {
        confidence: 0.15,
        findings: ['Could not extract text from this PDF', 'The file may be scanned images — try OCR later'],
        recommendation: 'needs_review',
      };
    }
  } else if (type === 'photo') {
    const metrics = await analyzePhotoQuality(file);
    if (metrics) {
      const good = metrics.confidence >= 0.6;
      metadata = {
        width: metrics.width,
        height: metrics.height,
        sharpness: Math.round(metrics.sharpness),
        brightness: Math.round(metrics.brightness),
        source: 'real',
        // AI vision runs async after upload (see services/ai/runEvidenceAnalysis).
        aiStatus: 'idle',
      };
      aiAnalysis = {
        confidence: metrics.confidence,
        findings: [
          `Resolution: ${metrics.width}×${metrics.height}`,
          `Sharpness (var. of Laplacian): ${Math.round(metrics.sharpness)}`,
          `Brightness: ${Math.round(metrics.brightness)}/255`,
          good
            ? 'Sharp enough to look at. This does not check for dents, corrosion, or a broken seal.'
            : 'Image is soft or dark. Retake it, then look at the part yourself.',
          'Measured from the pixels on this machine.',
        ],
        recommendation: 'needs_review',
      };
    } else {
      metadata = { source: 'real', parseFailed: true };
      aiAnalysis = {
        confidence: 0.15,
        findings: ['Could not decode this image file'],
        recommendation: 'needs_review',
      };
    }
  } else {
    metadata = { source: 'unsupported' };
    aiAnalysis = {
      confidence: 0.3,
      findings: [`${type} evidence is not analyzable offline yet`],
      recommendation: 'needs_review',
    };
  }

  if (type === 'photo' || type === 'barcode' || file.type.startsWith('image/')) {
    // Photos get a larger preview: one data-URL doubles as the thumbnail and
    // the AI vision payload. Other types keep the small card-sized preview.
    const preview = await makeImagePreview(file, type === 'photo' ? 768 : 280);
    if (preview) metadata.preview = preview;
  }

  return {
    id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type,
    status: 'pending',
    name: file.name,
    description: `Uploaded ${type} evidence`,
    capturedAt: new Date().toISOString(),
    uploadedBy: 'Inspector John Smith',
    metadata,
    aiAnalysis,
  };
}
