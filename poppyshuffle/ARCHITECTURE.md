# PoppyShuffle — Architecture Contract

Open-source event & rental management platform (a Goodshuffle Pro alternative),
seeded and themed for **The Poppy Creative** (poppycreates.com) — a venue,
event-rental, craft-class, and coworking business in Mandan, ND.

## Product surfaces

1. **Web app** — `/poppyshuffle/index.html`. No build step, plain ES modules,
   deployable on any static host (this repo is a GitHub Pages site).
2. **Mobile** — installable PWA (`manifest.webmanifest` + `sw.js`), fully
   responsive, offline-first; full read/edit of the same data.
3. **Desktop** — Electron scaffold in `desktop/` wrapping the same app.
4. **Website integration** — `embed/` public catalog + wishlist widget that a
   marketing site embeds; wishlists import into the app as new quotes.

## Data layer

`js/db.js` — IndexedDB database `poppyshuffle` with object stores:

- `settings` — singleton record `{id:'company', ...}`; business profile & policies.
- `inventory` — rental items, spaces, and services.
- `clients` — CRM contacts.
- `projects` — events/orders; embedded line items; quote → contract → invoice.
- `payments` — payment records referencing `projectId`.

### db.js public API (contract — do not change signatures)

```js
await db.ready;                      // resolves after open + first-run seeding
await db.all(store);                 // -> array
await db.get(store, id);             // -> object | undefined
await db.put(store, obj);            // assigns obj.id (crypto.randomUUID) and
                                     // obj.updatedAt if missing; returns obj
await db.bulkPut(store, objs);
await db.remove(store, id);
await db.exportJSON();               // -> plain object {version, exportedAt, stores:{...}}
await db.importJSON(data, {merge});  // replaces (default) or merges by id
db.onChange(fn);                     // fn(storeName) after any write; returns unsubscribe
await db.resetToSeed();              // wipe + reseed
```

### Entity shapes (all money in **integer cents**, dates as `'YYYY-MM-DD'`, times `'HH:MM'`)

```js
// settings ('company' singleton)
{ id:'company', name, tagline, email, phone, address, city, region,
  depositPct: 50,            // 50% deposit up front (real Poppy policy)
  balanceDueDaysBefore: 30,  // balance due 30 days before event (real policy)
  inHouseDiscountPct: 70,    // in-house rental discount when hosting at venue (real policy)
  taxPct: 5.0,               // ND state rate default, editable
  currency:'USD', theme:'poppy' }

// inventory
{ id, name, category,        // e.g. 'Seating','Tables','Backdrops','Rugs','Decor','Spaces','Services'
  type,                      // 'rental' | 'space' | 'service'
  description, priceCents,   // rental: per event; space: per day; service: per session
  unit,                      // 'per event' | 'per day' | 'per hour' | 'per session'
  stockQty,                  // spaces/services: 1..n; availability checks use this
  imageEmoji,                // no external images; emoji + color swatch placeholder
  color,                     // hex accent used for the catalog card
  tags: [], active: true, notes }

// clients
{ id, name, company, email, phone, source, notes, createdAt }

// projects  (one record per event/order)
{ id, name, clientId,
  status,                    // 'lead' | 'quote' | 'signed' | 'completed' | 'cancelled'
  eventDate, endDate,        // endDate defaults to eventDate (multi-day allowed)
  startTime, endTime, venue, // venue: free text or a space name
  inHouse: false,            // true -> inHouseDiscountPct applies to type==='rental' lines
  lines: [ { itemId, name, qty, priceCents, type } ],   // snapshot of price at add time
  discountCents: 0, notes,
  quoteNumber,               // 'PS-1042' style, assigned by projects view
  signature: null | { name, signedAt },   // contract e-sign
  createdAt, updatedAt }

// payments
{ id, projectId, amountCents, method,   // 'card'|'cash'|'check'|'transfer'|'other'
  date, kind,                            // 'deposit' | 'balance' | 'refund' | 'other'
  note }
```

### Money math (shared, in `js/schema.js`)

`projectTotals(project, settings)` returns
`{ subtotal, discount, inHouseDiscount, taxable, tax, total, depositDue, paidApplied }`
— single source of truth used by quote builder, docs, dashboard, and reports.

## App shell & routing

`js/app.js` (owner: manager) — hash router. Views self-register:

```js
import { registerView } from '../app.js';
registerView('inventory', { title:'Inventory', icon:'📦',
  async render(el){ /* fill el */ } });
```

Routes: `#/dashboard` `#/inventory` `#/projects` `#/projects/:id` `#/clients`
`#/calendar` `#/reports` `#/settings`. `app.js` exposes helpers:
`h(tag, attrs, ...children)` DOM builder, `fmtMoney(cents)`, `fmtDate(iso)`,
`toast(msg)`, `confirmDialog(msg)`, `openModal({title, body, actions})`,
`navigate(route)`. Views re-render on `db.onChange`.

## Availability engine (`js/availability.js`)

`bookedQty(itemId, dateFrom, dateTo, {excludeProjectId, statuses})` — sums line
qty across projects whose `[eventDate, endDate]` ranges overlap the query.
`signed` = hard hold; `quote` = soft hold. `checkProject(project)` returns an
array of conflicts `{itemId, name, requested, stock, hardBooked, softBooked}`.
The quote builder must surface conflicts inline; calendar shows per-day load.

## Documents (`js/docs.js`)

`renderDoc(kind, project, client, settings)` -> HTML string for
`kind: 'quote' | 'contract' | 'invoice'`; opened in a print-friendly window
(print = PDF). Contract includes Poppy policies (deposit, balance timing,
in-house discount) + e-signature capture stored on the project.

## File ownership (agents stay inside their own files)

- Manager: `ARCHITECTURE.md`, `index.html`, `css/app.css`, `js/app.js`,
  `js/db.js`, `js/schema.js`, `js/seed.js`
- Agent B: `js/availability.js`, `js/views/inventory.js`, `js/views/calendar.js`
- Agent C: `js/views/clients.js`, `js/views/projects.js`, `js/docs.js`
- Agent D: `js/views/dashboard.js`, `js/views/reports.js`, `js/views/settings.js`,
  `embed/catalog.html`, `embed/widget.js`
- Agent E: `manifest.webmanifest`, `sw.js`, `icons/`, `desktop/*`, `README.md`,
  `docs/*`

## Style

Poppy brand: warm cream surfaces, poppy red/coral primary `#E4593B`, deep
green ink `#233329`, sage `#8BA888`, golden accent `#E8B44F`. Serif display
(`Fraunces`-style stack falling back to Georgia), system sans body. Rounded
cards, soft shadows. Dark mode via `prefers-color-scheme` + manual toggle.
All CSS custom properties are defined in `css/app.css` — views use them, never
hard-code colors.
