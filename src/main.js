'use strict';

const { app, BrowserWindow, WebContentsView, globalShortcut, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');
const automation = require('./automation.js');

const FLYFF_URL     = 'https://universe.flyff.com';

// sendInputEvent erwartet DOM-Keywerte, nicht Accelerator-Namen
const KEY_NAME_MAP = { 'Space': ' ', 'Return': '\r', 'Enter': '\r' };
function normalizeKey(k) { return KEY_NAME_MAP[k] ?? k; }
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
// Nutzer-Configs liegen in app.getPath('userData') (~/.config/flyff-wrapper/)
// damit AppImage-Updates die gespeicherten Einstellungen nicht überschreiben.
// Beim ersten Start wird die gebündelte Default-Config dorthin kopiert.

function userConfigPath(filename) {
  return path.join(app.getPath('userData'), filename);
}

function bundledConfigPath(filename) {
  return path.join(__dirname, '..', 'config', filename);
}

function loadConfig(filename) {
  // Zuerst Nutzer-Config, dann gebündelter Default
  for (const p of [userConfigPath(filename), bundledConfigPath(filename)]) {
    try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch {}
  }
  return null;
}

function saveConfig(filename, data) {
  fs.mkdirSync(app.getPath('userData'), { recursive: true });
  fs.writeFileSync(userConfigPath(filename), JSON.stringify(data, null, 2), 'utf8');
}

// ── Globale Variablen ─────────────────────────────────────────────────────────

let mainWindow    = null;
let settingsWindow = null;
let questWindow    = null;
let pickerWindow   = null;
let currentPickerAccount = null;
const hpHealActive = {};  // account → boolean: steuert den async Heal-Loop
let ocrWorker = null;
let lastPickerScreenshot = null;
let view1 = null;   // WebContentsView für Account 1
let view2 = null;   // WebContentsView für Account 2
let activeAccount = 'account1';
let overlayOpen   = false;  // Guide oder Changelog sichtbar → Game-Views versteckt halten

// Virtuelle Mausposition für Gamepad-Delta-Bewegung
const cursor  = { x: DEFAULT_W / 2, y: DEFAULT_H / 2 };
const lastSent = { x: -1, y: -1 };   // verhindert Flood bei Cursor an der Kante

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

  // Cursor sichtbar halten (Spiel setzt canvas { cursor: none })
  const CURSOR_CSS = '*, canvas { cursor: default !important; }';

  view1.webContents.on('did-finish-load', () => { view1.webContents.insertCSS(CURSOR_CSS); });
  view2.webContents.on('did-finish-load', () => { view2.webContents.insertCSS(CURSOR_CSS); });

  updateViewBounds();
}

// Setzt Bounds und Sichtbarkeit der Views je nach aktivem Account.
// Ist ein Overlay offen, bleibt der aktive View versteckt bis es geschlossen wird.
function updateViewBounds() {
  if (!mainWindow || !view1 || !view2) return;
  const [w, h] = mainWindow.getContentSize();
  const activeBounds = { x: 0, y: TOOLBAR_H, width: w, height: h - TOOLBAR_H };
  const hiddenBounds  = { x: 0, y: TOOLBAR_H, width: 0, height: 0 };

  if (activeAccount === 'account1') {
    view1.setBounds(activeBounds);
    view1.setVisible(!overlayOpen);
    if (!overlayOpen) view1.webContents.focus();
    view2.setBounds(hiddenBounds);
    view2.setVisible(false);
  } else {
    view2.setBounds(activeBounds);
    view2.setVisible(!overlayOpen);
    if (!overlayOpen) view2.webContents.focus();
    view1.setBounds(hiddenBounds);
    view1.setVisible(false);
  }
}

// ── Auto-Fill Login ───────────────────────────────────────────────────────────


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
    title: 'Flyff Wrapper – Einstellungen',
    backgroundColor: '#1a1a2e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  settingsWindow.loadFile(path.join(__dirname, 'ui', 'settings.html'));
  settingsWindow.setMenu(null);
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

