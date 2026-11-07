// Dev-only: store graphics for both listings, rendered from HTML.
import fs from 'node:fs'; import path from 'node:path';

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;600;700&family=Instrument+Serif:ital@0;1&display=block" rel="stylesheet">`;
const dataUrl = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;

export async function renderStore(shot, ROOT, HERE) {
  const S = path.join(ROOT, 'store/tab-switcher');
  const T = path.join(ROOT, 'store/totality-theme');
  fs.mkdirSync(S, { recursive: true }); fs.mkdirSync(T, { recursive: true });
  const icon = fs.readFileSync(path.join(HERE, 'art/switcher-icon.svg'), 'utf8');
  const panelShot = dataUrl(path.join(S, 'screenshot-1-switcher.png'));
  const eclipse = dataUrl(path.join(ROOT, 'amoled-theme/images/ntp.png'));

  // ---------- Tab switcher ----------
  const base = `font-family:'Schibsted Grotesk',system-ui,sans-serif;background:#000;color:#efe4cf;`;
  const kbd = (k) => `<span style="display:inline-block;border:1.5px solid #3a3631;border-bottom-width:3px;border-radius:7px;padding:0 .35em;font-weight:600">${k}</span>`;

  await shot(icon.replace('<svg ', '<svg width="300" height="300" '), 300, 300, path.join(S, 'logo-300.png'));

  // Small promo tile 440x280
  await shot(`${FONTS}<div style="${base}width:440px;height:280px;position:relative;overflow:hidden">
    <div style="position:absolute;left:28px;top:30px;width:84px;height:84px">${icon.replace('<svg ', '<svg width="84" height="84" ')}</div>
    <div style="position:absolute;left:28px;top:132px;right:24px">
      <div style="font-size:40px;font-weight:700;letter-spacing:-.02em;line-height:1.05">Tab Cycle</div>
      <div style="margin-top:12px;font-size:16px;color:#8f877a">${kbd('Alt')} + ${kbd('Q')} switches between your recent tabs</div>
    </div>
  </div>`, 440, 280, path.join(S, 'promo-small-440x280.png'));

  // Large / marquee tile 1400x560
  await shot(`${FONTS}<div style="${base}width:1400px;height:560px;position:relative;overflow:hidden">
    <div style="position:absolute;left:84px;top:96px;width:520px">
      <div style="width:96px;height:96px">${icon.replace('<svg ', '<svg width="96" height="96" ')}</div>
      <div style="margin-top:34px;font-size:64px;font-weight:700;letter-spacing:-.025em;line-height:1">Tab Cycle</div>
      <div style="margin-top:22px;font-size:24px;line-height:1.5;color:#a39a8b">Tap ${kbd('Alt')} + ${kbd('Q')} for your last tab.<br>Hold it to see every tab, most recent first.</div>
    </div>
    <div style="position:absolute;left:650px;top:206px;width:864px;height:142px;border-radius:13px;overflow:hidden;
      background:url(${panelShot}) -80px -249px / 1024px 640px no-repeat;box-shadow:0 0 0 1px #2b2824, 0 30px 90px rgba(242,71,111,.08)"></div>
  </div>`, 1400, 560, path.join(S, 'promo-marquee-1400x560.png'));

  // Screenshot 2: how it works, 1280x800
  const step = (n, title, body) => `<div style="flex:1;border:1px solid #24211d;border-radius:20px;padding:40px 36px">
      <div style="font-size:18px;color:#f2476f;font-weight:600">${n}</div>
      <div style="margin-top:14px;font-size:36px;font-weight:700;letter-spacing:-.015em;line-height:1.1">${title}</div>
      <div style="margin-top:18px;font-size:22px;line-height:1.55;color:#a39a8b">${body}</div></div>`;
  await shot(`${FONTS}<div style="${base}width:1280px;height:800px;box-sizing:border-box;padding:0 72px;display:flex;flex-direction:column;justify-content:center">
    <div style="font-size:60px;font-weight:700;letter-spacing:-.025em">Switch tabs by when you used them</div>
    <div style="margin-top:16px;font-size:25px;color:#8f877a">Your most recent tab is always one keypress away, wherever it sits in the strip.</div>
    <div style="display:flex;gap:22px;margin-top:60px">
      ${step('Tap', 'Back to your last tab', `Press ${kbd('Alt')} + ${kbd('Q')} and let go. Press again to flip back. Perfect for working between two tabs.`)}
      ${step('Hold', 'See every tab', `Keep ${kbd('Alt')} held and press ${kbd('Q')} again. A panel shows your tabs with previews, most recent first.`)}
      ${step('Release', 'Switch once', `Let go of ${kbd('Alt')} to switch. ${kbd('Shift')} goes the other way, ${kbd('Esc')} cancels, or click a tab.`)}
    </div>
    <div style="margin-top:48px;font-size:20px;color:#6b645a">Pick any shortcut, even Ctrl+Tab (advanced). Works with vertical tabs. No accounts, no analytics.</div>
  </div>`, 1280, 800, path.join(S, 'screenshot-2-how-it-works.png'));

  // ---------- Totality theme ----------
  const serif = `font-family:'Instrument Serif',Georgia,serif;`;
  // The eclipse sits at 84.5% / 275px of the 2560x1440 art.
  const eclipseAt = (w, h, cx, cy, scale) => {
    const iw = 2560 * scale, ih = 1440 * scale;
    return `background:#000 url(${eclipse}) ${cx - 0.845 * iw}px ${cy - 275 * scale}px / ${iw}px ${ih}px no-repeat;`;
  };
  await shot(`${FONTS}<div style="width:440px;height:280px;position:relative;overflow:hidden;${eclipseAt(440, 280, 330, 120, 0.62)}">
    <div style="position:absolute;left:30px;bottom:34px;color:#efe4cf">
      <div style="${serif}font-size:58px;line-height:.9">Totality</div>
      <div style="font-family:'Schibsted Grotesk',sans-serif;margin-top:10px;font-size:15px;color:#8f877a">A true-black theme for OLED screens</div>
    </div></div>`, 440, 280, path.join(T, 'promo-small-440x280.png'));
  await shot(`${FONTS}<div style="width:1400px;height:560px;position:relative;overflow:hidden;${eclipseAt(1400, 560, 1020, 262, 0.95)}">
    <div style="position:absolute;left:96px;top:170px;color:#efe4cf">
      <div style="${serif}font-size:132px;line-height:.9">Totality</div>
      <div style="font-family:'Schibsted Grotesk',sans-serif;margin-top:22px;font-size:26px;color:#8f877a;max-width:520px;line-height:1.4">A true-black browser theme for OLED screens. Light only where it matters.</div>
    </div></div>`, 1400, 560, path.join(T, 'promo-marquee-1400x560.png'));
  // Icon: the eclipse, cropped tight, on a rounded black tile.
  await shot(`<div style="width:128px;height:128px;border-radius:28px;overflow:hidden;${eclipseAt(128, 128, 64, 64, 0.29)}"></div>`,
    128, 128, path.join(T, 'icon-128.png'));
}

