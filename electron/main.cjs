// FilamentHub für Windows: startet den eingebauten Server (spricht per LAN/MQTT mit dem Drucker) und zeigt die App im Fenster.
const { app, BrowserWindow, Menu, shell, session } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');

const PORT = 38517; // fest, damit die gespeicherten Daten (Spulen, Einstellungen) immer im selben Speicher liegen
const URL = `http://127.0.0.1:${PORT}`;
let server = null;
let win = null;

function startServer() {
  const userData = app.getPath('userData');
  const dataDir = path.join(userData, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const entry = path.join(__dirname, '..', 'server-dist', 'server.mjs');
  server = spawn(process.execPath, [entry], {
    cwd: userData, // dort liegt .bambu-config.json (Drucker-Zugangsdaten)
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      NODE_ENV: 'production',
      PORT: String(PORT),
      HOST: '127.0.0.1',
      FILAMENT_DATA_DIR: dataDir
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true
  });
  const log = fs.createWriteStream(path.join(userData, 'server.log'), { flags: 'a' });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on('exit', code => {
    if (!app.isQuitting) console.error('Server beendet, Code', code);
  });
}

function waitForServer(tries = 60) {
  return new Promise((resolve, reject) => {
    const attempt = n => {
      const req = http.get(URL, res => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (n <= 0) return reject(new Error('Server startet nicht'));
        setTimeout(() => attempt(n - 1), 500);
      });
    };
    attempt(tries);
  });
}

async function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 420,
    minHeight: 600,
    title: 'FilamentHub',
    backgroundColor: '#062116',
    icon: path.join(__dirname, '..', 'public', 'pwa-512x512.png'),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false }
  });
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith(URL)) shell.openExternal(url);
    return { action: url.startsWith(URL) ? 'allow' : 'deny' };
  });
  try {
    await waitForServer();
    await win.loadURL(URL);
  } catch (e) {
    await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent('<body style="font-family:sans-serif;background:#062116;color:#fff;padding:32px"><h2>FilamentHub startet nicht</h2><p>Der interne Server antwortet nicht. Port ' + PORT + ' evtl. belegt. Log: ' + path.join(app.getPath('userData'), 'server.log') + '</p></body>'));
  }
}

const lock = app.requestSingleInstanceLock();
if (!lock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    // Meldungen (Druck fertig, Trocknung fertig) erlauben
    session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'notifications' || permission === 'clipboard-sanitized-write'));
    startServer();
    createWindow();
  });
  app.on('before-quit', () => {
    app.isQuitting = true;
    if (server) server.kill();
  });
  app.on('window-all-closed', () => app.quit());
}
