// Live camera barcode scanning — real decoding from the device camera.
// Uses ZXing's video decoder, so it works fully offline (no network, no API key).
// If no camera is available (headless demo machine, denied permission), the caller
// can fall back to decodePastedBarcode().

import { BrowserMultiFormatReader, IScannerControls } from '@zxing/browser';
import { BarcodeFormat } from '@zxing/library';
import { BarcodeScanResult } from './realAnalysis';

export interface CameraScanHandle {
  stop: () => void;
}

/**
 * Start continuously decoding barcodes from a camera into `videoElement`.
 * Fires `onResult` for every successful decode (the caller decides when to stop).
 */
export async function scanFromCamera(
  videoElement: HTMLVideoElement,
  onResult: (result: BarcodeScanResult) => void
): Promise<CameraScanHandle> {
  const reader = new BrowserMultiFormatReader(undefined, { delayBetweenScanAttempts: 200 });

  const controls: IScannerControls = await reader.decodeFromConstraints(
    {
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    videoElement,
    (result) => {
      if (!result) return;
      const rawText = result.getText();
      const format = BarcodeFormat[result.getBarcodeFormat()] ?? String(result.getBarcodeFormat());
      onResult({ rawText, format, serialNumber: extractSerialLocal(rawText) ?? rawText });
    }
  );

  return { stop: () => controls.stop() };
}

/** List available cameras so the UI can show a device picker. */
export async function enumerateVideoInputs(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

/** A camera-free path: scan a barcode out of a still image (same as file upload). */
export async function decodePastedBarcode(file: File): Promise<BarcodeScanResult | null> {
  const url = URL.createObjectURL(file);
  try {
    const reader = new BrowserMultiFormatReader();
    const result = await reader.decodeFromImageUrl(url);
    const rawText = result.getText();
    const format = BarcodeFormat[result.getBarcodeFormat()] ?? String(result.getBarcodeFormat());
    return { rawText, format, serialNumber: extractSerialLocal(rawText) ?? rawText };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Local copy so this module has no import cycle with realAnalysis.ts
function extractSerialLocal(text: string): string | undefined {
  const m = text.match(/\b(SN[-\s]?\d{3}[-\s]?\d{3,6}(?:[-\s]?[A-Z])?)\b/i);
  return m?.[1]?.replace(/\s+/g, '-').toUpperCase();
}