const CLOSE_BTN_JS = `(() => {
  if (document.getElementById('__fw_close')) return;
  const b = document.createElement('div');
  b.id = '__fw_close';
  b.textContent = '✕ Close';
  b.style.cssText = 'position:fixed;top:12px;right:12px;z-index:2147483647;background:#cc2222;color:#fff;padding:9px 20px;border-radius:6px;cursor:pointer;font:bold 14px system-ui;box-shadow:0 2px 10px rgba(0,0,0,.6);';
  b.onmouseenter = () => b.style.background = '#ee3333';
  b.onmouseleave = () => b.style.background = '#cc2222';
  b.onclick = () => window.questWin.close();
  document.body.appendChild(b);
})()`;

function openQuestUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) return;
  if (questWindow) {
    questWindow.loadURL(url);
    questWindow.focus();
    return;
  }

  questWindow = new BrowserWindow({
    width: 1000,
    height: 750,
    title: 'Flyff Wrapper – Quest Details',
    backgroundColor: '#1a1a2e',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'quest-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  questWindow.webContents.on('did-finish-load', () => {
    questWindow?.webContents.executeJavaScript(CLOSE_BTN_JS).catch(() => {});
  });

  questWindow.loadURL(url);
  questWindow.on('closed', () => { questWindow = null; });
}

// ── CDP-Tastendruck (für Keys die sendInputEvent nicht erreicht) ──────────────
// Puppeteer/Playwright-Äquivalent: setzt code, key, text, windowsVirtualKeyCode korrekt
// und erzeugt isTrusted:true – identisch zu echtem OS-Tastendruck aus Sicht des Spiels

async function sendKeyCDP(view, keyDef) {
  if (!view) return;
  const dbg = view.webContents.debugger;
  if (!dbg.isAttached()) {
    try { dbg.attach('1.3'); } catch { return; }
  }
  try {
    await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...keyDef });
    if (keyDef.text) {
      await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'char', ...keyDef });
    }
    // 80ms halten – Spiel pollt Input per rAF (~16ms); keyUp im selben Tick = Taste nie "gedrückt"
    await new Promise(r => setTimeout(r, 80));
    await dbg.sendCommand('Input.dispatchKeyEvent', { type: 'keyUp', ...keyDef });
  } catch {}
}

const CDP_KEYS = {
  Space: { windowsVirtualKeyCode: 32, nativeVirtualKeyCode: 32, code: 'Space', key: ' ', text: ' ', unmodifiedText: ' ', autoRepeat: false },
  J:     { windowsVirtualKeyCode: 74, nativeVirtualKeyCode: 74, code: 'KeyJ',  key: 'j', text: 'j', unmodifiedText: 'j', autoRepeat: false }
};

// ── HP-basiertes Autoheal – Bar-Fill-Scan ────────────────────────────────────
// Scannt die Mittellinie des gewählten Rects von rechts nach links.
// Erstes gesättigtes (gefärbtes, nicht-graues) Pixel = rechte Füllkante.
// HP% = Füllkante / Balkenbreite × 100
// Funktioniert für beliebige Balkenfarben (rot, blau, grün).

function estimateHpFromBarFill(bitmap, width, height) {
  if (!bitmap || bitmap.length < width * height * 4) return null;
  const margin = 1; 
  let rightmost = -1;

  for (let y = 1; y < height - 1; y++) {
    for (let x = width - 1 - margin; x >= margin; x--) {
      const i = (y * width + x) * 4;
      const r = bitmap[i + 2], g = bitmap[i + 1], b = bitmap[i];
      const maxC = Math.max(r, g, b), minC = Math.min(r, g, b);
      
      // brightness 30, saturation 25. catches very dark pixels.
      if (maxC > 30 && (maxC - minC) > 25) {
        if (x > rightmost) rightmost = x;
        break;
      }
    }
  }

  if (rightmost < 0) return 0;
  
  const innerWidth = width - 2 * margin;
  if (innerWidth <= 0) return 0;
  
  let pct = ((rightmost - margin + 1) / innerWidth) * 100;
  if (pct > 100) pct = 100;
  return Math.round(pct);
}

