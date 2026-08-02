// Settings view — business profile, policies, data backup/restore,
// website integration (embed snippet + wishlist import), and about.
import { registerView, h, toast, confirmDialog, navigate, icon } from '../app.js';
import { db } from '../db.js';
import { todayISO, nextQuoteNumber } from '../schema.js';

const APP_VERSION = '1.0.0';

function downloadFile(name, text, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function pickFile(accept, onText) {
  const input = h('input', {
    type: 'file', accept, style: 'display:none',
    onChange: () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onText(String(reader.result), file.name);
      reader.onerror = () => toast('Could not read that file.', 'bad');
      reader.readAsText(file);
    },
  });
  document.body.append(input);
  input.click();
}

function numFrom(input, fallback) {
  const n = parseFloat(input.value);
  return Number.isFinite(n) ? n : fallback;
}

// ---- Wishlist import (from embed/widget.js JSON files) ---------------------
async function importWishlist(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    toast('That file is not valid JSON.', 'bad');
    return;
  }
  if (!data || data.app !== 'poppyshuffle-wishlist' || !Array.isArray(data.items)) {
    toast('Not a PoppyShuffle wishlist file.', 'bad');
    return;
  }

  const wishClient = data.client || {};
  const email = String(wishClient.email || '').trim().toLowerCase();
  const clients = await db.all('clients');
  let client = email
    ? clients.find(c => String(c.email || '').trim().toLowerCase() === email)
    : null;
  if (!client) {
    client = await db.put('clients', {
      name: String(wishClient.name || 'Website visitor'),
      company: '',
      email: String(wishClient.email || ''),
      phone: String(wishClient.phone || ''),
      source: 'Website',
      notes: 'Created from a website wishlist submission.',
      createdAt: new Date().toISOString(),
    });
  }

  const inventory = await db.all('inventory');
  const invById = new Map(inventory.map(i => [i.id, i]));
  const lines = data.items.map(it => {
    const qty = Math.max(1, Math.round(Number(it?.qty) || 1));
    const inv = it?.itemId ? invById.get(it.itemId) : null;
    if (inv) {
      // Snapshot the CURRENT price from inventory.
      return { itemId: inv.id, name: inv.name, qty, priceCents: inv.priceCents || 0, type: inv.type || 'rental' };
    }
    // Unknown item — keep the name from the file, price to be quoted.
    return { itemId: null, name: String(it?.name || 'Unknown item'), qty, priceCents: 0, type: 'rental' };
  });

  const projects = await db.all('projects');
  const eventDate = /^\d{4}-\d{2}-\d{2}$/.test(data.eventDate || '') ? data.eventDate : '';
  const project = await db.put('projects', {
    name: `${client.name} — Website inquiry`,
    clientId: client.id,
    status: 'lead',
    eventDate,
    endDate: eventDate,
    startTime: '', endTime: '',
    venue: '',
    inHouse: false,
    lines,
    discountCents: 0,
    notes: 'Imported from the public catalog wishlist widget.',
    quoteNumber: nextQuoteNumber(projects),
    signature: null,
    createdAt: new Date().toISOString(),
  });

  toast(`Wishlist imported — new lead for ${client.name}`);
  navigate(`#/projects/${project.id}`);
}

