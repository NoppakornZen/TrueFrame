// Runs the in-browser test harness and prints the JSON results.
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  headless: true,
  args: ['--disable-gpu', '--no-sandbox'],
});

const page = await browser.newPage();
page.on('console', (msg) => console.log('[console]', msg.type(), msg.text()));
page.on('pageerror', (err) => console.log('[pageerror]', err.message));

await page.goto('http://localhost:3001/test', { waitUntil: 'networkidle2' });

// Wait until status key disappears (i.e. results are done) or timeout 30s
await page.waitForFunction(
  () => {
    const el = document.getElementById('test-output');
    if (!el) return false;
    const txt = el.textContent || '';
    return !txt.includes('"status": "running"') && txt.length > 20;
  },
  { timeout: 30000 }
);

const json = await page.evaluate(() => document.getElementById('test-output')?.textContent);
console.log('=== RESULT ===');
console.log(json);
await browser.close();
