// Arca Estudio for Windows: opens the same editor as the web app in its own window.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

const ROOT = path.join(__dirname, '..');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Arca Estudio',
    backgroundColor: '#100D0B',
    icon: path.join(ROOT, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.loadFile(path.join(ROOT, 'app', 'index.html'));

  // Links to other websites open in the normal browser, never inside the editor window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
  });
}

// One copy at a time: opening the shortcut again focuses the existing window.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows();
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    Menu.setApplicationMenu(null);
    createWindow();
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
