// Clients view — CRM contacts for The Poppy Creative. Owner: Agent C.
import { registerView, h, navigate, toast, openModal, closeModal, confirmDialog, icon } from '../app.js';
import { db } from '../db.js';
import { fmtMoney, projectTotals, nextQuoteNumber, todayISO } from '../schema.js';

const SOURCES = ['Instagram', 'Facebook', 'Referral', 'Website', 'Walk-in', 'Other'];

registerView('clients', {
  title: 'Clients',
  icon: '👥',
  async render(el) {
    const [clients, projects, settings] = await Promise.all([
      db.all('clients'), db.all('projects'), db.get('settings', 'company'),
    ]);
    clients.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    let search = '';
    const tableWrap = h('div');

    el.append(
      h('div', { class: 'view-head' },
        h('div', { class: 'grow' },
          h('h1', null, 'Clients'),
          h('p', { class: 'subtitle' },
            `${clients.length} contact${clients.length === 1 ? '' : 's'}`)),
        h('input', {
          type: 'search', placeholder: 'Search clients…', style: 'max-width:220px',
          'aria-label': 'Search clients',
          onInput: e => { search = e.target.value.trim().toLowerCase(); renderTable(); },
        }),
        h('button', { class: 'btn btn-primary', onClick: () => editClient(null) }, '+ Add client')),
      tableWrap,
    );
    renderTable();

    function clientStats(c) {
      const ps = projects.filter(p => p.clientId === c.id);
      const value = ps.reduce((sum, p) => sum + projectTotals(p, settings).total, 0);
      return { count: ps.length, value };
    }

    function renderTable() {
      const list = clients.filter(c => !search ||
        [c.name, c.company, c.email, c.phone, c.source]
          .some(v => (v || '').toLowerCase().includes(search)));

      if (!clients.length) {
        tableWrap.replaceChildren(h('div', { class: 'empty' },
          h('div', { class: 'big' }, icon('blooms', 40)),
          h('p', null, 'No clients yet — add your first contact to get started.')));
        return;
      }
      if (!list.length) {
        tableWrap.replaceChildren(h('div', { class: 'empty' },
          h('p', null, `No clients match “${search}”.`)));
        return;
      }

      tableWrap.replaceChildren(h('div', { class: 'card card-tight' },
        h('div', { class: 'table-scroll' },
          h('table', { class: 'data' },
            h('thead', null, h('tr', null,
              h('th', null, 'Name'), h('th', null, 'Company'), h('th', null, 'Email'),
              h('th', null, 'Phone'), h('th', null, 'Source'),
              h('th', { class: 'num' }, 'Projects'), h('th', null, ''))),
            h('tbody', null, list.map(c => {
              const stats = clientStats(c);
              return h('tr', { class: 'rowlink', onClick: () => editClient(c) },
                h('td', null, h('strong', null, c.name || '—')),
                h('td', null, c.company || '—'),
                h('td', null, c.email || '—'),
                h('td', null, c.phone || '—'),
                h('td', null, c.source || '—'),
                h('td', { class: 'num' },
                  stats.count ? `${stats.count} · ${fmtMoney(stats.value)}` : '—'),
                h('td', { class: 'num' },
                  h('button', {
                    class: 'btn btn-sm',
                    onClick: e => { e.stopPropagation(); newProjectFor(c); },
                  }, 'New project')));
            }))))));
    }

    function editClient(client) {
      const isNew = !client;
      const c = client || {};
      const nameIn = h('input', { type: 'text', value: c.name || '', placeholder: 'Full name' });
      const companyIn = h('input', { type: 'text', value: c.company || '' });
      const emailIn = h('input', { type: 'email', value: c.email || '' });
      const phoneIn = h('input', { type: 'tel', value: c.phone || '' });
      const sourceIn = h('select', null,
        SOURCES.map(s => h('option', { value: s, selected: (c.source || 'Other') === s }, s)));
      const notesIn = h('textarea', { rows: '3', value: c.notes || '' });

      const actions = [];
      if (!isNew) {
        actions.push({
          label: 'Delete', danger: true,
          onClick: async () => {
            const owned = projects.filter(p => p.clientId === c.id);
            if (owned.length) {
              toast(`Cannot delete — ${c.name} has ${owned.length} project${owned.length === 1 ? '' : 's'}.`, 'bad');
              return;
            }
            closeModal();
            if (!await confirmDialog(`Delete client “${c.name}”? This cannot be undone.`)) return;
            await db.remove('clients', c.id);
            toast('Client deleted');
          },
        });
      }
      actions.push({ label: 'Cancel', onClick: closeModal });
      actions.push({
        label: isNew ? 'Add client' : 'Save', primary: true,
        onClick: async () => {
          const name = nameIn.value.trim();
          if (!name) { toast('Name is required.', 'bad'); return; }
          await db.put('clients', {
            ...c, name,
            company: companyIn.value.trim(),
            email: emailIn.value.trim(),
            phone: phoneIn.value.trim(),
            source: sourceIn.value,
            notes: notesIn.value,
            createdAt: c.createdAt || new Date().toISOString(),
          });
          closeModal();
          toast(isNew ? 'Client added' : 'Client saved');
        },
      });

      openModal({
        title: isNew ? 'Add client' : `Edit ${c.name}`,
        body: h('div', { class: 'form-grid' },
          h('label', { class: 'field span-2' }, 'Name *', nameIn),
          h('label', { class: 'field' }, 'Company', companyIn),
          h('label', { class: 'field' }, 'Source', sourceIn),
          h('label', { class: 'field' }, 'Email', emailIn),
          h('label', { class: 'field' }, 'Phone', phoneIn),
          h('label', { class: 'field span-2' }, 'Notes', notesIn)),
        actions,
      });
    }

    async function newProjectFor(client) {
      const allProjects = await db.all('projects');
      const t = todayISO();
      const proj = {
        name: `${client.name} — New event`,
        clientId: client.id,
        status: 'lead',
        eventDate: t, endDate: t,
        startTime: '', endTime: '', venue: '', inHouse: false,
        lines: [], discountCents: 0, notes: '',
        quoteNumber: nextQuoteNumber(allProjects),
        signature: null,
        createdAt: new Date().toISOString(),
      };
      await db.put('projects', proj);
      toast(`New project for ${client.name}`);
      navigate(`#/projects/${proj.id}`);
    }
  },
});
