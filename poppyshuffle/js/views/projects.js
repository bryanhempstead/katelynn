// Projects view — pipeline list + project detail (the quote builder). Owner: Agent C.
import { registerView, h, navigate, toast, openModal, closeModal, confirmDialog } from '../app.js';
import { db } from '../db.js';
import {
  fmtMoney, parseMoney, fmtDate, todayISO, projectTotals, nextQuoteNumber,
  PROJECT_STATUSES, STATUS_META, PAYMENT_METHODS, PAYMENT_KINDS, CATEGORIES,
} from '../schema.js';
import { openDoc } from '../docs.js';

// Defensive wrapper around the peer-owned availability engine. A lazy dynamic
// import means a missing/broken availability.js can never crash this view.
async function safeCheckProject(project) {
  try {
    const mod = await import('../availability.js');
    if (typeof mod.checkProject !== 'function') return [];
    return (await mod.checkProject(project)) || [];
  } catch (err) {
    console.warn('Availability check skipped:', err);
    return [];
  }
}

function statusBadge(status) {
  const meta = STATUS_META[status] || { label: status || '—', color: 'var(--muted)' };
  return h('span', { class: 'badge', style: `background:${meta.color}` }, meta.label);
}

registerView('projects', {
  title: 'Projects',
  icon: '🎪',
  async render(el, params) {
    if (params && params[0]) return renderDetail(el, params[0]);
    return renderList(el);
  },
});

/* ------------------------------------------------------------------ LIST */

