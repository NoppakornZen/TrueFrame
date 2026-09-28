import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
page.on('dialog', (d) => d.accept());
page.on('pageerror', (err) => console.log('[pageerror]', err.message));
await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2' });
await page.evaluate(() => localStorage.removeItem('trueframe-state'));
await page.reload({ waitUntil: 'networkidle2' });
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === 'Clear')?.click();
});
await new Promise((r) => setTimeout(r, 400));
const inputs = await page.$$('input[type="file"]');
await inputs[0].uploadFile('test-fixtures/photo.png');
await page.waitForFunction(() => /Sharpness/.test(document.body.innerText));
await inputs[1].uploadFile('test-fixtures/barcode.png');
await page.waitForFunction(() => document.body.innerText.includes('SN-787-45892-A'));
await inputs[2].uploadFile('test-fixtures/certificate.pdf');
await page.waitForFunction(() => document.body.innerText.includes('FAA-COC-2024-8891'));
await page.evaluate(() => {
  for (const label of ['No damage', 'Seal intact']) {
    Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim() === label)?.click();
  }
});
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('Run'))?.click();
});
await new Promise((r) => setTimeout(r, 800));
const text = await page.evaluate(() => document.body.innerText);
const start = text.indexOf('Do the sources agree');
console.log(text.slice(start, start + 2200));
await browser.close();
