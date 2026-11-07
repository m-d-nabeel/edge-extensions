// Dev-only: real store screenshots (1280x800) of the switcher over live sites.
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'store/tab-switcher');
fs.mkdirSync(OUT, { recursive: true });
const ext = path.join(ROOT, 'tab-cycle');
const prof = path.join(HERE, 'out/profile'); fs.rmSync(prof, { recursive: true, force: true });
const ctx = await chromium.launchPersistentContext(prof, { executablePath: '/usr/bin/microsoft-edge', headless: true, viewport: { width: 1280, height: 800 },
  colorScheme: 'dark', args: ['--headless=new', `--disable-extensions-except=${ext}`, `--load-extension=${ext}`, '--disable-features=DisableLoadExtensionCommandLineSwitch'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent('serviceworker');
const sites = [
  'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent',
  'https://news.ycombinator.com/',
  'https://en.wikipedia.org/wiki/Moon',
  'https://github.com/microsoft/vscode',
  'https://www.rust-lang.org/',
  'https://en.wikipedia.org/wiki/Solar_eclipse',
];
const pages = [];
for (const u of sites) {
  const p = await ctx.newPage(); await p.goto(u, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
  await p.bringToFront(); await sleep(1800); pages.push(p);
}
for (const p of ctx.pages()) if (!pages.includes(p)) await p.close();
console.log('thumbs:', await sw.evaluate(() => thumbOrder.length));
const host = pages.at(-1); await host.bringToFront(); await sleep(800);
const W = await sw.evaluate(async () => (await chrome.windows.getLastFocused()).id);
// Open the switcher the way a held Ctrl+Tab does, then move two steps back.
await host.click('body', { position: { x: 5, y: 400 } }).catch(() => {});
// Hold a real Ctrl (trusted input), then press "Tab" twice via the command handler.
await host.keyboard.down('Control');
await sw.evaluate((w) => step(1, w), W); await sleep(250); await sw.evaluate((w) => step(1, w), W); await sleep(900);
await host.screenshot({ path: path.join(OUT, 'screenshot-1-switcher.png') });
console.log('mode:', await sw.evaluate(() => cycle?.mode));
await sw.evaluate(() => finish(false)); await host.keyboard.up('Control'); await sleep(300);
const opt = await ctx.newPage();
const id = sw.url().split('/')[2];
await opt.goto(`chrome-extension://${id}/options.html`); await sleep(800);
await opt.screenshot({ path: path.join(OUT, 'screenshot-3-settings.png') });
await ctx.close();
console.log('done');
