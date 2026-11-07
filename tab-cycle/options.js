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

// ---------- Ctrl+Tab setup ----------
const isEdge = (navigator.userAgentData?.brands || []).some((b) => /Edge/i.test(b.brand)) || / Edg\//.test(navigator.userAgent);
const shortcutsUrl = (isEdge ? 'edge' : 'chrome') + '://extensions/shortcuts';
$('shortcutsUrl').textContent = shortcutsUrl;
$('openShortcuts').addEventListener('click', () => chrome.tabs.create({ url: shortcutsUrl }));

const id = chrome.runtime.id;
$('snippet').textContent =
`chrome.developerPrivate.updateExtensionCommand({ extensionId: "${id}", commandName: "cycle-forward", keybinding: "Ctrl+Tab" });
chrome.developerPrivate.updateExtensionCommand({ extensionId: "${id}", commandName: "cycle-backward", keybinding: "Ctrl+Shift+Tab" });`;

const flash = (btn, text) => { const old = btn.textContent; btn.textContent = text; setTimeout(() => (btn.textContent = old), 1200); };
$('copy').addEventListener('click', async () => { await navigator.clipboard.writeText($('snippet').textContent); flash($('copy'), 'Copied'); });

async function showShortcuts() {
  const cmds = await chrome.commands.getAll();
  const fwd = cmds.find((c) => c.name === 'cycle-forward')?.shortcut || '';
  const back = cmds.find((c) => c.name === 'cycle-backward')?.shortcut || '';
  const ctrlTab = /^Ctrl\+Tab$/i.test(fwd);
  $('status').classList.toggle('ok', ctrlTab);
  $('statusText').textContent = ctrlTab
    ? `Ctrl+Tab is set${back ? ` (and ${back} for the other direction)` : ''}. You're done.`
    : `Current shortcut: ${fwd || 'none'}. Follow the steps below to use Ctrl+Tab.`;
}
showShortcuts();
// Pick up a change made on the shortcuts page when the user comes back.
document.addEventListener('visibilitychange', () => { if (!document.hidden) showShortcuts(); });

// ---------- activity log ----------
async function showTrace() {
  const { trace = [] } = await chrome.storage.session.get('trace');
  if (trace.length) $('trace').textContent = trace.slice().reverse().join('\n');
}
showTrace();
chrome.storage.session.onChanged.addListener((c) => { if (c.trace) showTrace(); });
$('copyTrace').addEventListener('click', async () => { await navigator.clipboard.writeText($('trace').textContent); flash($('copyTrace'), 'Copied'); });
