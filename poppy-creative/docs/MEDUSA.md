# Online payments & e-commerce (Medusa)

PoppyShuffle can take money online two ways:

1. **Payment links on invoices** — works **today**, zero hosting, five minutes to set up.
2. **A self-hosted [Medusa](https://medusajs.com) storefront** — full e-commerce (catalog, cart, checkout, orders) when you're ready to run a small server.

Do #1 now. Add #2 whenever you want a real shop.

## Works today: payment links on invoices

Stripe, Square, and PayPal all offer free "payment links" — a hosted checkout page at a URL you copy once:

- Stripe: Dashboard → Payment Links → **+ New** (or a reusable "customer chooses amount" link)
- Square: Dashboard → Online Checkout → **Create link**
- PayPal: [paypal.me](https://paypal.me) or Business → Pay Links

Then in the app: **Settings → Payments & Commerce** → paste the URL into **Payment link URL**, optionally add **Payment instructions** (e.g. *"Pay online at the link below, or by check to The Poppy Creative"*), and save.

Every **invoice** now renders a prominent **"Pay online"** box after the totals, with your instructions and the link. Quotes, contracts, and pull sheets are unchanged. Clear the field to remove the box.

That's it — clients click the link on the emailed/printed invoice and pay by card. You record the payment in the project as usual.

## The Medusa option

**What it is.** Medusa is an open-source, self-hostable commerce platform (a Shopify alternative): product catalog, carts, checkout, payments (Stripe/PayPal plugins), orders, customers, and a full admin dashboard. MIT-licensed, no fees to Medusa itself.

**Why it can't run inside this app.** PoppyShuffle is deliberately a static app — plain ES modules on any static host, data in your browser's IndexedDB, no server. Medusa is the opposite: a long-running **Node.js server backed by Postgres (+ Redis)**. A static host can't run either. So Medusa runs elsewhere, and PoppyShuffle talks to it over its REST API via the adapter in `js/medusa.js`.

### Hosting options

| Option | Cost | Notes |
|---|---|---|
| Any small VPS (Hetzner, DigitalOcean, Linode, …) | ~$5–10/mo | Install Docker, use the compose file below. Most control. |
| Railway | ~$5+/mo usage | Medusa deploy templates exist; Postgres + Redis as managed add-ons. |
| Render | free tier is too small in practice; ~$7+/mo | Web service + managed Postgres; Redis via Key Value store. |

Anywhere that runs Node 20+ with a Postgres you can reach will do.

### Setup — the standard way (any machine with Node 20+ and Postgres)

```bash
npx create-medusa-app@latest my-shop
cd my-shop
npm run dev          # API + admin dashboard on http://localhost:9000
```

The wizard scaffolds the server, asks for a Postgres connection, runs migrations, and prompts you to create an admin user. For production on a VPS/Railway/Render, follow Medusa's deployment docs: build with `npx medusa build`, run the `.medusa/server` bundle with `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `COOKIE_SECRET`, and CORS env vars set.

### Setup — Docker Compose (recommended for a VPS)

A production-shaped stack lives in this repo at `medusa/` (`docker-compose.yml` + `Dockerfile`). There is **no official all-in-one Medusa image**, so it's a documented two-step: scaffold the app, then compose builds it.

```bash
cd medusa

# 1. Scaffold the Medusa app into medusa/app (one time).
#    Easiest: start the stack's own database first and point the wizard at it.
docker compose up -d postgres
npx create-medusa-app@latest app \
  --db-url "postgres://medusa:CHANGE-ME-db-password@localhost:5432/medusa"

# 2. Edit docker-compose.yml: replace every CHANGE-ME
#    (db password, JWT_SECRET, COOKIE_SECRET — use `openssl rand -hex 32` —
#    and the CORS origins, including the origin PoppyShuffle is served from).

# 3. Build and run everything (postgres + redis + medusa on port 9000).
docker compose up -d --build

# 4. Create your admin login, then open http://<host>:9000/app
docker compose exec medusa npx medusa user -e you@example.com -p <password>
```

Migrations run automatically on each start. Put a TLS reverse proxy (Caddy, nginx, Traefik) in front of port 9000 for a public host.

### Connect PoppyShuffle to your Medusa server

1. In the Medusa admin (`/app`): **Settings → Publishable API Keys** → create/copy a key (`pk_…`). Publishable keys are safe in a browser — they only allow public *reads* of the store.
2. Make sure the server's `STORE_CORS` includes the origin PoppyShuffle is served from.
3. In PoppyShuffle: **Settings → Payments & Commerce** → fill **Medusa URL** (e.g. `https://shop.poppycreates.com`) and **Medusa publishable API key** → save.

The adapter (`js/medusa.js`) is now active (`isConfigured()` returns true).

### What the adapter does today

- `isConfigured(settings)` — true when both Medusa fields are set.
- `pullProducts(settings)` — reads the full storefront catalog via the documented Medusa v2 route `GET {medusaURL}/store/products` (with the `x-publishable-api-key` header), following pagination; returns raw Medusa products. `productToInventoryItem(product)` maps one into PoppyShuffle's inventory shape.
- `createPaymentLink(settings, project, totals)` — composes a `{medusaURL}/checkout?…` URL carrying the quote number, project name, and amount due (integer cents), for a storefront checkout page to consume; returns `null` if Medusa isn't configured.

No view calls these yet — they are the integration surface for a future storefront/sync UI. Everything is defensive: network failures surface as clear error messages, never crashes.

### Future: admin push sync

`pushInventory(settings, items)` — pushing PoppyShuffle inventory into Medusa as products — is a **deliberate stub that throws**. Creating products uses Medusa's *Admin* API, which needs an admin token; embedding an admin token in a public static browser app would give anyone with dev tools full write access to your shop. It becomes viable once there's a server-side home for that credential (a tiny proxy, or a scheduled job on the same VPS). Until then: manage products in the Medusa admin dashboard, and pull them into the app with `pullProducts()`.

### Bottom line

- **Today:** paste a Stripe/Square/PayPal link into Settings and your invoices are payable online.
- **Later:** stand up `medusa/docker-compose.yml` on a $5–10 VPS, drop the URL + publishable key into Settings, and the storefront adapter lights up.
