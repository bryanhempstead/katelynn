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
    phone: '701.214.7969',
    address: '410 W Main St #408',
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
    // Spaces — real descriptions from poppycreates.com/our-spaces (hourly; base
    // rates aren't published in search indexes, so those are placeholders).
    inv('sp-meadow', 'The Meadow', 'Spaces', 'space', 7500, 'per hour', 1, '🌾', '#E8B44F',
      'Our largest light-filled studio — crisp white walls with a chic white-brick accent, warm wood flooring, and abundant natural light. Ideal for events, photoshoots, workshops, and creative gatherings. Every reservation includes a complimentary 30-minute buffer before and after for setup; each additional weekday studio hour is $50. (base rate placeholder)', ['studio', 'events', 'photo']),
    inv('sp-wildflower', 'The Wildflower', 'Spaces', 'space', 5000, 'per day', 6, '🌼', '#8BA888',
      'Inviting coworking and meeting space with cozy, historic charm — Wi-Fi, all the coffee you need, beverage fridge, vending machine, and a conference room with TV (HDMI screen-sharing + Firestick). Perfect for remote work, meetings, lifestyle shoots, or intimate gatherings. $50 a day.', ['coworking', 'meetings']),
    inv('sp-grove', 'The Grove', 'Spaces', 'space', 6500, 'per hour', 1, '🌳', '#4E6B51',
      'Chic, intimate studio for smaller gatherings, photoshoots, and creative projects — white walls with a stylish white-brick accent, rich dark wood floors, and large north-facing windows with soft, steady natural light. Transforms into a cozy event venue, photo studio, or workshop spot. Includes the complimentary 30-minute setup buffer. (base rate placeholder)', ['meetings', 'workshops', 'photo']),
    // Couches — poppycreates.com/collections/couches
    inv('it-velvet-sofa', 'Blush Velvet Sofa', 'Couches', 'rental', 12500, 'per event', 2, '🛋️', '#E4938B',
      'Statement blush velvet sofa — chic design and cozy comfort that elevates events, photoshoots, and gatherings. (demo item — replace with your pieces)', ['lounge', 'vintage']),
    // Accent Chairs — poppycreates.com/collections/accent-chairs
    inv('it-rattan-chairs', 'Rattan Peacock Chair', 'Accent Chairs', 'rental', 6500, 'per event', 4, '🪑', '#C99A5B',
      'Vintage rattan peacock chair — character and comfort for sweetheart tables and photo moments. (demo item)', ['boho', 'photo']),
    inv('it-folding-chairs', 'White Folding Chairs (set of 10)', 'Accent Chairs', 'rental', 3500, 'per event', 12, '💺', '#D9D4C7',
      'Clean white folding chairs, sold in sets of ten. Setup included for in-house events. (demo item)', ['ceremony']),
    // Tables — real items from the site
    inv('it-mika-table', 'Mika Table', 'Tables', 'rental', 2000, 'per event', 1, '🪑', '#5C5C54',
      'The Mika Accent Table features a sleek, dark wood top paired with a white pedestal base for a refined, modern look. Its compact size makes it an excellent choice for showcasing floral arrangements, candles, or small decorative elements. (price placeholder — not published)', ['accent', 'modern']),
    inv('it-lottie-table', 'Lottie Table', 'Tables', 'rental', 1500, 'per event', 1, '✨', '#E9C9CF',
      'A small girl that makes a big statement — she is dainty, she is shimmery. $15.00 per rental.', ['accent', 'shimmer']),
    inv('it-farm-table', 'Farmhouse Table (8 ft)', 'Tables', 'rental', 8500, 'per event', 6, '🪵', '#A9805B',
      'Warm wood farmhouse table seating 8–10. (demo item)', ['reception']),
    inv('it-cocktail-table', 'Cocktail Table with Linen', 'Tables', 'rental', 3000, 'per event', 8, '🍸', '#DDE3D5',
      'High-top cocktail table with your choice of linen. (demo item)', ['cocktail hour']),
    // Backdrops
    inv('it-arch-backdrop', 'Sage Arch Backdrop Wall', 'Backdrops', 'rental', 9500, 'per event', 2, '🏛️', '#8BA888',
      'Freestanding sage arch wall — flowers and signage attach easily. Perfect for turning any space into an insta-worthy backdrop. (demo item)', ['photo', 'ceremony']),
    inv('it-shimmer-wall', 'Champagne Shimmer Wall', 'Backdrops', 'rental', 11000, 'per event', 1, '✨', '#E8B44F',
      'Champagne sequin shimmer wall, 7×7 ft — pure sparkle in photos. (demo item)', ['photo', 'party']),
    inv('it-balloon-garland', 'Balloon Garland (10 ft, custom colors)', 'Backdrops', 'rental', 15000, 'per event', 4, '🎈', '#DE1E7E',
      'Custom-color balloon garland installed on any backdrop or wall. (demo item)', ['balloon', 'party']),
    // Rugs
    inv('it-persian-rug', 'Vintage Persian-Style Rug', 'Rugs', 'rental', 4500, 'per event', 5, '🧶', '#B0563B',
      'Layered vintage-style rugs to warm up ceremonies and lounges. (demo item)', ['boho', 'lounge']),
    // Decor — real items: mirrors, disco balls, clear pedestals
    inv('it-gold-mirror', 'Ornate Gold Mirror', 'Decor', 'rental', 4000, 'per event', 3, '🪞', '#C9A227',
      'Vintage-inspired mirror with ornate gold accents and a rich, gilded finish exuding timeless charm — a stunning focal point that enhances light and adds glamour. (price placeholder — not published)', ['mirrors', 'vintage']),
    inv('it-disco-6', 'Disco Ball — 6" (Disco Dynamo)', 'Decor', 'rental', 1000, 'per event', 4, '🪩', '#B8C0C8',
      'Pocket-sized 6-inch disco ball that turns every space into a disco wonderland. (price placeholder — not published)', ['disco', 'party']),
    inv('it-disco-12', 'Disco Ball — 12"', 'Decor', 'rental', 2500, 'per event', 2, '🪩', '#8FA0B0',
      'Statement 12-inch disco ball — instant sparkle and retro glam for dance floors, photo ops, and dazzling light across the venue. (price placeholder — not published)', ['disco', 'party']),
    inv('it-clear-pedestals', 'Clear Pedestals (set)', 'Decor', 'rental', 4500, 'per event', 2, '🏛️', '#DDE3D5',
      'Clear cylinder pedestals with built-in hooks inside to showcase decorations — fairy lights twinkling within or cascading floral arrangements suspended. Can be wrapped in spandex to match any theme. (price placeholder — not published)', ['pedestals', 'display']),
    inv('it-neon-sign', 'Neon Sign — "let’s party"', 'Decor', 'rental', 5000, 'per event', 1, '💡', '#DE1E7E',
      'Warm-white neon sign, hangs on any backdrop. (demo item)', ['photo', 'party']),
    inv('it-linen-set', 'Table Linens (each, assorted colors)', 'Decor', 'rental', 1200, 'per event', 40, '🧵', '#DDE3D5',
      'Floor-length linens in our house palette. Tablecloths are provided and set up for in-house events. (demo item)', ['tablescape']),
    // Services — Tailored Experiences & studio services from the site
    inv('sv-craft-class', 'Craft Class — Tailored Experience', 'Services', 'service', 30000, 'per session', 2, '🎨', '#8BA888',
      'Tailored Experiences are all about creating custom magic just for you — custom backdrops, centerpieces, and hands-on craft classes hosted by Poppy. (price placeholder)', ['classes', 'experiences']),
    inv('sv-party-package', 'Custom Party Package', 'Services', 'service', 25000, 'per event', 3, '🎉', '#DE1E7E',
      'Fully customizable party package — we provide all tables, chairs, and tablecloths, set everything up in your preferred layout before you arrive, and handle the cleanup after. All you bring is yourself, your friends, and any extra decor. (price placeholder)', ['party', 'full-service']),
    inv('sv-design', 'Marketing & Design Package', 'Services', 'service', 20000, 'per session', 3, '🖌️', '#4E6B51',
      'Branding, print, and social design services from the Poppy studio. (price placeholder)', ['design']),
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
        { itemId: 'sv-party-package', name: 'Custom Party Package', qty: 1, priceCents: 25000, type: 'service' },
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
