// Public catalog + wishlist widget for The Poppy Creative marketing site.
// Reads the same IndexedDB database as the app (same origin). If the visitor's
// browser has never run the app, db.ready seeds the demo catalog automatically.
//
// Wishlist JSON produced on "Request a quote" (imported via Settings → Import
// wishlist):
//   { app:'poppyshuffle-wishlist', createdAt,
//     client:{name,email,phone}, eventDate,
//     items:[{itemId, name, qty}] }
import { db } from '../js/db.js';
import { fmtMoney, CATEGORIES } from '../js/schema.js';

const LS_KEY = 'ps-wishlist';

// ---- tiny DOM helper (this page does not use the app's h()) ----------------
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

// ---- wishlist state (localStorage) -----------------------------------------
function loadWishlist() {
  try {
    const v = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(v)
      ? v.filter(w => w && typeof w === 'object' && w.name)
          .map(w => ({ itemId: w.itemId ?? null, name: String(w.name), qty: Math.max(1, Math.round(Number(w.qty) || 1)) }))
      : [];
  } catch {
    return [];
  }
}

let wishlist = loadWishlist();

function saveWishlist() {
  localStorage.setItem(LS_KEY, JSON.stringify(wishlist));
  renderBar();
}

function addToWishlist(item) {
  const existing = wishlist.find(w => w.itemId === item.id);
  if (existing) existing.qty += 1;
  else wishlist.push({ itemId: item.id, name: item.name, qty: 1 });
  saveWishlist();
}

// ---- sticky bar ------------------------------------------------------------
const bar = document.getElementById('wishbar');
const countEl = document.getElementById('wish-count');

function renderBar() {
  const count = wishlist.reduce((s, w) => s + w.qty, 0);
  bar.classList.toggle('show', count > 0);
  countEl.textContent = count > 0
    ? `🧺 ${count} item${count === 1 ? '' : 's'} in your wishlist`
    : '';
}

// ---- quote request sheet ---------------------------------------------------
const overlay = document.getElementById('quote-overlay');
const sheetBody = document.getElementById('sheet-body');

