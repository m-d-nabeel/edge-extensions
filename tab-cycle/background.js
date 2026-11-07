// Ctrl+Tab Recent Tab Switcher — background service worker.
//
// Per window we keep an MRU (most-recently-used) list of tab ids.
//
// Panel mode (normal web pages):
//   Ctrl+Tab opens a switcher panel over the page with the current tab first and
//   the previous one selected. More Tabs (Shift for backwards) move the selection;
//   no tab is touched until Ctrl is released, then we switch once. A quick tap
//   switches without the panel ever appearing. Esc / click outside / Alt+Tab cancel.
//
// Live mode (focus outside the page, edge:// pages, new tab page — places a page
// script can't see the keyboard): the first press switches tabs directly; a second
// press while the modifier is still held brings up the panel on the landed tab.
//
// Nothing leaves the browser: tab history, thumbnails and the activity log live
// in chrome.storage.session (memory only, cleared when the browser closes).

const DEFAULTS = { timeout: 900, commitOnRelease: true, panel: true, previews: true };
const PANEL_SAFETY_MS = 8000;    // panel mode: give up if the release never arrives
const RELEASE_RACE_MS = 150;     // a release received this soon before the command belongs to it
const THUMB_WIDTH = 400;
const THUMB_MAX = 40;            // thumbnails kept (least recently captured dropped)
const PANEL_THUMBS = 24;         // thumbnails sent to the panel
const TRACE_MAX = 60;

let settings = { ...DEFAULTS };

/** @type {Record<string, number[]>} windowId -> tab ids, most recent first */
let mru = {};
/** In-memory cache of thumbnails; the source of truth is storage.session. */
const thumbs = new Map();
/** Tab ids with a stored thumbnail, oldest capture first. */
let thumbOrder = [];
/** Activity log shown on the options page. */
let trace = [];

/**
 * @typedef {{windowId:number, list:number[], index:number, host:number,
 *   mode:'pending'|'panel'|'live', ready:Promise<void>, landed:number|null,
 *   timer:number, startedAt:number, port:chrome.runtime.Port|null, upgraded:boolean}} Cycle
 * @type {Cycle|null}
 */
let cycle = null;
let lastReleaseAt = 0;

const key = (windowId) => String(windowId);
const save = () => chrome.storage.session.set({ mru }).catch(() => {});

function touch(windowId, tabId) {
  const list = (mru[key(windowId)] ||= []);
  const i = list.indexOf(tabId);
  if (i === 0) return;
  if (i > 0) list.splice(i, 1);
  list.unshift(tabId);
  save();
}

function forget(tabId, windowId) {
  const k = key(windowId);
  if (mru[k]) mru[k] = mru[k].filter((id) => id !== tabId);
  save();
}

// ---------- startup ----------
// Runs every time the worker wakes, so it reads only small keys — never the thumbnails.
async function init() {
  const [stored, synced, tabs] = await Promise.all([
    chrome.storage.session.get(['mru', 'trace', 'thumbOrder']),
    chrome.storage.sync.get(DEFAULTS),
    chrome.tabs.query({}),
  ]);
  settings = { ...DEFAULTS, ...synced };
  trace = stored.trace || [];
  const alive = new Set(tabs.map((t) => t.id));
  thumbOrder = (stored.thumbOrder || []).filter((id) => alive.has(id));

  const prev = stored.mru || {};
  const byWin = {};
  for (const t of tabs) (byWin[key(t.windowId)] ||= []).push(t);
  const next = {};
  for (const [w, wtabs] of Object.entries(byWin)) {
    const inWin = new Set(wtabs.map((t) => t.id));
    const kept = (prev[w] || []).filter((id) => inWin.has(id));
    const keptSet = new Set(kept);
    // Tabs we haven't seen yet: order by Edge's own last-access time.
    const rest = wtabs
      .filter((t) => !keptSet.has(t.id))
      .sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))
      .map((t) => t.id);
    const list = [...kept, ...rest];
    const active = wtabs.find((t) => t.active);
    if (active && list[0] !== active.id) { list.splice(list.indexOf(active.id), 1); list.unshift(active.id); }
    next[w] = list;
  }
  mru = next;
  save();
}
const ready = init();

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
  // First install: show the setup page (Ctrl+Tab needs one manual step).
  if (reason === 'install') chrome.runtime.openOptionsPage();
  // Tabs that were already open don't have the content script yet.
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*', 'file:///*'] });
  for (const t of tabs) {
    if (t.discarded) continue;
    chrome.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: ['content.js'] }).catch(() => {});
  }
});

