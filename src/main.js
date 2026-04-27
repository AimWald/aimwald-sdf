'use strict';

const { app, BrowserWindow, WebContentsView, globalShortcut, ipcMain } = require('electron');
const path = require('path');
const fs   = require('fs');
const automation = require('./automation.js');

const FLYFF_URL     = 'https://universe.flyff.com';
const TOOLBAR_H     = 30;     // Höhe der Toolbar in px
const DEFAULT_W     = 1280;
const DEFAULT_H     = 800;

// electron-store ist ESM-only (v8+) – dynamischer Import nötig
let store;
async function initStore() {
  const { default: Store } = await import('electron-store');
  store = new Store({
    defaults: {
      activeAccount: 'account1',
      hotkeys: { switchAccount: 'F9', toggleAutomation: 'F10' },
      windowBounds: { width: DEFAULT_W, height: DEFAULT_H }
    }
  });
}

// ── Config-Dateien ────────────────────────────────────────────────────────────

function loadConfig(filename) {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', filename), 'utf8'));
  } catch {
    return null;
  }
}

function saveConfig(filename, data) {
  fs.writeFileSync(
    path.join(__dirname, '..', 'config', filename),
    JSON.stringify(data, null, 2),
    'utf8'
  );
}

// ── Globale Variablen ─────────────────────────────────────────────────────────

let mainWindow    = null;
let settingsWindow = null;
let view1 = null;   // WebContentsView für Account 1
let view2 = null;   // WebContentsView für Account 2
let activeAccount = 'account1';

// Virtuelle Mausposition für Gamepad-Delta-Bewegung
const cursor = { x: DEFAULT_W / 2, y: DEFAULT_H / 2 };

// ── Hauptfenster ──────────────────────────────────────────────────────────────

