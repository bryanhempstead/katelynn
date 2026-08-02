// Preload script: the only bridge between the PoppyShuffle page and Electron.
// Kept deliberately tiny — the app is a plain web app and needs nothing from
// the OS. We expose the app version plus a hook for the File menu's
// Export/Import events; the page may ignore both without error.

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('poppyshuffleDesktop', {
  version: process.env.npm_package_version || '1.0.0',
  platform: process.platform,
  // Optional: page code can call onMenu('export', fn) / onMenu('import', fn)
  // to react to the File menu. Nothing breaks if it never does.
  onMenu(kind, fn) {
    if (kind !== 'export' && kind !== 'import') return () => {};
    const channel = `poppyshuffle:${kind}`;
    const handler = () => fn();
    ipcRenderer.on(channel, handler);
    return () => ipcRenderer.removeListener(channel, handler);
  },
});
