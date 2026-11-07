// Content script (every frame, every page). Deliberately tiny: it only listens.
//  * Tracks whether the shortcut's modifier (Ctrl/Alt/Meta) is held in this frame
//    and reports when it's released — that's the moment the switch happens.
//  * Top frame only: hosts the switcher panel, an extension iframe inside a
//    closed shadow root, so page CSS/scripts can't reach into it and it never
//    takes focus.
// Only real (isTrusted) input counts, so a page can't fake key presses to drive it.
(() => {
  // Skip if a live copy is already running here (e.g. injected at install time).
  const existing = globalThis.__recentTabCycle;
  if (existing?.alive()) return;

  const life = new AbortController();
  const on = (type, fn) => window.addEventListener(type, fn, { capture: true, signal: life.signal });

  const IS_TOP = window === window.top;
  const SHOW_DELAY_MS = 90; // a quick tap switches without the panel flashing up
  const MODS = new Set(['Control', 'Alt', 'Meta', 'Shift']);

  let armed = false;   // a cycle involves this tab and is waiting for the release
  let held = false;    // modifier went down here and nothing else reached the page, i.e.
                       // the browser swallowed the combo (Ctrl+Tab does; Ctrl+C doesn't)
  let panel = null;    // shadow host of the switcher iframe
  let showTimer = 0;

  // After the extension is reloaded or updated, this copy is orphaned: its
  // chrome.runtime is gone. Notice that and get out of the way.
  const orphaned = () => { try { return !chrome.runtime?.id; } catch { return true; } };
  function shutdown() {
    life.abort();
    hidePanel();
  }
  const send = (msg) => {
    if (orphaned()) return shutdown();
    chrome.runtime.sendMessage(msg).catch(() => {});
  };
  const noModifiers = (e) => !e.ctrlKey && !e.altKey && !e.metaKey;

  function released() {
    armed = held = false;
    hidePanel(); // feels instant; the background switches and confirms
    send({ type: 'modifier-released' });
  }

  // ---------- input ----------
  on('keydown', (e) => {
    if (!e.isTrusted) return;
    if (MODS.has(e.key)) { if (!e.repeat && e.key !== 'Shift') held = true; return; }
    held = false;
    if (!armed) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopImmediatePropagation();
      armed = false; hidePanel();
      send({ type: 'switcher-cancel' });
    } else if (noModifiers(e)) {
      released(); // keyup was missed; a plain key proves the modifier is up
    }
  });

  on('keyup', (e) => {
    if (!e.isTrusted || e.key === 'Shift' || !MODS.has(e.key) || !noModifiers(e)) return;
    if (armed || held) released();
  });

  on('pointerdown', (e) => { if (e.isTrusted && armed && !panel && noModifiers(e)) released(); });

  on('blur', (e) => {
    if (!e.isTrusted) return;
    // Focus left the page (address bar, sidebar, another app): this frame won't
    // see the keyup, so stop claiming the modifier is held here.
    held = false;
    // Alt+Tab away cancels.
    if (!armed || !IS_TOP) return;
    setTimeout(() => {
      if (armed && !document.hasFocus()) { armed = false; hidePanel(); send({ type: 'switcher-cancel' }); }
    }, 0);
  });

  // The background reads this from every frame (scripting.executeScript runs in
  // this same isolated world, invisible to the page) before deciding whether to
  // show the panel: only a frame that saw the modifier go down will see it come up.
  globalThis.__recentTabCycle = {
    heldHere: () => held,
    alive: () => !life.signal.aborted && !orphaned(),
  };

  // ---------- panel ----------
  function showPanel() {
    if (panel || !IS_TOP || orphaned()) return;
    panel = document.createElement('recent-tab-cycle');
    panel.style.cssText =
      'all:initial!important;position:fixed!important;inset:0!important;' +
      'z-index:2147483647!important;display:block!important;';
    const root = panel.attachShadow({ mode: 'closed' });
    const frame = document.createElement('iframe');
    frame.src = chrome.runtime.getURL('switcher.html');
    frame.setAttribute('tabindex', '-1');
    frame.setAttribute('title', 'Recent tabs');
    // Same colour-scheme as the frame's document keeps the iframe transparent.
    frame.style.cssText =
      'all:initial;position:fixed;inset:0;width:100vw;height:100vh;border:0;' +
      'background:transparent;color-scheme:light;';
    root.append(frame);
    document.documentElement.append(panel);
  }
  function hidePanel() {
    clearTimeout(showTimer);
    panel?.remove();
    panel = null;
  }

  // ---------- messages from the background ----------
  chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    if (sender.id !== chrome.runtime.id || life.signal.aborted) return;
    switch (msg?.type) {
      case 'cycle-arm': // fallback mode: this tab was switched to mid-cycle
        armed = true;
        return;
      case 'switcher-open':
        if (!IS_TOP) return;
        armed = true;
        clearTimeout(showTimer);
        showTimer = setTimeout(showPanel, SHOW_DELAY_MS);
        reply({ ok: true });
        return;
      case 'switcher-close':
        armed = false;
        hidePanel();
        return;
    }
  });
})();