// ---------- diagnostics ----------
// What each Ctrl+Tab decided and why, shown on the options page. Hostnames only.
function note(text) {
  trace.push(`${new Date().toLocaleTimeString()}  ${text}`);
  if (trace.length > TRACE_MAX) trace = trace.slice(-TRACE_MAX);
  chrome.storage.session.set({ trace }).catch(() => {});
}
async function describe(tabId) {
  try {
    const t = await chrome.tabs.get(tabId);
    const url = t.url || t.pendingUrl || '';
    try { return new URL(url).host || url.split('?')[0]; } catch { return url.split('?')[0] || 'tab'; }
  } catch { return 'tab'; }
}

// ---------- thumbnails ----------
let captureTimer = 0;
let lastCaptureAt = 0;
function scheduleCapture(windowId, tabId, delay = 350) {
  if (!settings.previews) return;
  clearTimeout(captureTimer);
  captureTimer = setTimeout(() => capture(windowId, tabId), delay);
}
async function capture(windowId, tabId) {
  if (cycle) return scheduleCapture(windowId, tabId, 600); // never photograph the panel
  const wait = 550 - (Date.now() - lastCaptureAt);          // the browser allows ~2 captures/s
  if (wait > 0) return scheduleCapture(windowId, tabId, wait);
  const [active] = await chrome.tabs.query({ active: true, windowId }).catch(() => []);
  // Never capture InPrivate windows, or a tab that's still loading / no longer showing.
  if (!active || active.id !== tabId || active.status !== 'complete' || active.incognito) return;
  lastCaptureAt = Date.now();
  let url;
  try { url = await chrome.tabs.captureVisibleTab(windowId, { format: 'jpeg', quality: 70 }); } catch { return; }
  try {
    const blob = await (await fetch(url)).blob();
    // Decode straight to thumbnail size: far cheaper than decoding full size.
    const bmp = await createImageBitmap(blob, { resizeWidth: THUMB_WIDTH, resizeQuality: 'medium' });
    const canvas = new OffscreenCanvas(bmp.width, bmp.height);
    canvas.getContext('2d').drawImage(bmp, 0, 0);
    bmp.close();
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
    const bytes = new Uint8Array(await out.arrayBuffer());
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    storeThumb(tabId, 'data:image/jpeg;base64,' + btoa(bin));
  } catch { /* not fatal: the panel shows the site icon instead */ }
}
function storeThumb(tabId, data) {
  thumbs.set(tabId, data);
  thumbOrder = thumbOrder.filter((id) => id !== tabId);
  thumbOrder.push(tabId);
  const evicted = thumbOrder.length > THUMB_MAX ? thumbOrder.splice(0, thumbOrder.length - THUMB_MAX) : [];
  for (const id of evicted) thumbs.delete(id);
  chrome.storage.session.set({ ['thumb:' + tabId]: data, thumbOrder }).catch(() => {});
  if (evicted.length) chrome.storage.session.remove(evicted.map((id) => 'thumb:' + id)).catch(() => {});
}
function dropThumb(tabId) {
  thumbs.delete(tabId);
  if (!thumbOrder.includes(tabId)) return;
  thumbOrder = thumbOrder.filter((id) => id !== tabId);
  chrome.storage.session.remove('thumb:' + tabId).catch(() => {});
  chrome.storage.session.set({ thumbOrder }).catch(() => {});
}
async function clearThumbs() {
  const keys = thumbOrder.map((id) => 'thumb:' + id);
  thumbs.clear();
  thumbOrder = [];
  await chrome.storage.session.remove(keys).catch(() => {});
  await chrome.storage.session.set({ thumbOrder }).catch(() => {});
}
async function thumbsFor(ids) {
  const want = ids.filter((id) => thumbOrder.includes(id));
  const missing = want.filter((id) => !thumbs.has(id));
  if (missing.length) {
    const got = await chrome.storage.session.get(missing.map((id) => 'thumb:' + id)).catch(() => ({}));
    for (const id of missing) if (got['thumb:' + id]) thumbs.set(id, got['thumb:' + id]);
  }
  return new Map(want.map((id) => [id, thumbs.get(id)]));
}

