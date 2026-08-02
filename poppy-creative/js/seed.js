// First-run seed data, modeled on The Poppy Creative (poppycreates.com):
// three rental spaces (The Meadow, The Wildflower, The Grove), a Collections
// catalog of event rental pieces, craft classes, and marketing/design services.
// Real published policies: 50% deposit, balance due 30 days before the event,
// 70% discount on in-house rentals. Prices marked (placeholder) are editable
// stand-ins, not published rates.
import { todayISO, addDaysISO } from './schema.js';

const now = () => new Date().toISOString();

export function seedData() {
  const t = todayISO();

  const settings = [{
    id: 'company',
    name: 'The Poppy Creative',
    tagline: 'A vibrant community hub in Mandan, ND — venue, event rentals, craft classes & coworking',
    email: 'hello@poppycreates.com',
    phone: '(701) 555-0134',
    address: 'Main Street',
    city: 'Mandan',
    region: 'ND',
    depositPct: 50,
    balanceDueDaysBefore: 30,
    inHouseDiscountPct: 70,
    taxPct: 5.0,
    currency: 'USD',
    theme: 'poppy',
    updatedAt: now(),
  }];

  const inv = (id, name, category, type, priceCents, unit, stockQty, imageEmoji, color, description, tags = []) =>
    ({ id, name, category, type, priceCents, unit, stockQty, imageEmoji, color, description, tags, active: true, notes: '', updatedAt: now() });

  const inventory = [
    // Spaces
    inv('sp-meadow', 'The Meadow', 'Spaces', 'space', 7500, 'per hour', 1, '🌾', '#E8B44F',
      'Our largest light-filled studio — crisp white walls, chic white-brick accent, warm wood flooring, and tons of natural light. Ideal for events, photoshoots, and workshops. Available for hourly rental. (placeholder rate)', ['studio', 'events', 'photo']),
    inv('sp-wildflower', 'The Wildflower', 'Spaces', 'space', 5000, 'per day', 6, '🌼', '#8BA888',
      'Bright coworking space — drop in for the day with wifi, coffee, and good company. $50/day.', ['coworking']),
    inv('sp-grove', 'The Grove', 'Spaces', 'space', 6500, 'per hour', 1, '🌳', '#4E6B51',
      'Cozy mid-size gathering room, perfect for meetings, workshops, and intimate parties. Available for hourly rental. (placeholder rate)', ['meetings', 'workshops']),
    // Seating
    inv('it-velvet-sofa', 'Blush Velvet Sofa', 'Seating', 'rental', 12500, 'per event', 2, '🛋️', '#E4938B',
      'Statement blush velvet sofa — the insta-worthy centerpiece of any lounge setup.', ['lounge', 'vintage']),
    inv('it-rattan-chairs', 'Rattan Peacock Chair', 'Seating', 'rental', 6500, 'per event', 4, '🪑', '#C99A5B',
      'Vintage rattan peacock chair for sweetheart tables and photo moments.', ['boho', 'photo']),
    inv('it-folding-chairs', 'White Folding Chairs (set of 10)', 'Seating', 'rental', 3500, 'per event', 12, '💺', '#D9D4C7',
      'Clean white folding chairs, sold in sets of ten. Setup included for in-house events.', ['ceremony']),
    // Tables
    inv('it-farm-table', 'Farmhouse Table (8 ft)', 'Tables', 'rental', 8500, 'per event', 6, '🪵', '#A9805B',
      'Warm wood farmhouse table seating 8–10.', ['reception']),
    inv('it-cocktail-table', 'Cocktail Table with Linen', 'Tables', 'rental', 3000, 'per event', 8, '🍸', '#DDE3D5',
      'High-top cocktail table with your choice of linen.', ['cocktail hour']),
    inv('it-dessert-cart', 'Vintage Dessert Cart', 'Tables', 'rental', 5500, 'per event', 1, '🧁', '#E9C9CF',
      'Rolling vintage cart for desserts, favors, or a champagne station.', ['dessert', 'vintage']),
    // Backdrops
    inv('it-arch-backdrop', 'Sage Arch Backdrop Wall', 'Backdrops', 'rental', 9500, 'per event', 2, '🏛️', '#8BA888',
      'Freestanding sage arch wall — flowers and signage attach easily.', ['photo', 'ceremony']),
    inv('it-shimmer-wall', 'Champagne Shimmer Wall', 'Backdrops', 'rental', 11000, 'per event', 1, '✨', '#E8B44F',
      'Champagne sequin shimmer wall, 7×7 ft — pure sparkle in photos.', ['photo', 'party']),
    inv('it-balloon-garland', 'Balloon Garland (10 ft, custom colors)', 'Backdrops', 'rental', 15000, 'per event', 4, '🎈', '#DE1E7E',
      'Custom-color balloon garland installed on any backdrop or wall.', ['balloon', 'party']),
    // Rugs
    inv('it-persian-rug', 'Vintage Persian-Style Rug', 'Rugs', 'rental', 4500, 'per event', 5, '🧶', '#B0563B',
      'Layered vintage-style rugs to warm up ceremonies and lounges.', ['boho', 'lounge']),
    // Decor
    inv('it-neon-sign', 'Neon Sign — "let’s party"', 'Decor', 'rental', 5000, 'per event', 1, '💡', '#DE1E7E',
      'Warm-white neon sign, hangs on any backdrop.', ['photo', 'party']),
    inv('it-taper-candles', 'Taper Candle + Bud Vase Set (10 tables)', 'Decor', 'rental', 6000, 'per event', 3, '🕯️', '#E8B44F',
      'Amber bud vases, taper candles, and holders styled per table.', ['tablescape']),
    inv('it-easel', 'Gold Easel + Welcome Sign', 'Decor', 'rental', 2500, 'per event', 3, '🖼️', '#C9A227',
      'Gold easel with acrylic welcome sign — custom lettering available.', ['signage']),
    // Tableware & Linens
    inv('it-linen-set', 'Table Linens (each, assorted colors)', 'Tableware & Linens', 'rental', 1200, 'per event', 40, '🧵', '#DDE3D5',
      'Floor-length linens in our house palette.', ['tablescape']),
    inv('it-glassware', 'Amber Goblet Glassware (set of 10)', 'Tableware & Linens', 'rental', 2000, 'per event', 10, '🥂', '#C9772B',
      'Amber glass goblets that glow in candlelight.', ['tablescape']),
    // Services
    inv('sv-craft-class', 'Private Craft Class (up to 12)', 'Services', 'service', 30000, 'per session', 2, '🎨', '#8BA888',
      'A tailored hands-on craft class hosted by Poppy — materials included.', ['classes', 'experiences']),
    inv('sv-design', 'Marketing & Design Package', 'Services', 'service', 20000, 'per session', 3, '🖌️', '#4E6B51',
      'Branding, print, and social design services from the Poppy studio. (placeholder rate)', ['design']),
    inv('sv-setup', 'Delivery, Setup & Teardown', 'Services', 'service', 7500, 'per event', 5, '🚚', '#233329',
      'We deliver, set up in your preferred layout, and handle cleanup after.', ['logistics']),
  ];

  const clients = [
    { id: 'cl-harper', name: 'Harper Nelson', company: '', email: 'harper.n@example.com', phone: '(701) 555-0172', source: 'Instagram', notes: 'Planning a 30th birthday — loves the shimmer wall.', createdAt: now(), updatedAt: now() },
    { id: 'cl-bismarck-arts', name: 'Maya Ortiz', company: 'Bismarck Arts Collective', email: 'maya@bismarckarts.example.org', phone: '(701) 555-0148', source: 'Referral', notes: 'Quarterly workshop series in The Grove.', createdAt: now(), updatedAt: now() },
    { id: 'cl-tj', name: 'TJ & Rosa Amundson', company: '', email: 'tjrosa@example.com', phone: '(701) 555-0126', source: 'Facebook', notes: 'Fall wedding reception, ~120 guests.', createdAt: now(), updatedAt: now() },
  ];

  const projects = [
    {
      id: 'pr-harper-bday', name: 'Harper — 30th Birthday Bash', clientId: 'cl-harper',
      status: 'signed', eventDate: addDaysISO(t, 21), endDate: addDaysISO(t, 21),
      startTime: '17:00', endTime: '23:00', venue: 'The Meadow', inHouse: true,
      lines: [
        { itemId: 'sp-meadow', name: 'The Meadow (hourly)', qty: 6, priceCents: 7500, type: 'space' },
        { itemId: 'it-shimmer-wall', name: 'Champagne Shimmer Wall', qty: 1, priceCents: 11000, type: 'rental' },
        { itemId: 'it-balloon-garland', name: 'Balloon Garland (10 ft, custom colors)', qty: 1, priceCents: 15000, type: 'rental' },
        { itemId: 'it-neon-sign', name: 'Neon Sign — "let’s party"', qty: 1, priceCents: 5000, type: 'rental' },
        { itemId: 'it-cocktail-table', name: 'Cocktail Table with Linen', qty: 4, priceCents: 3000, type: 'rental' },
      ],
      discountCents: 0, notes: 'Gold + champagne palette. Balloon colors: champagne, white, poppy red.',
      quoteNumber: 'PS-1001',
      signature: { name: 'Harper Nelson', signedAt: now() },
      createdAt: now(), updatedAt: now(),
    },
    {
      id: 'pr-workshop', name: 'Arts Collective — Spring Workshop', clientId: 'cl-bismarck-arts',
      status: 'quote', eventDate: addDaysISO(t, 35), endDate: addDaysISO(t, 35),
      startTime: '09:00', endTime: '15:00', venue: 'The Grove', inHouse: true,
      lines: [
        { itemId: 'sp-grove', name: 'The Grove (hourly)', qty: 6, priceCents: 6500, type: 'space' },
        { itemId: 'sv-craft-class', name: 'Private Craft Class (up to 12)', qty: 1, priceCents: 30000, type: 'service' },
        { itemId: 'it-farm-table', name: 'Farmhouse Table (8 ft)', qty: 2, priceCents: 8500, type: 'rental' },
      ],
      discountCents: 0, notes: 'Send updated quote after headcount confirms.',
      quoteNumber: 'PS-1002', signature: null,
      createdAt: now(), updatedAt: now(),
    },
    {
      id: 'pr-wedding', name: 'Amundson Wedding Reception', clientId: 'cl-tj',
      status: 'lead', eventDate: addDaysISO(t, 90), endDate: addDaysISO(t, 91),
      startTime: '15:00', endTime: '23:00', venue: 'Off-site — Harmon Lake Pavilion', inHouse: false,
      lines: [
        { itemId: 'it-arch-backdrop', name: 'Sage Arch Backdrop Wall', qty: 1, priceCents: 9500, type: 'rental' },
        { itemId: 'it-farm-table', name: 'Farmhouse Table (8 ft)', qty: 6, priceCents: 8500, type: 'rental' },
        { itemId: 'it-linen-set', name: 'Table Linens (each, assorted colors)', qty: 12, priceCents: 1200, type: 'rental' },
        { itemId: 'sv-setup', name: 'Delivery, Setup & Teardown', qty: 1, priceCents: 7500, type: 'service' },
      ],
      discountCents: 0, notes: 'Two-day rental (setup Friday). Waiting on final guest count.',
      quoteNumber: 'PS-1003', signature: null,
      createdAt: now(), updatedAt: now(),
    },
  ];

  const payments = [
    { id: 'pay-harper-dep', projectId: 'pr-harper-bday', amountCents: 24675, method: 'card', date: t, kind: 'deposit', note: '50% deposit on signing', updatedAt: now() },
  ];

  return { settings, inventory, clients, projects, payments };
}
