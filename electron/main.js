// Bezaleel for Windows: opens the same editor as the web app in its own window.
const { app, BrowserWindow, Menu, dialog, shell, protocol, net } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'app');

// The editor is served from app://bezaleel/ instead of file://, so it behaves like the web app:
// a secure origin (needed for the noise-reduction worklet), working fetch(), and stable storage.
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }
]);
function serveApp() {
  protocol.handle('app', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(APP_DIR, rel));
    if (file !== APP_DIR && !file.startsWith(APP_DIR + path.sep)) return new Response('Not found', { status: 404 });
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: 'Bezaleel',
    backgroundColor: '#100D0B',
    icon: path.join(ROOT, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true }
  });
  win.loadURL('app://bezaleel/index.html');

  // Links to other websites open in the normal browser, never inside the editor window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://bezaleel/')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); }
  });
  return win;
}

// Checks GitHub Releases for a newer installer, downloads it in the background,
// and installs it on restart. Runs only in the installed program, not with `npm start`.
const FOUR_HOURS = 4 * 60 * 60 * 1000;
function setupUpdates(win) {
  if (!app.isPackaged) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('update-downloaded', async info => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'info',
      buttons: ['Reiniciar ahora', 'Después'],
      defaultId: 0,
      cancelId: 1,
      title: 'Actualización lista',
      message: `Bezaleel ${info.version} ya se descargó.`,
      detail: 'Si estás exportando un video, espera a que termine. Si eliges "Después", la nueva versión se instala sola cuando cierres el programa.'
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });
  // No internet or GitHub unreachable: keep working and try again at the next check.
  autoUpdater.on('error', () => {});
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, FOUR_HOURS);
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
    serveApp();
    setupUpdates(createWindow());
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
