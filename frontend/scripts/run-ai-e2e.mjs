// E2E for the AI vision layer. Deterministic: the app's dev-only `?aiMock=1`
// hook points the adapter at /__mock-ai/v1, and puppeteer intercepts that
// request — no API key, no env vars, no real gateway.
//
// Scenarios:
//   1. AI clean  → chips render, full evidence + signoffs → accept
//   2. AI dirty  → damage:true → policy fails, signoff contradiction conflict
//   3. No aiMock → offline fallback line, AI line never appears
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
const pageErrors = [];
page.on('pageerror', (err) => pageErrors.push(err.message));
page.on('dialog', (dialog) => dialog.accept());

// What the fake gateway will say about the photo.
let mockReply = {
  damage: false,
  corrosion: false,
  tamperingSigns: false,
  sealIntact: true,
  packagingDamaged: false,
  visibleSerial: 'SN-787-45892-A',
  findings: [
    'No visible damage or corrosion.',
    'Seal appears intact.',
    'AI observation — confirm with your own eyes before signing.',
  ],
  aiConfidence: 0.93,
};

await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().includes('/__mock-ai/v1/chat/completions')) {
    req.respond({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(mockReply) } }] }),
    });
  } else {
    void req.continue();
  }
});

const results = {};
const body = () => page.evaluate(() => document.body.innerText);

async function clearDesk() {
  await page.evaluate(() => localStorage.removeItem('trueframe-state'));
  await page.reload({ waitUntil: 'networkidle2' });
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Clear')
      ?.click();
  });
  await new Promise((r) => setTimeout(r, 400));
}

async function uploadAll() {
  const inputs = await page.$$('input[type="file"]');
  await inputs[0].uploadFile('test-fixtures/photo.png');
  // Wait for the AI path to finish (chips are only rendered after aiCondition).
  await page.waitForFunction(() => /ai vision · mock-vision/i.test(document.body.innerText), {
    timeout: 15000,
  });
  await inputs[1].uploadFile('test-fixtures/barcode.png');
  await page.waitForFunction(() => document.body.innerText.includes('SN-787-45892-A'), {
    timeout: 15000,
  });
  await inputs[2].uploadFile('test-fixtures/certificate.pdf');
  await page.waitForFunction(() => document.body.innerText.includes('FAA-COC-2024-8891'), {
    timeout: 20000,
  });
}

async function signoffAndRun() {
  await page.evaluate(() => {
    for (const label of ['No damage', 'Seal intact']) {
      Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)
        ?.click();
    }
  });
  await new Promise((r) => setTimeout(r, 200));
  await page.evaluate(() => {
    Array.from(document.querySelectorAll('button')).find((b) =>
      b.textContent?.trim().startsWith('Run')
    )?.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
}

// --- Scenario 1: AI says the part is clean and reads the matching serial ---
await page.goto('http://localhost:3001/?aiMock=1', { waitUntil: 'networkidle2' });
await clearDesk();
await uploadAll();
let text = await body();
results.s1_aiSourceLine = /ai vision · mock-vision/i.test(text);
results.s1_chipDamageNone = /damage:\s*none/i.test(text);
results.s1_chipCorrosionNone = /corrosion:\s*none/i.test(text);
results.s1_chipSealIntact = /seal:\s*intact/i.test(text);
results.s1_offlineLineAbsent = !/offline pixel analysis/i.test(text);
await signoffAndRun();
text = await body();
results.s1_decision = text.match(/\b(accept|reject|needs review)\b/i)?.[0] ?? 'none';
results.s1_reasoningMentionsConditions = /condition/i.test(text);
// Conflict blocks render their header as "CRITICAL · CONTRADICTION" etc.
// (a plain /conflict/i would also match the always-present "Conflicts 0" stat.)
results.s1_noErrorConflicts = !/(critical|high|medium|low)\s·\s(contradiction|inconsistency)/i.test(text);

// --- Scenario 2: AI reports damage despite the signoff ---
// Reload so the in-memory AI cache from scenario 1 is discarded.
mockReply = {
  damage: true,
  corrosion: false,
  tamperingSigns: false,
  sealIntact: true,
  packagingDamaged: false,
  findings: [
    'Visible dent on the leading edge.',
    'Seal appears intact.',
    'AI observation — confirm with your own eyes before signing.',
  ],
  aiConfidence: 0.91,
};
await page.goto('http://localhost:3001/?aiMock=1', { waitUntil: 'networkidle2' });
await clearDesk();
await uploadAll();
await page.waitForFunction(() => /damage:\s*seen/i.test(document.body.innerText), {
  timeout: 15000,
});
results.s2_chipDamageSeen = true;
await signoffAndRun();
text = await body();
results.s2_decision = text.match(/\b(accept|reject|needs review)\b/i)?.[0] ?? 'none';
results.s2_notAccept = results.s2_decision !== 'accept';
results.s2_conditionFailed = /damage equals false/i.test(text);
results.s2_signoffConflict = /ai vision reports visible damage/i.test(text);

// --- Scenario 3: no aiMock → offline fallback, AI line never appears ---
mockReply = {
  damage: false,
  corrosion: false,
  tamperingSigns: false,
  sealIntact: true,
  packagingDamaged: false,
  findings: ['should never be requested'],
  aiConfidence: 0.9,
};
await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2' });
await clearDesk();
{
  const inputs = await page.$$('input[type="file"]');
  await inputs[0].uploadFile('test-fixtures/photo.png');
  await page.waitForFunction(
    () =>
      /Sharpness \(var\. of Laplacian\): [1-9]/i.test(document.body.innerText) &&
      /offline pixel analysis/i.test(document.body.innerText),
    { timeout: 15000 }
  );
}
text = await body();
results.s3_offlineLineShown = /offline pixel analysis/i.test(text);
results.s3_aiLineAbsent = !/ai vision ·/i.test(text);
results.s3_sharpnessKept = /Sharpness \(var\. of Laplacian\)/i.test(text);

results.pageErrors = pageErrors;
results.passed =
  results.s1_aiSourceLine &&
  results.s1_chipDamageNone &&
  results.s1_chipCorrosionNone &&
  results.s1_chipSealIntact &&
  results.s1_offlineLineAbsent &&
  results.s1_decision === 'accept' &&
  results.s1_reasoningMentionsConditions &&
  results.s1_noErrorConflicts &&
  results.s2_chipDamageSeen &&
  results.s2_decision !== 'accept' &&
  results.s2_conditionFailed &&
  results.s2_signoffConflict &&
  results.s3_offlineLineShown &&
  results.s3_aiLineAbsent &&
  results.s3_sharpnessKept &&
  pageErrors.length === 0;

console.log('=== AI E2E ===');
console.log(JSON.stringify(results, null, 2));

await browser.close();
process.exit(results.passed ? 0 : 1);