function closeSheet() {
  overlay.hidden = true;
}
overlay.addEventListener('click', e => { if (e.target === overlay) closeSheet(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function openSheet() {
  sheetBody.replaceChildren(buildForm());
  overlay.hidden = false;
}
document.getElementById('quote-open').addEventListener('click', openSheet);

function buildWishRows() {
  const list = el('ul', { class: 'wish-list' });
  const redraw = () => {
    list.replaceChildren(...wishlist.map((w, i) =>
      el('li', null,
        el('span', { class: 'wname' }, w.name),
        el('button', { class: 'qty-btn', type: 'button', 'aria-label': `Fewer ${w.name}`,
          onClick: () => { w.qty -= 1; if (w.qty < 1) wishlist.splice(i, 1); saveWishlist(); wishlist.length ? redraw() : (closeSheet(), undefined); } }, '−'),
        el('span', { class: 'qtyv' }, String(w.qty)),
        el('button', { class: 'qty-btn', type: 'button', 'aria-label': `More ${w.name}`,
          onClick: () => { w.qty += 1; saveWishlist(); redraw(); } }, '+'),
        el('button', { class: 'rm-btn', type: 'button', 'aria-label': `Remove ${w.name}`,
          onClick: () => { wishlist.splice(i, 1); saveWishlist(); wishlist.length ? redraw() : (closeSheet(), undefined); } }, '✕'))));
  };
  redraw();
  return list;
}

function downloadWishlistFile(client, eventDate) {
  const payload = {
    app: 'poppyshuffle-wishlist',
    createdAt: new Date().toISOString(),
    client,
    eventDate,
    items: wishlist.map(w => ({ itemId: w.itemId, name: w.name, qty: w.qty })),
  };
  const stamp = new Date().toISOString().slice(0, 10);
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const a = el('a', { href: url, download: `poppy-wishlist-${stamp}.json` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildForm() {
  const name = el('input', { required: true, autocomplete: 'name', placeholder: 'Your name' });
  const email = el('input', { type: 'email', required: true, autocomplete: 'email', placeholder: 'you@example.com' });
  const phone = el('input', { type: 'tel', autocomplete: 'tel', placeholder: '(701) 555-0100' });
  const date = el('input', { type: 'date' });

  const form = el('form', {
    onSubmit: e => {
      e.preventDefault();
      if (!wishlist.length) { closeSheet(); return; }
      const client = { name: name.value.trim(), email: email.value.trim(), phone: phone.value.trim() };
      downloadWishlistFile(client, date.value || '');
      wishlist = [];
      saveWishlist();
      sheetBody.replaceChildren(buildThanks(client.name));
    },
  },
    el('h2', { id: 'sheet-title' }, 'Request a quote 🌸'),
    el('p', { class: 'sub' }, 'Tell us a little about you and your date — we’ll put together a custom quote for your wishlist.'),
    buildWishRows(),
    el('div', { class: 'fgrid' },
      el('label', { class: 'full' }, 'Name', name),
      el('label', null, 'Email', email),
      el('label', null, 'Phone', phone),
      el('label', { class: 'full' }, 'Event date (if you have one)', date)),
    el('div', { class: 'sheet-actions' },
      el('button', { class: 'ghost-btn', type: 'button', onClick: closeSheet }, 'Keep browsing'),
      el('button', { class: 'quote-btn', type: 'submit' }, 'Send my wishlist')));
  return form;
}

function buildThanks(firstName) {
  return el('div', { class: 'thanks' },
    el('div', { class: 'big' }, '💌'),
    el('h2', { id: 'sheet-title' }, `Thank you${firstName ? ', ' + firstName.split(' ')[0] : ''}!`),
    el('p', { class: 'sub' },
      'Your wishlist has been saved as a small file on your device — attach it in an email to hello@poppycreates.com and the Poppy team will follow up within one business day with a custom quote. (On the live site this is sent to us automatically.)'),
    el('div', { class: 'sheet-actions' },
      el('button', { class: 'quote-btn', type: 'button', onClick: closeSheet }, 'Back to the collections')));
}

// ---- catalog render --------------------------------------------------------
function unitLabel(item) {
  return item.unit || (item.type === 'space' ? 'per day' : 'per event');
}

function itemCard(item) {
  const btn = el('button', { class: 'add-btn', type: 'button' }, 'Add to wishlist');
  btn.addEventListener('click', () => {
    addToWishlist(item);
    btn.textContent = 'Added ✓';
    btn.classList.add('added');
    setTimeout(() => { btn.textContent = 'Add to wishlist'; btn.classList.remove('added'); }, 1200);
  });
  const swatch = /^#[0-9a-fA-F]{3,8}$/.test(item.color || '') ? item.color : '#E8B44F';
  return el('div', { class: 'item-card' },
    el('div', { class: 'thumb', style: `background:${swatch}33` }, item.imageEmoji || '🌸'),
    el('div', { class: 'item-body' },
      el('h3', null, item.name),
      el('p', { class: 'item-desc' }, item.description || ''),
      el('div', { class: 'price-row' },
        el('span', { class: 'price' }, fmtMoney(item.priceCents)),
        el('span', { class: 'unit' }, unitLabel(item))),
      btn));
}

async function renderCatalog() {
  const main = document.getElementById('catalog');
  try {
    await db.ready;
    const items = (await db.all('inventory')).filter(i => i.active);
    if (!items.length) {
      main.replaceChildren(el('p', { class: 'status-note' },
        'Our catalog is being restocked — check back soon! 🌷'));
      return;
    }
    const byCategory = new Map();
    for (const item of items) {
      const cat = item.category || 'More';
      if (!byCategory.has(cat)) byCategory.set(cat, []);
      byCategory.get(cat).push(item);
    }
    const ordered = [
      ...CATEGORIES.filter(c => byCategory.has(c)),
      ...[...byCategory.keys()].filter(c => !CATEGORIES.includes(c)),
    ];
    main.replaceChildren(...ordered.map(cat =>
      el('section', { class: 'cat-section' },
        el('h2', null, cat),
        el('div', { class: 'cat-rule' }),
        el('div', { class: 'grid' },
          byCategory.get(cat)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map(itemCard)))));
  } catch (err) {
    console.error(err);
    main.replaceChildren(el('p', { class: 'status-note' },
      'We couldn’t load the catalog in this browser. Please refresh, or reach us at hello@poppycreates.com.'));
  }
}

renderCatalog();
renderBar();