function createMainWindow() {
  const saved = store.get('windowBounds', { width: DEFAULT_W, height: DEFAULT_H });

  mainWindow = new BrowserWindow({
    width:  saved.width  || DEFAULT_W,
    height: saved.height || DEFAULT_H,
    frame: false,                   // Kein OS-Rahmen; Toolbar liegt direkt im HTML
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));
  mainWindow.maximize();
  // DevTools für Gamepad-Debugging – entfernen wenn nicht mehr gebraucht
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  mainWindow.on('resize', () => {
    if (mainWindow) {
      store.set('windowBounds', mainWindow.getBounds());
      updateViewBounds();
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Game-Views (WebContentsView) ──────────────────────────────────────────────

function createGameViews() {
  view1 = new WebContentsView({
    webPreferences: {
      partition: 'persist:account1',  // Isolierte Session für Account 1
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  view2 = new WebContentsView({
    webPreferences: {
      partition: 'persist:account2',  // Isolierte Session für Account 2
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  // Beide Views dauerhaft als Kinder des Hauptfensters – bleiben auch im Hintergrund aktiv
  mainWindow.contentView.addChildView(view1);
  mainWindow.contentView.addChildView(view2);

  view1.webContents.loadURL(FLYFF_URL);
  view2.webContents.loadURL(FLYFF_URL);

  updateViewBounds();
}

// Setzt Bounds und Sichtbarkeit der Views je nach aktivem Account
function updateViewBounds() {
  if (!mainWindow || !view1 || !view2) return;
  const [w, h] = mainWindow.getContentSize();
  const activeBounds = { x: 0, y: TOOLBAR_H, width: w, height: h - TOOLBAR_H };
  const hiddenBounds  = { x: 0, y: TOOLBAR_H, width: 0, height: 0 };

  if (activeAccount === 'account1') {
    view1.setBounds(activeBounds);
    view1.setVisible(true);
    view2.setBounds(hiddenBounds);
    view2.setVisible(false);
  } else {
    view2.setBounds(activeBounds);
    view2.setVisible(true);
    view1.setBounds(hiddenBounds);
    view1.setVisible(false);
  }
}

// ── Account-Wechsel ───────────────────────────────────────────────────────────

function switchAccount(account) {
  // Ohne Argument: zwischen den beiden Accounts umschalten
  activeAccount = account !== undefined
    ? account
    : (activeAccount === 'account1' ? 'account2' : 'account1');

  store.set('activeAccount', activeAccount);
  updateViewBounds();
  mainWindow?.webContents.send('account-switched', activeAccount);
}

// ── Automation ────────────────────────────────────────────────────────────────

function onAutomationStateChange(account, running) {
  mainWindow?.webContents.send('automation-state-changed', { account, running });
}

function startAutomation(account) {
  const view = account === 'account1' ? view1 : view2;
  if (!view) return;
  automation.start(account, view.webContents, onAutomationStateChange);
}

function stopAutomation(account) {
  automation.stop(account, onAutomationStateChange);
}

// ── Globale Shortcuts ─────────────────────────────────────────────────────────

function registerShortcuts() {
  const hk = store.get('hotkeys', { switchAccount: 'F9', toggleAutomation: 'F10' });

  // F9 (konfigurierbar): Account wechseln
  try { globalShortcut.register(hk.switchAccount, () => switchAccount()); } catch (e) {
    console.error('Shortcut konnte nicht registriert werden:', hk.switchAccount, e.message);
  }

  // F10 (konfigurierbar): Automation des aktiven Accounts umschalten
  try {
    globalShortcut.register(hk.toggleAutomation, () => {
      automation.isRunning(activeAccount)
        ? stopAutomation(activeAccount)
        : startAutomation(activeAccount);
    });
  } catch (e) {
    console.error('Shortcut konnte nicht registriert werden:', hk.toggleAutomation, e.message);
  }

  // F11: Vollbild umschalten (fest verdrahtet)
  try {
    globalShortcut.register('F11', () => {
      mainWindow?.setFullScreen(!mainWindow.isFullScreen());
    });
  } catch {}
}

// ── Settings-Fenster ──────────────────────────────────────────────────────────

function openSettings() {
  if (settingsWindow) { settingsWindow.focus(); return; }

  settingsWindow = new BrowserWindow({
    width: 680,
    height: 740,
    parent: mainWindow,
    modal: false,
    title: 'Flyff Wrapper – Einstellungen',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'ui', 'settings.html'));
  settingsWindow.setMenu(null);
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

// ── IPC-Handler ───────────────────────────────────────────────────────────────

function setupIPC() {
  ipcMain.on('switch-account',      (_, acc)  => switchAccount(acc));
  ipcMain.on('start-automation',    (_, acc)  => startAutomation(acc));
  ipcMain.on('stop-automation',     (_, acc)  => stopAutomation(acc));
  ipcMain.on('open-settings',       ()        => openSettings());

  // Zustand für Toolbar-Initialisierung liefern
  ipcMain.handle('get-state', () => ({
    activeAccount,
    account1Running: automation.isRunning('account1'),
    account2Running: automation.isRunning('account2'),
    hotkeys: store.get('hotkeys')
  }));

  // Automation-Config für Settings-Fenster liefern
  ipcMain.handle('get-automation-config', () => {
    return loadConfig('automation.json');
  });

  // Gamepad-Config für Renderer liefern
  ipcMain.handle('get-gamepad-config', () => {
    return loadConfig('gamepad.json') || { '0': 'Z', '1': 'X', '2': 'C', '3': 'V' };
  });

  // Neue Automation-Config übernehmen und in Datei schreiben
  ipcMain.on('save-automation-config', (_, cfg) => {
    try { saveConfig('automation.json', cfg); } catch (e) {
      console.error('Fehler beim Speichern der Automation-Config:', e.message);
    }
    automation.setConfig(cfg);
    // Laufende Automationen mit neuer Config neu starten
    ['account1', 'account2'].forEach(acc => {
      if (automation.isRunning(acc)) {
        stopAutomation(acc);
        startAutomation(acc);
      }
    });
  });

  // Hotkeys neu registrieren
  ipcMain.on('save-hotkeys', (_, hotkeys) => {
    store.set('hotkeys', hotkeys);
    globalShortcut.unregisterAll();
    registerShortcuts();
  });

  // Gamepad-Mausbewegung: Delta auf virtuelle Position anwenden und an aktiven View senden
  ipcMain.on('gamepad-mouse-move', (_, { dx, dy }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view || !mainWindow) return;
    const [w, h] = mainWindow.getContentSize();
    cursor.x = Math.max(0, Math.min(w,            cursor.x + dx));
    cursor.y = Math.max(0, Math.min(h - TOOLBAR_H, cursor.y + dy));
    try {
      view.webContents.sendInputEvent({
        type: 'mouseMove',
        x: Math.round(cursor.x),
        y: Math.round(cursor.y)
      });
    } catch {}
  });

  // Gamepad-Button: Tastendruck an aktiven View senden
  ipcMain.on('gamepad-button', (_, { keyCode }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    try {
      view.webContents.sendInputEvent({ type: 'keyDown', keyCode });
      view.webContents.sendInputEvent({ type: 'keyUp',   keyCode });
    } catch {}
  });
}

// ── App-Lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  await initStore();

  const automationCfg = loadConfig('automation.json');
  if (automationCfg) automation.setConfig(automationCfg);

  activeAccount = store.get('activeAccount', 'account1');

  createMainWindow();
  createGameViews();
  setupIPC();
  registerShortcuts();
});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});