registerView('settings', {
  title: 'Settings',
  icon: '⚙️',
  async render(el) {
    await db.ready;
    const company = (await db.get('settings', 'company')) || { id: 'company' };

    // ---- Business profile -------------------------------------------------
    const f = {};
    const field = (label, key, attrs = {}, help = null) => h('label', { class: 'field' },
      label,
      f[key] = h('input', { value: company[key] ?? '', ...attrs }),
      help ? h('span', { class: 'stock-note' }, help) : null);

    const profileCard = h('div', { class: 'card' },
      h('h2', null, icon('wreath'), ' Business profile'),
      h('p', { class: 'subtitle' }, 'Shown on quotes, contracts, and invoices.'),
      h('div', { class: 'form-grid' },
        field('Business name', 'name'),
        field('Tagline', 'tagline'),
        field('Email', 'email', { type: 'email' }),
        field('Phone', 'phone', { type: 'tel' }),
        field('Street address', 'address'),
        field('City', 'city'),
        field('State / region', 'region')),
      h('p', null,
        h('button', {
          class: 'btn btn-primary',
          onClick: async () => {
            const latest = (await db.get('settings', 'company')) || { id: 'company' };
            await db.put('settings', {
              ...latest,
              id: 'company',
              name: f.name.value.trim() || 'The Poppy Creative',
              tagline: f.tagline.value.trim(),
              email: f.email.value.trim(),
              phone: f.phone.value.trim(),
              address: f.address.value.trim(),
              city: f.city.value.trim(),
              region: f.region.value.trim(),
            });
            toast('Business profile saved');
          },
        }, 'Save profile')));

    // ---- Policies ---------------------------------------------------------
    const p = {};
    const policyField = (label, key, help, attrs = {}) => h('label', { class: 'field' },
      label,
      p[key] = h('input', { type: 'number', min: '0', step: attrs.step || '1', max: attrs.max, value: company[key] ?? 0 }),
      h('span', { class: 'stock-note' }, help));

    const policiesCard = h('div', { class: 'card' },
      h('h2', null, icon('branch'), ' Policies'),
      h('p', { class: 'subtitle' }, "These mirror The Poppy Creative's published booking policies and drive all money math."),
      h('div', { class: 'form-grid' },
        policyField('Deposit %', 'depositPct',
          'Percent of the total due up front to hold a date. Poppy policy: 50%.', { max: '100' }),
        policyField('Balance due (days before event)', 'balanceDueDaysBefore',
          'The remaining balance is due this many days before the event. Poppy policy: 30 days.'),
        policyField('In-house rental discount %', 'inHouseDiscountPct',
          'Discount applied to rental items when the event is hosted at the venue. Poppy policy: 70%.', { max: '100' }),
        policyField('Tax %', 'taxPct',
          'Sales tax applied to the taxable subtotal. Default: 5% (ND state rate).', { step: '0.1', max: '100' })),
      h('p', null,
        h('button', {
          class: 'btn btn-primary',
          onClick: async () => {
            const latest = (await db.get('settings', 'company')) || { id: 'company' };
            await db.put('settings', {
              ...latest,
              id: 'company',
              depositPct: Math.min(100, Math.max(0, numFrom(p.depositPct, 50))),
              balanceDueDaysBefore: Math.max(0, Math.round(numFrom(p.balanceDueDaysBefore, 30))),
              inHouseDiscountPct: Math.min(100, Math.max(0, numFrom(p.inHouseDiscountPct, 70))),
              taxPct: Math.min(100, Math.max(0, numFrom(p.taxPct, 5))),
            });
            toast('Policies saved');
          },
        }, 'Save policies')));

    // ---- Data -------------------------------------------------------------
    const dataCard = h('div', { class: 'card' },
      h('h2', null, icon('sprout'), ' Data'),
      h('p', { class: 'subtitle' }, 'Everything lives in your browser (IndexedDB). Back it up regularly.'),
      h('div', { class: 'chip-row' },
        h('button', {
          class: 'btn',
          onClick: async () => {
            const data = await db.exportJSON();
            downloadFile(`poppyshuffle-backup-${todayISO()}.json`, JSON.stringify(data, null, 2));
            toast('Backup exported');
          },
        }, icon('leaf', 18), ' Export backup (JSON)'),
        h('button', {
          class: 'btn',
          onClick: () => pickFile('.json,application/json', async text => {
            let parsed;
            try {
              parsed = JSON.parse(text);
            } catch {
              toast('That file is not valid JSON.', 'bad');
              return;
            }
            const ok = await confirmDialog('Importing a backup REPLACES all current data with the contents of the file. Continue?');
            if (!ok) return;
            try {
              await db.importJSON(parsed);
              toast('Backup imported');
            } catch (err) {
              toast(`Import failed: ${err?.message || err}`, 'bad');
            }
          }),
        }, icon('bud', 18), ' Import backup'),
        h('button', {
          class: 'btn btn-danger',
          onClick: async () => {
            const ok = await confirmDialog('Reset everything back to the demo data? All current data will be lost.');
            if (!ok) return;
            await db.resetToSeed();
            toast('Reset to demo data');
          },
        }, icon('sprout', 18), ' Reset to demo data')));

    // ---- Website integration ----------------------------------------------
    const embedSnippet = [
      '<iframe',
      '  src="https://YOUR-SITE.example/poppyshuffle/embed/catalog.html"',
      '  style="border:0;width:100%;min-height:900px"',
      '  title="The Poppy Creative — Rental Collections"',
      '  loading="lazy"></iframe>',
    ].join('\n');

    const websiteCard = h('div', { class: 'card' },
      h('h2', null, icon('vine'), ' Website integration'),
      h('p', null,
        'PoppyShuffle ships with a public rental catalog and wishlist widget (',
        h('a', { href: 'embed/catalog.html', target: '_blank', rel: 'noopener' }, 'preview the catalog'),
        ') that you can embed on poppycreates.com. Visitors browse your active inventory, build a wishlist, and request a quote.'),
      h('p', null, 'Embed it on your marketing site with this snippet:'),
      h('pre', {
        class: 'card-tight',
        style: 'background:var(--surface-2);border:1px solid var(--line);border-radius:10px;padding:.7rem .8rem;overflow-x:auto;font-size:.78rem;margin:.4rem 0',
      }, embedSnippet),
      h('div', { class: 'chip-row' },
        h('button', {
          class: 'btn btn-sm',
          onClick: () => {
            navigator.clipboard?.writeText(embedSnippet)
              .then(() => toast('Embed snippet copied'))
              .catch(() => toast('Could not copy — select and copy the snippet manually.', 'bad'));
          },
        }, icon('branch', 16), ' Copy'),
        h('button', {
          class: 'btn btn-sm btn-primary',
          onClick: () => pickFile('.json,application/json', importWishlist),
        }, icon('bud', 16), ' Import wishlist')),
      h('p', { class: 'stock-note', style: 'margin-top:.6rem' },
        'When a visitor submits a wishlist, the widget produces a small JSON file (in a hosted deployment it would be sent to you automatically). Use "Import wishlist" to bring that file in — it creates the client (matched by email if they already exist) and a new lead project with their requested items priced from your current inventory.'));

    // ---- Payments & Commerce ----------------------------------------------
    const pay = {};
    const payField = (label, key, attrs, help) => h('label', { class: 'field' },
      label,
      pay[key] = h('input', { value: company[key] ?? '', ...attrs }),
      h('span', { class: 'stock-note' }, help));

    const paymentsCard = h('div', { class: 'card' },
      h('h2', null, icon('stems'), ' Payments & Commerce'),
      h('p', { class: 'subtitle' },
        'Get paid online. A payment link works today with zero hosting; the optional Medusa fields connect a full self-hosted storefront.'),
      h('div', { class: 'form-grid' },
        payField('Payment link URL', 'paymentLinkURL',
          { type: 'url', placeholder: 'https://buy.stripe.com/…' },
          'A payment link from Stripe, Square, or PayPal. When set, every invoice shows a prominent "Pay online" box with this link.'),
        h('label', { class: 'field' },
          'Payment instructions',
          pay.paymentInstructions = h('textarea', {
            rows: '3',
            placeholder: 'Pay online at the link below, or by check to The Poppy Creative…',
            value: company.paymentInstructions ?? '',
          }),
          h('span', { class: 'stock-note' },
            'Optional. Printed on invoices above the payment link — mention checks, cash, or transfer details here.')),
        payField('Medusa URL (optional)', 'medusaURL',
          { type: 'url', placeholder: 'https://shop.poppycreates.com' },
          'Base URL of a self-hosted Medusa server. Together with the publishable key, this activates the storefront adapter — see docs/MEDUSA.md.'),
        payField('Medusa publishable API key (optional)', 'medusaPublishableKey',
          { placeholder: 'pk_…' },
          'Publishable API key from the Medusa admin (Settings → Publishable API Keys). Safe to store here — it only grants read access to the public store API.')),
      h('p', null,
        h('button', {
          class: 'btn btn-primary',
          onClick: async () => {
            const latest = (await db.get('settings', 'company')) || { id: 'company' };
            await db.put('settings', {
              ...latest,
              id: 'company',
              paymentLinkURL: pay.paymentLinkURL.value.trim(),
              paymentInstructions: pay.paymentInstructions.value.trim(),
              medusaURL: pay.medusaURL.value.trim().replace(/\/+$/, ''),
              medusaPublishableKey: pay.medusaPublishableKey.value.trim(),
            });
            toast('Payment settings saved');
          },
        }, 'Save payment settings')));

    // ---- About ------------------------------------------------------------
    const aboutCard = h('div', { class: 'card' },
      h('h2', null, icon('flower'), ' About PoppyShuffle'),
      h('p', null,
        'PoppyShuffle is an open-source event & rental management platform — an alternative to Goodshuffle Pro — covering inventory, quotes, contracts, invoicing, payments, availability, and reporting for venues and event-rental businesses.'),
      h('p', null,
        'It is free and open source: no build step, no server, plain ES modules on top of IndexedDB, deployable on any static host and installable as a PWA. Themed and seeded for The Poppy Creative of Mandan, ND.'),
      h('p', { class: 'stock-note' }, `Version ${APP_VERSION}`));

    el.append(
      h('div', { class: 'view-head' },
        h('div', { class: 'grow' },
          h('h1', null, icon('daisy', 22), ' Settings'),
          h('p', { class: 'subtitle' }, 'Business profile, policies, data, website integration, and payments.'))),
      profileCard, policiesCard, dataCard, websiteCard, paymentsCard, aboutCard);
  },
});
