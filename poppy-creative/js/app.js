// App shell: hash router, view registry, DOM + UI helpers.
import { db } from './db.js';
import { icon, VIEW_ICONS } from './icons.js';
export { fmtMoney, fmtDate } from './schema.js';
export { icon } from './icons.js';

import { applyDesign } from './design.js';

const views = new Map();
const NAV_ORDER = ['dashboard', 'projects', 'inventory', 'clients', 'calendar', 'reports', 'design', 'settings'];

export function registerView(name, view) { views.set(name, view); }

// Tiny hyperscript-style DOM builder.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = true;
      else if (k === 'selected') el.selected = true;
      else if (k === 'html') el.innerHTML = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function navigate(route) { location.hash = route.startsWith('#') ? route : `#${route}`; }

export function toast(msg, kind = 'ok') {
  const t = h('div', { class: `toast toast-${kind}` }, msg);
  document.getElementById('toasts').append(t);
  requestAnimationFrame(() => t.classList.add('show'));
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 350); }, 3200);
}

export function openModal({ title, body, actions = [], wide = false }) {
  closeModal();
  const overlay = h('div', { class: 'modal-overlay', onClick: e => { if (e.target === overlay) closeModal(); } },
    h('div', { class: `modal${wide ? ' modal-wide' : ''}`, role: 'dialog', 'aria-modal': 'true' },
      h('div', { class: 'modal-head' },
        h('h2', null, title),
        h('button', { class: 'icon-btn', 'aria-label': 'Close', onClick: closeModal }, '✕')),
      h('div', { class: 'modal-body' }, body),
      actions.length ? h('div', { class: 'modal-actions' },
        actions.map(a => h('button', {
          class: a.primary ? 'btn btn-primary' : (a.danger ? 'btn btn-danger' : 'btn'),
          onClick: () => a.onClick?.(),
        }, a.label))) : null,
    ));
  document.body.append(overlay);
  return overlay;
}

export function closeModal() { document.querySelector('.modal-overlay')?.remove(); }

export function confirmDialog(msg) {
  return new Promise(resolve => {
    openModal({
      title: 'Are you sure?',
      body: h('p', null, msg),
      actions: [
        { label: 'Cancel', onClick: () => { closeModal(); resolve(false); } },
        { label: 'Confirm', primary: true, onClick: () => { closeModal(); resolve(true); } },
      ],
    });
  });
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '') || 'dashboard';
  const [name, ...rest] = hash.split('/');
  return { name: views.has(name) ? name : 'dashboard', params: rest.filter(Boolean).map(decodeURIComponent) };
}

let renderSeq = 0;
async function renderCurrent() {
  const { name, params } = parseRoute();
  const seq = ++renderSeq;
  const view = views.get(name);
  const main = document.getElementById('view');
  document.querySelectorAll('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.view === name));
  const container = h('div', { class: `view view-${name}` });
  try {
    await view.render(container, params);
  } catch (err) {
    console.error(err);
    container.append(h('div', { class: 'card error-card' },
      h('h2', null, 'Something went wrong'), h('pre', null, String(err?.stack || err))));
  }
  if (seq !== renderSeq) return; // a newer navigation superseded this render
  main.replaceChildren(container);
  main.scrollTop = 0;
}

function buildNav() {
  const nav = document.getElementById('nav-links');
  nav.replaceChildren(...NAV_ORDER.filter(n => views.has(n)).map(n => {
    const v = views.get(n);
    return h('a', { class: 'nav-link', href: `#/${n}`, dataset: { view: n } },
      h('span', { class: 'nav-icon' }, VIEW_ICONS[n] ? icon(VIEW_ICONS[n], 20) : (v.icon || '•')),
      h('span', { class: 'nav-label' }, v.title));
  }));
}

export async function startApp() {
  await db.ready;
  buildNav();
  const settings = await db.get('settings', 'company');
  document.getElementById('brand-name').textContent = settings?.name || 'Poppy Creative';
  try { await applyDesign(await db.get('settings', 'design')); } catch (e) { console.warn('design apply failed', e); }
  db.onChange(async store => {
    if (store === 'settings') {
      try { await applyDesign(await db.get('settings', 'design')); } catch {}
    }
  });

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const root = document.documentElement;
    const next = root.dataset.mode === 'dark' ? 'light' : 'dark';
    root.dataset.mode = next;
    localStorage.setItem('ps-theme', next);
  });
  const saved = localStorage.getItem('ps-theme');
  if (saved) document.documentElement.dataset.mode = saved;

  document.getElementById('menu-toggle').addEventListener('click', () =>
    document.body.classList.toggle('nav-open'));
  document.getElementById('nav-links').addEventListener('click', () =>
    document.body.classList.remove('nav-open'));

  window.addEventListener('hashchange', renderCurrent);
  let pending = false;
  db.onChange(() => {
    if (pending) return;
    pending = true;
    setTimeout(() => { pending = false; renderCurrent(); }, 60);
  });
  await renderCurrent();
  document.getElementById('splash')?.remove();
}
