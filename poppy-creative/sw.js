/* PoppyShuffle service worker.
 *
 * Strategy: network-first, falling back to cache. Fresh deploys are picked up
 * naturally whenever the network is available, and the app keeps working
 * offline from the last good copy. All successful same-origin GET responses
 * are cached on the fly.
 *
 * Registered from index.html with a relative path ('sw.js'), so the worker is
 * scoped to the poppyshuffle/ directory and never touches the root-level
 * service worker or caches belonging to other apps in this GitHub Pages repo.
 */

const CACHE_NAME = 'poppyshuffle-v3';

// App shell, relative to this worker's location (the app may be served from a
// subpath such as /poppy-creative/).
const PRECACHE = [
  './',
  'index.html',
  'css/app.css',
  'js/app.js',
  'js/db.js',
  'js/schema.js',
  'js/seed.js',
  'js/availability.js',
  'js/docs.js',
  'js/ical.js',
  'fonts/fraunces-latin-wght-normal.woff2',
  'fonts/kaushan-script-latin-400-normal.woff2',
  'fonts/josefin-sans-latin-wght-normal.woff2',
  'js/icons.js',
  'js/views/dashboard.js',
  'js/views/inventory.js',
  'js/views/projects.js',
  'js/views/clients.js',
  'js/views/calendar.js',
  'js/views/reports.js',
  'js/views/settings.js',
  'embed/catalog.html',
  'embed/widget.js',
  'manifest.webmanifest',
  'icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // cache.addAll() is atomic — one missing file would fail the whole
    // install. Add files individually and ignore individual failures so a
    // single 404 never bricks the worker.
    await Promise.allSettled(PRECACHE.map((url) => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      // Cache successful same-origin responses on the fly.
      if (response && response.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (err) {
      const cached = await caches.match(request, { ignoreSearch: true });
      if (cached) return cached;
      // Offline navigation to any route falls back to the app shell.
      if (request.mode === 'navigate') {
        const shell = await caches.match('index.html');
        if (shell) return shell;
      }
      throw err;
    }
  })());
});
