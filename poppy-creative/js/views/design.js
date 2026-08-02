// Design Studio — branding (logo), typography (bundled + uploaded fonts),
// size & spacing, colors with a legibility checker, and reset to defaults.
// Edits the 'design' record in the settings store; js/design.js (applyDesign)
// re-applies it live on every save via db.onChange.
import { registerView, h, toast, confirmDialog, openModal, closeModal, icon } from '../app.js';
import { db } from '../db.js';
import { defaultDesign, normalizeDesign, contrastRatio, BUNDLED_FONTS } from '../design.js';

const PALETTE_LABELS = {
  poppy: 'Accent (primary)',
  gold: 'Accent gold',
  sage: 'Sage',
  lime: 'Lime band',
  charcoal: 'Button charcoal',
  ink: 'Text ink',
  bg: 'Page background',
  surface: 'Card surface',
};

const FONT_FORMATS = { woff2: 'woff2', woff: 'woff', ttf: 'truetype', otf: 'opentype' };

const PREVIEW_LINE = 'The quick brown poppy jumps over the lazy daisy 0123456789';

// The whole view re-renders after each save (db.onChange); remember the window
// scroll position so a save doesn't jump the user back to the top.
let pendingScrollY = null;

function isDarkNow() {
  const mode = document.documentElement.dataset.mode;
  return mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
}

// Hidden file input -> FileReader dataURI. cb(dataURI, file).
function pickDataFile(accept, cb) {
  const input = h('input', {
    type: 'file', accept, style: 'display:none',
    onChange: () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => cb(String(reader.result), file);
      reader.onerror = () => toast('Could not read that file.', 'bad');
      reader.readAsDataURL(file);
    },
  });
  document.body.append(input);
  input.click();
}

// Modal prompt (not window.prompt) for naming an uploaded font.
function promptFontName(defaultName, onOk) {
  const input = h('input', { value: defaultName, maxlength: '60', placeholder: 'e.g. Poppy Grotesk' });
  const ok = () => {
    const name = input.value.trim();
    if (!name) { toast('Please enter a display name for the font.', 'bad'); return; }
    closeModal();
    onOk(name);
  };
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ok(); } });
  openModal({
    title: 'Name this font',
    body: h('label', { class: 'field' },
      'Display name (shown in the font menus)', input),
    actions: [
      { label: 'Cancel', onClick: closeModal },
      { label: 'Add font', primary: true, onClick: ok },
    ],
  });
  setTimeout(() => { input.focus(); input.select(); }, 0);
}

function cssFamily(family) {
  return `"${String(family).replace(/"/g, '')}"`;
}

