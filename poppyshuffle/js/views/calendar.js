// Calendar view — month grid of events, upcoming list, and per-space bookings.
import { registerView, h, navigate, fmtDate } from '../app.js';
import { db } from '../db.js';
import { STATUS_META, rangesOverlap, todayISO, addDaysISO } from '../schema.js';

// Displayed month persists across re-renders. m is 0-based.
const state = { y: null, m: null };

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function iso(y, m0, d) {
  return `${y}-${String(m0 + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function statusColor(status) {
  return STATUS_META[status]?.color || 'var(--muted)';
}

function projectDates(p) {
  const end = p.endDate && p.endDate !== p.eventDate ? p.endDate : null;
  return end ? `${fmtDate(p.eventDate)} – ${fmtDate(end)}` : fmtDate(p.eventDate);
}

registerView('calendar', {
  title: 'Calendar',
  icon: '📅',
  async render(el) {
    if (state.y == null) {
      const now = new Date();
      state.y = now.getFullYear();
      state.m = now.getMonth();
    }
    const [projects, inventory] = await Promise.all([
      db.all('projects'), db.all('inventory'),
    ]);
    const active = projects.filter(p => p.status !== 'cancelled' && p.eventDate);
    const spaces = inventory.filter(it => it.type === 'space');
    const today = todayISO();

    function shiftMonth(delta) {
      const d = new Date(state.y, state.m + delta, 1);
      state.y = d.getFullYear();
      state.m = d.getMonth();
      draw();
    }

    function draw() {
      const { y, m } = state;
      const monthLabel = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      const daysIn = new Date(y, m + 1, 0).getDate();
      const startPad = new Date(y, m, 1).getDay();
      const totalCells = Math.ceil((startPad + daysIn) / 7) * 7;
      const monthFrom = iso(y, m, 1);
      const monthTo = iso(y, m, daysIn);

      // --- Month grid ---
      const cells = DOW.map(d => h('div', { class: 'cal-dow' }, d));
      for (let i = 0; i < totalCells; i++) {
        const dt = new Date(y, m, i - startPad + 1);
        const dISO = iso(dt.getFullYear(), dt.getMonth(), dt.getDate());
        const other = dt.getMonth() !== m;
        const evts = active.filter(p =>
          rangesOverlap(dISO, dISO, p.eventDate, p.endDate || p.eventDate));
        cells.push(h('div', { class: `cal-cell${other ? ' other' : ''}${dISO === today ? ' today' : ''}` },
          h('div', { class: 'cal-daynum' }, dt.getDate()),
          evts.map(p => h('span', {
            class: 'cal-evt',
            style: `background:${statusColor(p.status)}`,
            title: p.name,
            onClick: () => navigate(`/projects/${p.id}`),
          }, p.name))));
      }
      const calCard = h('div', { class: 'card card-tight' },
        h('div', { class: 'cal-grid' }, cells));

      // --- Upcoming events (next 60 days) ---
      const horizon = addDaysISO(today, 60);
      const upcoming = active
        .filter(p => (p.endDate || p.eventDate) >= today && p.eventDate <= horizon)
        .sort((a, b) => a.eventDate.localeCompare(b.eventDate) ||
          (a.name || '').localeCompare(b.name || ''));
      const upcomingCard = h('div', { class: 'card' },
        h('h2', null, 'Upcoming events'),
        upcoming.length
          ? h('div', { class: 'table-scroll' },
              h('table', { class: 'data' },
                h('thead', null, h('tr', null,
                  h('th', null, 'Date'), h('th', null, 'Event'),
                  h('th', null, 'Venue'), h('th', null, 'Status'))),
                h('tbody', null, upcoming.map(p =>
                  h('tr', { class: 'rowlink', onClick: () => navigate(`/projects/${p.id}`) },
                    h('td', null, projectDates(p)),
                    h('td', null, p.name),
                    h('td', null, p.venue || '—'),
                    h('td', null, h('span', {
                      class: 'badge',
                      style: `background:${statusColor(p.status)}`,
                    }, STATUS_META[p.status]?.label || p.status)))))))
          : h('div', { class: 'empty' },
              h('div', { class: 'big' }, '🗓️'),
              h('p', null, 'Nothing on the books for the next 60 days.')));

      // --- Space bookings for the displayed month (venue schedule) ---
      const spacesCard = h('div', { class: 'card' },
        h('h2', null, `Space bookings — ${monthLabel}`),
        spaces.length
          ? spaces.map(sp => {
              const bookings = active
                .filter(p => (p.lines || []).some(l => l.itemId === sp.id) &&
                  rangesOverlap(p.eventDate, p.endDate || p.eventDate, monthFrom, monthTo))
                .sort((a, b) => a.eventDate.localeCompare(b.eventDate));
              return h('div', { style: 'margin:.6rem 0' },
                h('h3', { style: 'margin:0 0 .2rem;font-size:.95rem' },
                  `${sp.imageEmoji || '🏛️'} ${sp.name}`),
                bookings.length
                  ? bookings.map(p =>
                      h('div', { style: 'display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline;padding:.15rem 0' },
                        h('a', { href: `#/projects/${p.id}` }, p.name),
                        h('span', { class: 'stock-note' }, projectDates(p))))
                  : h('p', { class: 'stock-note' }, 'No bookings this month.'));
            })
          : h('div', { class: 'empty' }, 'No spaces in inventory.'));

      el.replaceChildren(
        h('div', { class: 'view-head' },
          h('div', { class: 'grow' },
            h('h1', null, monthLabel),
            h('p', { class: 'subtitle' }, 'Events & space schedule')),
          h('button', { class: 'btn btn-sm', onClick: () => shiftMonth(-1) }, '‹ Prev'),
          h('button', {
            class: 'btn btn-sm',
            onClick: () => {
              const now = new Date();
              state.y = now.getFullYear();
              state.m = now.getMonth();
              draw();
            },
          }, 'Today'),
          h('button', { class: 'btn btn-sm', onClick: () => shiftMonth(1) }, 'Next ›')),
        calCard,
        upcomingCard,
        spacesCard);
    }

    draw();
  },
});
