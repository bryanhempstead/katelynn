// Inventory view — catalog cards, category/search filters, availability check,
// add/edit modal. Owns no data shapes; see ARCHITECTURE.md for the contract.
import { registerView, h, openModal, closeModal, confirmDialog, toast, fmtMoney, icon } from '../app.js';
import { db } from '../db.js';
import { CATEGORIES, ITEM_TYPES, parseMoney, todayISO } from '../schema.js';
import { itemAvailabilityOn } from '../availability.js';

// Filter state survives re-renders (db.onChange re-renders the whole view).
const state = {
  category: 'All',
  search: '',
  dateFrom: todayISO(),
  dateTo: todayISO(),
};

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const SAFE_HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

function thumbBackground(color) {
  return SAFE_HEX.test(color || '')
    ? `color-mix(in srgb, ${color} 28%, var(--surface))`
    : 'var(--surface-2)';
}

function field(label, input, span2 = false) {
  return h('label', { class: `field${span2 ? ' span-2' : ''}` }, label, input);
}

function openItemModal(item) {
  const isNew = !item;
  const it = item || {
    name: '', category: CATEGORIES[0], type: 'rental', priceCents: 0,
    unit: 'per event', stockQty: 1, imageEmoji: '📦', color: '#8BA888',
    description: '', tags: [], active: true, notes: '',
  };

  const f = {
    name: h('input', { value: it.name || '', placeholder: 'Item name' }),
    category: h('select', null,
      CATEGORIES.map(c => h('option', { value: c, selected: c === it.category }, c))),
    type: h('select', null,
      ITEM_TYPES.map(t => h('option', { value: t, selected: t === it.type }, t))),
    price: h('input', { type: 'number', step: '0.01', min: '0', value: ((it.priceCents || 0) / 100).toFixed(2) }),
    unit: h('input', { value: it.unit || '', placeholder: 'per event' }),
    stockQty: h('input', { type: 'number', step: '1', min: '0', value: it.stockQty ?? 1 }),
    imageEmoji: h('input', { value: it.imageEmoji || '', placeholder: '📦' }),
    color: h('input', { type: 'color', value: HEX6.test(it.color || '') ? it.color : '#8BA888' }),
    description: h('textarea', { rows: 3 }, it.description || ''),
    tags: h('input', { value: (it.tags || []).join(', '), placeholder: 'boho, photo, lounge' }),
    active: h('input', { type: 'checkbox', checked: it.active !== false }),
    notes: h('textarea', { rows: 2 }, it.notes || ''),
  };

  const body = h('div', { class: 'form-grid' },
    field('Name', f.name, true),
    field('Category', f.category),
    field('Type', f.type),
    field('Price ($)', f.price),
    field('Unit', f.unit),
    field('Stock qty', f.stockQty),
    field('Emoji', f.imageEmoji),
    field('Card color', f.color),
    field('Description', f.description, true),
    field('Tags (comma separated)', f.tags, true),
    h('label', { class: 'check-row span-2' }, f.active, 'Active (visible in catalog)'),
    field('Notes', f.notes, true),
  );

  const actions = [];
  if (!isNew) {
    actions.push({
      label: 'Delete', danger: true,
      onClick: async () => {
        const ok = await confirmDialog(`Delete “${it.name}” from inventory? This cannot be undone.`);
        if (!ok) { openItemModal(item); return; }
        await db.remove('inventory', it.id);
        closeModal();
        toast('Item deleted');
      },
    });
  }
  actions.push({ label: 'Cancel', onClick: closeModal });
  actions.push({
    label: isNew ? 'Add item' : 'Save', primary: true,
    onClick: async () => {
      const name = f.name.value.trim();
      if (!name) { toast('Name is required', 'bad'); return; }
      const obj = {
        ...it,
        name,
        category: f.category.value,
        type: f.type.value,
        priceCents: parseMoney(f.price.value),
        unit: f.unit.value.trim() || 'per event',
        stockQty: Math.max(0, parseInt(f.stockQty.value, 10) || 0),
        imageEmoji: f.imageEmoji.value.trim() || '📦',
        color: f.color.value,
        description: f.description.value,
        tags: f.tags.value.split(',').map(s => s.trim()).filter(Boolean),
        active: f.active.checked,
        notes: f.notes.value,
      };
      await db.put('inventory', obj);
      closeModal();
      toast(isNew ? 'Item added' : 'Item saved');
    },
  });

  openModal({ title: isNew ? 'Add item' : `Edit — ${it.name}`, body, actions, wide: true });
}

