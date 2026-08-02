# PoppyShuffle Desktop

A minimal [Electron](https://www.electronjs.org/) wrapper around the PoppyShuffle web app in the parent directory. Same app, same data model — just in its own window with a native menu.

## Run it

```bash
cd poppyshuffle/desktop
npm install
npm start
```

`npm install` pulls Electron (a dev dependency); `npm start` opens PoppyShuffle in a 1280×800 window.

## Package an installer

```bash
npx electron-builder        # installer for your current OS into desktop/dist/
npx electron-builder --dir  # unpacked app folder, faster for testing
```

The `build` section in `package.json` bundles the parent app files (`index.html`, `css/`, `js/`, `icons/`, `embed/`).

## Where your data lives

The app stores everything in IndexedDB. Inside Electron, IndexedDB is kept in the app's **userData** directory, so your data persists across restarts and updates automatically:

- Linux: `~/.config/poppyshuffle-desktop/`
- macOS: `~/Library/Application Support/poppyshuffle-desktop/`
- Windows: `%APPDATA%\poppyshuffle-desktop\`

Desktop data is separate from any browser or PWA copy of PoppyShuffle — move data between them with backups (below).

## Backups (export / import)

Use **Settings → Export backup** inside the app to download a full JSON snapshot of every store (settings, inventory, clients, projects, payments), and **Settings → Import backup** to restore it — on this machine or any other platform running PoppyShuffle. The File menu's *Export data… / Import data…* entries send events the page may also handle; the Settings screen is the canonical path.

## Menu

- **File** — Export data…, Import data…, Quit
- **View** — reload, dev tools, zoom, full screen
- **Help** — link to the GitHub repository
