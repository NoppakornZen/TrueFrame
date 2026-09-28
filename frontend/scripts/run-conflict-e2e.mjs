import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, args: ['--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1000 });
await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.removeItem('trueframe-state'));
await page.reload({ waitUntil: 'networkidle2' });
const inputs = await page.$$('input[type="file"]');
await inputs[1].uploadFile('test-fixtures/barcode-wrong.png');  // WRONG serial
await page.waitForFunction(() => document.body.innerText.includes('SN-787-99999-X'), { timeout: 15000 });
await inputs[2].uploadFile('test-fixtures/certificate.pdf');
await page.waitForFunction(() => document.body.innerText.includes('FAA-COC-2024-8891'), { timeout: 20000 });
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('Run'))?.click();
});
await new Promise(r => setTimeout(r, 1000));
const text = await page.evaluate(() => document.body.innerText);
const out = {
  conflictDetected: /conflict/i.test(text) && !/\bconflicts\s*\n?\s*0\b/i.test(text),
  conflictCount: (text.match(/(\d+)\s+conflicts?/i) || [])[1],
  mentionsMismatch: /mismatch/i.test(text),
  decision: (text.match(/\b(accept|reject|needs review)\b/i) || [])[1],
};
console.log(JSON.stringify(out, null, 2));
await browser.close();