async function renderList(el) {
  const [projects, clients, settings, payments] = await Promise.all([
    db.all('projects'), db.all('clients'), db.get('settings', 'company'), db.all('payments'),
  ]);
  projects.sort((a, b) => (b.eventDate || '').localeCompare(a.eventDate || ''));
  const clientById = new Map(clients.map(c => [c.id, c]));

  let statusFilter = 'all';
  let search = '';
  const chipRow = h('div', { class: 'chip-row', style: 'margin-bottom:.8rem' });
  const tableWrap = h('div');

  el.append(
    h('div', { class: 'view-head' },
      h('div', { class: 'grow' },
        h('h1', null, 'Projects'),
        h('p', { class: 'subtitle' },
          `${projects.length} project${projects.length === 1 ? '' : 's'} in the pipeline`)),
      h('input', {
        type: 'search', placeholder: 'Search projects…', style: 'max-width:220px',
        'aria-label': 'Search projects',
        onInput: e => { search = e.target.value.trim().toLowerCase(); renderTable(); },
      }),
      h('button', { class: 'btn btn-primary', onClick: newProjectModal }, '+ New project')),
    h('div', { class: 'stat-grid' }, PROJECT_STATUSES.map(s => {
      const ps = projects.filter(p => p.status === s);
      const value = ps.reduce((sum, p) => sum + projectTotals(p, settings).total, 0);
      return h('div', {
        class: 'stat', style: 'cursor:pointer', title: `Filter by ${STATUS_META[s].label}`,
        onClick: () => setFilter(statusFilter === s ? 'all' : s),
      },
        h('div', { class: 'stat-label' },
          h('span', { style: `display:inline-block;width:.6em;height:.6em;border-radius:99px;background:${STATUS_META[s].color};margin-right:.4em` }),
          STATUS_META[s].label),
        h('div', { class: 'stat-value' }, String(ps.length)),
        h('div', { class: 'stat-sub' }, fmtMoney(value)));
    })),
    chipRow,
    tableWrap,
  );
  renderChips();
  renderTable();

  function setFilter(s) { statusFilter = s; renderChips(); renderTable(); }

  function renderChips() {
    chipRow.replaceChildren(
      h('button', { class: `chip${statusFilter === 'all' ? ' active' : ''}`, onClick: () => setFilter('all') }, 'All'),
      ...PROJECT_STATUSES.map(s =>
        h('button', { class: `chip${statusFilter === s ? ' active' : ''}`, onClick: () => setFilter(s) },
          STATUS_META[s].label)));
  }

  function renderTable() {
    const list = projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!search) return true;
      const cl = clientById.get(p.clientId);
      return [p.name, p.quoteNumber, p.venue, cl?.name, cl?.company]
        .some(v => (v || '').toLowerCase().includes(search));
    });

    if (!projects.length) {
      tableWrap.replaceChildren(h('div', { class: 'empty' },
        h('div', { class: 'big' }, '🎪'),
        h('p', null, 'No projects yet — create your first quote to get the party started.')));
      return;
    }
    if (!list.length) {
      tableWrap.replaceChildren(h('div', { class: 'empty' },
        h('p', null, 'No projects match the current filter.')));
      return;
    }

    tableWrap.replaceChildren(h('div', { class: 'card card-tight' },
      h('div', { class: 'table-scroll' },
        h('table', { class: 'data' },
          h('thead', null, h('tr', null,
            h('th', null, 'Quote #'), h('th', null, 'Name'), h('th', null, 'Client'),
            h('th', null, 'Event date'), h('th', null, 'Status'),
            h('th', { class: 'num' }, 'Total'), h('th', { class: 'num' }, 'Paid'),
            h('th', { class: 'num' }, 'Balance'))),
          h('tbody', null, list.map(p => {
            const t = projectTotals(p, settings, payments);
            const cl = clientById.get(p.clientId);
            return h('tr', { class: 'rowlink', onClick: () => navigate(`#/projects/${p.id}`) },
              h('td', null, p.quoteNumber || '—'),
              h('td', null, h('strong', null, p.name || 'Untitled')),
              h('td', null, cl?.name || '—'),
              h('td', null, fmtDate(p.eventDate)),
              h('td', null, statusBadge(p.status)),
              h('td', { class: 'num' }, fmtMoney(t.total)),
              h('td', { class: 'num' }, fmtMoney(t.paid)),
              h('td', { class: 'num' },
                h('strong', null, fmtMoney(t.balanceDue))));
          }))))));
  }

  function newProjectModal() {
    const nameIn = h('input', { type: 'text', placeholder: 'e.g. Nelson 30th Birthday' });
    const clientSel = h('select', null,
      h('option', { value: '' }, '— No client yet —'),
      clients.slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        .map(c => h('option', { value: c.id }, c.name)));
    const dateIn = h('input', { type: 'date', value: todayISO() });

    openModal({
      title: 'New project',
      body: h('div', { class: 'form-grid' },
        h('label', { class: 'field span-2' }, 'Project name *', nameIn),
        h('label', { class: 'field' }, 'Client', clientSel),
        h('label', { class: 'field' }, 'Event date', dateIn)),
      actions: [
        { label: 'Cancel', onClick: closeModal },
        {
          label: 'Create project', primary: true,
          onClick: async () => {
            const name = nameIn.value.trim();
            if (!name) { toast('Project name is required.', 'bad'); return; }
            const eventDate = dateIn.value || todayISO();
            const proj = {
              name, clientId: clientSel.value || null, status: 'lead',
              eventDate, endDate: eventDate,
              startTime: '', endTime: '', venue: '', inHouse: false,
              lines: [], discountCents: 0, notes: '',
              quoteNumber: nextQuoteNumber(projects), signature: null,
              createdAt: new Date().toISOString(),
            };
            await db.put('projects', proj);
            closeModal();
            toast('Project created');
            navigate(`#/projects/${proj.id}`);
          },
        },
      ],
    });
  }
}

/* ---------------------------------------------------------------- DETAIL */