// Scans each row for dominant color channel; groups consecutive same-color rows
// into bands. Returns { hp, mp, fp } as absolute screen coordinate rects.
function detectAllBars(bitmap, imgWidth, imgHeight, statusRect) {
  const MIN_SAT = 25, MIN_BRIGHT = 30;
  const MIN_PX = Math.max(3, Math.floor(imgWidth * 0.08));

  const rowTypes = [];
  for (let y = 0; y < imgHeight; y++) {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    for (let x = 0; x < imgWidth; x++) {
      const i = (y * imgWidth + x) * 4;
      const B = bitmap[i], G = bitmap[i + 1], R = bitmap[i + 2]; // BGRA
      const maxC = Math.max(R, G, B), minC = Math.min(R, G, B);
      if (maxC > MIN_BRIGHT && (maxC - minC) > MIN_SAT) {
        rSum += R; gSum += G; bSum += B; count++;
      }
    }
    if (count >= MIN_PX) {
      let type;
      if (rSum >= gSum && rSum >= bSum) type = 'hp';
      else if (gSum >= rSum && gSum >= bSum) type = 'fp';
      else type = 'mp';
      rowTypes.push({ y, type });
    }
  }

  const bands = [];
  for (const { y, type } of rowTypes) {
    const last = bands[bands.length - 1];
    if (last && last.type === type && y <= last.endY + 3) {
      last.endY = y;
    } else {
      bands.push({ type, startY: y, endY: y });
    }
  }

  const result = {};
  for (const { type, startY, endY } of bands) {
    const h = endY - startY + 1;
    if (!result[type] || h > result[type].height) {
      result[type] = {
        x: statusRect.x,
        y: statusRect.y + startY,
        width: statusRect.width,
        height: Math.max(h, 4)
      };
    }
  }
  return result;
}

async function initOcr() {
  try {
    const { createWorker } = require('tesseract.js');
    ocrWorker = await createWorker('eng', 1, { logger: () => {} });
    await ocrWorker.setParameters({
      tessedit_char_whitelist: '0123456789./%',
      tessedit_pageseg_mode:   '7',  // single text line
    });
    console.log('OCR worker ready');
  } catch (e) {
    console.error('OCR init failed:', e.message);
  }
}

// Weißen Text auf farbigem/dunklem Hintergrund → schwarzer Text auf weiß.
// Erkennt "386 / 386" (current/max) und "82.94%" (Prozent-Format).
async function ocrPercent(img) {
  if (!ocrWorker) return null;
  try {
    const { width, height } = img.getSize();
    const src = img.toBitmap();
    const dst = Buffer.alloc(src.length, 255);
    for (let i = 0; i < width * height; i++) {
      const bright = (src[i*4+2] + src[i*4+1] + src[i*4]) / 3;
      const val = bright > 160 ? 0 : 255;
      dst[i*4] = dst[i*4+1] = dst[i*4+2] = val;
      dst[i*4+3] = 255;
    }
    const processed = nativeImage.createFromBitmap(dst, { width, height });
    const { data: { text } } = await ocrWorker.recognize(processed.toPNG());

    // "386 / 386" oder "386/386" → current / max
    let m = text.match(/(\d+)\s*[/\\]\s*(\d+)/);
    if (m) {
      const cur = parseInt(m[1]), max = parseInt(m[2]);
      if (max > 0) return Math.round((cur / max) * 100);
    }
    // "82.94%" – Fallback für Prozent-Elemente
    m = text.match(/(\d+(?:\.\d+)?)\s*%/);
    if (m) return parseFloat(m[1]);
    return null;
  } catch { return null; }
}

