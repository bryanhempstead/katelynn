// Shared constants, formatting, and money math. Single source of truth for totals.

export const PROJECT_STATUSES = ['lead', 'quote', 'signed', 'completed', 'cancelled'];

export const STATUS_META = {
  lead:      { label: 'Lead',      color: 'var(--gold)' },
  quote:     { label: 'Quote',     color: 'var(--sage)' },
  signed:    { label: 'Signed',    color: 'var(--poppy)' },
  completed: { label: 'Completed', color: 'var(--ink-soft)' },
  cancelled: { label: 'Cancelled', color: 'var(--muted)' },
};

export const ITEM_TYPES = ['rental', 'space', 'service'];

export const CATEGORIES = [
  'Seating', 'Tables', 'Backdrops', 'Rugs', 'Decor', 'Tableware & Linens',
  'Spaces', 'Services',
];

export const PAYMENT_METHODS = ['card', 'cash', 'check', 'transfer', 'other'];
export const PAYMENT_KINDS = ['deposit', 'balance', 'refund', 'other'];

export function fmtMoney(cents, { sign = false } = {}) {
  const n = (cents ?? 0) / 100;
  const s = n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  return sign && cents > 0 ? `+${s}` : s;
}

export function parseMoney(str) {
  if (typeof str === 'number') return Math.round(str * 100);
  const n = parseFloat(String(str ?? '').replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
}

export function addDaysISO(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function rangesOverlap(aFrom, aTo, bFrom, bTo) {
  return (aFrom <= (bTo || bFrom)) && ((aTo || aFrom) >= bFrom);
}

// The single source of truth for project money math.
export function projectTotals(project, settings, payments = []) {
  const lines = project.lines || [];
  let subtotal = 0;
  let inHouseDiscount = 0;
  const inHousePct = project.inHouse ? (settings?.inHouseDiscountPct ?? 0) : 0;

  for (const line of lines) {
    const ext = (line.priceCents || 0) * (line.qty || 0);
    subtotal += ext;
    if (inHousePct && line.type === 'rental') {
      inHouseDiscount += Math.round(ext * inHousePct / 100);
    }
  }

  const discount = Math.min(project.discountCents || 0, subtotal - inHouseDiscount);
  const taxable = Math.max(0, subtotal - inHouseDiscount - discount);
  const tax = Math.round(taxable * ((settings?.taxPct ?? 0) / 100));
  const total = taxable + tax;

  const paid = payments
    .filter(p => p.projectId === project.id)
    .reduce((s, p) => s + (p.kind === 'refund' ? -(p.amountCents || 0) : (p.amountCents || 0)), 0);

  const depositDue = Math.round(total * ((settings?.depositPct ?? 50) / 100));
  const balanceDue = Math.max(0, total - paid);
  const balanceDueDate = project.eventDate
    ? addDaysISO(project.eventDate, -(settings?.balanceDueDaysBefore ?? 30))
    : null;

  return { subtotal, inHouseDiscount, discount, taxable, tax, total, paid, depositDue, balanceDue, balanceDueDate };
}

export function nextQuoteNumber(projects) {
  let max = 1000;
  for (const p of projects) {
    const m = /^PS-(\d+)$/.exec(p.quoteNumber || '');
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PS-${max + 1}`;
}
