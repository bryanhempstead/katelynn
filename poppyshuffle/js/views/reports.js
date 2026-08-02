// Reports view — revenue & payments by month (pure CSS bars), top items,
// status breakdown, client leaderboard, and CSV exports.
import { registerView, h, toast, fmtMoney } from '../app.js';
import { db } from '../db.js';
import { projectTotals, STATUS_META, PROJECT_STATUSES } from '../schema.js';

// ---- month helpers ---------------------------------------------------------
function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function defaultRange() {
  const now = new Date();
  return {
    from: monthKeyOf(new Date(now.getFullYear(), now.getMonth() - 5, 1)),
    to: monthKeyOf(now),
  };
}

function monthsBetween(from, to) {
  let [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const out = [];
  while ((fy < ty || (fy === ty && fm <= tm)) && out.length < 36) {
    out.push(`${fy}-${String(fm).padStart(2, '0')}`);
    fm += 1;
    if (fm > 12) { fm = 1; fy += 1; }
  }
  return out;
}

function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

// Selected range survives re-renders (db.onChange re-runs the view).
let range = null;

// ---- CSV helpers -----------------------------------------------------------
function toCSV(rows) {
  return rows.map(row => row.map(v => {
    const s = String(v ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',')).join('\r\n');
}

function downloadFile(name, text, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const dollars = cents => ((cents || 0) / 100).toFixed(2);

// ---- shared chart bits -----------------------------------------------------
function barChart(rows, color) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.cents)));
  return h('div', { class: 'timeline' },
    rows.map(r => h('div', { class: 'pipe-row' },
      h('span', { style: 'flex:0 0 5.2rem;font-size:.8rem;font-weight:600;color:var(--ink-soft)' }, r.label),
      h('div', { class: 'pipe-bar' },
        h('div', {
          class: 'pipe-fill',
          style: `width:${Math.round(Math.abs(r.cents) / max * 100)}%;background:${r.cents < 0 ? 'var(--bad)' : color}`,
        })),
      h('span', { class: 'num', style: 'flex:0 0 6.2rem;font-size:.84rem;font-weight:600' },
        fmtMoney(r.cents)))));
}

function statusBadge(status) {
  const meta = STATUS_META[status] || { label: status, color: 'var(--muted)' };
  return h('span', { class: 'badge', style: `background:${meta.color}` }, meta.label);
}

