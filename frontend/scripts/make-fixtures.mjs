// Generates real test fixtures: a CODE128 barcode PNG and a CoC PDF.
// Run: node scripts/make-fixtures.mjs
import bwipjs from 'bwip-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'test-fixtures');
mkdirSync(outDir, { recursive: true });

const SERIAL = 'SN-787-45892-A';
const CERT_NO = 'FAA-CoC-2024-8891';

// --- Barcode PNG (CODE128) ---
const png = await bwipjs.toBuffer({
  bcid: 'code128',
  text: SERIAL,
  scale: 3,
  height: 12,
  includetext: true,
});
writeFileSync(join(outDir, 'barcode.png'), png);
console.log('wrote test-fixtures/barcode.png');

// --- CoC PDF ---
const pdf = await PDFDocument.create();
const page = pdf.addPage([595, 842]);
const font = await pdf.embedFont(StandardFonts.Helvetica);
const lines = [
  ['CERTIFICATE OF CONFORMITY', 20],
  ['Issued by: FAA', 12],
  [`Certificate Number: ${CERT_NO}`, 12],
  [`Serial Number: ${SERIAL}`, 12],
  ['Part: CFM LEAP-1B Turbine Blade Assembly', 12],
  ['Issued: 2024-09-01', 12],
  ['Expiry Date: 2027-12-31', 12],
  ['This certifies the part conforms to all applicable requirements.', 10],
];
let y = 780;
for (const [text, size] of lines) {
  page.drawText(text, { x: 60, y, size, font, color: rgb(0, 0, 0) });
  y -= size * 2;
}
writeFileSync(join(outDir, 'certificate.pdf'), await pdf.save());
console.log('wrote test-fixtures/certificate.pdf');

// --- Mismatched barcode (for conflict demo) ---
const png2 = await bwipjs.toBuffer({
  bcid: 'code128',
  text: 'SN-787-99999-X',
  scale: 3,
  height: 12,
  includetext: true,
});
writeFileSync(join(outDir, 'barcode-wrong.png'), png2);
console.log('wrote test-fixtures/barcode-wrong.png');