registerView('inventory', {
  title: 'Inventory',
  icon: '📦',
  async render(el) {
    const items = await db.all('inventory');
    items.sort((a, b) =>
      (a.category || '').localeCompare(b.category || '') ||
      (a.name || '').localeCompare(b.name || ''));

    let drawSeq = 0;
    const gridWrap = h('div');
    const chipRow = h('div', { class: 'chip-row' });

    function drawChips() {
      chipRow.replaceChildren(...['All', ...CATEGORIES].map(c =>
        h('button', {
          type: 'button',
          class: `chip${state.category === c ? ' active' : ''}`,
          style: 'font-family:inherit',
          onClick: () => { state.category = c; drawChips(); drawGrid(); },
        }, c)));
    }

    async function drawGrid() {
      const seq = ++drawSeq;
      const q = state.search.trim().toLowerCase();
      const filtered = items.filter(it => {
        if (state.category !== 'All' && it.category !== state.category) return false;
        if (!q) return true;
        const hay = [it.name, it.category, it.description, (it.tags || []).join(' ')]
          .join(' ').toLowerCase();
        return hay.includes(q);
      });

      // Availability for the chosen range (only when both dates set).
      const availById = new Map();
      if (state.dateFrom && state.dateTo) {
        const from = state.dateFrom <= state.dateTo ? state.dateFrom : state.dateTo;
        const to = state.dateFrom <= state.dateTo ? state.dateTo : state.dateFrom;
        const results = await Promise.all(
          filtered.map(it => itemAvailabilityOn(it.id, from, to)));
        if (seq !== drawSeq) return; // superseded by a newer draw
        filtered.forEach((it, i) => availById.set(it.id, results[i]));
      }
      if (seq !== drawSeq) return;

      if (!filtered.length) {
        gridWrap.replaceChildren(h('div', { class: 'empty' },
          h('div', { class: 'big' }, icon('pot', 40)),
          h('p', null, 'No items match. Try another category or search.')));
        return;
      }

      gridWrap.replaceChildren(h('div', { class: 'cards-grid' }, filtered.map(it => {
        const inactive = it.active === false;
        const a = availById.get(it.id);
        let availLine = null;
        if (a) {
          const n = Math.max(0, a.available);
          const cls = n <= 0 ? ' stock-out' : (a.stock > 0 && n / a.stock < 0.3 ? ' stock-low' : '');
          availLine = h('div', { class: `stock-note${cls}` }, `${n} of ${a.stock} available`);
        }
        return h('div', {
          class: 'inv-card',
          style: inactive ? 'opacity:.55' : null,
          onClick: () => openItemModal(it),
        },
          h('div', { class: 'inv-thumb', style: `background:${thumbBackground(it.color)}` },
            it.imageEmoji || '📦'),
          h('div', { class: 'inv-body' },
            h('h3', null, it.name,
              inactive ? h('span', { class: 'badge', style: 'margin-left:.4rem' }, 'inactive') : null),
            h('div', { class: 'inv-meta' },
              h('span', null, it.category || '—'),
              h('span', { class: 'inv-price' }, `${fmtMoney(it.priceCents)} ${it.unit || ''}`.trim())),
            h('div', { class: 'stock-note' }, `${it.stockQty ?? 0} in stock`),
            availLine));
      })));
    }

    const searchInput = h('input', {
      type: 'search', placeholder: 'Search items…', value: state.search,
      onInput: e => { state.search = e.target.value; drawGrid(); },
    });
    const fromInput = h('input', {
      type: 'date', value: state.dateFrom,
      onChange: e => { state.dateFrom = e.target.value; drawGrid(); },
    });
    const toInput = h('input', {
      type: 'date', value: state.dateTo,
      onChange: e => { state.dateTo = e.target.value; drawGrid(); },
    });

    const toolbar = h('div', { class: 'card card-tight' },
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:.6rem;align-items:center' },
        chipRow,
        h('div', { style: 'flex:1 1 180px;min-width:150px' }, searchInput)),
      h('div', { style: 'display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin-top:.6rem' },
        h('span', { class: 'stock-note', style: 'font-weight:700' }, 'Check availability'),
        h('div', { style: 'flex:0 1 160px' }, fromInput),
        h('span', { class: 'stock-note' }, '→'),
        h('div', { style: 'flex:0 1 160px' }, toInput)));

    el.append(
      h('div', { class: 'view-head' },
        h('div', { class: 'grow' },
          h('h1', null, 'Inventory'),
          h('p', { class: 'subtitle' },
            `${items.length} item${items.length === 1 ? '' : 's'} in the catalog`)),
        h('button', { class: 'btn btn-primary', onClick: () => openItemModal(null) }, '+ Add item')),
      toolbar,
      gridWrap);

    drawChips();
    await drawGrid();
  },
});
