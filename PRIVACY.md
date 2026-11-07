# Privacy Policy

**Effective date:** November 8, 2026

This policy covers two browser add-ons by Md Nabeel:
- **Tab Cycle (MRU) – Switch Recent Tabs**, an extension
- **AMOLED Pure Black Theme – Totality**, a theme

## Summary
Neither add-on collects, transmits, sells or shares any data. There are no accounts, no analytics, no advertising and no remote servers. Everything described below stays inside your browser on your device.

## Tab Cycle (MRU) – Switch Recent Tabs

To switch tabs in recently used order, the extension works with the following information. All of it is processed locally:

| Data | Why it's needed | Where it's kept | How long |
|---|---|---|---|
| The order in which you used your tabs (tab ids) | To know which tab was used last | `chrome.storage.session` (memory only) | Until the browser closes |
| Tab titles, addresses and site icons | To show tabs in the switcher panel | Read when the panel opens, not stored | Not stored |
| Small preview images of tabs you've visited | To show thumbnails in the switcher panel | `chrome.storage.session` (memory only). At most 40 are kept, and they're deleted when a tab closes | Until the browser closes |
| A short activity log (time, site hostname, what the shortcut did) | To help you troubleshoot from the settings page | `chrome.storage.session` (memory only), last 60 entries | Until the browser closes |
| Your settings (for example, the timeout) | To remember your choices | `chrome.storage.sync` (synced by your browser if browser sync is on) | Until you remove the extension |

Other ways the extension limits what it handles:
- **Preview images:** never taken in InPrivate or Incognito windows, and you can turn them off on the settings page with "Show page previews". Turning them off deletes any already taken.
- **Web pages:** the extension adds a small script to the pages you visit. That script only watches whether a modifier key (Ctrl, Alt, Shift) is pressed or released, so the switch happens when you let go. It doesn't read or change page content, forms, passwords or anything you type.
- **No outside communication:** no data is sent to the developer or any third party. The extension makes no network requests.

## AMOLED Pure Black Theme – Totality
The theme only contains colours and an image. It has no code and cannot access any data.

## Changes
If this policy changes, the updated version will be published at this address with a new effective date.

## Contact
Questions: md.nabeel.dev@gmail.com
