/**
 * take-screenshots.mjs
 * Screenshots the static demo HTML pages with Playwright.
 * Run: node scripts/take-screenshots.mjs
 */
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'timers/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'public');

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 860 },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();

// Screenshot 1: Search / List view
console.log('Capturing search list screenshot...');
await page.goto(`file://${path.join(ROOT, 'scripts/demo-search.html')}`, { waitUntil: 'networkidle' });
await sleep(2000); // wait for Google Fonts + Tailwind CDN
await page.screenshot({ path: path.join(OUT_DIR, 'hero-search.png'), clip: { x: 0, y: 0, width: 1440, height: 860 } });
console.log('Saved public/hero-search.png');

// Screenshot 2: Analytics view
console.log('Capturing analytics screenshot...');
await page.goto(`file://${path.join(ROOT, 'scripts/demo-analytics.html')}`, { waitUntil: 'networkidle' });
await sleep(2000);
await page.screenshot({ path: path.join(OUT_DIR, 'hero-analytics.png'), clip: { x: 0, y: 0, width: 1440, height: 860 } });
console.log('Saved public/hero-analytics.png');

await browser.close();
console.log('\nDone! Screenshots saved to public/');
