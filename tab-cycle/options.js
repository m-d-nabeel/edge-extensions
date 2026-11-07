const DEFAULTS = { timeout: 900, commitOnRelease: true, panel: true, previews: true };
const $ = (id) => document.getElementById(id);

// ---------- settings ----------
chrome.storage.sync.get(DEFAULTS).then((s) => {
  for (const k of ['panel', 'previews', 'commitOnRelease']) $(k).checked = s[k];
  $('timeout').value = s.timeout;
});
for (const k of ['panel', 'previews', 'commitOnRelease']) {
  $(k).addEventListener('change', (e) => chrome.storage.sync.set({ [k]: e.target.checked }));
}
$('timeout').addEventListener('change', (e) => {
  const v = Math.min(5000, Math.max(200, Math.round(Number(e.target.value) || DEFAULTS.timeout)));
  e.target.value = v;
  chrome.storage.sync.set({ timeout: v });
});

// ---------- shortcut ----------
const isEdge = (navigator.userAgentData?.brands || []).some((b) => /Edge/i.test(b.brand)) || / Edg\//.test(navigator.userAgent);
const shortcutsUrl = (isEdge ? 'edge' : 'chrome') + '://extensions/shortcuts';
for (const el of document.querySelectorAll('.shortcutsUrl')) el.textContent = shortcutsUrl;
for (const id of ['openShortcuts', 'openShortcuts2']) $(id).addEventListener('click', () => chrome.tabs.create({ url: shortcutsUrl }));

const flash = (btn, text) => { const old = btn.textContent; btn.textContent = text; setTimeout(() => (btn.textContent = old), 1200); };

async function showShortcuts() {
  const cmds = await chrome.commands.getAll();
  const fwd = cmds.find((c) => c.name === 'cycle-forward')?.shortcut || '';
  const back = cmds.find((c) => c.name === 'cycle-backward')?.shortcut || '';
  $('statusText').textContent = fwd
    ? `Your shortcut: ${fwd}${back ? ` (${back} for the other direction)` : ''}`
    : 'No shortcut set. Use "Change shortcut" to pick one.';
  // Make the explanation match the shortcut actually in use.
  if (fwd) {
    const parts = fwd.split('+');
    const key = parts.pop();
    for (const el of document.querySelectorAll('.sc-full')) el.textContent = fwd;
    for (const el of document.querySelectorAll('.sc-mod')) el.textContent = parts.join('+');
    for (const el of document.querySelectorAll('.sc-key')) el.textContent = key;
  }
  if (/^Ctrl\+Tab$/i.test(fwd)) $('advanced').querySelector('summary').textContent = 'Advanced: Ctrl+Tab is in use';
}
showShortcuts();
// Pick up a change made on the shortcuts page when the user comes back.
document.addEventListener('visibilitychange', () => { if (!document.hidden) showShortcuts(); });

// ---------- advanced: Ctrl+Tab ----------
const id = chrome.runtime.id;
$('snippet').textContent =
`chrome.developerPrivate.updateExtensionCommand({ extensionId: "${id}", commandName: "cycle-forward", keybinding: "Ctrl+Tab" });
chrome.developerPrivate.updateExtensionCommand({ extensionId: "${id}", commandName: "cycle-backward", keybinding: "Ctrl+Shift+Tab" });`;
$('copy').addEventListener('click', async () => { await navigator.clipboard.writeText($('snippet').textContent); flash($('copy'), 'Copied'); });

// ---------- activity log ----------
async function showTrace() {
  const { trace = [] } = await chrome.storage.session.get('trace');
  if (trace.length) $('trace').textContent = trace.slice().reverse().join('\n');
}
showTrace();
chrome.storage.session.onChanged.addListener((c) => { if (c.trace) showTrace(); });
$('copyTrace').addEventListener('click', async () => { await navigator.clipboard.writeText($('trace').textContent); flash($('copyTrace'), 'Copied'); });
