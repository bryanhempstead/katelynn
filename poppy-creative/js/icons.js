// Botanical outline icon set — flowers, leaves, and vines drawn as single-color
// line art (stroke: currentColor), echoing the hand-sketched poppy in The Poppy
// Creative's logo. Use icon(name, size) to get an inline <svg> element.

const P = {
  // open daisy bloom, eight slim petals (ref: hand-drawn wildflower sheets)
  flower: `<circle cx="12" cy="12" r="1.9"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z" transform="rotate(45 12 12)"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z" transform="rotate(90 12 12)"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z" transform="rotate(135 12 12)"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z" transform="rotate(180 12 12)"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z" transform="rotate(225 12 12)"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z" transform="rotate(270 12 12)"/>
    <path d="M12 3.4C13 5 13 7.4 12 9.5 11 7.4 11 5 12 3.4Z" transform="rotate(315 12 12)"/>`,
  // tulip on stem with leaf
  tulip: `<path d="M8.5 4.5v4a3.5 3.5 0 0 0 7 0v-4l-2.1 1.8L12 4.2l-1.4 2.1Z"/>
    <path d="M12 12v8.5"/>
    <path d="M12 16.5c-2.8 0-4.5-1.5-5-3.7 2.8 0 4.5 1.5 5 3.7Z"/>
    <path d="M12 18.5c2.8 0 4.5-1.5 5-3.7-2.8 0-4.5 1.5-5 3.7Z"/>`,
  // potted sprout
  pot: `<path d="M6.5 14h11l-1 3.5a3 3 0 0 1-2.9 2.2h-3.2a3 3 0 0 1-2.9-2.2Z"/>
    <path d="M12 14v-4"/>
    <path d="M12 10C11.6 7.3 9.9 5.6 7.6 5.2c.3 2.7 2 4.4 4.4 4.8Z"/>
    <path d="M12 10c.4-2.7 2.1-4.4 4.4-4.8-.3 2.7-2 4.4-4.4 4.8Z"/>`,
  // two wildflower stems (clients)
  blooms: `<path d="M8 20V9.6"/>
    <path d="M5.8 4.4c.4 2 1.1 3.3 2.2 4 1.1-.7 1.8-2 2.2-4-.8.5-1.5.8-2.2.8s-1.4-.3-2.2-.8Z"/>
    <path d="M16.5 20v-8.4"/>
    <circle cx="16.5" cy="9.2" r="2.3"/>
    <circle cx="16.5" cy="9.2" r=".7" fill="currentColor" stroke="none"/>
    <path d="M8 14.8c-1.7 0-2.9-.9-3.4-2.4 1.7 0 2.9.9 3.4 2.4Z"/>
    <path d="M16.5 15.6c1.7 0 2.9-.9 3.4-2.4-1.7 0-2.9.9-3.4 2.4Z"/>`,
  // calendar with small flower
  calendarFlower: `<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/>
    <path d="M4 9.5h16M8.5 3.5v3M15.5 3.5v3"/>
    <circle cx="12" cy="14.7" r="1"/>
    <path d="M12 13.7v-1.6M12 15.7v1.6M13 14.7h1.6M11 14.7H9.4"/>`,
  // rising vine (reports/growth)
  vineUp: `<path d="M4 19.5C9 19 14.5 15 18.6 6.5"/>
    <path d="M19.5 4.5l-.7 3.4-3.3-1"/>
    <path d="M8.6 17.6c-.2-1.9.6-3.4 2-4.3.2 1.9-.6 3.4-2 4.3Z"/>
    <path d="M13.4 14c-1.9.3-3.4-.3-4.4-1.6 1.9-.3 3.4.3 4.4 1.6Z"/>`,
  // daisy (settings)
  daisy: `<circle cx="12" cy="12" r="2.2"/>
    <path d="M12 9.8V4.6M12 14.2v5.2M14.2 12h5.2M9.8 12H4.6"/>
    <path d="M13.6 10.4l3.6-3.6M10.4 13.6l-3.6 3.6M13.6 13.6l3.6 3.6M10.4 10.4L6.8 6.8"/>`,
  // trailing vine (public catalog / website)
  vine: `<path d="M3.5 12h17" opacity="0"/>
    <path d="M3.5 15.5C7 9 12 8.5 20.5 9.5"/>
    <path d="M8.3 11.9c-.5-1.8 0-3.4 1.2-4.6.5 1.8 0 3.4-1.2 4.6Z"/>
    <path d="M13.6 9.9c-.5-1.8 0-3.4 1.2-4.6.5 1.8 0 3.4-1.2 4.6Z"/>
    <path d="M11 12.3c.5 1.8 0 3.4-1.2 4.6-.5-1.8 0-3.4 1.2-4.6Z"/>
    <path d="M16.4 10.5c.5 1.8 0 3.4-1.2 4.6-.5-1.8 0-3.4 1.2-4.6Z"/>`,
  // single leaf
  leaf: `<path d="M5 19C5 10.5 10.5 5.5 19 5c.5 8.5-5 13.5-13.5 14Z"/>
    <path d="M5 19C8.5 15 12 11.5 16.5 8"/>`,
  // sprout (two leaves)
  sprout: `<path d="M12 20v-7"/>
    <path d="M12 13C11.4 9.6 9.2 7.5 6.2 7c.4 3.4 2.6 5.5 5.8 6Z"/>
    <path d="M12 13c.6-3.4 2.8-5.5 5.8-6-.4 3.4-2.6 5.5-5.8 6Z"/>`,
  // bud / bloom on stem
  bud: `<path d="M12 12.5V20"/>
    <path d="M8.7 5.8a3.3 3.3 0 0 1 6.6 0c0 2.6-1.5 4.7-3.3 6.7-1.8-2-3.3-4.1-3.3-6.7Z"/>
    <path d="M12 16.8c-2.3 0-3.8-1.2-4.3-3.1 2.3 0 3.8 1.2 4.3 3.1Z"/>`,
  // bellflower (attention)
  bellflower: `<path d="M7.5 4.5h9l-1.2 7.4a4.3 4.3 0 0 1-3.3 3.5v0a4.3 4.3 0 0 1-3.3-3.5Z"/>
    <path d="M12 15.5V20M9.5 20h5"/>
    <path d="M12 4.5V2.8"/>`,
  // wreath ring (about/brand)
  wreath: `<circle cx="12" cy="12" r="7"/>
    <path d="M12 5c-.4-1.3-1.4-2.1-2.8-2.3.4 1.3 1.4 2.1 2.8 2.3Z"/>
    <path d="M19 12c1.3-.4 2.1-1.4 2.3-2.8-1.3.4-2.1 1.4-2.3 2.8Z"/>
    <path d="M12 19c.4 1.3 1.4 2.1 2.8 2.3-.4-1.3-1.4-2.1-2.8-2.3Z"/>
    <path d="M5 12c-1.3.4-2.1 1.4-2.3 2.8 1.3-.4 2.1-1.4 2.3-2.8Z"/>`,
  // berry sprig (documents/lists) — ref: hand-drawn berry branches
  branch: `<path d="M11 20C11 13.5 11.5 8.5 13 4"/>
    <path d="M12.1 8.5C10.4 7.9 9.3 6.6 9 4.8"/>
    <circle cx="8.7" cy="4" r="1" fill="currentColor" stroke="none"/>
    <path d="M12.6 6.6c1.5-.8 2.4-2 2.7-3.7"/>
    <circle cx="15.6" cy="2.3" r="1" fill="currentColor" stroke="none"/>
    <path d="M11.4 12.6c-1.9-.4-3.1-1.6-3.6-3.5"/>
    <circle cx="7.5" cy="8.4" r="1" fill="currentColor" stroke="none"/>
    <path d="M11.2 11.2c1.8-.2 3.1-1.1 3.9-2.8"/>
    <circle cx="15.6" cy="7.6" r="1" fill="currentColor" stroke="none"/>
    <path d="M11 16.3c-1.8 0-3.1-.8-3.9-2.4 1.8 0 3.1.8 3.9 2.4Z"/>`,
  // dandelion seed head (money/payments) — ref: wildflower sheet
  seedhead: `<circle cx="12" cy="8.5" r=".9" fill="currentColor" stroke="none"/>
    <path d="M12 8.5V3.6M12 8.5l3.5-3.4M12 8.5l4.8-.1M12 8.5l3.4 3.4M12 8.5l-3.5-3.4M12 8.5l-4.8-.1M12 8.5l-3.4 3.4"/>
    <circle cx="12" cy="2.9" r=".8" fill="currentColor" stroke="none"/>
    <circle cx="16" cy="4.6" r=".8" fill="currentColor" stroke="none"/>
    <circle cx="17.5" cy="8.4" r=".8" fill="currentColor" stroke="none"/>
    <circle cx="15.9" cy="12.4" r=".8" fill="currentColor" stroke="none"/>
    <circle cx="8" cy="4.6" r=".8" fill="currentColor" stroke="none"/>
    <circle cx="6.5" cy="8.4" r=".8" fill="currentColor" stroke="none"/>
    <circle cx="8.1" cy="12.4" r=".8" fill="currentColor" stroke="none"/>
    <path d="M12 9.4V20"/>
    <path d="M12 16.6c-1.9.2-3.4-.5-4.4-1.9 1.9-.2 3.4.5 4.4 1.9Z"/>`,
  // crossed stems (duplicate/shuffle)
  stems: `<path d="M5 19C9 13 14 8.5 19.5 5.5"/>
    <path d="M19 19C15 13 10 8.5 4.5 5.5"/>
    <path d="M7.6 9.4C7.4 7.7 8 6.3 9.2 5.3c.2 1.7-.4 3.1-1.6 4.1Z"/>
    <path d="M16.4 9.4c.2-1.7-.4-3.1-1.6-4.1-.2 1.7.4 3.1 1.6 4.1Z"/>`,
};