// ---------- the cycle ----------
function armTimer(c, ms, commit) {
  clearTimeout(c.timer);
  c.timer = setTimeout(() => { if (cycle === c) { note(`timeout after ${ms} ms`); finish(commit); } }, ms);
}

function startCycle(windowId) {
  const list = (mru[key(windowId)] || []).slice();
  if (list.length < 2) return null;
  /** @type {Cycle} */
  const c = { windowId, list, index: 0, host: list[0], mode: 'pending', ready: null,
              landed: null, timer: 0, startedAt: Date.now(), port: null, upgraded: false };
  c.ready = (async () => {
    // Panel only if some frame of this page saw the modifier go down — then it
    // will also see it come up. Otherwise focus is in the address bar, sidebar,
    // DevTools… or the page can't be scripted (edge://, new tab page): a panel
    // there would never hear the release and get stuck, so switch live instead.
    if (!settings.panel) { c.mode = 'live'; note('start: live (panel turned off)'); return; }
    const [held, where] = await Promise.all([modifierHeldInPage(c.host), describe(c.host)]);
    if (held === true) {
      const r = await chrome.tabs.sendMessage(c.host, { type: 'switcher-open' }, { frameId: 0 }).catch(() => null);
      if (r) { c.mode = 'panel'; note(`start on ${where}: panel`); return; }
      note(`start on ${where}: live (page didn't answer)`);
    } else {
      note(`start on ${where}: live (${held === false ? "page didn't see the modifier go down — focus outside the page" : 'page not scriptable'})`);
    }
    c.mode = 'live';
  })();
  cycle = c;
  return c;
}

/** true / false, or null when the page can't be scripted (edge://, new tab page…). */
async function modifierHeldInPage(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: () => globalThis.__recentTabCycle?.heldHere() ?? null,
    });
    if (results.some((r) => r.result === true)) return true;
    return results.some((r) => r.result === false) ? false : null;
  } catch {
    return null;
  }
}

async function step(dir, windowId) {
  if (cycle && cycle.windowId !== windowId) await finish(cycle.mode === 'live');
  const c = cycle || startCycle(windowId);
  if (!c) return;
  const n = c.list.length;
  c.index = (((c.index + dir) % n) + n) % n;
  await c.ready;
  if (cycle !== c) return;

  if (c.mode === 'panel') {
    c.port?.postMessage({ type: 'select', index: c.index });
    armTimer(c, settings.commitOnRelease ? PANEL_SAFETY_MS : settings.timeout, !settings.commitOnRelease);
    return;
  }

  // ---- live ----
  // First press only: was the modifier already released when it arrived? Then
  // it's a quick tap. (Times are this worker's own clock; page clocks drift.)
  if (c.landed == null && settings.commitOnRelease && lastReleaseAt >= c.startedAt - RELEASE_RACE_MS) {
    note('released before the press was handled: quick tap');
    return finish(true);
  }

  // Another press while a live cycle is still open means the modifier is held:
  // that's "keep pressing Tab", so bring up the panel on the tab we're on.
  if (c.landed != null && settings.panel && !c.upgraded) {
    c.upgraded = true;
    const r = await chrome.tabs.sendMessage(c.landed, { type: 'switcher-open' }, { frameId: 0 }).catch(() => null);
    if (cycle !== c) return;
    if (r) {
      c.mode = 'panel';
      c.host = c.landed;
      note(`second press: switched to panel on ${await describe(c.host)}`);
      armTimer(c, settings.commitOnRelease ? PANEL_SAFETY_MS : settings.timeout, !settings.commitOnRelease);
      return;
    }
    note("second press: landed page can't show a panel, staying live");
  }

  const target = c.list[c.index];
  armTimer(c, settings.timeout, true);
  try {
    await chrome.tabs.update(target, { active: true });
    c.landed = target;
  } catch {
    forget(target, windowId); // tab vanished; skip it
    if (cycle !== c || c.list[c.index] !== target) return;
    c.list.splice(c.index, 1);
    if (dir > 0) c.index -= 1;
    return step(dir, windowId);
  }
  // Let the landed page report the release so we can end early. We don't wait
  // longer than the timeout for it: whether it will ever arrive can't be known
  // (document.hasFocus() reports true even while the address bar has focus).
  if (settings.commitOnRelease && cycle === c) chrome.tabs.sendMessage(target, { type: 'cycle-arm' }).catch(() => {});
}

