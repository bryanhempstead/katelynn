// Dashboard view — warm greeting, key stats, needs-attention flags, next-up
// schedule, and quick actions. Registered on the '#/dashboard' route.
import { registerView, h, navigate, fmtMoney, fmtDate } from '../app.js';
import { db } from '../db.js';
import { projectTotals, todayISO, addDaysISO, STATUS_META } from '../schema.js';

function greeting() {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning ☀️';
  if (hr < 17) return 'Good afternoon 🌤️';
  return 'Good evening 🌙';
}

function statusBadge(status) {
  const meta = STATUS_META[status] || { label: status, color: 'var(--muted)' };
  return h('span', { class: 'badge', style: `background:${meta.color}` }, meta.label);
}

registerView('dashboard', {
  title: 'Dashboard',
  icon: '🏡',
  async render(el) {
    await db.ready;
    const [settings, projects, clients, inventory, payments] = await Promise.all([
      db.get('settings', 'company'),
      db.all('projects'),
      db.all('clients'),
      db.all('inventory'),
      db.all('payments'),
    ]);

    const today = todayISO();
    const in30 = addDaysISO(today, 30);
    const in14 = addDaysISO(today, 14);
    const in7 = addDaysISO(today, 7);
    const staleBefore = addDaysISO(today, -14);
    const totalsOf = new Map(projects.map(p => [p.id, projectTotals(p, settings, payments)]));

    // ---- Stats -------------------------------------------------------------
    const upcoming = projects.filter(p =>
      p.status !== 'cancelled' && p.eventDate && p.eventDate >= today && p.eventDate <= in30);
    const leads = projects.filter(p => p.status === 'lead');
    const quotes = projects.filter(p => p.status === 'quote');
    const signed = projects.filter(p => p.status === 'signed');
    const completed = projects.filter(p => p.status === 'completed');

    const sumTotal = list => list.reduce((s, p) => s + totalsOf.get(p.id).total, 0);
    const pipelineValue = sumTotal(leads) + sumTotal(quotes);
    const bookedRevenue = sumTotal(signed) + sumTotal(completed);
    const outstanding = signed.reduce((s, p) => s + totalsOf.get(p.id).balanceDue, 0);
    const activeItems = inventory.filter(i => i.active).length;

    const stat = (label, value, sub) => h('div', { class: 'stat' },
      h('div', { class: 'stat-label' }, label),
      h('div', { class: 'stat-value' }, value),
      sub ? h('div', { class: 'stat-sub' }, sub) : null);

    // ---- Needs attention ---------------------------------------------------
    const flags = [];
    for (const p of quotes) {
      if (p.eventDate && p.eventDate >= today && p.eventDate <= in14) {
        flags.push({
          emoji: '✍️', projectId: p.id,
          text: `${p.quoteNumber ? p.quoteNumber + ' — ' : ''}${p.name}: event is ${fmtDate(p.eventDate)} and the quote is still unsigned.`,
        });
      }
    }
    for (const p of signed) {
      const t = totalsOf.get(p.id);
      if (t.balanceDue > 0 && t.balanceDueDate && t.balanceDueDate <= in7) {
        const overdue = t.balanceDueDate < today;
        flags.push({
          emoji: '💸', projectId: p.id,
          text: `${p.name}: ${fmtMoney(t.balanceDue)} balance ${overdue ? 'was due' : 'due'} ${fmtDate(t.balanceDueDate)}${overdue ? ' — overdue' : ''}.`,
        });
      }
    }
    for (const p of leads) {
      const created = (p.createdAt || '').slice(0, 10);
      if (created && created < staleBefore) {
        flags.push({
          emoji: '🌱', projectId: p.id,
          text: `Lead going stale: ${p.name} (created ${fmtDate(created)}) — time to follow up.`,
        });
      }
    }

    const attention = h('div', { class: 'card' },
      h('h2', null, '🔔 Needs attention'),
      flags.length
        ? h('div', { class: 'table-scroll' },
            h('table', { class: 'data' },
              h('tbody', null,
                flags.map(f => h('tr', {
                  class: 'rowlink',
                  onClick: () => navigate(`#/projects/${f.projectId}`),
                },
                  h('td', { style: 'width:2rem' }, f.emoji),
                  h('td', null, f.text))))))
        : h('div', { class: 'empty' }, h('div', { class: 'big' }, '🎉'), 'All caught up!'));

    // ---- Next up -----------------------------------------------------------
    const nextUp = projects
      .filter(p => p.status !== 'cancelled' && p.eventDate && p.eventDate >= today)
      .sort((a, b) => (a.eventDate + (a.startTime || '')).localeCompare(b.eventDate + (b.startTime || '')))
      .slice(0, 6);

    const nextCard = h('div', { class: 'card' },
      h('h2', null, '📅 Next up'),
      nextUp.length
        ? h('div', { class: 'table-scroll' },
            h('table', { class: 'data' },
              h('thead', null, h('tr', null,
                h('th', null, 'Date'), h('th', null, 'Project'), h('th', null, 'Venue'),
                h('th', null, 'Status'), h('th', { class: 'num' }, 'Total'))),
              h('tbody', null,
                nextUp.map(p => h('tr', {
                  class: 'rowlink',
                  onClick: () => navigate(`#/projects/${p.id}`),
                },
                  h('td', null, fmtDate(p.eventDate)),
                  h('td', null, p.name),
                  h('td', null, p.venue || '—'),
                  h('td', null, statusBadge(p.status)),
                  h('td', { class: 'num' }, fmtMoney(totalsOf.get(p.id).total)))))))
        : h('div', { class: 'empty' },
            h('div', { class: 'big' }, '🌷'),
            'Nothing on the calendar yet — time to book something lovely.'));

    // ---- Assemble ----------------------------------------------------------
    el.append(
      h('div', { class: 'view-head' },
        h('div', { class: 'grow' },
          h('h1', null, greeting()),
          h('p', { class: 'subtitle' },
            `Today is ${fmtDate(today)} — here's what's happening at ${settings?.name || 'your studio'}.`)),
        h('button', { class: 'btn btn-primary', onClick: () => navigate('#/projects') }, '➕ New project'),
        h('button', { class: 'btn', onClick: () => navigate('#/inventory') }, '📦 Add inventory'),
        h('button', { class: 'btn', onClick: () => navigate('#/calendar') }, '🗓️ View calendar')),
      h('div', { class: 'stat-grid' },
        stat('Upcoming events', String(upcoming.length), 'next 30 days'),
        stat('Pipeline value', fmtMoney(pipelineValue), `${leads.length} lead${leads.length === 1 ? '' : 's'} · ${quotes.length} quote${quotes.length === 1 ? '' : 's'}`),
        stat('Booked revenue', fmtMoney(bookedRevenue), `${signed.length} signed · ${completed.length} completed`),
        stat('Outstanding balance', fmtMoney(outstanding), 'on signed projects'),
        stat('Clients', String(clients.length), 'in your CRM'),
        stat('Inventory items', String(inventory.length), `${activeItems} active`)),
      attention,
      nextCard);
  },
});