// Theme screenshots from real browser windows (tools/theme_screens.mjs writes out/raw-*.png).
export async function renderThemeShots(shot, ROOT, HERE) {
  const T = path.join(ROOT, 'store/totality-theme');
  const ntp = dataUrl(path.join(HERE, 'out/raw-ntp.png'));
  // The real window, cropped above the news feed, with a caption below. Nothing is painted over.
  await shot(`${FONTS}<div style="width:1280px;height:800px;background:#000;position:relative;overflow:hidden">
    <div style="position:absolute;left:0;top:0;width:1280px;height:428px;background:url(${ntp}) 0 0 / 1280px 800px no-repeat"></div>
    <div style="position:absolute;left:0;right:0;top:428px;height:1px;background:#1f1d1a"></div>
    <div style="position:absolute;left:84px;top:500px;color:#efe4cf">
      <div style="font-family:'Instrument Serif',Georgia,serif;font-size:76px;line-height:1">An eclipse on every new tab</div>
      <div style="font-family:'Schibsted Grotesk',sans-serif;margin-top:20px;font-size:24px;line-height:1.5;color:#8f877a;max-width:980px">
        True black everywhere else, so OLED pixels stay off. To see the whole sky, hide the news feed from the new tab page's settings.</div>
    </div></div>`, 1280, 800, path.join(T, 'screenshot-1-new-tab.png'));
  fs.copyFileSync(path.join(HERE, 'out/raw-page.png'), path.join(T, 'screenshot-2-browsing.png'));
}