/** End the cycle. commit=true switches to the selection; false cancels. */
async function finish(commit) {
  const c = cycle;
  if (!c) return;
  cycle = null;
  clearTimeout(c.timer);
  await c.ready;

  if (c.mode === 'panel') {
    chrome.tabs.sendMessage(c.host, { type: 'switcher-close' }).catch(() => {});
    try { c.port?.disconnect(); } catch {}
    const target = c.list[c.index];
    if (commit && target !== c.host) {
      await chrome.tabs.update(target, { active: true }).catch(() => forget(target, c.windowId));
    }
    note(commit ? `switched to ${await describe(target)} (${c.index} back)` : 'cancelled');
  } else if (commit && c.landed == null && c.index !== 0) {
    // live: the press was released before we even switched.
    await chrome.tabs.update(c.list[c.index], { active: true }).catch(() => {});
    note(`switched to ${await describe(c.list[c.index])}`);
  } else {
    note(`ended live cycle ${c.index} back`);
  }
  // Whatever is active now becomes the most recent tab.
  const [active] = await chrome.tabs.query({ active: true, windowId: c.windowId }).catch(() => []);
  if (active) touch(c.windowId, active.id);
}

// ---------- inputs ----------
chrome.commands.onCommand.addListener(async (command, tab) => {
  if (command !== 'cycle-forward' && command !== 'cycle-backward') return;
  await ready;
  let windowId = tab?.windowId;
  if (windowId == null) {
    const w = await chrome.windows.getLastFocused().catch(() => null);
    if (!w) return;
    windowId = w.id;
  }
  step(command === 'cycle-backward' ? -1 : 1, windowId);
});

// Only our own content scripts can reach this (no externally_connectable).
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (sender.id !== chrome.runtime.id || !sender.tab) return;
  if (msg?.type === 'modifier-released') {
    if (!settings.commitOnRelease) return;
    lastReleaseAt = Date.now(); // receipt time on our clock — never the page's
    if (cycle) { note('modifier released'); finish(true); }
  } else if (msg?.type === 'switcher-cancel') {
    if (cycle && sender.tab.id === cycle.host) { note('cancelled (Esc or focus lost)'); finish(false); }
  }
});

