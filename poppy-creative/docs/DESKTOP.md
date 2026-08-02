# PoppyShuffle on desktop

Two ways to run PoppyShuffle as a desktop app — pick whichever suits you.

## Option 1: Electron app

A ready-to-run Electron scaffold lives in [`desktop/`](../desktop/README.md):

```bash
cd poppyshuffle/desktop
npm install
npm start
```

You get a native window (1280×800), a File/View/Help menu, and data persisted in Electron's own userData directory via IndexedDB. Package installers with `npx electron-builder`. Full details — data location, backups, packaging — are in [desktop/README.md](../desktop/README.md).

## Option 2: Install the PWA (no install of anything else)

Chromium browsers can install the web app as a desktop app directly:

1. Open the app URL in **Chrome** or **Edge**.
2. Click the **install icon** in the address bar (or menu → **Cast, save, and share → Install page as app…** in Chrome; **Apps → Install this site as an app** in Edge).
3. PoppyShuffle opens in its own window with its own dock/taskbar icon, works offline, and updates itself on each launch when online.

The PWA uses the browser's IndexedDB; the Electron app uses its own. They are separate databases — use **Settings → Export backup / Import backup** to move data between them.
