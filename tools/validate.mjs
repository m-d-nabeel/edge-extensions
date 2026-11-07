// Dev-only: loads the packaged zips like a reviewer would and fails on any
// manifest warning, install error or runtime error reported by the browser.
import { chromium } from 'playwright-core';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os'; import { execFileSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ext-validate-'));
const dirs = [];
for (const z of fs.readdirSync(path.join(ROOT, 'dist')).filter((f) => f.endsWith('.zip'))) {
  const d = path.join(tmp, z.replace('.zip', '')); fs.mkdirSync(d);
  execFileSync('unzip', ['-q', path.join(ROOT, 'dist', z), '-d', d]); dirs.push(d);
  // Every file the manifest points at must exist in the zip.
  const m = JSON.parse(fs.readFileSync(path.join(d, 'manifest.json'), 'utf8'));
  const refs = [...Object.values(m.icons || {}), ...Object.values(m.action?.default_icon || {}), m.background?.service_worker, m.options_ui?.page,
    ...(m.content_scripts || []).flatMap((c) => c.js || []), ...(m.web_accessible_resources || []).flatMap((w) => w.resources),
    ...Object.values(m.theme?.images || {})].filter(Boolean);
  const missing = refs.filter((r) => !fs.existsSync(path.join(d, r)));
  console.log(`${z}: ${refs.length} referenced files${missing.length ? ', MISSING: ' + missing.join(', ') : ', all present'}`);
  if (m.description && m.description.length > 132) console.log(`  description too long: ${m.description.length} > 132`);
}
const prof = path.join(tmp, 'profile'); fs.mkdirSync(prof + '/Default', { recursive: true });
fs.writeFileSync(prof + '/Default/Preferences', JSON.stringify({ extensions: { ui: { developer_mode: true } } }));
const ctx = await chromium.launchPersistentContext(prof, { executablePath: '/usr/bin/microsoft-edge', headless: true,
  args: ['--headless=new', `--disable-extensions-except=${dirs.join(',')}`, `--load-extension=${dirs.join(',')}`, '--disable-features=DisableLoadExtensionCommandLineSwitch'] });
const p = ctx.pages()[0];
// Exercise the extension a little so runtime errors have a chance to surface.
for (const u of ['https://example.com', 'https://en.wikipedia.org/wiki/Tab_key']) { const t = await ctx.newPage(); await t.goto(u).catch(() => {}); await t.bringToFront(); await t.waitForTimeout(1200); }
const sw = ctx.serviceWorkers().find((w) => w.url().includes('background.js'));
if (sw) {
  await sw.evaluate(async () => { const w = (await chrome.windows.getLastFocused()).id; await step(1, w); await new Promise((r) => setTimeout(r, 300)); await finish(true); });
}
await p.goto('edge://extensions'); await p.waitForTimeout(1500);
const info = await p.evaluate(async () => (await chrome.developerPrivate.getExtensionsInfo({ includeDisabled: true, includeTerminated: true })).map((e) => ({
  name: e.name, version: e.version, state: e.state, type: e.type,
  manifestErrors: (e.manifestErrors || []).map((x) => x.message), installWarnings: e.installWarnings || [],
  runtimeErrors: (e.runtimeErrors || []).map((x) => `${x.message} @ ${x.source}:${x.lineNumber}`),
})));
let bad = 0;
for (const e of info) {
  const problems = [...e.manifestErrors, ...e.installWarnings, ...e.runtimeErrors];
  bad += problems.length;
  console.log(`${e.name} ${e.version} [${e.type}, ${e.state}] ${problems.length ? 'PROBLEMS:\n  ' + problems.join('\n  ') : 'no warnings or errors'}`);
}
const themeLoaded = fs.readFileSync(path.join(prof, 'Default/Preferences'), 'utf8').includes('amoled-pure-black');
console.log('theme applied:', themeLoaded ? 'yes' : 'check manually (themes are not listed above)');
await ctx.close(); fs.rmSync(tmp, { recursive: true, force: true });
process.exit(bad ? 1 : 0);
