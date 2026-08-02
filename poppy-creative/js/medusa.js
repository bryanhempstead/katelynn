// Medusa storefront adapter for PoppyShuffle.
//
// Medusa (https://medusajs.com) is an open-source commerce platform — a
// self-hostable Shopify alternative. It runs as its own Node + Postgres
// server, which a static app cannot provide, so this module is a thin REST
// client against a Medusa v2 server the owner hosts elsewhere.
// Setup & hosting guide: docs/MEDUSA.md. Deploy scaffold: medusa/.
//
// Configuration lives on the company settings record ({id:'company'}):
//   medusaURL            — base URL of the Medusa server, e.g. https://shop.example.com
//   medusaPublishableKey — publishable API key (public, read-only Store API access)
// Both are edited in Settings → Payments & Commerce.
//
// What works today:
//   isConfigured(settings)                    — are both fields set?
//   pullProducts(settings)                    — read the storefront catalog
//                                               (GET /store/products, paginated)
//   createPaymentLink(settings, project, totals) — compose a checkout URL
//   productToInventoryItem(product)           — map a Medusa product to the
//                                               app's inventory record shape
// Documented stub (needs an admin API token, which we deliberately do NOT
// store in the browser):
//   pushInventory(settings, items)            — always throws; see docs/MEDUSA.md
//
// Design rules: ES module, zero dependencies, imports nothing from the app
// (safe to load anywhere), never touches the network unless explicitly called,
// and every fetch is wrapped so a down/misconfigured server produces a clear
// Error — never an app crash. Views do not call this yet; it is the
// integration surface for a future storefront view.

const REQUEST_TIMEOUT_MS = 10_000;
const PAGE_SIZE = 100;
const MAX_PAGES = 50; // safety cap: 5,000 products is plenty for a rental shop

/** Normalized base URL ('' when unset). Trailing slashes stripped. */
function baseURL(settings) {
  return String(settings?.medusaURL || '').trim().replace(/\/+$/, '');
}

function publishableKey(settings) {
  return String(settings?.medusaPublishableKey || '').trim();
}

/**
 * True when both Medusa fields are present and the URL looks like http(s).
 * Views should call this before offering any Medusa action.
 */
export function isConfigured(settings) {
  const url = baseURL(settings);
  return /^https?:\/\//i.test(url) && publishableKey(settings).length > 0;
}

/**
 * GET a Store API path with the publishable key header.
 * Resolves to parsed JSON; rejects with a human-readable Error on any
 * failure (unreachable host, timeout, non-2xx, bad key, non-JSON body).
 */