// The panel iframe connects here to get its contents.
const SWITCHER_PATH = '/switcher.html';
chrome.runtime.onConnect.addListener(async (port) => {
  if (port.name !== 'switcher') return;
  const c = cycle;
  const s = port.sender;
  let fromSwitcher = false;
  try { fromSwitcher = s?.id === chrome.runtime.id && new URL(s.url).pathname === SWITCHER_PATH; } catch {}
  // One panel per cycle, in the tab hosting it, from our own switcher page only.
  if (!c || c.mode !== 'panel' || c.port || !fromSwitcher || s.tab?.id !== c.host) { port.disconnect(); return; }
  c.port = port;
  port.onDisconnect.addListener(() => { if (c.port === port) c.port = null; });
  const valid = (i) => Number.isInteger(i) && i >= 0 && i < c.list.length;
  port.onMessage.addListener((msg) => {
    if (cycle !== c) return;
    if (msg?.type === 'hover' && valid(msg.index)) c.index = msg.index;
    else if (msg?.type === 'pick' && valid(msg.index)) { c.index = msg.index; finish(true); }
    else if (msg?.type === 'cancel') { note('cancelled (clicked outside)'); finish(false); }
    else if (msg?.type === 'released') { note('modifier released (seen via mouse)'); finish(true); }
  });

  const tabs = await chrome.tabs.query({ windowId: c.windowId });
  const byId = new Map(tabs.map((t) => [t.id, t]));
  c.list = c.list.filter((id) => byId.has(id));
  c.index = Math.min(c.index, c.list.length - 1);
  const shots = settings.previews ? await thumbsFor(c.list.slice(0, PANEL_THUMBS)) : new Map();
  const items = c.list.map((id) => {
    const t = byId.get(id);
    return { title: t.title || '', url: t.url || t.pendingUrl || '', favIconUrl: t.favIconUrl || '', thumb: shots.get(id) || null };
  });
  if (cycle === c) port.postMessage({ type: 'render', items, index: c.index });
});

// ---------- MRU bookkeeping ----------
chrome.tabs.onActivated.addListener(async ({ tabId, windowId }) => {
  await ready;
  if (cycle && cycle.windowId === windowId) {
    // Live mode switches tabs itself; finish() records where it ended.
    if (cycle.mode !== 'panel') return;
    // Panel mode never switches by itself: the user clicked a tab. Cancel.
    note('cancelled (another tab was selected)');
    finish(false);
  }
  touch(windowId, tabId);
  scheduleCapture(windowId, tabId);
});

// (Chromium has no event filter for onUpdated — passing one throws — so return fast.)
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status === 'complete' && tab.active) scheduleCapture(tab.windowId, tabId, 500);
});

chrome.tabs.onCreated.addListener(async (tab) => {
  await ready;
  const list = (mru[key(tab.windowId)] ||= []);
  if (!list.includes(tab.id)) { list.push(tab.id); save(); } // background tabs = least recent
});

chrome.tabs.onRemoved.addListener(async (tabId, { windowId, isWindowClosing }) => {
  await ready;
  dropThumb(tabId);
  if (cycle && cycle.windowId === windowId) {
    if (tabId === cycle.host && cycle.mode === 'panel') finish(false);
    else {
      const i = cycle.list.indexOf(tabId);
      if (i !== -1) { cycle.list.splice(i, 1); if (i <= cycle.index) cycle.index = Math.max(0, cycle.index - 1); }
    }
  }
  if (!isWindowClosing) forget(tabId, windowId);
});

chrome.tabs.onDetached.addListener(async (tabId, { oldWindowId }) => {
  await ready;
  if (cycle?.windowId === oldWindowId) finish(false);
  forget(tabId, oldWindowId);
});

chrome.tabs.onAttached.addListener(async (tabId, { newWindowId }) => {
  await ready;
  touch(newWindowId, tabId);
});

chrome.tabs.onReplaced.addListener(async (added, removed) => {
  await ready;
  for (const list of Object.values(mru)) {
    const i = list.indexOf(removed);
    if (i !== -1) list[i] = added;
  }
  dropThumb(removed);
  save();
});

chrome.windows.onRemoved.addListener(async (windowId) => {
  await ready;
  delete mru[key(windowId)];
  if (cycle?.windowId === windowId) { clearTimeout(cycle.timer); cycle = null; }
  save();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  for (const k of Object.keys(DEFAULTS)) if (changes[k]) settings[k] = changes[k].newValue ?? DEFAULTS[k];
  if (changes.previews && !settings.previews) clearThumbs();
});

// The toolbar button opens the settings page (shortcuts, options, activity log).
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());
