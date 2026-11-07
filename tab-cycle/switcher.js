// Switcher panel. Lives in an iframe inside the active page; the background
// worker drives it over a port (render / select), it reports clicks back.
const strip = document.getElementById('strip');
const panel = document.getElementById('panel');
const port = chrome.runtime.connect({ name: 'switcher' });
let tiles = [];

const favicon = (url) => {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', url || '');
  u.searchParams.set('size', '32');
  return u.href;
};

function render(items, index) {
  strip.textContent = '';
  tiles = items.map((it, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.id = 'tab-' + i;
    tile.setAttribute('role', 'option');

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    if (it.thumb) thumb.style.backgroundImage = `url("${it.thumb}")`;
    else {
      const big = document.createElement('img');
      big.className = 'big';
      big.src = favicon(it.url);
      thumb.append(big);
    }

    const meta = document.createElement('div');
    meta.className = 'meta';
    const icon = document.createElement('img');
    icon.src = favicon(it.url);
    // Fall back to the page's own icon URL, but only from safe schemes.
    const ownIcon = /^(https:|data:image\/)/.test(it.favIconUrl || '') ? it.favIconUrl : '';
    icon.onerror = () => { if (ownIcon && icon.src !== ownIcon) icon.src = ownIcon; else icon.remove(); };
    const title = document.createElement('span');
    title.className = 'title';
    title.textContent = it.title || it.url || 'Untitled';
    tile.title = title.textContent;
    meta.append(icon, title);

    tile.append(thumb, meta);
    tile.addEventListener('mousemove', () => {
      if (!mouseLive || tiles[i].classList.contains('sel')) return;
      select(i);
      port.postMessage({ type: 'hover', index: i });
    });
    tile.addEventListener('click', (e) => { e.stopPropagation(); port.postMessage({ type: 'pick', index: i }); });
    strip.append(tile);
    return tile;
  });
  document.getElementById('count').textContent = items.length === 1 ? '1 tab' : `${items.length} tabs`;
  select(index, false);
  requestAnimationFrame(() => panel.classList.add('ready'));
}

function select(index, smooth = true) {
  tiles.forEach((t, i) => {
    t.classList.toggle('sel', i === index);
    t.setAttribute('aria-selected', String(i === index));
  });
  // Not scrollIntoView(): that would also scroll the host page.
  const t = tiles[index];
  if (!t) return;
  panel.setAttribute('aria-activedescendant', t.id);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  strip.scrollTo({ left: t.offsetLeft - (strip.clientWidth - t.offsetWidth) / 2, behavior: smooth && !calm ? 'smooth' : 'instant' });
}

// The panel may pop up under a resting cursor; only real movement selects.
let mouseLive = false, origin = null;
let releaseSent = false;
document.addEventListener('mousemove', (e) => {
  if (!mouseLive) {
    origin ||= [e.screenX, e.screenY];
    if (Math.hypot(e.screenX - origin[0], e.screenY - origin[1]) > 6) mouseLive = true;
    return;
  }
  // Backstop: real mouse events carry the modifier state. If it's already up,
  // the keyup went somewhere we couldn't hear it — switch now.
  if (!e.ctrlKey && !e.altKey && !e.metaKey && !releaseSent) {
    releaseSent = true;
    port.postMessage({ type: 'released' });
  }
});

port.onMessage.addListener((msg) => {
  if (msg.type === 'render') render(msg.items, msg.index);
  else if (msg.type === 'select') select(msg.index);
});

// Clicking outside the panel cancels.
document.addEventListener('click', () => port.postMessage({ type: 'cancel' }));
panel.addEventListener('click', (e) => e.stopPropagation());
