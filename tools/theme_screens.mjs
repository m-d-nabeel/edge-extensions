// Dev-only: real browser-window screenshots of the theme (needs a desktop session).
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url'; import { execFile } from 'node:child_process'; import { promisify } from 'node:util';
const run = promisify(execFile);
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'store/totality-theme'); fs.mkdirSync(OUT, { recursive: true });
const theme = path.join(ROOT, 'amoled-theme');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function windowShot(vertical, url, file, prep) {
  const prof = path.join(HERE, 'out/profile-theme'); fs.rmSync(prof, { recursive: true, force: true }); fs.mkdirSync(prof + '/Default', { recursive: true });
  fs.writeFileSync(prof + '/Default/Preferences', JSON.stringify({ edge: { vertical_tabs: { opened: vertical, collapsed: false, first_opened2: true } },
    browser: { show_hub_apps_tower: false }, ntp: { layout_mode: 3 } }));
  const ctx = await chromium.launchPersistentContext(prof, { executablePath: '/usr/bin/microsoft-edge', headless: false, viewport: null, colorScheme: 'dark',
    ignoreDefaultArgs: ['--enable-automation', '--no-sandbox'],
    args: ['--ozone-platform=wayland', '--window-size=1280,800', `--disable-extensions-except=${theme}`, `--load-extension=${theme}`, '--disable-features=DisableLoadExtensionCommandLineSwitch', '--no-first-run'] });
  const p = ctx.pages()[0];
  for (const u of ['https://en.wikipedia.org/wiki/Moon', 'https://developer.mozilla.org/en-US/']) { const t = await ctx.newPage(); await t.goto(u).catch(() => {}); }
  await p.bringToFront(); await p.goto(url).catch(() => {}); await sleep(3500);
  if (prep) await prep(p);
  await sleep(800);
  const tmp = path.join(HERE, 'out/raw.png');
  await run('spectacle', ['-b', '-n', '-a', '-o', tmp]);
  await ctx.close();
  return tmp;
}
// First-run pop-ups on the new tab page: try their close buttons, then Escape.
const closeModal = async (p) => {
  for (let round = 0; round < 3; round++) {
    for (const f of p.frames()) {
      const btns = f.locator('button[aria-label*="close" i], button[title*="close" i], [role=dialog] button:has-text("Skip"), [role=dialog] button:has-text("Not now")');
      const n = await btns.count().catch(() => 0);
      for (let i = 0; i < n; i++) await btns.nth(i).click({ timeout: 1500 }).catch(() => {});
    }
    await p.keyboard.press('Escape').catch(() => {});
    await sleep(900);
  }
  await p.mouse.move(640, 790);
};
const a = await windowShot(false, 'edge://newtab', 'ntp', closeModal); fs.copyFileSync(a, path.join(HERE, 'out/raw-ntp.png'));
const b = await windowShot(true, 'https://en.wikipedia.org/wiki/Solar_eclipse', 'page', async (p) => p.mouse.move(1270, 400)); fs.copyFileSync(b, path.join(HERE, 'out/raw-page.png'));
console.log('ok');
