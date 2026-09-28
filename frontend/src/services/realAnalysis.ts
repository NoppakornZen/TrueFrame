// Real offline analysis: barcode decoding (ZXing) + certificate text extraction (pdf.js)
// Everything runs locally in the browser — no network, no API key.

import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat } from '@zxing/library';
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

export interface BarcodeScanResult {
  rawText: string;
  format: string;
  serialNumber?: string;
}

export interface CertificateExtraction {
  serialNumber?: string;
  certificateNumber?: string;
  issuer?: string;
  expiryDate?: string;
  issuedDate?: string;
  partNumber?: string;
  rawTextPreview: string;
}

export type RealAnalysis =
  | { kind: 'barcode'; barcode: BarcodeScanResult }
  | { kind: 'document'; certificate: CertificateExtraction };

// ---------- Barcode ----------

export async function scanBarcodeFile(file: File): Promise<BarcodeScanResult | null> {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(url);
    const rawText = result.getText();
    const format = BarcodeFormat[result.getBarcodeFormat()] ?? String(result.getBarcodeFormat());
    return {
      rawText,
      format,
      serialNumber: extractSerial(rawText) ?? rawText,
    };
  } catch {
    return null; // not a decodable barcode image
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ---------- Certificate / PDF ----------

export async function extractCertificateText(file: File): Promise<CertificateExtraction | null> {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    let text = '';
    const pages = Math.min(pdf.numPages, 3);
    for (let i = 1; i <= pages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(' ') + '\n';
    }
    return parseCertificateText(text);
  } catch {
    return null; // not a readable PDF
  }
}

export function parseCertificateText(text: string): CertificateExtraction {
  const serialNumber =
    matchFirst(text, /\b(SN[-\s]?\d{3}[-\s]?\d{3,6}(?:[-\s]?[A-Z])?)\b/i) ||
    matchFirst(text, /\bSerial(?:\s*(?:No|Number|#))?[:\s]*([A-Z0-9-]{6,})\b/i);

  const certificateNumber =
    matchFirst(text, /\b(FAA[-\s]?(?:CoC)?[-\s]?\d{4}[-\s]?\d{3,5})\b/i) ||
    matchFirst(text, /\b(?:Cert(?:ificate)?\s*(?:No|Number|#))[:\s]*([A-Z0-9-]{4,})\b/i);

  const issuer = matchFirst(text, /\b(FAA|EASA|CAAT|Boeing|Airbus|Rolls[-\s]?Royce|GE\s*Aviation)\b/i);

  const expiryDate = matchFirst(
    text,
    /\b(?:Expir\w+|Valid\s*(?:until|thru|through))(?:\s+date)?[\s:.-]{0,8}(\d{4}[-/]\d{2}[-/]\d{2})\b/i
  );

  const issuedDate = matchFirst(
    text,
    /\b(?:Issued(?:\s+on)?|Issue\s+date|Date\s*of\s*issue)[\s:.-]{1,12}(\d{4}[-/]\d{2}[-/]\d{2})\b/i
  );

  const partNumber = matchFirst(text, /\bPart(?:\s*(?:No|Number|#))?[:\s]*([A-Z0-9-]{6,})\b/i);

  return {
    serialNumber: serialNumber?.replace(/\s+/g, '-').toUpperCase(),
    certificateNumber: certificateNumber?.toUpperCase(),
    issuer,
    expiryDate,
    issuedDate,
    partNumber: partNumber?.toUpperCase(),
    rawTextPreview: text.slice(0, 500),
  };
}

function matchFirst(text: string, re: RegExp): string | undefined {
  const m = text.match(re);
  return m?.[1]?.trim();
}

// ---------- Photo quality (real, offline, from pixels) ----------

export interface PhotoMetrics {
  width: number;
  height: number;
  sharpness: number; // variance of Laplacian — higher = sharper
  brightness: number; // 0-255 mean
  confidence: number; // derived 0-1
}

/** Small JPEG the evidence card can show, and that survives a refresh. */
export async function makeImagePreview(file: File, maxDim = 280): Promise<string | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    URL.revokeObjectURL(url);
    return frameToJpeg(img, img.width, img.height, maxDim);
  } catch {
    return null;
  }
}

export function captureVideoFrame(video: HTMLVideoElement, maxDim = 280): string | null {
  if (!video.videoWidth || !video.videoHeight) return null;
  return frameToJpeg(video, video.videoWidth, video.videoHeight, maxDim);
}

function frameToJpeg(
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  maxDim: number
): string | null {
  const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.72);
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image failed to load'));
    img.src = url;
  });
}

export async function analyzePhotoQuality(file: File): Promise<PhotoMetrics | null> {
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });

    // Downscale to a workable size for pixel math
    const maxDim = 400;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale));
    const h = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    // Composite over white: source PNGs may have transparent backgrounds
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const { data } = ctx.getImageData(0, 0, w, h);

    // Grayscale
    const gray = new Float32Array(w * h);
    let sum = 0;
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[p] = g;
      sum += g;
    }
    const brightness = sum / (w * h);

    // Variance of Laplacian (sharpness)
    let lapSum = 0;
    let lapSqSum = 0;
    let n = 0;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const idx = y * w + x;
        const lap =
          4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
        lapSum += lap;
        lapSqSum += lap * lap;
        n++;
      }
    }
    const mean = lapSum / n;
    const variance = lapSqSum / n - mean * mean;

    // Map sharpness variance to a 0-1 score (log-ish scale; >~500 is sharp)
    const sharpScore = Math.min(1, Math.log10(1 + variance) / 3);
    // Exposure: only penalize extremes (near-black or blown-out); a white
    // backdrop is normal for part photography
    const exposureScore =
      brightness < 40 || brightness > 245 ? 0.3 : 1 - Math.min(1, Math.max(0, Math.abs(brightness - 140) - 60) / 80);
    // Resolution: penalize tiny images
    const resScore = Math.min(1, Math.min(img.width, img.height) / 500);

    const confidence = Math.round((sharpScore * 0.5 + exposureScore * 0.25 + resScore * 0.25) * 100) / 100;

    URL.revokeObjectURL(url);
    return { width: img.width, height: img.height, sharpness: variance, brightness, confidence };
  } catch {
    return null;
  }
}

// ---------- Serial helper shared by barcode + doc ----------

export function extractSerial(text: string): string | undefined {
  const m = text.match(/\b(SN[-\s]?\d{3}[-\s]?\d{3,6}(?:[-\s]?[A-Z])?)\b/i);
  return m?.[1]?.replace(/\s+/g, '-').toUpperCase();
}
