import puppeteer from 'puppeteer-core';
const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true, args: ['--disable-gpu', '--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 1100, deviceScaleFactor: 1.5 });
await page.goto('http://localhost:3001/', { waitUntil: 'networkidle2' });
const inputs = await page.$$('input[type="file"]');
await inputs[0].uploadFile('test-fixtures/photo.png');
await page.waitForFunction(() => /Sharpness \(var\. of Laplacian\): [1-9]/.test(document.body.innerText), { timeout: 15000 });
await inputs[1].uploadFile('test-fixtures/barcode.png');
await page.waitForFunction(() => document.body.innerText.includes('SN-787-45892-A'), { timeout: 15000 });
await inputs[2].uploadFile('test-fixtures/certificate.pdf');
await page.waitForFunction(() => document.body.innerText.includes('FAA-COC-2024-8891'), { timeout: 20000 });
await page.evaluate(() => {
  Array.from(document.querySelectorAll('button')).find((b) => b.textContent?.trim().startsWith('Run Analysis'))?.click();
});
await new Promise(r => setTimeout(r, 1200));
await page.screenshot({ path: 'C:/Users/Zen/Desktop/TureFrameclaude/frontend/final.png', fullPage: true });
console.log('saved C:/Users/Zen/Desktop/TureFrameclaude/frontend/final.png');
await browser.close();
