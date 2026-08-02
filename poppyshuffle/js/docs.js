// Printable documents (quote / contract / invoice) for PoppyShuffle.
// Owner: Agent C. Builds standalone HTML strings opened in a new window.
// IMPORTANT: imports schema.js ONLY (never app.js — avoids circular deps).
import { fmtMoney, fmtDate, todayISO, projectTotals } from './schema.js';

// Escape every user-provided string interpolated into the HTML.
function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const DOC_TITLES = { quote: 'QUOTE', contract: 'RENTAL CONTRACT', invoice: 'INVOICE' };

const KIND_LABELS = { deposit: 'Deposit', balance: 'Balance', refund: 'Refund', other: 'Payment' };

function docStyles() {
  return `
    * { box-sizing: border-box; }
    body {
      margin: 0; padding: 2.2rem 2.4rem; color: #233329; background: #fff;
      font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      max-width: 820px; margin-inline: auto;
    }
    h1, h2, h3 { font-family: "Fraunces", "Iowan Old Style", Georgia, "Times New Roman", serif; margin: 0; }
    .doc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;
      border-bottom: 3px solid #E4593B; padding-bottom: 1rem; margin-bottom: 1.4rem; }
    .biz-name { font-size: 1.6rem; color: #E4593B; }
    .biz-sub { color: #4a5a50; font-size: .82rem; letter-spacing: .05em; text-transform: uppercase; margin-top: .2rem; }
    .biz-contact { color: #4a5a50; font-size: .8rem; margin-top: .4rem; }
    .doc-meta { text-align: right; }
    .doc-title { font-size: 1.35rem; letter-spacing: .12em; color: #233329; }
    .doc-num { color: #E4593B; font-weight: 700; margin-top: .2rem; }
    .doc-date { color: #4a5a50; font-size: .82rem; margin-top: .2rem; }
    .blocks { display: flex; justify-content: space-between; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 1.4rem; }
    .block h3 { font-size: .78rem; letter-spacing: .08em; text-transform: uppercase; color: #8b948d; margin-bottom: .25rem; }
    .block p { margin: 0; }
    table { width: 100%; border-collapse: collapse; margin: .6rem 0 1rem; }
    th { text-align: left; font-size: .72rem; text-transform: uppercase; letter-spacing: .06em;
      color: #8b948d; padding: .4rem .5rem; border-bottom: 2px solid #e6ded0; }
    td { padding: .45rem .5rem; border-bottom: 1px solid #eee6d8; vertical-align: top; }
    .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .totals { margin-left: auto; width: 320px; max-width: 100%; }
    .totals td { border-bottom: 1px solid #f0eade; }
    .totals tr.grand td { border-top: 2px solid #233329; border-bottom: none; font-weight: 700; font-size: 1.05rem; }
    .totals tr.due td { color: #E4593B; font-weight: 700; font-size: 1.15rem; border-bottom: none; }
    .muted { color: #8b948d; }
    .note-box { background: #faf6ef; border: 1px solid #e6ded0; border-radius: 10px; padding: .7rem .9rem; margin: 1rem 0; }
    .terms { margin: 1.2rem 0; }
    .terms h2 { font-size: 1.05rem; margin-bottom: .4rem; }
    .terms ol { padding-left: 1.2rem; margin: .3rem 0; }
    .terms li { margin: .35rem 0; }
    .editable { color: #8b948d; font-style: italic; }
    .sig { margin-top: 2.2rem; }
    .sig-line { border-bottom: 1.5px solid #233329; height: 2.4rem; max-width: 340px; display: flex; align-items: flex-end; }
    .sig-name { font-family: "Fraunces", Georgia, serif; font-size: 1.25rem; }
    .sig-cap { font-size: .78rem; color: #8b948d; margin-top: .25rem; }
    .signed-stamp { display: inline-block; border: 2px solid #4E6B51; color: #4E6B51; border-radius: 8px;
      padding: .3rem .7rem; font-weight: 700; margin-top: .5rem; }
    .doc-foot { margin-top: 2.4rem; padding-top: .8rem; border-top: 1px solid #e6ded0;
      color: #8b948d; font-size: .78rem; text-align: center; }
    .print-btn { position: fixed; right: 1.2rem; bottom: 1.2rem; background: #E4593B; color: #fff;
      border: none; border-radius: 99px; padding: .7rem 1.3rem; font: inherit; font-weight: 700;
      cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,.25); }
    .print-btn:hover { background: #B0402A; }
    @media print { .print-btn { display: none; } body { padding: 0; } }
  `;
}

