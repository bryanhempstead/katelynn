// PoppyShuffle desktop shell (Electron).
//
// This is a thin wrapper around the same static web app in the parent
// directory — no build step, no bundler. Data persistence: the app stores
// everything in IndexedDB, and Electron keeps IndexedDB inside the app's
// userData directory automatically (see app.getPath('userData')), so records
// survive restarts and app updates with zero extra code here.

const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const REPO_URL = 'https://github.com/bryanhempstead/katelynn';

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#faf6ef',
    icon: path.join(__dirname, '..', 'icons', 'icon-512.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));
  return win;
}

function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'Export data…',
          accelerator: 'CmdOrCtrl+E',
          click: (_item, win) => {
            // The page listens for this via preload if it chooses to; the
            // current app ignores it gracefully (export lives in Settings).
            if (win) win.webContents.send('poppyshuffle:export');
          },
        },
        {
          label: 'Import data…',
          accelerator: 'CmdOrCtrl+I',
          click: (_item, win) => {
            if (win) win.webContents.send('poppyshuffle:import');
          },
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'PoppyShuffle on GitHub',
          click: () => shell.openExternal(REPO_URL),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  app.on('activate', () => {
    // macOS: re-create a window when the dock icon is clicked.
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
