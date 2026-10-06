// Bezaleel for Windows: opens the same editor as the web app in its own window.
const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

const ROOT = path.join(__dirname, '..');

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
  win.loadFile(path.join(ROOT, 'app', 'index.html'));

  // Links to other websites open in the normal browser, never inside the editor window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file:')) { e.preventDefault(); shell.openExternal(url); }
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
    setupUpdates(createWindow());
    app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
