// Runtime design engine: loads the 'design' record from settings and applies
// it app-wide by generating CSS custom-property overrides and registering
// uploaded fonts via the FontFace API. The Design view (views/design.js)
// edits this record; everything else just inherits the tokens.

export const BUNDLED_FONTS = {
  script: [
    { family: 'Kaushan Script', label: 'Kaushan Script (brush — site match)' },
    { family: 'Fraunces', label: 'Fraunces (serif)' },
    { family: 'Josefin Sans', label: 'Josefin Sans (geometric)' },
    { family: 'Georgia', label: 'Georgia (system serif)' },
    { family: 'cursive', label: 'System cursive' },
  ],
  display: [
    { family: 'Fraunces', label: 'Fraunces (serif — default)' },
    { family: 'Josefin Sans', label: 'Josefin Sans (geometric)' },
    { family: 'Kaushan Script', label: 'Kaushan Script (brush)' },
    { family: 'Georgia', label: 'Georgia (system serif)' },
    { family: 'system-ui', label: 'System sans' },
  ],
  body: [
    { family: 'system-ui', label: 'System sans (default)' },
    { family: 'Josefin Sans', label: 'Josefin Sans (site match)' },
    { family: 'Fraunces', label: 'Fraunces (serif)' },
    { family: 'Georgia', label: 'Georgia (system serif)' },
  ],
};

// Poppy Creative defaults — mirror the values in css/app.css.
export function defaultDesign() {
  return {
    id: 'design',
    logoDataURI: null,          // replaces the header/splash mark when set
    logoDarkDataURI: null,      // optional dark-mode logo
    customFonts: [],            // [{ id, family, dataURI, format }]
    fonts: { script: 'Kaushan Script', display: 'Fraunces', body: 'system-ui' },
    sizes: {
      baseFontPx: 15,           // body font size
      headingScale: 1,          // multiplies h1/h2 sizes
      headingSpacing: 0.15,     // letter-spacing (em) for uppercase card titles
      bodyLineHeight: 1.5,
      radius: 14,               // card corner radius
      density: 1,               // padding/gap multiplier (0.8 compact – 1.25 airy)
    },
    light: {
      poppy: '#DE1E7E', gold: '#E9A312', sage: '#93AC72', lime: '#D0F0A0',
      charcoal: '#3E4038', ink: '#3B3B35', bg: '#FEFDFB', surface: '#ffffff',
    },
    dark: {
      poppy: '#D6247F', gold: '#D9A21F', sage: '#9DB47E', lime: '#55663A',
      charcoal: '#585B51', ink: '#ECECE2', bg: '#1E1E1A', surface: '#282823',
    },
  };
}

// Deep-merge a stored record over the defaults so new fields are always present.
export function normalizeDesign(stored) {
  const d = defaultDesign();
  if (!stored) return d;
  return {
    ...d, ...stored,
    fonts: { ...d.fonts, ...(stored.fonts || {}) },
    sizes: { ...d.sizes, ...(stored.sizes || {}) },
    light: { ...d.light, ...(stored.light || {}) },
    dark: { ...d.dark, ...(stored.dark || {}) },
    customFonts: Array.isArray(stored.customFonts) ? stored.customFonts : [],
  };
}

// WCAG relative luminance + contrast ratio (for the legibility checker).
export function contrastRatio(hexA, hexB) {
  const lum = hex => {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return null;
    const [r, g, b] = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255)
      .map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const a = lum(hexA), b = lum(hexB);
  if (a == null || b == null) return null;
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

const loadedFontIds = new Set();

async function registerCustomFonts(design) {
  for (const f of design.customFonts) {
    if (!f?.dataURI || !f.family || loadedFontIds.has(f.id)) continue;
    try {
      const face = new FontFace(f.family, `url(${f.dataURI})`);
      await face.load();
      document.fonts.add(face);
      loadedFontIds.add(f.id);
    } catch (e) {
      console.warn('Could not load custom font', f.family, e);
    }
  }
}

function fontStack(family, fallback) {
  const quoted = /^[a-z-]+$/i.test(family) && ['cursive', 'serif', 'sans-serif', 'system-ui', 'monospace'].includes(family)
    ? family : `"${family.replace(/"/g, '')}"`;
  return `${quoted}, ${fallback}`;
}

function paletteBlock(p) {
  return `
    --poppy: ${p.poppy}; --poppy-deep: color-mix(in srgb, ${p.poppy} 78%, #000);
    --gold: ${p.gold}; --sage: ${p.sage}; --lime: ${p.lime};
    --sage-deep: color-mix(in srgb, ${p.sage} 70%, #000);
    --charcoal: ${p.charcoal}; --ink: ${p.ink}; --bg: ${p.bg}; --surface: ${p.surface};
    --ink-soft: color-mix(in srgb, ${p.ink} 78%, ${p.bg});
    --muted: color-mix(in srgb, ${p.ink} 52%, ${p.bg});
    --line: color-mix(in srgb, ${p.ink} 12%, ${p.bg});
    --surface-2: color-mix(in srgb, ${p.lime} 22%, ${p.surface});
    --orange: color-mix(in srgb, ${p.poppy} 55%, ${p.gold});`;
}

// Apply the design record: inject a <style> overriding css/app.css tokens.
export async function applyDesign(designRecord) {
  const d = normalizeDesign(designRecord);
  await registerCustomFonts(d);
  const s = d.sizes;
  const css = `
  :root {
    --font-script: ${fontStack(d.fonts.script, 'cursive')};
    --font-display: ${fontStack(d.fonts.display, 'Georgia, serif')};
    --font-body: ${fontStack(d.fonts.body, '-apple-system, "Segoe UI", Roboto, sans-serif')};
    --radius: ${s.radius}px;
    ${paletteBlock(d.light)}
  }
  :root[data-mode="dark"] { ${paletteBlock(d.dark)} }
  @media (prefers-color-scheme: dark) { :root:not([data-mode="light"]) { ${paletteBlock(d.dark)} } }
  body { font-size: ${s.baseFontPx}px; line-height: ${s.bodyLineHeight}; }
  h1 { font-size: ${(1.7 * s.headingScale).toFixed(3)}rem; }
  .view-head h1 { font-size: ${(2 * s.headingScale).toFixed(3)}rem; }
  h2 { font-size: ${(0.98 * s.headingScale).toFixed(3)}rem; letter-spacing: ${s.headingSpacing}em; }
  .card { padding: ${(1 * s.density).toFixed(3)}rem ${(1.1 * s.density).toFixed(3)}rem; margin-bottom: ${(1 * s.density).toFixed(3)}rem; }
  .main { padding: ${(1.2 * s.density).toFixed(3)}rem ${(1.4 * s.density).toFixed(3)}rem 4rem; }
  .stat-grid, .cards-grid { gap: ${(0.8 * s.density).toFixed(3)}rem; }
  table.data td { padding: ${(0.55 * s.density).toFixed(3)}rem .6rem; }
  `;
  let el = document.getElementById('design-overrides');
  if (!el) {
    el = document.createElement('style');
    el.id = 'design-overrides';
    document.head.append(el);
  }
  el.textContent = css;
  applyLogo(d);
}

function applyLogo(d) {
  const dark = document.documentElement.dataset.mode === 'dark' ||
    (document.documentElement.dataset.mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  const uri = (dark && d.logoDarkDataURI) || d.logoDataURI;
  for (const img of document.querySelectorAll('.brand-mark img, .splash-mark img')) {
    img.src = uri || 'icons/icon.svg';
  }
}
