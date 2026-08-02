# PoppyShuffle on mobile

PoppyShuffle is a fully responsive, offline-first PWA — install it from the browser and it behaves like a native app with its own icon and standalone window. Full read/edit of the same data as the web app.

## Install

**iOS (Safari)**

1. Open the app URL (e.g. `https://your-site.com/poppy-creative/`).
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.

**Android (Chrome)**

1. Open the app URL in Chrome.
2. Tap the **⋮** menu → **Add to Home screen** (or **Install app** when Chrome offers it), then confirm.

## Offline behavior

The service worker (`sw.js`) precaches the app shell and uses a network-first strategy: when you're online you always get the newest deployed version, and everything you load is cached; when you're offline the app runs from cache. Your actual records are never "on the network" at all — they live in IndexedDB on the device — so viewing and editing data works fully offline. New deploys are picked up automatically the next time you open the app online.

## Moving data between devices

Each device keeps its own local database — there is no sync server. To move or copy data:

1. On the source device: **Settings → Export backup** — saves one JSON file containing every store.
2. Get the file to the other device (AirDrop, email, cloud drive…).
3. On the target device: **Settings → Import backup** — choose **replace** (make this device an exact copy) or **merge** (combine by record id).

The same file works across mobile, desktop browser, and the Electron app.