function sendHealKey(view, keyCode) {
  const cdpDef = CDP_KEYS[keyCode];
  if (cdpDef) { sendKeyCDP(view, cdpDef); return; }
  try {
    view.webContents.sendInputEvent({ type: 'keyDown', keyCode });
    view.webContents.sendInputEvent({ type: 'char',    keyCode: normalizeKey(keyCode) });
    view.webContents.sendInputEvent({ type: 'keyUp',   keyCode });
  } catch {}
}

function stopAutoHeal(account) {
  hpHealActive[account] = false;
}

async function runBarLoop(account, barType, barCfg, barRect, view) {
  const delay = Math.max(barCfg.intervalMs || 500, 200);
  let lastPressed = 0;
  const cooldown = 1500;

  while (hpHealActive[account]) {
    const t0 = Date.now();
    try {
      if (view && mainWindow) {
        let img = await view.webContents.capturePage(barRect);
        let pct = estimateHpFromBarFill(img.toBitmap(), img.getSize().width, img.getSize().height);

        // Safety check: 0% is often a capture glitch (UI flicker).
        // If we get 0%, wait 100ms and re-capture once to confirm.
        if (pct === 0) {
          await new Promise(r => setTimeout(r, 100));
          img = await view.webContents.capturePage(barRect);
          pct = estimateHpFromBarFill(img.toBitmap(), img.getSize().width, img.getSize().height);
        }

        if (pct !== null) {
          console.log(`[AutoHeal] ${account} ${barType.toUpperCase()}=${pct}% threshold=${barCfg.threshold}%`);
          if (pct < barCfg.threshold && Date.now() - lastPressed > cooldown) {
            console.log(`[AutoHeal] ${account} ${barType}: pressing ${barCfg.key}`);
            sendHealKey(view, barCfg.key);
            lastPressed = Date.now();
          }
        }
      }
    } catch (e) { console.error(`[AutoHeal] ${account} ${barType} error:`, e.message); }
    const wait = Math.max(0, delay - (Date.now() - t0));
    await new Promise(r => setTimeout(r, wait));
  }
}

function startAutoHeal(account) {
  stopAutoHeal(account);
  const cfg  = loadConfig('autoheal.json');
  const acfg = cfg?.[account];
  if (!acfg?.barBounds || Object.keys(acfg.barBounds).length === 0) return;

  const bars = ['hp', 'mp', 'fp'];
  const anyEnabled = bars.some(b => acfg[b]?.enabled);
  if (!anyEnabled) return;

  const view = account === 'account1' ? view1 : view2;
  hpHealActive[account] = true;

  for (const barType of bars) {
    const barCfg  = acfg[barType];
    const barRect = acfg.barBounds[barType];
    if (!barCfg?.enabled || !barRect) continue;
    console.log(`[AutoHeal] ${account} ${barType} started – key=${barCfg.key} threshold=${barCfg.threshold}% interval=${barCfg.intervalMs}ms`);
    runBarLoop(account, barType, barCfg, barRect, view);
  }
}

async function openHpPicker(account) {
  if (pickerWindow) pickerWindow.close();
  if (!mainWindow) return;
  currentPickerAccount = account;
  const bounds = mainWindow.getBounds();

  // Game-View-Screenshot als Hintergrund – funktioniert auch in Gamescope (kein Compositor nötig)
  let bgDataUrl = null;
  try {
    const activeView = activeAccount === 'account1' ? view1 : view2;
    const [w, h] = mainWindow.getContentSize();
    const img = await activeView.webContents.capturePage({ x: 0, y: 0, width: w, height: h - TOOLBAR_H });
    bgDataUrl = img.toDataURL();
    lastPickerScreenshot = img;
  } catch {}

  pickerWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y + TOOLBAR_H,
    width:  bounds.width,
    height: bounds.height - TOOLBAR_H,
    frame: false,
    alwaysOnTop: true,
    backgroundColor: '#000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  pickerWindow.loadFile(path.join(__dirname, 'ui', 'hp-picker.html'));
  pickerWindow.setSkipTaskbar(true);
  pickerWindow.webContents.on('did-finish-load', () => {
    if (bgDataUrl) pickerWindow?.webContents.send('hp-picker-bg', bgDataUrl);
  });
  pickerWindow.on('closed', () => { pickerWindow = null; });
}