export const ICON_NAMES = Object.keys(P);

export function icon(name, size = 20, cls = '') {
  const paths = P[name] || P.leaf;
  const span = document.createElement('span');
  span.className = `bicon${cls ? ' ' + cls : ''}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML =
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" ` +
    `stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return span;
}

// ---- decorative flourishes (larger ornaments, same hand-drawn language) -----
const FLOURISHES = {
  // horizontal divider: stem with leaves and a small open bloom at center
  divider: { vb: '0 0 220 26', w: 220, h: 26, paths: `
    <path d="M8 15C40 13 70 13 96 14M124 14c26-1 56-1 88 1"/>
    <path d="M34 14c3-6 8-9 15-9-2 6-7 9-15 9Z"/>
    <path d="M62 14c-3 6-8 9-15 9 2-6 7-9 15-9Z"/>
    <path d="M158 14c3-6 8-9 15-9-2 6-7 9-15 9Z"/>
    <path d="M186 14c-3 6-8 9-15 9 2-6 7-9 15-9Z"/>
    <circle cx="110" cy="13" r="2"/>
    <path d="M110 6.5c1 1.6 1 3 0 4.4-1-1.4-1-2.8 0-4.4Z"/>
    <path d="M110 19.5c1-1.6 1-3 0-4.4-1 1.4-1 2.8 0 4.4Z"/>
    <path d="M103.5 13c1.6-1 3-1 4.4 0-1.4 1-2.8 1-4.4 0Z"/>
    <path d="M116.5 13c-1.6-1-3-1-4.4 0 1.4 1 2.8 1 4.4 0Z"/>` },
  // corner vine: curved stem, leaves, one open bloom + one small bloom
  corner: { vb: '0 0 120 120', w: 120, h: 120, paths: `
    <path d="M12 112C30 96 44 78 54 60 64 42 78 26 104 16"/>
    <path d="M30 92c-8 3-15 2-21-3 7-4 14-3 21 3Z"/>
    <path d="M44 74c-1-9 2-16 9-20 2 8-1 15-9 20Z"/>
    <path d="M62 46c-8 2-15 0-20-6 8-3 15-1 20 6Z"/>
    <path d="M74 32c-1-8 2-14 8-18 2 7-1 13-8 18Z"/>
    <circle cx="88" cy="52" r="3"/>
    <path d="M88 41c1.7 2.6 1.7 5.2 0 7.8-1.7-2.6-1.7-5.2 0-7.8Z"/>
    <path d="M88 63c1.7-2.6 1.7-5.2 0-7.8-1.7 2.6-1.7 5.2 0 7.8Z"/>
    <path d="M77 52c2.6-1.7 5.2-1.7 7.8 0-2.6 1.7-5.2 1.7-7.8 0Z"/>
    <path d="M99 52c-2.6-1.7-5.2-1.7-7.8 0 2.6 1.7 5.2 1.7 7.8 0Z"/>
    <circle cx="106" cy="86" r="2.2"/>
    <path d="M106 78.5c1.2 1.9 1.2 3.7 0 5.6-1.2-1.9-1.2-3.7 0-5.6Z"/>
    <path d="M106 93.5c1.2-1.9 1.2-3.7 0-5.6-1.2 1.9-1.2 3.7 0 5.6Z"/>
    <path d="M98.5 86c1.9-1.2 3.7-1.2 5.6 0-1.9 1.2-3.7 1.2-5.6 0Z"/>
    <path d="M113.5 86c-1.9-1.2-3.7-1.2-5.6 0 1.9 1.2 3.7 1.2 5.6 0Z"/>
    <path d="M96 26c-6 1-11-1-14-6 6-2 11 0 14 6Z"/>` },
  // tall wildflower stem with buds (splash / empty states)
  stem: { vb: '0 0 60 120', w: 60, h: 120, paths: `
    <path d="M30 116C30 88 30 60 30 30"/>
    <path d="M30 30C30 22 33 15 39 11c1 8-2 14-9 19Z"/>
    <path d="M30 44c-6-1-10-5-12-11 6 1 10 5 12 11Z"/>
    <circle cx="44" cy="34" r="1.6" fill="currentColor" stroke="none"/>
    <path d="M30 40c5-2 9-1 13 2"/>
    <path d="M30 58c6 1 10 5 12 11-6-1-10-5-12-11Z"/>
    <path d="M30 74c-6-1-10-5-12-11 6 1 10 5 12 11Z"/>
    <circle cx="16" cy="49" r="1.6" fill="currentColor" stroke="none"/>
    <path d="M30 54c-5-2-9-1-13 2"/>
    <path d="M30 92c-7-2-11-7-12-14 7 2 11 7 12 14Z"/>
    <path d="M30 92c7-2 11-7 12-14-7 2-11 7-12 14Z"/>
    <circle cx="30" cy="24" r="2"/>
    <path d="M30 15c1.4 2.2 1.4 4.4 0 6.6-1.4-2.2-1.4-4.4 0-6.6Z"/>
    <path d="M23.5 24c2.2-1.4 4.4-1.4 6.6 0-2.2 1.4-4.4 1.4-6.6 0Z"/>
    <path d="M36.5 24c-2.2-1.4-4.4-1.4-6.6 0 2.2 1.4 4.4 1.4 6.6 0Z"/>` },
};

export function flourishMarkup(name, { width, stroke = 'currentColor', strokeWidth = 2 } = {}) {
  const f = FLOURISHES[name] || FLOURISHES.divider;
  const w = width || f.w;
  const h = Math.round(w * f.h / f.w);
  return `<svg viewBox="${f.vb}" width="${w}" height="${h}" fill="none" stroke="${stroke}" ` +
    `stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${f.paths}</svg>`;
}

export function flourish(name, width, cls = '') {
  const span = document.createElement('span');
  span.className = `bflourish${cls ? ' ' + cls : ''}`;
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = flourishMarkup(name, { width });
  return span;
}

// Map view names → icons (used by the nav in app.js).
export const VIEW_ICONS = {
  dashboard: 'flower',
  projects: 'tulip',
  inventory: 'pot',
  clients: 'blooms',
  calendar: 'calendarFlower',
  reports: 'vineUp',
  design: 'bud',
  settings: 'daisy',
  catalog: 'vine',
};
