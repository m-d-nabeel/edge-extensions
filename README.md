# Edge extensions

| Folder | Store name | What it is |
|---|---|---|
| `tab-cycle/` | **Ctrl+Tab Recent Tab Switcher (MRU)** | Ctrl+Tab in most-recently-used order, with a switcher panel |
| `amoled-theme/` | **AMOLED Pure Black Theme – Totality** | True-black OLED theme with an eclipse on the new tab page |

## Publishing
1. Run `tools/package.sh`. It creates the store zips in `dist/`, with `manifest.json` at the zip root and runtime files only.
2. Check them: `cd tools && npm install && node validate.mjs`. This loads the zips in Edge and fails on any manifest warning or runtime error.
3. Follow the field-by-field listing guides. Every text field, permission justification and graphic is ready there:
   - `store/tab-switcher/LISTING.md` covers **Edge Add-ons**, and optionally the Chrome Web Store.
   - `store/totality-theme/LISTING.md` covers the **Chrome Web Store**. Edge Add-ons doesn't take third-party themes.
4. `PRIVACY.md` is the privacy policy, published at https://github.com/m-d-nabeel/edge-extensions/blob/main/PRIVACY.md.

## Development
- **Install unpacked:** `edge://extensions` → Developer mode → Load unpacked → pick the folder.
- **Regenerate graphics:** run `node tools/render_assets.mjs`. It renders icons, logos, promo tiles and the "how it works" screenshot from HTML/SVG in `tools/art` and `tools/store_graphics.mjs`.
- **Real screenshots:**
  - `node tools/screenshots.mjs`: the switcher over live sites (headless).
  - `node tools/theme_screens.mjs`: real browser windows; needs a desktop session.
- **Eclipse artwork:** `python tools/render_totality.py` (needs numpy and Pillow).

## Ctrl+Tab Recent Tab Switcher: how it works
- **Tap Ctrl+Tab:** switches straight to your previous tab with no panel. Tap again to toggle back.
- **Hold Ctrl and press Tab again:** a panel shows your tabs with previews, most recent first. Tab and Shift+Tab move the selection.
- **Let go:** switches once, so the tabs you passed over keep their place in the history.
- **Cancel:** Esc, clicking outside the panel or Alt+Tab away.
- **Where the panel isn't possible** (address bar focused, `edge://` pages, the new tab page): the first press switches directly, and a second press while holding brings up the panel on the tab you landed on.
- **Default shortcut:** Alt+Q. Ctrl+Tab needs a one-time console step, which the settings page walks you through.
- **Troubleshooting:** Settings → Recent activity shows what each press did and why.

**Reliability details:**
- The panel only opens on a page that saw the modifier go down, because only that page is certain to see it come up.
- Release timing uses the background's own clock, never the page's.
- Backstops: moving the mouse over the panel with Ctrl already up switches, and the panel closes after 8 s.

**Security and privacy:**
- Only real key events count (`isTrusted`), so pages can't fake key presses.
- Page scripts can't see the extension's state or disable it.
- The switcher page uses a dynamic URL, so sites can't detect the extension.
- The panel accepts one connection per cycle, from its own page only, and checks every index it receives.
- Tab order, preview images and the activity log are memory-only (`storage.session`). At most 40 previews are kept, and none are taken in InPrivate windows.
- No network requests.

**Efficiency:**
- The content script only listens for key events.
- The background worker wakes on tab events and reads only small keys on wake; previews are loaded only when the panel opens.
- Preview images are decoded straight to thumbnail size, and capture is rate-limited.

**Tested** in Edge 157 (native Wayland, real kernel-level keystrokes via `/dev/uinput`, vertical tabs):
- tap
- hold
- fast Ctrl+Tab then Tab Tab
- address bar focused
- default Alt+Q
- Shift for the other direction
- Esc
- extension reload with tabs already open
- page-forged key events are ignored

## AMOLED Pure Black Theme – Totality
- **Browser frame, tabs and toolbar:** `#000`.
- **Text:** warm corona-white (`#EFE4CF`).
- **New tab page:** an eclipse (`amoled-theme/images/ntp.png`).

**What a theme can't change:**
- **Edge's own pages:** Settings and other `edge://` pages, menus and the sidebar follow Edge's built-in colour theme, which extensions can't reach.
- **Unfocused address bar:** stays `#212121`, derived by Edge.
- **Focus ring:** uses Edge's accent colour.

## Credits
Built with the help of Claude (Anthropic) as a coding assistant.
