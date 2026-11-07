# Store listing: Ctrl+Tab Recent Tab Switcher (MRU)

**Package:** `dist/ctrl-tab-recent-tab-switcher-1.0.0.zip` (build with `tools/package.sh`)

**Where to submit:**
- **Microsoft Edge Add-ons** via Partner Center: https://partner.microsoft.com/dashboard/microsoftedge
- **Chrome Web Store** (optional, same zip): https://chrome.google.com/webstore/devconsole

---

## Name
Comes from the manifest: `Ctrl+Tab Recent Tab Switcher (MRU)`

## Short description
Comes from the manifest (122 chars):

> Ctrl+Tab through tabs in most recently used order. Tap to jump back to your last tab, hold to see every tab with previews.

## Description
Paste the following; it's 250–10,000 characters, as Edge requires.

```
Switch tabs the way you actually work: by when you last used them, not by where they sit in the tab strip.

TAP to go back
Press Ctrl+Tab and let go to jump to the tab you were just on. Press it again to flip back. Perfect for working between two tabs, like docs and code, or an email and a spreadsheet.

HOLD to see every tab
Keep Ctrl held and press Tab again. A panel appears with your tabs and page previews, most recent first. Keep pressing Tab to move through them, Shift+Tab to go back, then let go of Ctrl to switch. Esc cancels, and you can also click a tab.

Nothing switches until you let go, so the tabs you pass over keep their place in your history.

FEATURES
• Most-recently-used (MRU) tab order, kept separately for each window
• Instant toggle between your last two tabs
• Switcher panel with page previews, titles and site icons
• Works with vertical tabs and horizontal tabs
• Also works from the address bar and browser pages, switching directly there
• Ctrl+Tab, Alt+Q or any shortcut you like
• Dark, minimal design

SETTING UP CTRL+TAB
Browsers don't let extensions claim Ctrl+Tab from the regular shortcuts screen. The settings page that opens after install walks you through a one-time step (copy, paste into the console of the shortcuts page, done). Or keep the default Alt+Q.

PRIVATE BY DESIGN
• No accounts, no analytics, no ads, no network requests
• Tab history and previews stay in memory and are cleared when the browser closes
• Previews are never taken in InPrivate windows, and you can turn them off

Permissions explained:
• Read your browsing history / all sites: to know which tabs you've used, show their titles and previews, and notice when you let go of Ctrl on the page you're on. Nothing leaves your browser.
```

## Category
**Productivity**

## Search terms
Edge allows 7 terms, each 30 characters or fewer, 21 words in total. These use 18 words:
1. `ctrl tab`
2. `recent tabs`
3. `tab switcher`
4. `last used tab`
5. `mru tab order`
6. `switch between tabs`
7. `previous tab shortcut`

## Graphics
All files are in this folder.

| Edge field | File | Size |
|---|---|---|
| Extension logo (required) | `logo-300.png` | 300×300 |
| Small promotional tile | `promo-small-440x280.png` | 440×280 |
| Large promotional tile | `promo-marquee-1400x560.png` | 1400×560 |
| Screenshot 1 | `screenshot-1-switcher.png` | 1280×800 |
| Screenshot 2 | `screenshot-2-how-it-works.png` | 1280×800 |
| Screenshot 3 | `screenshot-3-settings.png` | 1280×800 |

For the Chrome Web Store:
- **Icon:** use `../../tab-cycle/icons/128.png`.
- **Small promo tile (required there):** `promo-small-440x280.png`.
- **Marquee:** `promo-marquee-1400x560.png`.

## Privacy tab

**Privacy policy URL:** https://github.com/m-d-nabeel/edge-extensions/blob/main/PRIVACY.md

**Website:** https://github.com/m-d-nabeel/edge-extensions

**Support contact:** md.nabeel.dev@gmail.com

**Single purpose:**
> Lets the user switch browser tabs in most-recently-used order with a keyboard shortcut (Ctrl+Tab), including a switcher panel that lists open tabs.

**Permission justifications:**

| Permission | Justification |
|---|---|
| `tabs` | Reads the open tabs' titles, URLs and favicons to list them in the switcher panel, and activates the tab the user picks. |
| `storage` | Saves the user's settings, and keeps the most-recently-used tab order and preview images in session (memory-only) storage, so it survives the background worker sleeping. |
| `scripting` | Checks, at the moment the shortcut is pressed, whether the current page saw the modifier key go down (to decide whether the panel can be shown there). Also adds the key-release listener to tabs that were already open at install. |
| `favicon` | Shows each tab's site icon in the switcher panel. |
| Host permission `<all_urls>` | The content script must run on every site to detect when the user releases Ctrl, which is when the switch happens. It's also required by `tabs.captureVisibleTab` to make the tab preview images. The script only listens for modifier key events and never reads or changes page content. |

**Remote code:** No. All code is in the package; no remote scripts, no `eval`.

**Data usage:**
- The extension does not collect or transmit any user data.
- It processes tab titles/URLs and preview images locally only, does not sell or transfer data to third parties, and does not use data for purposes unrelated to the single purpose.

## Notes for certification
Paste this into the field for testers:

```
No account or setup needed.

Default shortcut: Alt+Q (and Alt+Shift+Q for the other direction).
1. Open 3–4 normal websites in tabs, visiting them one after another.
2. Tap Alt+Q: switches to the previously used tab. Tap again: back.
3. Hold Alt, press Q three times, then let go of Alt: a panel with tab previews
   appears while Alt is held; releasing switches to the selected tab.
   Esc cancels.

The settings page opens on install. Its "Use Ctrl+Tab" section is optional:
it shows how a user can assign Ctrl+Tab themselves via the browser's own
extension shortcuts page. The extension never changes browser shortcuts by itself.

Note: on browser-internal pages (edge://..., the new tab page) the panel can't
be drawn, so the first press switches tabs directly; this is expected.
```

## Before you submit
- [x] Privacy policy is hosted at https://github.com/m-d-nabeel/edge-extensions/blob/main/PRIVACY.md
- [x] Support contact `md.nabeel.dev@gmail.com`, website https://github.com/m-d-nabeel/edge-extensions
- [ ] Run `tools/package.sh`, then upload `dist/ctrl-tab-recent-tab-switcher-1.0.0.zip`.
- [ ] Markets: all. Visibility: public.
