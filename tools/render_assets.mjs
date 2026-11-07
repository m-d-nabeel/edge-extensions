// Dev-only: renders icons + store graphics from HTML/SVG with headless Edge.
//   node render_assets.mjs [icons|store|all]
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const what = process.argv[2] || 'all';
const browser = await chromium.launch({ executablePath: '/usr/bin/microsoft-edge', headless: true });
const page = await browser.newPage();
export async function shot(html, w, h, out, scale = 1) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}</style></head><body>${html}</body></html>`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await page.screenshot({ path: out, omitBackground: true, scale: 'css' });
}
const svg = (f) => fs.readFileSync(path.join(HERE, 'art', f), 'utf8');
if (what === 'icons' || what === 'all') {
  const icon = svg('switcher-icon.svg');
  const small = svg('switcher-icon-small.svg');
  for (const s of [16, 32, 48, 128]) {
    const art = s <= 32 ? small : icon;
    await shot(art.replace('<svg ', `<svg width="${s}" height="${s}" `), s, s, path.join(ROOT, 'tab-cycle/icons', s + '.png'));
  }
  await shot(icon.replace('<svg ', '<svg width="512" height="512" '), 512, 512, path.join(HERE, 'out/switcher-icon-512.png'));
}
if (what === 'store' || what === 'all') {
  const { renderStore, renderThemeShots } = await import('./store_graphics.mjs');
  await renderStore(shot, ROOT, HERE);
  if (fs.existsSync(path.join(HERE, 'out/raw-ntp.png'))) await renderThemeShots(shot, ROOT, HERE);
}
await browser.close();