// ── Auto-Targeting: Spiralsuche im Game-View-Kontext ─────────────────────────
// Wird via executeJavaScript in den aktiven WebContentsView injiziert.
// Bewegt den Cursor spiralförmig von der Bildschirmmitte nach außen und klickt,
// sobald das Spiel via Cursor-Style-Änderung ein hoverbares Ziel signalisiert.

function spiralSearch(maxRadius) {
  if (window.__flyffTargetSearch) return;
  window.__flyffTargetSearch = true;

  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const STEP = 0.35;    // Radiant pro Tick (~60° pro Tick, Scan in ~2.3s statt ~8s)
  const TIGHTNESS = 6;  // Pixel pro Radiant (~37px Abstand zwischen Spiralarmen)
  const TICK_MS = 16;   // ~60 Schritte/s

  let theta = 0;
  let curX = cx;
  let curY = cy;
  let timer = null;
  let observer = null;

  const baseCursor = document.body.style.cursor;
  const canvas = document.querySelector('canvas');
  const baseCanvasCursor = canvas ? canvas.style.cursor : '';

  function stop() {
    window.__flyffTargetSearch = false;
    if (observer) observer.disconnect();
    clearInterval(timer);
  }

  function clickCurrent() {
    stop();
    setTimeout(() => {
      const el = document.elementFromPoint(curX, curY) || document.body;
      el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: curX, clientY: curY, button: 0 }));
      el.dispatchEvent(new MouseEvent('mouseup',   { bubbles: true, cancelable: true, clientX: curX, clientY: curY, button: 0 }));
    }, 80);
  }

  function cursorChanged() {
    if (document.body.style.cursor !== baseCursor) return true;
    if (canvas && canvas.style.cursor !== baseCanvasCursor) return true;
    return false;
  }

  observer = new MutationObserver(() => { if (cursorChanged()) clickCurrent(); });
  observer.observe(document.body, { attributes: true, attributeFilter: ['style'] });
  if (canvas) observer.observe(canvas, { attributes: true, attributeFilter: ['style'] });

  timer = setInterval(() => {
    const r = TIGHTNESS * theta;
    if (r > maxRadius) { stop(); return; }

    curX = cx + r * Math.cos(theta);
    curY = cy + r * Math.sin(theta);

    const el = document.elementFromPoint(curX, curY) || document.body;
    el.dispatchEvent(new MouseEvent('mousemove', {
      bubbles: true, cancelable: true,
      clientX: curX, clientY: curY,
      screenX: curX, screenY: curY
    }));

    if (cursorChanged()) { clickCurrent(); return; }

    theta += STEP;
  }, TICK_MS);
}

// ── IPC-Handler ───────────────────────────────────────────────────────────────