async function storeGet(settings, path) {
  const url = `${baseURL(settings)}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let res;
  try {
    res = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        // Medusa v2 Store API authenticates public reads with this header.
        'x-publishable-api-key': publishableKey(settings),
      },
      signal: controller.signal,
    });
  } catch (err) {
    throw new Error(err?.name === 'AbortError'
      ? `Medusa server timed out after ${REQUEST_TIMEOUT_MS / 1000}s (${url}).`
      : `Could not reach the Medusa server at ${baseURL(settings)} — is it running and reachable from this browser? (${err?.message || err})`);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error('Medusa rejected the publishable API key (HTTP ' + res.status + '). Check Settings → Payments & Commerce against the key in your Medusa admin.');
  }
  if (!res.ok) {
    throw new Error(`Medusa request failed: HTTP ${res.status} for ${path}.`);
  }
  try {
    return await res.json();
  } catch {
    throw new Error(`Medusa returned a non-JSON response for ${path} — is medusaURL pointing at the server root?`);
  }
}

/**
 * Read the full product catalog from the Medusa Store API.
 * Uses the documented v2 route GET {url}/store/products with the
 * x-publishable-api-key header, following limit/offset pagination.
 *
 * Returns the raw Medusa product objects (id, title, handle, description,
 * thumbnail, variants, …) so callers keep full fidelity; use
 * productToInventoryItem() to map one into the app's inventory shape.
 * Note: variant prices only appear when the request is region-scoped
 * (region_id / calculated_price fields) — priceCents mapping is best-effort.
 */
export async function pullProducts(settings) {
  if (!isConfigured(settings)) {
    throw new Error('Medusa is not configured — set the Medusa URL and publishable API key in Settings → Payments & Commerce (see docs/MEDUSA.md).');
  }
  const products = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const offset = page * PAGE_SIZE;
    const data = await storeGet(settings, `/store/products?limit=${PAGE_SIZE}&offset=${offset}`);
    const batch = Array.isArray(data?.products) ? data.products : [];
    products.push(...batch);
    const count = Number(data?.count);
    if (batch.length < PAGE_SIZE) break;
    if (Number.isFinite(count) && products.length >= count) break;
  }
  return products;
}

/**
 * Map one Medusa product to the app's inventory record shape
 * (see ARCHITECTURE.md). No id — callers decide whether to create or merge.
 * priceCents is taken from the first variant's calculated price when the
 * server included one (region-scoped requests), otherwise 0 ("to be priced").
 */
export function productToInventoryItem(product) {
  const variant = Array.isArray(product?.variants) ? product.variants[0] : null;
  const calc = variant?.calculated_price?.calculated_amount;
  return {
    name: String(product?.title || 'Untitled product'),
    category: 'Decor',
    type: 'rental',
    description: String(product?.description || ''),
    priceCents: Number.isFinite(calc) ? Math.round(calc * 100) : 0,
    unit: 'per event',
    stockQty: 1,
    imageEmoji: '🛍️',
    color: '#E8B44F',
    tags: ['medusa', product?.handle].filter(Boolean).map(String),
    active: product?.status ? product.status === 'published' : true,
    notes: product?.id ? `Imported from Medusa (product ${product.id}).` : 'Imported from Medusa.',
  };
}

/**
 * Push app inventory into Medusa as products.
 *
 * DELIBERATE STUB. Creating/updating products uses Medusa's Admin API
 * (POST /admin/products …), which requires an admin auth token. Shipping an
 * admin token inside a public, static, in-browser app would hand full write
 * access to the shop to anyone who opens dev tools — so this stays a stub
 * until there is a server-side place to hold that credential (see
 * docs/MEDUSA.md, "Future: admin push sync"). Until then, manage products in
 * the Medusa admin dashboard and use pullProducts() to read them back here.
 *
 * @throws {Error} always
 */
export async function pushInventory(settings, items) {
  void settings; void items;
  throw new Error('pushInventory requires an admin API token, which this app deliberately does not store in the browser — see docs/MEDUSA.md. Manage products in the Medusa admin dashboard, or use pullProducts() to read the catalog.');
}

/**
 * Compose a checkout URL on the configured Medusa storefront for an invoice
 * or quote, carrying enough context (quote number, project name, amount due)
 * for the storefront to greet the client and reconcile the payment.
 * Purely local — no network. Returns null when Medusa is not configured.
 *
 * @param {object} settings  company settings record
 * @param {object} project   project record (quoteNumber, name, id)
 * @param {object} totals    result of projectTotals() — integer cents
 * @returns {Promise<string|null>}
 */
export async function createPaymentLink(settings, project, totals) {
  if (!isConfigured(settings)) return null;
  const params = new URLSearchParams();
  if (project?.quoteNumber) params.set('ref', String(project.quoteNumber));
  if (project?.name) params.set('description', String(project.name));
  const due = Number.isFinite(totals?.balanceDue) ? totals.balanceDue
    : Number.isFinite(totals?.total) ? totals.total : null;
  if (due != null) {
    params.set('amount', String(due)); // integer cents, matching the app's money math
    params.set('currency', String(settings?.currency || 'USD').toLowerCase());
  }
  return `${baseURL(settings)}/checkout?${params.toString()}`;
}
