# PoppyShuffle 🌺

**Open-source event & rental management** — an alternative to Goodshuffle Pro, built for and seeded with the real-world shape of [The Poppy Creative](https://poppycreates.com) (Mandan, ND): event venue, rental collections, craft classes, and coworking.

No build step, no server, no accounts. One static web app (plain ES modules + IndexedDB) that runs as a website, an installable mobile PWA, and a desktop app.

## What it is

PoppyShuffle covers the day-to-day of an event venue & rental business: track inventory, check what's actually available on a date, turn a lead into a quote, get the contract e-signed, invoice it, take payments, and see how the business is doing — all from one place, entirely on your own device.

## Feature tour

- **Inventory & real-time availability** — rentals, spaces, and services with stock quantities. The availability engine sums bookings across overlapping date ranges: signed projects are hard holds, open quotes are soft holds, and conflicts surface right in the quote builder and calendar.
- **Quotes → Contracts → e-sign** — build a quote from inventory with price snapshots, per-project discounts, and automatic conflict warnings; generate a print-friendly contract (print = PDF) that includes Poppy's policies and captures a typed e-signature stored on the project.
- **Invoices & payments** — invoices from the same single source of money truth (`projectTotals`), with deposit/balance tracking and payment records (card, cash, check, transfer).
- **CRM** — clients with company, contact info, lead source, and notes, linked to their projects.
- **Calendar & space bookings** — month view of events and per-day inventory load across The Meadow, The Wildflower, and The Grove.
- **Dashboard** — pipeline by status, upcoming events, money in flight.
- **Reports & CSV** — revenue and utilization summaries, exportable to CSV.
- **Website integration** — an embeddable public catalog (`embed/catalog.html`) with a wishlist widget; visitors build a wishlist on your marketing site and it imports into the app as a new quote. See [docs/WEBSITE-INTEGRATION.md](docs/WEBSITE-INTEGRATION.md).

## The Poppy Creative specifics

Seed data models the real business:

- **Three spaces** — **The Meadow** (event venue, per day), **The Wildflower** (drop-in coworking), **The Grove** (workshop/gathering space).
- **Collections** — the event rental catalog (seating, tables, backdrops, rugs, decor).
- **Craft classes** and **marketing & design services** as bookable service items.
- **Policies, seeded in Settings** — 50% deposit up front, balance due 30 days before the event, and a 70% in-house rental discount when the event is hosted at the venue. All editable in Settings.

## Getting started

It's a static site — serve the folder any way you like:

```bash
cd poppyshuffle
python3 -m http.server 8000
# open http://localhost:8000/
```

Or just visit the deployed site at `/poppyshuffle/` on this repo's GitHub Pages host. First run seeds the demo data automatically; **Settings → Reset to seed** restores it.

## Platforms

- **Web** — any modern browser; fully responsive.
- **Mobile (PWA)** — installable and offline-first via `manifest.webmanifest` + `sw.js`. Install steps in [docs/MOBILE.md](docs/MOBILE.md).
- **Desktop** — Electron scaffold in [`desktop/`](desktop/README.md), or install the PWA from Chrome/Edge. See [docs/DESKTOP.md](docs/DESKTOP.md).

## Data & privacy

All data lives **locally in your browser's IndexedDB** — there is no server, no sync, no analytics, no tracking. Back up and move data with **Settings → Export backup** (a single JSON file of every store) and **Settings → Import backup** (replace or merge). That JSON file is the entire database; keep it somewhere safe.

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for the data model, module contracts, availability engine, and document generation.

## License

MIT.

**Disclaimer:** all pricing in the seed data is placeholder demo data, not The Poppy Creative's published rates. PoppyShuffle is an independent open-source project and is not affiliated with, endorsed by, or connected to Goodshuffle or Goodshuffle Pro.
