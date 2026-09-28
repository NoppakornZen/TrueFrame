import { writeFileSync } from 'node:fs';
import bwipjs from 'bwip-js';

// Realistic "part photo": PDF417 packed = lots of sharp edges = passes quality check
const png = await bwipjs.toBuffer({
  bcid: 'pdf417',
  text: 'CFM LEAP-1B TURBINE BLADE ASSEMBLY | PART: PART-787-ENG-0451 | SN: SN-787-45892-A | SUPPLIER: Boeing | CONDITION: EXCELLENT | PACKAGING: INTACT',
  scale: 5,
  columns: 4,
  rows: 12,
});
writeFileSync('test-fixtures/photo.png', png);
writeFileSync('public/photo.png', png);
console.log('wrote test-fixtures/photo.png + public/photo.png');