registerView('design', {
  title: 'Design',
  icon: 'bud',
  async render(el) {
    await db.ready;
    const design = normalizeDesign(await db.get('settings', 'design'));

    async function save() {
      pendingScrollY = window.scrollY;
      await db.put('settings', design); // applyDesign + re-render fire via db.onChange
    }

    // ---- Branding ---------------------------------------------------------
    const logoBlock = (label, key, { darkBg = false, help }) => h('div', { class: 'field' },
      label,
      h('div', { style: 'display:flex;align-items:center;gap:.8rem;flex-wrap:wrap' },
        h('span', {
          style: 'display:inline-grid;place-content:center;width:76px;height:76px;flex:0 0 auto;' +
            `border:1px solid var(--line);border-radius:10px;background:${darkBg ? '#1E1E1A' : 'var(--surface-2)'}`,
        },
          h('img', {
            src: design[key] || 'icons/icon.svg', alt: '',
            style: 'max-width:60px;max-height:60px;display:block',
          })),
        h('div', { class: 'chip-row' },
          h('button', {
            class: 'btn btn-sm',
            onClick: () => pickDataFile('image/png,image/jpeg,image/svg+xml,image/webp,.png,.jpg,.jpeg,.svg,.webp',
              async (dataURI) => {
                if (!/^data:image\/(png|jpeg|svg\+xml|webp)[;,]/.test(dataURI)) {
                  toast('Please choose a PNG, JPG, SVG, or WEBP image.', 'bad');
                  return;
                }
                design[key] = dataURI;
                await save();
                toast('Logo updated');
              }),
          }, 'Upload…'),
          design[key] ? h('button', {
            class: 'btn btn-sm btn-danger',
            onClick: async () => {
              design[key] = null;
              await save();
              toast('Logo removed — built-in poppy icon restored');
            },
          }, 'Remove') : null)),
      h('span', { class: 'stock-note' }, help));

    const brandingCard = h('div', { class: 'card' },
      h('h2', null, icon('wreath'), ' Branding'),
      h('p', { class: 'subtitle' },
        'Your logo replaces the built-in poppy mark in the header and splash screen. Images are stored locally in your browser database.'),
      h('div', { class: 'form-grid' },
        logoBlock('Logo', 'logoDataURI',
          { help: 'PNG, JPG, SVG, or WEBP. Remove to return to the built-in poppy icon.' }),
        logoBlock('Dark-mode logo (optional)', 'logoDarkDataURI',
          { darkBg: true, help: 'Used instead of the main logo when dark mode is active.' })));

    // ---- Typography -------------------------------------------------------
    const fontSelect = (role, label, help) => {
      const opts = [
        ...BUNDLED_FONTS[role].map(o => ({ value: o.family, label: o.label })),
        ...design.customFonts.map(f => ({ value: f.family, label: '⬆ ' + f.family })),
      ];
      if (!opts.some(o => o.value === design.fonts[role])) {
        opts.push({ value: design.fonts[role], label: design.fonts[role] });
      }
      const sel = h('select', {
        onChange: async () => { design.fonts[role] = sel.value; await save(); },
      }, opts.map(o => h('option', { value: o.value, selected: o.value === design.fonts[role] }, o.label)));
      return h('label', { class: 'field' }, label, sel, h('span', { class: 'stock-note' }, help));
    };

    const deleteFont = f => async () => {
      const ok = await confirmDialog(
        `Delete the uploaded font "${f.family}"? Anything using it switches back to the Poppy default font.`);
      if (!ok) return;
      design.customFonts = design.customFonts.filter(x => x.id !== f.id);
      const defs = defaultDesign().fonts;
      for (const role of ['script', 'display', 'body']) {
        if (design.fonts[role] === f.family) design.fonts[role] = defs[role];
      }
      await save();
      toast('Font deleted');
    };

    const fontRows = design.customFonts.length
      ? design.customFonts.map(f => h('div', {
          style: 'display:flex;align-items:center;gap:.7rem;border:1px solid var(--line);border-radius:10px;padding:.45rem .7rem;margin:.35rem 0',
        },
          h('div', { style: 'flex:1;min-width:0' },
            h('div', { style: 'font-weight:700;font-size:.82rem;color:var(--ink-soft)' }, f.family),
            h('div', {
              style: `font-family:${cssFamily(f.family)}, serif;font-size:1.1rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis`,
            }, PREVIEW_LINE)),
          h('button', { class: 'icon-btn', 'aria-label': `Delete font ${f.family}`, onClick: deleteFont(f) }, '✕')))
      : [h('p', { class: 'stock-note', style: 'margin:.4rem 0' },
          'No custom fonts uploaded yet — the bundled fonts above are always available.')];

    const uploadFontBtn = h('button', {
      class: 'btn btn-sm',
      onClick: () => pickDataFile('.woff2,.woff,.ttf,.otf', (dataURI, file) => {
        const ext = (file.name.split('.').pop() || '').toLowerCase();
        const format = FONT_FORMATS[ext];
        if (!format) { toast('Unsupported font file — use .woff2, .woff, .ttf, or .otf.', 'bad'); return; }
        const base = file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'Custom font';
        promptFontName(base, async name => {
          design.customFonts.push({ id: crypto.randomUUID(), family: name, dataURI, format });
          await save();
          toast(`Font "${name}" uploaded`);
        });
      }),
    }, icon('bud', 16), ' Upload font (.woff2 / .woff / .ttf / .otf)');

    const previewBlock = h('div', {
      style: 'border:1.5px dashed var(--line);border-radius:10px;padding:.8rem 1rem;margin-top:.8rem',
    },
      h('div', { style: 'font-family:var(--font-script);font-size:2rem;color:var(--poppy);line-height:1.2' },
        'The Poppy Creative'),
      h('h2', { style: 'margin:.35rem 0 .2rem' }, 'Craft classes & event rentals'),
      h('p', { style: 'margin:.2rem 0' }, `Body text — ${PREVIEW_LINE}.`),
      h('span', { class: 'stock-note' }, 'Live preview — updates as soon as you save a change.'));

    const typographyCard = h('div', { class: 'card' },
      h('h2', null, icon('branch'), ' Typography'),
      h('p', { class: 'subtitle' }, 'Pick from the bundled fonts or upload your own brand fonts.'),
      h('div', { class: 'form-grid' },
        fontSelect('script', 'Script / display accent', 'Used for the big page headings.'),
        fontSelect('display', 'Heading font', 'Used for card titles and stat numbers.'),
        fontSelect('body', 'Body font', 'Used for paragraphs, tables, and forms.')),
      h('div', { style: 'margin-top:.8rem' }, uploadFontBtn),
      h('div', null, fontRows),
      previewBlock);

    // ---- Size & spacing ---------------------------------------------------
    const sliderField = (label, key, min, max, step, fmt, hint) => {
      const clamp = v => Math.min(max, Math.max(min, v));
      const valEl = h('span', {
        style: 'min-width:3.6em;text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:var(--ink)',
      }, fmt(design.sizes[key]));
      const range = h('input', {
        type: 'range', min: String(min), max: String(max), step: String(step),
        value: String(design.sizes[key]), style: 'flex:1',
        // Update the number live while dragging; only persist on release.
        onInput: () => { valEl.textContent = fmt(parseFloat(range.value)); },
        onChange: async () => {
          const v = parseFloat(range.value);
          if (!Number.isFinite(v)) return;
          design.sizes[key] = clamp(v);
          await save();
        },
      });
      return h('label', { class: 'field' }, label,
        h('div', { style: 'display:flex;align-items:center;gap:.6rem' }, range, valEl),
        hint ? h('span', { class: 'stock-note' }, hint) : null);
    };

    const sizesCard = h('div', { class: 'card' },
      h('h2', null, icon('sprout'), ' Size & spacing'),
      h('p', { class: 'subtitle' }, 'Tune the overall scale and feel. Changes apply when you release a slider.'),
      h('div', { class: 'form-grid' },
        sliderField('Base font size', 'baseFontPx', 13, 18, 1, v => `${Math.round(v)}px`),
        sliderField('Heading scale', 'headingScale', 0.8, 1.4, 0.05, v => `${v.toFixed(2)}×`),
        sliderField('Heading letter-spacing', 'headingSpacing', 0, 0.3, 0.01, v => `${v.toFixed(2)}em`),
        sliderField('Body line height', 'bodyLineHeight', 1.3, 1.9, 0.05, v => v.toFixed(2)),
        sliderField('Corner radius', 'radius', 0, 24, 1, v => `${Math.round(v)}px`),
        sliderField('Density', 'density', 0.8, 1.25, 0.05, v => v.toFixed(2), 'Compact ↔ Airy')));

    // ---- Colors + legibility checker --------------------------------------
    const checkerRows = p => {
      const pairs = [
        ['Ink on page', p.ink, p.bg],
        ['Ink on cards', p.ink, p.surface],
        ['White on accent', '#ffffff', p.poppy],
        ['White on charcoal', '#ffffff', p.charcoal],
        ['Ink on lime band', p.ink, p.lime],
      ];
      return pairs.map(([name, fg, bg]) => {
        const r = contrastRatio(fg, bg);
        if (r == null) return h('div', { class: 'stock-note' }, `${name}: —`);
        const ratio = `${r.toFixed(1)}:1`;
        if (r >= 4.5) {
          return h('div', {
            style: 'font-size:.82rem;font-weight:600;color:var(--ok);padding:.12rem 0',
          }, `${name}: AA ✓ (${ratio})`);
        }
        return h('div', {
          class: r < 3 ? 'conflict conflict-hard' : 'conflict',
          style: 'margin:.25rem 0;padding:.35rem .6rem',
        }, `${name}: ⚠ low contrast (${ratio})`);
      });
    };

    const colorRow = (mode, key, refresh) => {
      const colorIn = h('input', {
        type: 'color', value: design[mode][key],
        dataset: { color: `${mode}-${key}` },
        'aria-label': `${PALETTE_LABELS[key]} (${mode})`,
        style: 'width:44px;height:32px;padding:2px;flex:0 0 auto',
      });
      const hexIn = h('input', {
        value: design[mode][key], maxlength: '7',
        dataset: { hex: `${mode}-${key}` },
        'aria-label': `${PALETTE_LABELS[key]} hex (${mode})`,
        style: 'width:6.4em;flex:0 0 auto;font-variant-numeric:tabular-nums',
      });
      // Picker drag: live-sync hex + checker, but don't write yet.
      colorIn.addEventListener('input', () => {
        hexIn.value = colorIn.value;
        design[mode][key] = colorIn.value;
        refresh();
      });
      // Picker closed / committed: persist once.
      colorIn.addEventListener('change', () => { design[mode][key] = colorIn.value; save(); });
      // Hex typed: ignore until it's a valid 6-digit hex, then sync + persist.
      hexIn.addEventListener('change', () => {
        const m = /^#?([0-9a-fA-F]{6})$/.exec(hexIn.value.trim());
        if (!m) { hexIn.value = design[mode][key]; return; }
        const norm = '#' + m[1].toLowerCase();
        design[mode][key] = norm;
        colorIn.value = norm;
        hexIn.value = norm;
        refresh();
        save();
      });
      return h('div', { style: 'display:flex;align-items:center;gap:.5rem;padding:.18rem 0' },
        h('span', { style: 'flex:1;min-width:0;font-size:.85rem;font-weight:600;color:var(--ink-soft)' },
          PALETTE_LABELS[key]),
        colorIn, hexIn);
    };

    const paletteColumn = (mode, title) => {
      const checkEl = h('div', { style: 'margin-top:.7rem' });
      const refresh = () => checkEl.replaceChildren(
        h('div', {
          style: 'font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700;margin-bottom:.2rem',
        }, 'Legibility check'),
        ...checkerRows(design[mode]));
      refresh();
      return h('div', { style: 'min-width:0' },
        h('h3', { style: 'margin:.2rem 0 .45rem;font-size:1rem' }, title),
        Object.keys(PALETTE_LABELS).map(key => colorRow(mode, key, refresh)),
        checkEl);
    };

    const modeBtn = h('button', {
      class: 'btn btn-sm',
      onClick: () => {
        document.documentElement.dataset.mode = isDarkNow() ? 'light' : 'dark';
        modeBtn.textContent = isDarkNow() ? 'Preview light mode' : 'Preview dark mode';
      },
    }, isDarkNow() ? 'Preview light mode' : 'Preview dark mode');

    const colorsCard = h('div', { class: 'card' },
      h('div', { style: 'display:flex;align-items:center;gap:.7rem;flex-wrap:wrap' },
        h('h2', { style: 'margin-bottom:0;flex:1' }, icon('flower'), ' Colors'),
        modeBtn),
      h('p', { class: 'subtitle', style: 'margin:.25rem 0 .7rem' },
        'Each mode has its own palette. The legibility check flags combinations below WCAG AA (4.5:1).'),
      h('div', {
        style: 'display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:1rem 1.6rem',
      },
        paletteColumn('light', 'Light mode'),
        paletteColumn('dark', 'Dark mode')));

    // ---- Reset ------------------------------------------------------------
    const resetCard = h('div', { class: 'card' },
      h('h2', null, icon('stems'), ' Reset'),
      h('p', { class: 'subtitle' },
        'Return every design setting to the Poppy Creative defaults. Your uploaded logo and custom fonts are cleared too.'),
      h('button', {
        class: 'btn btn-danger',
        onClick: async () => {
          const ok = await confirmDialog(
            'Reset the design to the Poppy defaults? Your logo and uploaded custom fonts will be cleared as well.');
          if (!ok) return;
          pendingScrollY = window.scrollY;
          await db.put('settings', defaultDesign());
          toast('Design reset to Poppy defaults');
        },
      }, 'Reset design to Poppy defaults'));

    el.append(
      h('div', { class: 'view-head' },
        h('div', { class: 'grow' },
          h('h1', null, icon('bud', 22), ' Design'),
          h('p', { class: 'subtitle' }, 'Make PoppyShuffle look like your brand — logo, fonts, sizing, and colors.'))),
      brandingCard, typographyCard, sizesCard, colorsCard, resetCard);

    // Restore scroll after a save-triggered re-render (app.js resets it).
    if (pendingScrollY != null) {
      const y = pendingScrollY;
      pendingScrollY = null;
      requestAnimationFrame(() => window.scrollTo(0, y));
    }
  },
});