function linesTable(project) {
  const lines = project.lines || [];
  if (!lines.length) return `<p class="muted">No line items.</p>`;
  const rows = lines.map(l => `
    <tr>
      <td>${esc(l.name)}${l.type && l.type !== 'rental' ? ` <span class="muted">(${esc(l.type)})</span>` : ''}</td>
      <td class="num">${esc(l.qty)}</td>
      <td class="num">${esc(fmtMoney(l.priceCents))}</td>
      <td class="num">${esc(fmtMoney((l.priceCents || 0) * (l.qty || 0)))}</td>
    </tr>`).join('');
  return `
    <table>
      <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function totalsTable(kind, totals, settings) {
  const row = (label, val, cls = '') =>
    `<tr class="${cls}"><td>${label}</td><td class="num">${esc(val)}</td></tr>`;
  let out = row('Subtotal', fmtMoney(totals.subtotal));
  if (totals.inHouseDiscount > 0) {
    out += row(`In-house rental discount (${esc(settings?.inHouseDiscountPct ?? 0)}%)`,
      `−${fmtMoney(totals.inHouseDiscount)}`);
  }
  if (totals.discount > 0) out += row('Discount', `−${fmtMoney(totals.discount)}`);
  out += row(`Tax (${esc(settings?.taxPct ?? 0)}%)`, fmtMoney(totals.tax));
  out += row('Total', fmtMoney(totals.total), 'grand');
  if (kind === 'invoice') {
    out += row('Payments applied', `−${fmtMoney(totals.paid)}`);
    out += row('BALANCE DUE', fmtMoney(totals.balanceDue), 'due');
  } else {
    out += row(`Deposit due to reserve (${esc(settings?.depositPct ?? 50)}%)`,
      fmtMoney(totals.depositDue), 'due');
  }
  return `<table class="totals">${out}</table>`;
}

function paymentsTable(payments) {
  if (!payments.length) return `<p class="muted">No payments recorded yet.</p>`;
  const rows = payments.map(p => `
    <tr>
      <td>${esc(fmtDate(p.date))}</td>
      <td>${esc(KIND_LABELS[p.kind] || p.kind || 'Payment')}</td>
      <td>${esc(p.method || '—')}</td>
      <td>${esc(p.note || '')}</td>
      <td class="num">${esc((p.kind === 'refund' ? '−' : '') + fmtMoney(p.amountCents))}</td>
    </tr>`).join('');
  return `
    <table>
      <thead><tr><th>Date</th><th>Kind</th><th>Method</th><th>Note</th><th class="num">Amount</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function contractTerms(settings, totals) {
  const depositPct = settings?.depositPct ?? 50;
  const balanceDays = settings?.balanceDueDaysBefore ?? 30;
  const inHousePct = settings?.inHouseDiscountPct ?? 70;
  const dueBy = totals.balanceDueDate
    ? ` (for this event: by ${esc(fmtDate(totals.balanceDueDate))})` : '';
  return `
    <div class="terms">
      <h2>Terms &amp; Conditions</h2>
      <ol>
        <li><strong>Reservation &amp; deposit.</strong> A non-refundable deposit of ${esc(depositPct)}%
          of the total (${esc(fmtMoney(totals.depositDue))}) is due upon signing to reserve
          the date and items listed above.</li>
        <li><strong>Balance.</strong> The remaining balance is due ${esc(balanceDays)} days
          before the event date${dueBy}.</li>
        <li><strong>In-house rental discount.</strong> A ${esc(inHousePct)}% discount applies to
          rental items when the event is hosted in-house at our venue.</li>
        <li><strong>Cancellation.</strong> <span class="editable">[Placeholder — cancellation
          policy text. Edit this wording in Settings.]</span></li>
        <li><strong>Damage &amp; loss.</strong> <span class="editable">[Placeholder — damage,
          loss, and cleaning policy text. Edit this wording in Settings.]</span></li>
      </ol>
    </div>`;
}

function signatureBlock(project, clientName) {
  const sig = project.signature;
  if (sig) {
    return `
      <div class="sig">
        <div class="sig-line"><span class="sig-name">${esc(sig.name)}</span></div>
        <div class="sig-cap">Client signature — ${esc(clientName || sig.name)}</div>
        <div class="signed-stamp">✓ Signed by ${esc(sig.name)} on
          ${esc(new Date(sig.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))}</div>
      </div>`;
  }
  return `
    <div class="sig">
      <div class="sig-line"></div>
      <div class="sig-cap">Client signature${clientName ? ` — ${esc(clientName)}` : ''} &nbsp;·&nbsp; Date</div>
    </div>`;
}

// -> full standalone HTML string for kind: 'quote' | 'contract' | 'invoice'
export function renderDoc(kind, { project, client, settings, payments = [] }) {
  const totals = projectTotals(project, settings, payments);
  const projPayments = payments
    .filter(p => p.projectId === project.id)
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const title = DOC_TITLES[kind] || 'DOCUMENT';
  const dates = project.endDate && project.endDate !== project.eventDate
    ? `${fmtDate(project.eventDate)} – ${fmtDate(project.endDate)}`
    : fmtDate(project.eventDate);
  const time = [project.startTime, project.endTime].filter(Boolean).join(' – ');

  const clientBlock = client ? `
    <div class="block">
      <h3>${kind === 'invoice' ? 'Bill to' : 'Prepared for'}</h3>
      <p><strong>${esc(client.name)}</strong></p>
      ${client.company ? `<p>${esc(client.company)}</p>` : ''}
      ${client.email ? `<p>${esc(client.email)}</p>` : ''}
      ${client.phone ? `<p>${esc(client.phone)}</p>` : ''}
    </div>` : '';

  const eventBlock = `
    <div class="block">
      <h3>Event</h3>
      <p><strong>${esc(project.name)}</strong></p>
      <p>${esc(dates)}${time ? ` · ${esc(time)}` : ''}</p>
      ${project.venue ? `<p>${esc(project.venue)}</p>` : ''}
      ${project.inHouse ? `<p class="muted">Hosted in-house at the venue</p>` : ''}
    </div>`;

  let middle = '';
  if (kind === 'contract') middle = contractTerms(settings, totals) + signatureBlock(project, client?.name);
  if (kind === 'invoice') middle = `<h2 style="font-size:1.05rem">Payments</h2>${paymentsTable(projPayments)}`;

  const notes = kind !== 'contract' && project.notes
    ? `<div class="note-box"><strong>Notes:</strong> ${esc(project.notes)}</div>` : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} ${esc(project.quoteNumber || '')} — ${esc(settings?.name || 'PoppyShuffle')}</title>
<style>${docStyles()}</style>
</head>
<body>
  <div class="doc-head">
    <div>
      <div class="biz-name">🌺 ${esc(settings?.name || 'PoppyShuffle')}</div>
      <div class="biz-sub">${esc(settings?.tagline || '')}</div>
      <div class="biz-contact">
        ${esc([settings?.address, [settings?.city, settings?.region].filter(Boolean).join(', ')].filter(Boolean).join(' · '))}<br>
        ${esc([settings?.email, settings?.phone].filter(Boolean).join(' · '))}
      </div>
    </div>
    <div class="doc-meta">
      <div class="doc-title">${esc(title)}</div>
      <div class="doc-num">${esc(project.quoteNumber || '')}</div>
      <div class="doc-date">Issued ${esc(fmtDate(todayISO()))}</div>
      <div class="doc-date">Event: ${esc(dates)}</div>
    </div>
  </div>

  <div class="blocks">${clientBlock}${eventBlock}</div>

  ${linesTable(project)}
  ${totalsTable(kind, totals, settings)}
  ${kind !== 'invoice' && totals.balanceDueDate
    ? `<p class="muted num" style="text-align:right">Balance due by ${esc(fmtDate(totals.balanceDueDate))}</p>` : ''}
  ${notes}
  ${middle}

  <div class="doc-foot">
    ${esc(settings?.name || 'PoppyShuffle')} — thank you for celebrating with us.
  </div>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save as PDF</button>
</body>
</html>`;
}

// Open the rendered document in a new window (print = save as PDF).
export function openDoc(kind, data) {
  const html = renderDoc(kind, data);
  const w = window.open('', '_blank');
  if (!w) {
    alert('Pop-up blocked — please allow pop-ups for this site to open documents.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