registerView('reports', {
  title: 'Reports',
  icon: '📈',
  async render(el) {
    await db.ready;
    if (!range) range = defaultRange();
    if (range.from > range.to) range = { from: range.to, to: range.from };

    const [settings, projects, clients, payments] = await Promise.all([
      db.get('settings', 'company'),
      db.all('projects'),
      db.all('clients'),
      db.all('payments'),
    ]);

    const months = monthsBetween(range.from, range.to);
    const inRange = key => key >= range.from && key <= range.to;
    const totalsOf = new Map(projects.map(p => [p.id, projectTotals(p, settings, payments)]));
    const clientById = new Map(clients.map(c => [c.id, c]));

    const rangeProjects = projects.filter(p => p.eventDate && inRange(p.eventDate.slice(0, 7)));
    const bookedInRange = rangeProjects.filter(p => p.status === 'signed' || p.status === 'completed');
    const activeInRange = rangeProjects.filter(p => p.status !== 'cancelled');

    // ---- Revenue by month (signed + completed, by eventDate) --------------
    const revByMonth = new Map(months.map(m => [m, 0]));
    for (const p of bookedInRange) {
      const key = p.eventDate.slice(0, 7);
      revByMonth.set(key, (revByMonth.get(key) || 0) + totalsOf.get(p.id).total);
    }

    // ---- Payments collected by month (refunds negative) -------------------
    const payByMonth = new Map(months.map(m => [m, 0]));
    for (const pay of payments) {
      const key = (pay.date || '').slice(0, 7);
      if (!inRange(key)) continue;
      const amt = (pay.kind === 'refund' ? -1 : 1) * (pay.amountCents || 0);
      payByMonth.set(key, (payByMonth.get(key) || 0) + amt);
    }

    // ---- Top items across non-cancelled projects in range -----------------
    const itemAgg = new Map();
    for (const p of activeInRange) {
      for (const line of (p.lines || [])) {
        const key = line.itemId || `name:${line.name}`;
        const agg = itemAgg.get(key) || { name: line.name, times: 0, qty: 0, revenue: 0 };
        agg.times += 1;
        agg.qty += line.qty || 0;
        agg.revenue += (line.priceCents || 0) * (line.qty || 0);
        itemAgg.set(key, agg);
      }
    }
    const topItems = [...itemAgg.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);

    // ---- Status breakdown -------------------------------------------------
    const statusRows = PROJECT_STATUSES.map(status => {
      const list = rangeProjects.filter(p => p.status === status);
      return { status, count: list.length, value: list.reduce((s, p) => s + totalsOf.get(p.id).total, 0) };
    });

    // ---- Client leaderboard (booked value) --------------------------------
    const clientAgg = new Map();
    for (const p of bookedInRange) {
      const agg = clientAgg.get(p.clientId) || { clientId: p.clientId, events: 0, value: 0 };
      agg.events += 1;
      agg.value += totalsOf.get(p.id).total;
      clientAgg.set(p.clientId, agg);
    }
    const topClients = [...clientAgg.values()].sort((a, b) => b.value - a.value).slice(0, 5);

    // ---- CSV exports ------------------------------------------------------
    const exportProjects = () => {
      const rows = [[
        'Quote #', 'Project', 'Client', 'Status', 'Event date', 'End date', 'Venue',
        'In-house', 'Subtotal', 'In-house discount', 'Discount', 'Tax', 'Total', 'Paid', 'Balance due',
      ]];
      for (const p of projects) {
        const t = totalsOf.get(p.id);
        rows.push([
          p.quoteNumber || '', p.name || '', clientById.get(p.clientId)?.name || '',
          p.status || '', p.eventDate || '', p.endDate || '', p.venue || '',
          p.inHouse ? 'yes' : 'no',
          dollars(t.subtotal), dollars(t.inHouseDiscount), dollars(t.discount),
          dollars(t.tax), dollars(t.total), dollars(t.paid), dollars(t.balanceDue),
        ]);
      }
      downloadFile('poppyshuffle-projects.csv', toCSV(rows));
      toast('Projects CSV exported');
    };

    const projectById = new Map(projects.map(p => [p.id, p]));
    const exportPayments = () => {
      const rows = [['Date', 'Project', 'Client', 'Kind', 'Method', 'Amount', 'Note']];
      for (const pay of payments) {
        const p = projectById.get(pay.projectId);
        const signedAmt = (pay.kind === 'refund' ? -1 : 1) * (pay.amountCents || 0);
        rows.push([
          pay.date || '', p?.name || '', clientById.get(p?.clientId)?.name || '',
          pay.kind || '', pay.method || '', dollars(signedAmt), pay.note || '',
        ]);
      }
      downloadFile('poppyshuffle-payments.csv', toCSV(rows));
      toast('Payments CSV exported');
    };

    // ---- Range selector ---------------------------------------------------
    const view = this;
    const onRange = (which, value) => {
      if (!/^\d{4}-\d{2}$/.test(value)) return;
      range = { ...range, [which]: value };
      el.replaceChildren();
      view.render(el);
    };

    const fromInput = h('input', { type: 'month', value: range.from, 'aria-label': 'From month',
      onChange: e => onRange('from', e.target.value) });
    const toInput = h('input', { type: 'month', value: range.to, 'aria-label': 'To month',
      onChange: e => onRange('to', e.target.value) });

    // ---- Assemble ---------------------------------------------------------
    const revRows = months.map(m => ({ label: monthLabel(m), cents: revByMonth.get(m) || 0 }));
    const payRows = months.map(m => ({ label: monthLabel(m), cents: payByMonth.get(m) || 0 }));
    const anyRevenue = revRows.some(r => r.cents !== 0);
    const anyPayments = payRows.some(r => r.cents !== 0);

    el.append(
      h('div', { class: 'view-head' },
        h('div', { class: 'grow' },
          h('h1', null, '📈 Reports'),
          h('p', { class: 'subtitle' }, `${monthLabel(range.from)} – ${monthLabel(range.to)}`)),
        h('button', { class: 'btn', onClick: exportProjects }, '⬇️ Export projects CSV'),
        h('button', { class: 'btn', onClick: exportPayments }, '⬇️ Export payments CSV')),

      h('div', { class: 'card card-tight' },
        h('div', { class: 'form-grid' },
          h('label', { class: 'field' }, 'From month', fromInput),
          h('label', { class: 'field' }, 'To month', toInput))),

      h('div', { class: 'card' },
        h('h2', null, '🌺 Revenue by month'),
        h('p', { class: 'subtitle' }, 'Signed & completed projects, grouped by event date.'),
        anyRevenue ? barChart(revRows, 'var(--poppy)')
          : h('div', { class: 'empty' }, h('div', { class: 'big' }, '🌱'), 'No booked revenue in this range yet.')),

      h('div', { class: 'card' },
        h('h2', null, '💰 Payments collected by month'),
        h('p', { class: 'subtitle' }, 'All recorded payments; refunds count as negative.'),
        anyPayments ? barChart(payRows, 'var(--sage)')
          : h('div', { class: 'empty' }, h('div', { class: 'big' }, '🪙'), 'No payments recorded in this range.')),

      h('div', { class: 'card' },
        h('h2', null, '🏆 Top items'),
        h('p', { class: 'subtitle' }, 'Line items across non-cancelled projects in range, by revenue.'),
        topItems.length
          ? h('div', { class: 'table-scroll' },
              h('table', { class: 'data' },
                h('thead', null, h('tr', null,
                  h('th', null, 'Item'), h('th', { class: 'num' }, 'Times rented'),
                  h('th', { class: 'num' }, 'Qty'), h('th', { class: 'num' }, 'Revenue'))),
                h('tbody', null, topItems.map(it => h('tr', null,
                  h('td', null, it.name),
                  h('td', { class: 'num' }, String(it.times)),
                  h('td', { class: 'num' }, String(it.qty)),
                  h('td', { class: 'num' }, fmtMoney(it.revenue)))))))
          : h('div', { class: 'empty' }, h('div', { class: 'big' }, '📦'), 'No line items in this range.')),

      h('div', { class: 'card' },
        h('h2', null, '🚦 Status breakdown'),
        h('div', { class: 'table-scroll' },
          h('table', { class: 'data' },
            h('thead', null, h('tr', null,
              h('th', null, 'Status'), h('th', { class: 'num' }, 'Projects'),
              h('th', { class: 'num' }, 'Value'))),
            h('tbody', null, statusRows.map(r => h('tr', null,
              h('td', null, statusBadge(r.status)),
              h('td', { class: 'num' }, String(r.count)),
              h('td', { class: 'num' }, fmtMoney(r.value)))))))),

      h('div', { class: 'card' },
        h('h2', null, '💐 Client leaderboard'),
        h('p', { class: 'subtitle' }, 'Top clients by booked (signed & completed) value in range.'),
        topClients.length
          ? h('div', { class: 'table-scroll' },
              h('table', { class: 'data' },
                h('thead', null, h('tr', null,
                  h('th', null, 'Client'), h('th', { class: 'num' }, 'Events'),
                  h('th', { class: 'num' }, 'Booked value'))),
                h('tbody', null, topClients.map(r => h('tr', null,
                  h('td', null, clientById.get(r.clientId)?.name || 'Unknown client'),
                  h('td', { class: 'num' }, String(r.events)),
                  h('td', { class: 'num' }, fmtMoney(r.value)))))))
          : h('div', { class: 'empty' }, h('div', { class: 'big' }, '🫙'), 'No booked clients in this range yet.')));
  },
});
