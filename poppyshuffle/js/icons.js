// Botanical outline icon set — flowers, leaves, and vines drawn as single-color
// line art (stroke: currentColor), echoing the hand-sketched poppy in The Poppy
// Creative's logo. Use icon(name, size) to get an inline <svg> element.

const P = {
  // 5-petal open blossom
  flower: `<circle cx="12" cy="12" r="2.4"/>
    <path d="M12 9.6C10.8 7.4 10.9 4.9 12 3.2 13.1 4.9 13.2 7.4 12 9.6Z"/>
    <path d="M14.3 10.9c2.5-.3 4.7.7 5.9 2.2-2 .6-4.4.2-6.3-1Z" transform="rotate(-16 12 12)"/>
    <path d="M9.7 10.9C7.2 10.6 5 11.6 3.8 13.1c2 .6 4.4.2 6.3-1Z" transform="rotate(16 12 12)"/>
    <path d="M13.5 14.1c1.9 1.6 2.7 3.9 2.4 5.8-1.9-.8-3.5-2.7-4-4.9Z"/>
    <path d="M10.5 14.1C8.6 15.7 7.8 18 8.1 19.9c1.9-.8 3.5-2.7 4-4.9Z"/>`,
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
  // two blossoms (clients)
  blooms: `<circle cx="8" cy="7.5" r="2.6"/>
    <circle cx="8" cy="7.5" r="1" fill="currentColor" stroke="none"/>
    <path d="M8 10.1V20"/>
    <circle cx="16.5" cy="10" r="2.2"/>
    <circle cx="16.5" cy="10" r=".8" fill="currentColor" stroke="none"/>
    <path d="M16.5 12.2c0 3.4-2 5.4-4.5 6.3"/>
    <path d="M8 15.5c-1.9-.2-3.2-1.3-3.7-3 1.9.2 3.2 1.3 3.7 3Z"/>`,
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
  // branch with leaves (documents/lists)
  branch: `<path d="M6 20C6 12 10 6.5 18 4"/>
    <path d="M9.2 13.2c-2 .2-3.6-.5-4.7-1.9 2-.2 3.6.5 4.7 1.9Z"/>
    <path d="M11.5 9.4c-.2-2 .5-3.6 1.9-4.7.2 2-.5 3.6-1.9 4.7Z"/>
    <path d="M8 16.7c1.6 1.2 2.3 2.7 2.1 4.7-1.6-1.2-2.3-2.7-2.1-4.7Z"/>`,
  // poppy seed head (money/payments)
  seedhead: `<circle cx="12" cy="9" r="4.5"/>
    <path d="M8.6 6.5h6.8M12 4.5v9"/>
    <path d="M12 13.5V20M9 20h6"/>`,
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
    `stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
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
  settings: 'daisy',
  catalog: 'vine',
};
