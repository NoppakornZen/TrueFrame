// End-to-end test of the real user flow in the browser.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

const results = {};

await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.removeItem('trueframe-state'));
await page.reload({ waitUntil: 'networkidle2' });

// --- Upload all three evidence types (photo, barcode, document) ---
const inputs = await page.$$('input[type="file"]');
await inputs[0].uploadFile('test-fixtures/photo.png');     // photo
await page.waitForFunction(
  () =>
    /Sharpness \(var\. of Laplacian\): [1-9]/i.test(document.body.innerText) &&
    /ai inspection (finished|could not check)/i.test(document.body.innerText),
  { timeout: 60000 }
);
results.photoUploadWorks = true;

await inputs[1].uploadFile('test-fixtures/barcode.png');   // barcode
await page.waitForFunction(() => document.body.innerText.includes('SN-787-45892-A'), { timeout: 15000 });
results.barcodeUploadWorks = true;

await inputs[2].uploadFile('test-fixtures/certificate.pdf'); // document
// wait for the extracted cert number (unique to parsed PDF, not present initially)
await page.waitForFunction(
  () => document.body.innerText.includes('FAA-COC-2024-8891'),
  { timeout: 20000 }
);
results.certUploadWorks = true;

// --- Run Analysis ---
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('Run'))?.click();
});
await new Promise((r) => setTimeout(r, 1000));
const bodyText = await page.evaluate(() => document.body.innerText);
results.decisionShown = /accept|reject|needs review/i.test(bodyText);
// Show the decision badge text
results.decisionText = (bodyText.match(/\b(accept|reject|needs review)\b/i) || [])[0] || 'none';

// --- Policy toggle (use real lucide-power svg) ---
const beforeActive = await page.evaluate(() => (document.body.innerText.match(/\d+ of \d+ active/) || ['0 of 0 active'])[0]);
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('button')).find((b) => b.querySelector('svg.lucide-power'));
  btn?.click();
});
await new Promise((r) => setTimeout(r, 400));
const afterActive = await page.evaluate(() => (document.body.innerText.match(/\d+ of \d+ active/) || ['0 of 0 active'])[0]);
results.policyToggleWorks = afterActive !== beforeActive;

// --- Add Policy: open modal, fill, save ---
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Add')?.click();
});
await new Promise((r) => setTimeout(r, 400));
results.modalOpened = await page.evaluate(() => /new policy/i.test(document.body.innerText));

await page.type('input[type="text"]', 'Test Packaging Rule');
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'photo')?.click();
});
await new Promise((r) => setTimeout(r, 200));
await page.evaluate(() => {
  // click the LAST "Add Policy" button = the one inside the modal (first is the header opener)
  const btns = Array.from(document.querySelectorAll('button')).filter(
    (b) => b.textContent?.trim() === 'Add policy' && !b.disabled
  );
  btns[btns.length - 1]?.click();
});
await new Promise((r) => setTimeout(r, 500));
results.policyAdded = await page.evaluate(() => document.body.innerText.includes('Test Packaging Rule'));

// --- Delete the added policy ---
results.beforeDeleteCount = await page.evaluate(() =>
  (document.body.innerText.match(/Test Packaging Rule/g) || []).length
);
await page.evaluate(() => {
  // the expand handler lives on the inner cursor-pointer header div
  const header = Array.from(document.querySelectorAll('div.cursor-pointer')).find((d) =>
    d.textContent?.trim().startsWith('Test Packaging Rule')
  );
  header?.click();
});
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  // scope the trash button to the policy card that contains the test policy
  const card = Array.from(document.querySelectorAll('li')).find((d) =>
    d.textContent?.trim().startsWith('Test Packaging Rule') && d.querySelector('svg[class*="trash"]')
  );
  card?.querySelector('button:has(svg[class*="trash"])')?.click();
});
await new Promise((r) => setTimeout(r, 400));
results.policyDeleted = await page.evaluate(() => !document.body.innerText.includes('Test Packaging Rule'));

console.log('=== E2E RESULTS ===');
console.log(JSON.stringify(results, null, 2));

await browser.close();
