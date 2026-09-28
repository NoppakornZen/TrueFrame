import barcodeUrl from '../../test-fixtures/barcode.png';
import barcodeWrongUrl from '../../test-fixtures/barcode-wrong.png';
import photoUrl from '../../test-fixtures/photo.png';
import certificateUrl from '../../test-fixtures/certificate.pdf?url';
import { Evidence } from '../types';
import { inspectFile } from './inspectFile';

async function fileFromUrl(url: string, name: string, type: string): Promise<File> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${name}`);
  const blob = await res.blob();
  return new File([blob], name, { type });
}

/**
 * A scripted shipment, read with the same code as a real upload.
 * The inspector has already looked at the part, so Run can accept or reject
 * on the serial alone. The card still says a person looked.
 */
export async function loadDemoShipment(kind: 'match' | 'mismatch'): Promise<Evidence[]> {
  const [photoFile, barcodeFile, certFile] = await Promise.all([
    fileFromUrl(photoUrl, 'part-photo.png', 'image/png'),
    fileFromUrl(
      kind === 'match' ? barcodeUrl : barcodeWrongUrl,
      kind === 'match' ? 'barcode.png' : 'barcode-wrong.png',
      'image/png'
    ),
    fileFromUrl(certificateUrl, 'certificate.pdf', 'application/pdf'),
  ]);

  const [photo, barcode, certificate] = await Promise.all([
    inspectFile(photoFile, 'photo'),
    inspectFile(barcodeFile, 'barcode'),
    inspectFile(certFile, 'document'),
  ]);

  photo.metadata = {
    ...photo.metadata,
    inspectorSignoff: { noDamage: true, sealIntact: true },
  };
  if (photo.aiAnalysis) {
    photo.aiAnalysis = {
      ...photo.aiAnalysis,
      findings: [
        ...photo.aiAnalysis.findings,
        'Inspector J. Smith looked: no visible damage, seal intact.',
      ],
    };
  }

  return [photo, barcode, certificate];
}