async function renderDetail(el, id) {
  const [project, settings, allPayments, inventory, clients] = await Promise.all([
    db.get('projects', id), db.get('settings', 'company'),
    db.all('payments'), db.all('inventory'), db.all('clients'),
  ]);

  if (!project) {
    el.append(h('div', { class: 'empty' },
      h('div', { class: 'big' }, '🎪'),
      h('p', null, 'Project not found — it may have been deleted.'),
      h('p', null, h('a', { href: '#/projects' }, '← Back to projects'))));
    return;
  }

  const client = clients.find(c => c.id === project.clientId) || null;
  const payments = allPayments.filter(p => p.projectId === id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const totals = projectTotals(project, settings, allPayments);
  const conflicts = await safeCheckProject(project);

  // Every save triggers db.onChange -> the whole view re-renders with fresh data.
  async function save(patch) {
    if (patch) Object.assign(project, patch);
    await db.put('projects', project);
  }

  /* ---- head ---- */
  const statusSel = h('select', {
    style: 'width:auto', 'aria-label': 'Project status',
    onChange: e => save({ status: e.target.value }),
  }, PROJECT_STATUSES.map(s =>
    h('option', { value: s, selected: project.status === s }, STATUS_META[s].label)));

  el.append(h('div', { class: 'view-head' },
    h('div', { class: 'grow' },
      h('p', { class: 'subtitle', style: 'margin-bottom:.15rem' },
        h('a', { href: '#/projects' }, '← All projects')),
      h('h1', { style: 'cursor:pointer', title: 'Click to rename', onClick: renameModal },
        project.name, ' ',
        h('span', { style: 'font-size:.85rem;color:var(--muted)' }, '✎')),
      h('p', { class: 'subtitle' },
        project.quoteNumber || '—',
        client ? ` · ${client.name}` : ' · No client',
        client?.email ? ` · ${client.email}` : '',
        client?.phone ? ` · ${client.phone}` : '')),
    h('button', {
      class: 'btn btn-sm', title: 'Copy this project as a new lead',
      onClick: duplicateProject,
    }, '⧉ Duplicate'),
    h('label', { class: 'field' }, 'Status', statusSel)));

  async function duplicateProject() {
    const projects = await db.all('projects');
    const copy = {
      // no id — db.put assigns a fresh one
      name: `${project.name} (copy)`,
      clientId: project.clientId,
      status: 'lead',
      eventDate: '', endDate: '',          // repeat bookings almost always shift dates
      startTime: project.startTime || '', endTime: project.endTime || '',
      venue: project.venue || '',
      inHouse: !!project.inHouse,
      lines: (project.lines || []).map(l => ({ ...l })),
      discountCents: project.discountCents || 0,
      notes: project.notes || '',
      quoteNumber: nextQuoteNumber(projects),
      signature: null,
      createdAt: new Date().toISOString(),
    };
    await db.put('projects', copy);
    toast('Project duplicated');
    navigate(`#/projects/${copy.id}`);
  }

  /* ---- event details card ---- */
  const evIn = h('input', { type: 'date', value: project.eventDate || '' });
  const endIn = h('input', { type: 'date', value: project.endDate || '' });
  const startIn = h('input', { type: 'time', value: project.startTime || '' });
  const endTimeIn = h('input', { type: 'time', value: project.endTime || '' });
  const venueIn = h('input', { type: 'text', value: project.venue || '', placeholder: 'The Meadow, off-site address…' });
  const inHouseCb = h('input', { type: 'checkbox', checked: project.inHouse });
  const notesIn = h('textarea', { rows: '2', value: project.notes || '' });

  el.append(h('div', { class: 'card' },
    h('h2', null, 'Event details'),
    h('div', { class: 'form-grid' },
      h('label', { class: 'field' }, 'Event date', evIn),
      h('label', { class: 'field' }, 'End date', endIn),
      h('label', { class: 'field' }, 'Start time', startIn),
      h('label', { class: 'field' }, 'End time', endTimeIn),
      h('label', { class: 'field span-2' }, 'Venue', venueIn),
      h('label', { class: 'check-row span-2' }, inHouseCb,
        `Hosted in-house at ${settings?.name || 'The Poppy Creative'} (${settings?.inHouseDiscountPct ?? 70}% rental discount)`),
      h('label', { class: 'field span-2' }, 'Notes', notesIn)),
    h('div', { style: 'margin-top:.7rem' },
      h('button', {
        class: 'btn btn-primary',
        onClick: async () => {
          const eventDate = evIn.value || project.eventDate || todayISO();
          let endDate = endIn.value || eventDate;
          if (endDate < eventDate) endDate = eventDate;
          await save({
            eventDate, endDate,
            startTime: startIn.value, endTime: endTimeIn.value,
            venue: venueIn.value.trim(), inHouse: inHouseCb.checked,
            notes: notesIn.value,
          });
          toast('Event details saved');
        },
      }, 'Save event details'))));

  /* ---- line items card (with availability conflicts) ---- */
  const conflictEls = conflicts.map(c => h('div', {
    class: c.severity === 'hard' ? 'conflict conflict-hard' : 'conflict',
  }, `⚠ ${c.name}: ${c.requested} requested, only ${c.stock} in stock` +
     ` (${c.hardBooked} held by signed projects` +
     `${c.softBooked ? `, ${c.softBooked} in open quotes` : ''})`));

  const lines = project.lines || (project.lines = []);
  el.append(h('div', { class: 'card' },
    h('div', { class: 'view-head', style: 'margin-bottom:.4rem' },
      h('h2', { class: 'grow', style: 'margin:0' }, 'Line items'),
      h('button', { class: 'btn btn-sm', onClick: addCustomLine }, '+ Custom line'),
      h('button', { class: 'btn btn-primary btn-sm', onClick: openPicker }, '+ Add item')),
    conflictEls,
    lines.length
      ? h('div', { class: 'table-scroll' },
        h('table', { class: 'data' },
          h('thead', null, h('tr', null,
            h('th', null, 'Item'), h('th', { class: 'num' }, 'Qty'),
            h('th', { class: 'num' }, 'Unit price'), h('th', { class: 'num' }, 'Line total'),
            h('th', null, ''))),
          h('tbody', null, lines.map((line, i) => h('tr', null,
            h('td', null, line.itemId
              ? h('span', null, line.name,
                  line.type !== 'rental' ? h('span', { class: 'stock-note' }, ` · ${line.type}`) : null)
              : h('input', {
                  type: 'text', value: line.name, 'aria-label': 'Custom item name',
                  onChange: e => { line.name = e.target.value.trim() || 'Custom item'; save(); },
                })),
            h('td', { class: 'num' }, h('input', {
              type: 'number', min: '1', step: '1', value: line.qty,
              style: 'width:72px;text-align:right', 'aria-label': 'Quantity',
              onChange: e => {
                line.qty = Math.max(1, Math.round(Number(e.target.value)) || 1);
                save();
              },
            })),
            h('td', { class: 'num' }, h('input', {
              type: 'text', inputmode: 'decimal',
              value: ((line.priceCents || 0) / 100).toFixed(2),
              style: 'width:92px;text-align:right', 'aria-label': 'Unit price in dollars',
              onChange: e => { line.priceCents = Math.max(0, parseMoney(e.target.value)); save(); },
            })),
            h('td', { class: 'num' }, fmtMoney((line.priceCents || 0) * (line.qty || 0))),
            h('td', { class: 'num' }, h('button', {
              class: 'icon-btn', 'aria-label': `Remove ${line.name}`, title: 'Remove line',
              onClick: () => { lines.splice(i, 1); save(); },
            }, '✕')))))))
      : h('div', { class: 'empty' },
        h('div', { class: 'big' }, '🛋️'),
        h('p', null, 'No line items yet — add spaces, rentals, or services from inventory.'))));

  function addCustomLine() {
    lines.push({ itemId: null, name: 'Custom item', qty: 1, priceCents: 0, type: 'rental' });
    save();
  }

  function openPicker() {
    const active = inventory.filter(it => it.active !== false);
    let q = '';
    const listEl = h('div');

    const renderItems = () => {
      const match = active.filter(it => !q ||
        `${it.name} ${it.category} ${(it.tags || []).join(' ')}`.toLowerCase().includes(q));
      if (!match.length) {
        listEl.replaceChildren(h('div', { class: 'empty' }, 'No inventory items match.'));
        return;
      }
      const cats = [
        ...CATEGORIES.filter(c => match.some(it => it.category === c)),
        ...[...new Set(match.map(it => it.category))].filter(c => !CATEGORIES.includes(c)),
      ];
      listEl.replaceChildren(...cats.flatMap(cat => [
        h('h3', { style: 'margin:.8rem 0 .2rem' }, cat),
        h('div', { class: 'table-scroll' }, h('table', { class: 'data' },
          h('tbody', null, match.filter(it => it.category === cat).map(it =>
            h('tr', { class: 'rowlink', onClick: () => addItem(it) },
              h('td', { style: 'width:2.2rem;font-size:1.2rem' }, it.imageEmoji || '📦'),
              h('td', null, h('strong', null, it.name),
                h('div', { class: 'stock-note' }, `${it.stockQty ?? '—'} in stock`)),
              h('td', { class: 'num' },
                h('strong', null, fmtMoney(it.priceCents)),
                h('div', { class: 'stock-note' }, it.unit || ''))))))),
      ]));
    };
    renderItems();

    async function addItem(it) {
      const existing = lines.find(l => l.itemId === it.id);
      if (existing) existing.qty += 1;
      else lines.push({ itemId: it.id, name: it.name, qty: 1, priceCents: it.priceCents || 0, type: it.type || 'rental' });
      await save();
      toast(existing ? `${it.name} ×${existing.qty}` : `Added ${it.name}`);
    }

    openModal({
      wide: true,
      title: 'Add from inventory',
      body: h('div', null,
        h('input', {
          type: 'search', placeholder: 'Search inventory…', 'aria-label': 'Search inventory',
          onInput: e => { q = e.target.value.trim().toLowerCase(); renderItems(); },
        }),
        listEl),
      actions: [{ label: 'Done', primary: true, onClick: closeModal }],
    });
  }

  /* ---- totals card ---- */
  const discountIn = h('input', {
    type: 'text', inputmode: 'decimal',
    value: ((project.discountCents || 0) / 100).toFixed(2),
    style: 'width:100px;text-align:right', 'aria-label': 'Manual discount in dollars',
    onChange: e => save({ discountCents: Math.max(0, parseMoney(e.target.value)) }),
  });
  const trow = (label, val, { bold = false, accent = false } = {}) => h('tr', null,
    h('td', { style: bold ? 'font-weight:700' : '' }, label),
    h('td', {
      class: 'num',
      style: `${bold ? 'font-weight:700;' : ''}${accent ? 'color:var(--poppy);' : ''}`,
    }, val));

  el.append(h('div', { class: 'card' },
    h('h2', null, 'Totals'),
    h('div', { class: 'table-scroll' }, h('table', { class: 'data' }, h('tbody', null,
      trow('Subtotal', fmtMoney(totals.subtotal)),
      project.inHouse
        ? trow(`In-house rental discount (${settings?.inHouseDiscountPct ?? 0}%)`,
            `−${fmtMoney(totals.inHouseDiscount)}`)
        : null,
      h('tr', null,
        h('td', null, 'Manual discount ($)'),
        h('td', { class: 'num' }, discountIn)),
      trow(`Tax (${settings?.taxPct ?? 0}%)`, fmtMoney(totals.tax)),
      trow('TOTAL', fmtMoney(totals.total), { bold: true }),
      trow(`Deposit due (${settings?.depositPct ?? 50}%)`, fmtMoney(totals.depositDue)),
      trow('Payments applied', `−${fmtMoney(totals.paid)}`),
      trow('Balance due', fmtMoney(totals.balanceDue), { bold: true, accent: totals.balanceDue > 0 })))),
    totals.balanceDueDate
      ? h('p', { class: 'subtitle', style: 'text-align:right;margin-top:.4rem' },
          `Balance due by ${fmtDate(totals.balanceDueDate)}`)
      : null));

  /* ---- payments card ---- */
  const depositRemaining = Math.max(0, totals.depositDue - totals.paid);
  el.append(h('div', { class: 'card' },
    h('div', { class: 'view-head', style: 'margin-bottom:.4rem' },
      h('h2', { class: 'grow', style: 'margin:0' }, 'Payments'),
      depositRemaining > 0
        ? h('button', {
            class: 'btn btn-sm',
            onClick: () => paymentModal({
              amountCents: depositRemaining, kind: 'deposit',
              note: `${settings?.depositPct ?? 50}% deposit`,
            }),
          }, `Record deposit (${fmtMoney(depositRemaining)})`)
        : null,
      h('button', { class: 'btn btn-primary btn-sm', onClick: () => paymentModal() }, '+ Record payment')),
    payments.length
      ? h('div', { class: 'table-scroll' },
        h('table', { class: 'data' },
          h('thead', null, h('tr', null,
            h('th', null, 'Date'), h('th', null, 'Kind'), h('th', null, 'Method'),
            h('th', { class: 'num' }, 'Amount'), h('th', null, 'Note'), h('th', null, ''))),
          h('tbody', null, payments.map(p => h('tr', null,
            h('td', null, fmtDate(p.date)),
            h('td', null, p.kind || '—'),
            h('td', null, p.method || '—'),
            h('td', { class: 'num' },
              (p.kind === 'refund' ? '−' : '') + fmtMoney(p.amountCents)),
            h('td', null, p.note || ''),
            h('td', { class: 'num' }, h('button', {
              class: 'icon-btn', 'aria-label': 'Delete payment', title: 'Delete payment',
              onClick: async () => {
                if (!await confirmDialog(`Delete this ${fmtMoney(p.amountCents)} ${p.kind || 'payment'} record?`)) return;
                await db.remove('payments', p.id);
                toast('Payment deleted');
              },
            }, '✕')))))))
      : h('div', { class: 'empty' }, h('p', null, 'No payments recorded yet.'))));

  function paymentModal(prefill = {}) {
    const amountIn = h('input', {
      type: 'text', inputmode: 'decimal', placeholder: '0.00',
      value: prefill.amountCents != null ? (prefill.amountCents / 100).toFixed(2) : '',
    });
    const kindSel = h('select', null, PAYMENT_KINDS.map(k =>
      h('option', { value: k, selected: (prefill.kind || 'deposit') === k }, k)));
    const methodSel = h('select', null, PAYMENT_METHODS.map(m =>
      h('option', { value: m, selected: m === 'card' }, m)));
    const dateIn = h('input', { type: 'date', value: todayISO() });
    const noteIn = h('input', { type: 'text', value: prefill.note || '' });

    openModal({
      title: 'Record payment',
      body: h('div', { class: 'form-grid' },
        h('label', { class: 'field' }, 'Amount ($) *', amountIn),
        h('label', { class: 'field' }, 'Kind', kindSel),
        h('label', { class: 'field' }, 'Method', methodSel),
        h('label', { class: 'field' }, 'Date', dateIn),
        h('label', { class: 'field span-2' }, 'Note', noteIn)),
      actions: [
        { label: 'Cancel', onClick: closeModal },
        {
          label: 'Record payment', primary: true,
          onClick: async () => {
            const amountCents = parseMoney(amountIn.value);
            if (amountCents <= 0) { toast('Enter an amount greater than zero.', 'bad'); return; }
            await db.put('payments', {
              projectId: id, amountCents,
              kind: kindSel.value, method: methodSel.value,
              date: dateIn.value || todayISO(), note: noteIn.value.trim(),
            });
            closeModal();
            toast(`${fmtMoney(amountCents)} payment recorded`);
          },
        },
      ],
    });
  }

  /* ---- contract / e-sign card ---- */
  el.append(h('div', { class: 'card' },
    h('h2', null, 'Contract & signature'),
    project.signature
      ? h('div', { class: 'view-head', style: 'margin:0' },
          h('p', { class: 'grow', style: 'margin:0;color:var(--ok);font-weight:600' },
            `✓ Signed by ${project.signature.name} on ${fmtDate((project.signature.signedAt || '').slice(0, 10))}`),
          h('button', {
            class: 'btn btn-sm',
            onClick: async () => {
              if (!await confirmDialog(`Remove ${project.signature.name}'s signature from this contract?`)) return;
              await save({ signature: null });
              toast('Signature removed');
            },
          }, 'Unsign'))
      : h('div', { class: 'view-head', style: 'margin:0' },
          h('p', { class: 'subtitle grow', style: 'margin:0' },
            'Not signed yet — open the contract below, then record the client’s signature here.'),
          h('button', { class: 'btn btn-primary', onClick: signModal }, 'Mark as signed'))));

  function signModal() {
    const nameIn = h('input', { type: 'text', value: client?.name || '', placeholder: 'Signer’s full name' });
    openModal({
      title: 'Mark contract as signed',
      body: h('div', null,
        h('label', { class: 'field' }, 'Signed by *', nameIn),
        h('p', { class: 'subtitle' }, 'Records the signer’s name and today’s date on this project.')),
      actions: [
        { label: 'Cancel', onClick: closeModal },
        {
          label: 'Mark as signed', primary: true,
          onClick: async () => {
            const name = nameIn.value.trim();
            if (!name) { toast('Signer name is required.', 'bad'); return; }
            const patch = { signature: { name, signedAt: new Date().toISOString() } };
            if (project.status === 'lead' || project.status === 'quote') patch.status = 'signed';
            await save(patch);
            closeModal();
            toast(`Contract signed by ${name} 🎉`);
          },
        },
      ],
    });
  }

  /* ---- documents card ---- */
  const docData = { project, client, settings, payments: allPayments, inventory };
  el.append(h('div', { class: 'card' },
    h('h2', null, 'Documents'),
    h('p', { class: 'subtitle' }, 'Opens a printable page in a new tab — print to save as PDF.'),
    h('div', { class: 'chip-row', style: 'margin-top:.5rem' },
      h('button', { class: 'btn', onClick: () => openDoc('quote', docData) }, '📄 Quote'),
      h('button', { class: 'btn', onClick: () => openDoc('contract', docData) }, '✍️ Contract'),
      h('button', { class: 'btn', onClick: () => openDoc('invoice', docData) }, '🧾 Invoice'),
      h('button', { class: 'btn', onClick: () => openDoc('pullsheet', docData) }, '📋 Pull sheet'))));

  /* ---- danger zone ---- */
  el.append(h('div', { class: 'card', style: 'border-color:var(--bad)' },
    h('h2', null, 'Danger zone'),
    h('p', { class: 'subtitle' }, 'Deleting a project also deletes its payment records.'),
    h('button', {
      class: 'btn btn-danger', style: 'margin-top:.4rem',
      onClick: async () => {
        const msg = payments.length
          ? `Delete “${project.name}” and its ${payments.length} payment record${payments.length === 1 ? '' : 's'}? This cannot be undone.`
          : `Delete “${project.name}”? This cannot be undone.`;
        if (!await confirmDialog(msg)) return;
        for (const p of payments) await db.remove('payments', p.id);
        await db.remove('projects', id);
        toast('Project deleted');
        navigate('#/projects');
      },
    }, 'Delete project')));

  function renameModal() {
    const nameIn = h('input', { type: 'text', value: project.name });
    openModal({
      title: 'Rename project',
      body: h('label', { class: 'field' }, 'Project name *', nameIn),
      actions: [
        { label: 'Cancel', onClick: closeModal },
        {
          label: 'Save', primary: true,
          onClick: async () => {
            const name = nameIn.value.trim();
            if (!name) { toast('Name is required.', 'bad'); return; }
            closeModal();
            await save({ name });
          },
        },
      ],
    });
  }
}