function setupIPC() {
  ipcMain.on('switch-account',      (_, acc)  => switchAccount(acc));
  ipcMain.on('start-automation',    (_, acc)  => startAutomation(acc));
  ipcMain.on('stop-automation',     (_, acc)  => stopAutomation(acc));
  ipcMain.on('open-settings',       ()        => openSettings());
  ipcMain.on('close-settings',      ()        => settingsWindow?.close());
  ipcMain.on('open-quest-url',      (_, url)  => openQuestUrl(url));
  ipcMain.on('close-quest-window',  ()        => questWindow?.close());


  ipcMain.on('set-game-view-visibility', (_, visible) => {
    overlayOpen = !visible;
    updateViewBounds();
  });

  // Zustand für Toolbar-Initialisierung liefern
  ipcMain.handle('get-state', () => ({
    activeAccount,
    account1Running: automation.isRunning('account1'),
    account2Running: automation.isRunning('account2'),
    hotkeys: store.get('hotkeys'),
    version: app.getVersion()
  }));

  // Automation-Config für Settings-Fenster liefern
  ipcMain.handle('get-automation-config', () => {
    return loadConfig('automation.json');
  });

  // Gamepad-Config für Renderer liefern
  ipcMain.handle('get-gamepad-config', () => {
    return loadConfig('gamepad.json') || { '0': 'Z', '1': 'X', '2': 'C', '3': 'V' };
  });

  ipcMain.handle('clear-session', async (_, account) => {
    const { session } = require('electron');
    const partition = account === 'account1' ? 'persist:account1' : 'persist:account2';
    await session.fromPartition(partition).clearStorageData();
    const view = account === 'account1' ? view1 : view2;
    view?.webContents.loadURL('https://universe.flyff.com');
  });

  ipcMain.handle('get-changelog', () => {
    try {
      return fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
    } catch { return ''; }
  });

  ipcMain.handle('get-monsters', () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, '../config/monsters.json'), 'utf8'));
    } catch { return []; }
  });

  ipcMain.handle('get-quests', () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, '../config/quests.json'), 'utf8'));
    } catch { return []; }
  });

  ipcMain.handle('get-questlines', () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, '../config/questlines.json'), 'utf8'));
    } catch { return []; }
  });

  ipcMain.handle('get-dailies', () => {
    try {
      return JSON.parse(fs.readFileSync(path.join(__dirname, '../config/dailies.json'), 'utf8'));
    } catch { return []; }
  });

  ipcMain.handle('get-quest-progress', () => {
    return store.get('questProgress', {});
  });

  ipcMain.on('save-quest-progress', (_, progress) => {
    store.set('questProgress', progress);
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
    cursor.x = Math.max(0, Math.min(w - 1,             cursor.x + dx));
    cursor.y = Math.max(0, Math.min(h - TOOLBAR_H - 1, cursor.y + dy));
    const rx = Math.round(cursor.x);
    const ry = Math.round(cursor.y);
    if (rx === lastSent.x && ry === lastSent.y) return;  // Position unverändert → nicht senden
    lastSent.x = rx;
    lastSent.y = ry;
    try {
      view.webContents.sendInputEvent({ type: 'mouseMove', x: rx, y: ry });
    } catch {}
  });

  // Cursor zur Mitte zurücksetzen wenn Stick losgelassen (nach Kamera-Schwenk)
  ipcMain.on('gamepad-reset-cursor', () => {
    if (!mainWindow) return;
    const [w, h] = mainWindow.getContentSize();
    cursor.x   = w / 2;
    cursor.y   = (h - TOOLBAR_H) / 2;
    lastSent.x = -1;  // nächste Bewegung erzwingt Send
    lastSent.y = -1;
  });

  // Gamepad-Button: kurzer Tastendruck
  // Space/J via CDP (80ms Hold nötig weil Spiel Input per rAF pollt); alle anderen Keys via sendInputEvent sofort
  ipcMain.on('gamepad-button', (_, { keyCode }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    const cdpDef = CDP_KEYS[keyCode];
    if (cdpDef) {
      sendKeyCDP(view, cdpDef);
      return;
    }
    try {
      view.webContents.sendInputEvent({ type: 'keyDown', keyCode });
      view.webContents.sendInputEvent({ type: 'char',    keyCode: normalizeKey(keyCode) });
      view.webContents.sendInputEvent({ type: 'keyUp',   keyCode });
    } catch {}
  });

  // Gamepad-WASD: Taste gedrückt halten (linker Stick)
  ipcMain.on('gamepad-keydown', (_, { keyCode }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    try { view.webContents.sendInputEvent({ type: 'keyDown', keyCode: normalizeKey(keyCode) }); } catch {}
  });

  ipcMain.on('gamepad-keyup', (_, { keyCode }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    try { view.webContents.sendInputEvent({ type: 'keyUp', keyCode: normalizeKey(keyCode) }); } catch {}
  });

  // Mausklicks für Controller-Buttons (__LCLICK / __RHOLD)
  ipcMain.on('gamepad-mousedown', (_, { button }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    try {
      view.webContents.sendInputEvent({
        type: 'mouseDown', button,
        x: Math.round(cursor.x), y: Math.round(cursor.y), clickCount: 1
      });
    } catch {}
  });

  ipcMain.on('gamepad-mouseup', (_, { button }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    try {
      view.webContents.sendInputEvent({
        type: 'mouseUp', button,
        x: Math.round(cursor.x), y: Math.round(cursor.y), clickCount: 1
      });
    } catch {}
  });

  // Scrollrad (D-Pad Zoom)
  ipcMain.on('gamepad-scroll', (_, { deltaX, deltaY }) => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    try {
      view.webContents.sendInputEvent({
        type: 'mouseWheel',
        x: Math.round(cursor.x),
        y: Math.round(cursor.y),
        deltaX,
        deltaY,
        canScroll: true
      });
    } catch {}
  });

  // Auto-Targeting: Spiralsuche im aktiven Game-View
  ipcMain.on('search-target', () => {
    const view = activeAccount === 'account1' ? view1 : view2;
    if (!view) return;
    const gpCfg = loadConfig('gamepad.json') || {};
    const radius = gpCfg.targetRadius || 300;
    view.webContents.executeJavaScript(`(${spiralSearch})(${radius})`).catch(() => {});
  });

  // Gamepad-Config speichern
  ipcMain.on('save-gamepad-config', (_, cfg) => {
    try { saveConfig('gamepad.json', cfg); } catch (e) {
      console.error('Fehler beim Speichern der Gamepad-Config:', e.message);
    }
    mainWindow?.webContents.send('gamepad-config-updated', cfg);
  });

  // Autoheal-Config laden
  ipcMain.handle('get-autoheal-config', () => loadConfig('autoheal.json') || {});

  // Autoheal-Config speichern und Loops neu starten
  ipcMain.on('save-autoheal-config', (_, cfg) => {
    try { saveConfig('autoheal.json', cfg); } catch (e) {
      console.error('Error saving autoheal config:', e.message);
    }
    ['account1', 'account2'].forEach(acc => {
      const anyEnabled = ['hp', 'mp', 'fp'].some(b => cfg[acc]?.[b]?.enabled);
      anyEnabled ? startAutoHeal(acc) : stopAutoHeal(acc);
    });
  });

  // HP-Bar-Picker öffnen
  ipcMain.on('open-hp-picker', (_, account) => openHpPicker(account).catch(e => console.error('HP picker:', e)));

  // Picker: Rechteck wurde ausgewählt → Bars detektieren, Config speichern, Settings benachrichtigen
  ipcMain.on('hp-picker-done', async (_, rect) => {
    const account = currentPickerAccount;
    if (!account) { pickerWindow?.close(); return; }
    const cfg = loadConfig('autoheal.json') || {};
    if (!cfg[account]) cfg[account] = { hp: {}, mp: {}, fp: {} };
    cfg[account].statusRect = rect;
    cfg[account].barBounds  = {};

    if (lastPickerScreenshot) {
      try {
        const cropped = lastPickerScreenshot.crop({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        const { width, height } = cropped.getSize();
        if (width && height) {
          const bitmap = cropped.toBitmap();
          cfg[account].barBounds = detectAllBars(bitmap, width, height, rect);
          console.log(`[AutoHeal] ${account} detected bars:`, JSON.stringify(cfg[account].barBounds));
        }
      } catch (e) { console.error('[AutoHeal] bar detection failed:', e.message); }
    }

    try { saveConfig('autoheal.json', cfg); } catch {}
    pickerWindow?.close();
    settingsWindow?.webContents.send('autoheal-rect-picked', {
      account, rect, barBounds: cfg[account].barBounds
    });
  });

  // Picker: abgebrochen
  ipcMain.on('hp-picker-cancel', () => { pickerWindow?.close(); });

  // Alle Bars einmalig messen (Test-Button)
  ipcMain.handle('test-hp-capture', async (_, account) => {
    const cfg  = loadConfig('autoheal.json');
    const acfg = cfg?.[account];
    if (!acfg?.barBounds || Object.keys(acfg.barBounds).length === 0) return { error: 'no-rect' };
    const view = account === 'account1' ? view1 : view2;
    if (!view) return { error: 'no-view' };
    const result = {};
    for (const barType of ['hp', 'mp', 'fp']) {
      const barRect = acfg.barBounds[barType];
      if (!barRect) { result[barType] = null; continue; }
      try {
        const img = await view.webContents.capturePage(barRect);
        const { width, height } = img.getSize();
        if (!width || !height) { result[barType] = null; continue; }
        result[barType] = estimateHpFromBarFill(img.toBitmap(), width, height);
      } catch { result[barType] = null; }
    }
    return result;
  });

  // Macro-Config laden
  ipcMain.handle('get-macros', () => loadConfig('macros.json') || []);

  // Macro-Config speichern und Toolbar aktualisieren
  ipcMain.on('save-macros', (_, macros) => {
    try { saveConfig('macros.json', macros); } catch (e) {
      console.error('Fehler beim Speichern der Macro-Config:', e.message);
    }
    mainWindow?.webContents.send('macros-updated', macros);
  });

  // Macro ausführen: Automation pausieren, Keys sequenziell senden, Automation fortsetzen
  ipcMain.on('run-macro', (_, macroId) => {
    const macros = loadConfig('macros.json') || [];
    const macro  = macros.find(m => m.id === macroId);
    if (!macro) return;
    const account = macro.account || 'account2';
    const view    = account === 'account1' ? view1 : view2;
    if (!view) return;

    const wasRunning = automation.isRunning(account);
    if (wasRunning) stopAutomation(account);

    const delay      = macro.delay || 200;
    const keys       = macro.keys  || [];
    const startDelay = wasRunning ? 100 : 0;

    keys.forEach((keyCode, i) => {
      setTimeout(() => {
        const cdpDef = CDP_KEYS[keyCode];
        if (cdpDef) {
          sendKeyCDP(view, cdpDef);
        } else {
          try {
            view.webContents.sendInputEvent({ type: 'keyDown', keyCode });
            view.webContents.sendInputEvent({ type: 'char',    keyCode: normalizeKey(keyCode) });
            view.webContents.sendInputEvent({ type: 'keyUp',   keyCode });
          } catch {}
        }
      }, startDelay + i * delay);
    });

    if (wasRunning) {
      setTimeout(() => startAutomation(account), startDelay + keys.length * delay + 200);
    }
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
  await initOcr();
  ['account1', 'account2'].forEach(acc => startAutoHeal(acc));

});

app.on('window-all-closed', () => {
  globalShortcut.unregisterAll();
  if (process.platform !== 'darwin') app.quit();
});

// Sauberes Beenden via SIGTERM (Steam Overlay "Spiel beenden" im Game Mode)
process.on('SIGTERM', () => {
  globalShortcut.unregisterAll();
  app.quit();
});

// IPC-Handler: App direkt beenden (vom Toolbar-Button)
ipcMain.on('quit-app', () => {
  globalShortcut.unregisterAll();
  app.quit();
});
