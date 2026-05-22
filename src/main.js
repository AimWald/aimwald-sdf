'use strict';

const { app, BrowserWindow, WebContentsView, globalShortcut, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs   = require('fs');
const automation = require('./automation.js');

const FLYFF_URL     = 'https://universe.flyff.com';

// sendInputEvent erwartet DOM-Keywerte, nicht Accelerator-Namen
const KEY_NAME_MAP = { 'Space': ' ', 'Return': '\r', 'Enter': '\r', 'ArrowLeft': 'Left', 'ArrowRight': 'Right', 'ArrowUp': 'Up', 'ArrowDown': 'Down' };
function normalizeKey(k) { return KEY_NAME_MAP[k] ?? k; }
const TOOLBAR_H     = 30;     // Toolbar height in pixels
const DEFAULT_W     = 1280;
const DEFAULT_H     = 800;

// electron-store ist ESM-only (v8+) – dynamischer Import nötig
let store;
async function initStore() {
  const { default: Store } = await import('electron-store');
  store = new Store({
    defaults: {
      activeAccount: 'account1',
      hotkeys: { switchAccount: 'F9', toggleAutomation: 'F10', followBoard: ',' },
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
let currentPickerTarget = null; // { account, barType }
const hpHealActive  = {};  // account → boolean: steuert den async Heal-Loop
let ocrWorker = null;
let lastPickerScreenshot = null;

// Game Views: 1 & 2 sind immer geladen, 3 & 4 optional (null bis geöffnet)
const gameViews = {
  account1: null,
  account2: null,
  account3: null,
  account4: null
};

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
    frame: false,                   // No OS frame; toolbar is in HTML
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '../build/icon.png'),
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
      const [w, h] = mainWindow.getContentSize();
      mainWindow.webContents.send('view-size-changed', { w, h: h - TOOLBAR_H });
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });

  // Forward keyboard events from the toolbar renderer to the active game view.
  // Steam Deck's virtual keyboard sends events to the OS window (BrowserWindow)
  // rather than the focused WebContentsView, so they would otherwise be lost.
  // event.preventDefault() stops the toolbar page from also handling it.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (overlayOpen) return;
    const view = gameViews[activeAccount];
    if (!view?.webContents) return;
    event.preventDefault();
    const mods = [];
    if (input.shift)   mods.push('shift');
    if (input.control) mods.push('control');
    if (input.alt)     mods.push('alt');
    if (input.meta)    mods.push('meta');
    try {
      if (input.type === 'keyDown') {
        view.webContents.sendInputEvent({ type: 'keyDown', keyCode: input.key, modifiers: mods });
        if (input.key.length === 1) {
          view.webContents.sendInputEvent({ type: 'char', keyCode: input.key, modifiers: mods });
        }
      } else if (input.type === 'keyUp') {
        view.webContents.sendInputEvent({ type: 'keyUp', keyCode: input.key, modifiers: mods });
      }
    } catch {}
  });
}

// ── Game-Views (WebContentsView) ──────────────────────────────────────────────

function createGameView(account) {
  const view = new WebContentsView({
    webPreferences: {
      partition: `persist:${account}`,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true
    }
  });

  mainWindow.contentView.addChildView(view);
  view.webContents.loadURL(FLYFF_URL);

  const CURSOR_CSS = '*, canvas { cursor: default !important; }';
  view.webContents.on('did-finish-load', () => {
    view.webContents.insertCSS(CURSOR_CSS);
  });

  gameViews[account] = view;
  return view;
}

function createGameViews() {
  // Account 1 & 2 werden beim Start immer geladen
  createGameView('account1');
  createGameView('account2');
  updateViewBounds();
}

function openAccount(account) {
  if (gameViews[account]) {
    switchAccount(account);
    return;
  }
  createGameView(account);
  switchAccount(account);
  mainWindow?.webContents.send('account-opened', account);
}

function closeAccount(account) {
  if (account === 'account1' || account === 'account2') {
    console.warn(`Cannot close ${account} - core accounts cannot be closed`);
    return;
  }
  const view = gameViews[account];
  if (!view) return;

  stopAutomation(account);
  stopAutoHeal(account);
  mainWindow.contentView.removeChildView(view);
  view.webContents.close();
  gameViews[account] = null;

  // Switch to account1 if we just closed the active account
  if (activeAccount === account) {
    switchAccount('account1');
  }

  mainWindow?.webContents.send('account-closed', account);
}

// Setzt Bounds und Sichtbarkeit der Views je nach aktivem Account.
// Ist ein Overlay offen, bleibt der aktive View versteckt bis es geschlossen wird.
function updateViewBounds() {
  if (!mainWindow) return;
  const [w, h] = mainWindow.getContentSize();
  const activeBounds = { x: 0, y: TOOLBAR_H, width: w, height: h - TOOLBAR_H };
  const hiddenBounds = { x: -w - 100, y: TOOLBAR_H, width: w, height: h - TOOLBAR_H };

  for (const [account, view] of Object.entries(gameViews)) {
    if (!view) continue;

    if (account === activeAccount) {
      view.setBounds(activeBounds);
      view.setVisible(!overlayOpen);
      if (!overlayOpen) view.webContents.focus();
    } else {
      view.setBounds(hiddenBounds);
      view.setVisible(true);
    }
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
  const view = gameViews[account];
  if (!view) return;
  automation.start(account, view.webContents, onAutomationStateChange);
}

function stopAutomation(account) {
  automation.stop(account, onAutomationStateChange);
}

// ── Follow + Board: Z + Alt+6 Key-Kombination ────────────────────────────────

async function sendFollowBoard(account) {
  const view = gameViews[account];
  if (!view) return;

  console.log(`[FollowBoard] Sending to ${account}: Z, then Alt+6`);

  // Z drücken
  const zKey = CDP_KEYS['Z'] || { windowsVirtualKeyCode: 90, nativeVirtualKeyCode: 90, code: 'KeyZ', key: 'z', text: 'z', unmodifiedText: 'z', autoRepeat: false };
  await sendKeyCDP(view, zKey);
  await new Promise(r => setTimeout(r, 150));

  // Alt+6 drücken
  try {
    view.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Alt' });
    await new Promise(r => setTimeout(r, 50));
    view.webContents.sendInputEvent({ type: 'keyDown', keyCode: '6', modifiers: ['alt'] });
    view.webContents.sendInputEvent({ type: 'char', keyCode: '6', modifiers: ['alt'] });
    await new Promise(r => setTimeout(r, 80));
    view.webContents.sendInputEvent({ type: 'keyUp', keyCode: '6', modifiers: ['alt'] });
    view.webContents.sendInputEvent({ type: 'keyUp', keyCode: 'Alt' });
  } catch (e) {
    console.error('[FollowBoard] Error sending Alt+6:', e.message);
  }
}

// ── Globale Shortcuts ─────────────────────────────────────────────────────────

function registerShortcuts() {
  const hk = store.get('hotkeys', { switchAccount: 'F9', toggleAutomation: 'F10', followBoard: ',' });

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

  // Follow + Board Hotkey (konfigurierbar, Standard: ,)
  try {
    globalShortcut.register(hk.followBoard, () => {
      sendFollowBoard(activeAccount);
    });
  } catch (e) {
    console.error('Shortcut konnte nicht registriert werden:', hk.followBoard, e.message);
  }

}

// ── Settings-Fenster ──────────────────────────────────────────────────────────

function openSettings() {
  if (settingsWindow) { settingsWindow.focus(); return; }

  settingsWindow = new BrowserWindow({
    width: 680,
    height: 740,
    title: 'AimWald-SDF Settings',
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
    title: 'AimWald-SDF Quest Details',
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

// v1 (max rightmost pixel – fast but sensitive to stray text pixels)
function estimateHpFromBarFill_v1(bitmap, width, height, barType, physLeft = null, physRight = null) {
  if (!bitmap || bitmap.length < width * height * 4) return null;
  const scanL = physLeft  != null ? Math.max(0,         Math.round(physLeft)  - 1) : 2;
  const scanR = physRight != null ? Math.min(width - 1, Math.round(physRight) + 1) : width - 3;
  let rightmost = -1;
  for (let y = 1; y < height - 1; y++) {
    for (let x = scanR; x >= scanL; x--) {
      const i = (y * width + x) * 4;
      const b = bitmap[i], g = bitmap[i + 1], r = bitmap[i + 2];
      let isHit = false;
      if (barType === 'hp') isHit = r > 70 && r > g + 40 && r > b + 40;
      else if (barType === 'mp') isHit = b > 70 && b > r + 20 && b > g + 20;
      else if (barType === 'fp') isHit = g > 70 && g > r + 25 && g > b + 15;
      else { const mx = Math.max(r, g, b); isHit = mx > 50 && (mx - Math.min(r, g, b)) > 30; }
      if (isHit) { if (x > rightmost) rightmost = x; break; }
    }
  }
  if (rightmost < 0) return 0;
  const L = physLeft != null ? physLeft : scanL;
  const R = physRight != null ? physRight : scanR;
  const span = R - L;
  if (span <= 0) return 0;
  return Math.round(Math.min(100, ((rightmost - L) / span) * 100));
}

// v2 (median per row – robust against stray text/border pixels)
function estimateHpFromBarFill(bitmap, width, height, barType, physLeft = null, physRight = null) {
  if (!bitmap || bitmap.length < width * height * 4) return null;
  const scanL = physLeft  != null ? Math.max(0,         Math.round(physLeft)  - 1) : 2;
  const scanR = physRight != null ? Math.min(width - 1, Math.round(physRight) + 1) : width - 3;

  // skip top/bottom 20% of bar height to avoid border/shadow rows
  const yStart = Math.max(1,          Math.floor(height * 0.2));
  const yEnd   = Math.min(height - 1, Math.ceil(height  * 0.8));

  const hits = [];
  for (let y = yStart; y < yEnd; y++) {
    for (let x = scanR; x >= scanL; x--) {
      const i = (y * width + x) * 4;
      const b = bitmap[i], g = bitmap[i + 1], r = bitmap[i + 2];
      let isHit = false;
      if (barType === 'hp') isHit = r > 70 && r > g + 40 && r > b + 40;
      else if (barType === 'mp') isHit = b > 70 && b > r + 20 && b > g + 20;
      else if (barType === 'fp') isHit = g > 70 && g > r + 25 && g > b + 15;
      else { const mx = Math.max(r, g, b); isHit = mx > 50 && (mx - Math.min(r, g, b)) > 30; }
      if (isHit) { hits.push(x); break; }
    }
  }

  if (hits.length === 0) return 0;
  hits.sort((a, b) => a - b);
  const median = hits[Math.floor(hits.length / 2)];

  const L = physLeft  != null ? physLeft  : scanL;
  const R = physRight != null ? physRight : scanR;
  const span = R - L;
  if (span <= 0) return 0;
  return Math.round(Math.max(0, Math.min(100, ((median - L) / span) * 100)));
}

// Scans each row for dominant color channel; groups consecutive same-color rows
// into bands. Returns { hp, mp, fp } as absolute screen coordinate rects.
function detectAllBars(bitmap, imgWidth, imgHeight, statusRect) {
  const rowTypes = [];
  for (let y = 0; y < imgHeight; y++) {
    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    let minX = imgWidth, maxX = 0;

    for (let x = 0; x < imgWidth; x++) {
      const i = (y * imgWidth + x) * 4;
      const B = bitmap[i], G = bitmap[i + 1], R = bitmap[i + 2]; // BGRA
      
      let match = false;
      // Stricter HP check (Dominance > 40) to ignore brown UI elements
      if      (R > 80 && R > G + 40 && R > B + 40) match = 'hp';
      else if (B > 80 && B > R + 25 && B > G + 25) match = 'mp';
      else if (G > 80 && G > R + 25 && G > B + 15) match = 'fp';

      if (match) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (match === 'hp') rSum++;
        else if (match === 'mp') bSum++;
        else gSum++;
        count++;
      }
    }

    if (count >= 10) {
      let type;
      if (rSum >= bSum && rSum >= gSum) type = 'hp';
      else if (gSum >= rSum && gSum >= bSum) type = 'fp';
      else type = 'mp';
      rowTypes.push({ y, type, minX, maxX });
    }
  }

  const result = {};
  for (const type of ['hp', 'mp', 'fp']) {
    const rows = rowTypes.filter(r => r.type === type);
    if (rows.length > 5) {
      const startY = Math.min(...rows.map(r => r.y));
      const endY   = Math.max(...rows.map(r => r.y));
      const minX   = Math.min(...rows.map(r => r.minX));
      const maxX   = Math.max(...rows.map(r => r.maxX));
      
      const h = endY - startY + 1;
      const w = maxX - minX + 1;
      const padding = 2; // Vertical padding for safer OCR/Color scan

      result[type] = {
        x: statusRect.x + minX,
        y: statusRect.y + startY - padding,
        width: w,
        height: h + (padding * 2),
        barLeft: 0,   // Relative to this rect's x
        barRight: w   // Relative to this rect's x
      };
    }
  }
  console.log(`[AutoHeal] Detected bars:`, JSON.stringify(result));
  return result;
}

async function initOcr() {
  // OCR disabled – tesseract blocks the main thread and produces no useful output
  // on 17px-tall bar images. Color bar-fill scan is used exclusively.
}

async function ocrPercent(img) {
  if (!ocrWorker) return null;
  try {
    const { width, height } = img.getSize();
    if (width < 15 || height < 8) return null;

    const src = img.toBitmap();
    // Use multi-thresholding with 3x scaling for high precision
    const thresholds = [150, 190, 225];
    let bestResult = null;

    for (const thresh of thresholds) {
      const dst = Buffer.alloc(src.length, 255);
      for (let i = 0; i < width * height; i++) {
        const bright = (src[i*4] + src[i*4+1] + src[i*4+2]) / 3;
        dst[i*4] = dst[i*4+1] = dst[i*4+2] = (bright > thresh) ? 0 : 255;
        dst[i*4+3] = 255;
      }
      const processed = nativeImage.createFromBitmap(dst, { width, height });
      const scaled = processed.resize({ width: width * 3, height: height * 3 });
      
      const { data: { text } } = await ocrWorker.recognize(scaled.toPNG());
      const clean = text.trim().replace(/\n/g, ' ');
      if (!clean) continue;

      // Pattern: digits - separator - digits (e.g. "386 / 386")
      // Handles misread slashes like 7, |, I, l
      let m = clean.match(/(\d+)\s*[^\d ]+\s*(\d+)/);
      if (!m) m = clean.match(/(\d+)\s+(\d+)/); // Just two numbers with space
      
      if (m) {
        const cur = parseInt(m[1]), max = parseInt(m[2]);
        if (max > 0 && cur <= max * 1.1) {
          const candidate = Math.round((cur / max) * 100);
          if (candidate > 100) continue;
          bestResult = candidate;
          console.log(`[OCR Raw] "${clean}" -> ${bestResult}% (thresh ${thresh})`);
          break;
        }
      }

      // Percent fallback
      m = clean.match(/(\d+(?:\.\d+)?)\s*%/);
      if (m) {
        const candidate = parseFloat(m[1]);
        if (candidate > 100) continue;
        bestResult = candidate;
        console.log(`[OCR Raw] "${clean}" -> ${bestResult}% (thresh ${thresh})`);
        break;
      }
    }
    return bestResult;
  } catch (e) { return null; }
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

// ±10% Variation für Anti-Detection
function randomizeInterval(baseMs) {
  const variation = baseMs * 0.1;
  return baseMs + (Math.random() * 2 - 1) * variation;
}

async function runBarLoop(account, barType, barCfg, barEntry, view) {
  const baseDelay = Math.max(barCfg.intervalMs || 500, 200);
  const cooldown  = 1500;
  const actions  = barCfg.actions?.length
    ? barCfg.actions
    : [{ key: barCfg.key, threshold: barCfg.threshold }];
  const lastPressed = actions.map(() => 0);

  const barRect  = barEntry
    ? { x: barEntry.x, y: barEntry.y, width: barEntry.width, height: barEntry.height }
    : null;

  // normalize pixel entries: old format { mode:'pixel', x, y } → { mode:'pixel', pixels:[{x,y}] }
  const pixelList = barEntry?.mode === 'pixel'
    ? (Array.isArray(barEntry.pixels) ? barEntry.pixels : (barEntry.x != null ? [{ x: barEntry.x, y: barEntry.y }] : []))
    : null;
  // ensure lastPressed covers all pixel slots too
  while (pixelList && lastPressed.length < pixelList.length) lastPressed.push(0);

  while (hpHealActive[account]) {
    const t0 = Date.now();
    try {
      if (view && mainWindow) {
        if (pixelList) {
          // Per-pixel scan: each pixel corresponds to actions[i].key
          const now = Date.now();
          for (let i = 0; i < pixelList.length && i < actions.length; i++) {
            const px = pixelList[i];
            if (!px) continue;
            const cr = { x: Math.max(0, px.x - 1), y: Math.max(0, px.y - 3), width: 3, height: 7 };
            try {
              const img = await view.webContents.capturePage(cr);
              const bmp = img.toBitmap();
              const { width: pw, height: ph } = img.getSize();
              let found = false;
              for (let row = 0; row < ph && !found; row++) {
                for (let col = 0; col < pw && !found; col++) {
                  const bi = (row * pw + col) * 4;
                  const b2 = bmp[bi], g2 = bmp[bi + 1], r2 = bmp[bi + 2];
                  if (barType === 'hp')      found = r2 > 70 && r2 > g2 + 40 && r2 > b2 + 40;
                  else if (barType === 'mp') found = b2 > 70 && b2 > r2 + 20 && b2 > g2 + 20;
                  else                       found = g2 > 70 && g2 > r2 + 25 && g2 > b2 + 15;
                }
              }
              if (!found && now - lastPressed[i] > cooldown) {
                console.log(`[AutoHeal] ${account} ${barType} pixel[${i}] empty → pressing ${actions[i].key}`);
                sendHealKey(view, actions[i].key);
                lastPressed[i] = now;
              }
            } catch (e2) { console.error(`[AutoHeal] pixel[${i}] error:`, e2.message); }
          }
        } else {
          let pct = null;
          if (barRect) {
            const img = await view.webContents.capturePage(barRect);
            const { width, height } = img.getSize();
            if (width && height) {
              const dpr       = width / barRect.width;
              const physLeft  = barEntry.barLeft  != null ? barEntry.barLeft  * dpr : null;
              const physRight = barEntry.barRight != null ? barEntry.barRight * dpr : null;
              pct = estimateHpFromBarFill(img.toBitmap(), width, height, barType, physLeft, physRight);
            }
          }
          if (pct !== null) {
            console.log(`[AutoHeal] ${account} ${barType.toUpperCase()}=${pct}%`);
            const now = Date.now();
            for (let i = 0; i < actions.length; i++) {
              const { key, threshold } = actions[i];
              if (pct < threshold && now - lastPressed[i] > cooldown) {
                console.log(`[AutoHeal] ${account} ${barType}: pressing ${key} (<${threshold}%)`);
                sendHealKey(view, key);
                lastPressed[i] = now;
              }
            }
          }
        }
      }
    } catch (e) { console.error(`[AutoHeal] ${account} ${barType} error:`, e.message); }
    const elapsed = Date.now() - t0;
    const delay = randomizeInterval(baseDelay);
    const wait = Math.max(0, delay - elapsed);
    await new Promise(r => setTimeout(r, wait));
  }
}

function startAutoHeal(account) {
  stopAutoHeal(account);
  const cfg  = loadConfig('autoheal.json');
  const acfg = cfg?.[account];

  const bars = ['hp', 'mp', 'fp'];

  // Check if any bar is actually enabled AND has a valid source configured
  const hasEnabledBar = bars.some(b => {
    if (!acfg?.[b]?.enabled) return false;
    return !!acfg?.barBounds?.[b];
  });

  if (!hasEnabledBar) {
    console.log(`[AutoHeal] ${account} – no enabled bars with valid bounds, not starting`);
    return;
  }

  const view = gameViews[account];
  hpHealActive[account] = true;

  for (const barType of bars) {
    const barCfg  = acfg[barType];
    const barEntry = acfg?.barBounds?.[barType] || null;
    if (!barCfg?.enabled) continue;
    if (!barEntry) continue;
    console.log(`[AutoHeal] ${account} ${barType} started – interval=${barCfg.intervalMs}ms`);
    runBarLoop(account, barType, barCfg, barEntry, view);
  }
}

async function openHpPicker(account, barType, mode = 'bar', pixelIndex = 0) {
  if (pickerWindow) pickerWindow.close();
  if (!mainWindow) return;
  currentPickerTarget = { account, barType, mode, pixelIndex };
  const bounds = mainWindow.getBounds();

  // Game-View-Screenshot als Hintergrund – funktioniert auch in Gamescope (kein Compositor nötig)
  let bgDataUrl = null;
  try {
    const activeView = gameViews[activeAccount];
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
    if (bgDataUrl) pickerWindow?.webContents.send('hp-picker-bg', { bg: bgDataUrl, barType: currentPickerTarget?.barType, mode: currentPickerTarget?.mode });
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
  ipcMain.on('open-account',        (_, acc)  => openAccount(acc));
  ipcMain.on('close-account',       (_, acc)  => closeAccount(acc));
  ipcMain.on('start-automation',    (_, acc)  => startAutomation(acc));
  ipcMain.on('stop-automation',     (_, acc)  => stopAutomation(acc));
  ipcMain.on('follow-board',        (_, acc)  => sendFollowBoard(acc));
  ipcMain.on('open-settings',       ()        => openSettings());
  ipcMain.on('close-settings',      ()        => settingsWindow?.close());
  ipcMain.on('open-quest-url',      (_, url)  => openQuestUrl(url));
  ipcMain.on('close-quest-window',  ()        => questWindow?.close());


  ipcMain.on('set-game-view-visibility', (_, visible) => {
    overlayOpen = !visible;
    updateViewBounds();
  });

  // Zustand für Toolbar-Initialisierung liefern
  ipcMain.handle('get-view-size', () => {
    const [w, h] = mainWindow.getContentSize();
    return { w, h: h - TOOLBAR_H };
  });

  ipcMain.handle('get-state', () => ({
    activeAccount,
    account1Running: automation.isRunning('account1'),
    account2Running: automation.isRunning('account2'),
    account3Open: !!gameViews.account3,
    account4Open: !!gameViews.account4,
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
    const partition = `persist:${account}`;
    await session.fromPartition(partition).clearStorageData();
    const view = gameViews[account];
    view?.webContents.loadURL(FLYFF_URL);
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
    const raw = store.get('questProgress', {});
    // Migration: convert old boolean format to { done, skipped }
    const migrated = {};
    for (const [key, val] of Object.entries(raw)) {
      if (typeof val === 'boolean') {
        migrated[key] = { done: val, skipped: false };
      } else if (typeof val === 'object' && val !== null) {
        migrated[key] = { done: !!val.done, skipped: !!val.skipped };
      } else {
        migrated[key] = { done: false, skipped: false };
      }
    }
    return migrated;
  });

  ipcMain.on('save-quest-progress', (_, progress) => {
    store.set('questProgress', progress);
  });

  // Export quest progress as JSON file
  ipcMain.handle('export-quest-progress', async () => {
    const { dialog } = require('electron');
    const progress = store.get('questProgress', {});
    const result = await dialog.showSaveDialog({
      title: 'Export Quest Progress',
      defaultPath: `flyff-quest-progress-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }],
      modal: true,
      properties: []
    });
    if (result.canceled || !result.filePath) return { success: false, canceled: true };
    try {
      fs.writeFileSync(result.filePath, JSON.stringify(progress, null, 2), 'utf8');
      return { success: true, path: result.filePath };
    } catch (e) {
      return { success: false, error: e.message };
    }
  });

  // Import quest progress from JSON file
  ipcMain.handle('import-quest-progress', async () => {
    const { dialog } = require('electron');
    const result = await dialog.showOpenDialog({
      title: 'Import Quest Progress',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile'],
      modal: true
    });
    if (result.canceled || !result.filePaths.length) return { success: false, canceled: true };
    try {
      const data = JSON.parse(fs.readFileSync(result.filePaths[0], 'utf8'));
      store.set('questProgress', data);
      return { success: true, count: Object.keys(data).length };
    } catch (e) {
      return { success: false, error: e.message };
    }
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
    const view = gameViews[activeAccount];
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
    const view = gameViews[activeAccount];
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
    const view = gameViews[activeAccount];
    if (!view) return;
    try { view.webContents.sendInputEvent({ type: 'keyDown', keyCode: normalizeKey(keyCode) }); } catch {}
  });

  ipcMain.on('gamepad-keyup', (_, { keyCode }) => {
    const view = gameViews[activeAccount];
    if (!view) return;
    try { view.webContents.sendInputEvent({ type: 'keyUp', keyCode: normalizeKey(keyCode) }); } catch {}
  });

  // Mausklicks für Controller-Buttons (__LCLICK / __RHOLD)
  ipcMain.on('gamepad-mousedown', (_, { button }) => {
    const view = gameViews[activeAccount];
    if (!view) return;
    try {
      view.webContents.sendInputEvent({
        type: 'mouseDown', button,
        x: Math.round(cursor.x), y: Math.round(cursor.y), clickCount: 1
      });
    } catch {}
  });

  ipcMain.on('gamepad-mouseup', (_, { button }) => {
    const view = gameViews[activeAccount];
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
    const view = gameViews[activeAccount];
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
    const view = gameViews[activeAccount];
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
  ipcMain.on('open-hp-picker', (_, { account, barType, mode, pixelIndex }) => openHpPicker(account, barType, mode, pixelIndex ?? 0).catch(e => console.error('HP picker:', e)));

  // Picker: Rechteck wurde ausgewählt → direkt als barBounds[barType] speichern
  ipcMain.on('hp-picker-done', (_, rect) => {
    const target = currentPickerTarget;
    if (!target) { pickerWindow?.close(); return; }
    const { account, barType } = target;

    // ── Pixel mode: single-click pick, save x/y into pixels[pixelIndex] ──
    if (rect.mode === 'pixel') {
      pickerWindow?.close();
      const { pixelIndex = 0 } = target;
      const cfg = loadConfig('autoheal.json') || {};
      if (!cfg[account]) cfg[account] = {};
      if (!cfg[account].barBounds) cfg[account].barBounds = {};
      const existing = cfg[account].barBounds[barType];
      const pixels = (existing?.mode === 'pixel' && Array.isArray(existing.pixels))
        ? [...existing.pixels]
        : [];
      while (pixels.length <= pixelIndex) pixels.push(null);
      pixels[pixelIndex] = { x: rect.x, y: rect.y };
      cfg[account].barBounds[barType] = { mode: 'pixel', pixels };
      try { saveConfig('autoheal.json', cfg); } catch {}
      console.log(`[AutoHeal] ${account} ${barType} pixel[${pixelIndex}] saved: x=${rect.x} y=${rect.y}`);
      settingsWindow?.webContents.send('autoheal-rect-picked', { account, barType, pixelIndex, rect: { x: rect.x, y: rect.y } });
      return;
    }

    // ── Bar mode: drag-select rect, calibrate barLeft/barRight ──
    let barLeft = null, barRight = null;
    if (lastPickerScreenshot) {
      try {
        const cropped = lastPickerScreenshot.crop({ x: rect.x, y: rect.y, width: rect.width, height: rect.height });
        const bmp = cropped.toBitmap();
        const { width: pw, height: ph } = cropped.getSize();
        const dpr = pw / rect.width;
        let left = pw, right = -1;
        for (let y = 1; y < ph - 1; y++) {
          for (let x = 0; x < pw; x++) {
            const i = (y * pw + x) * 4;
            const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2];
            let isHit = false;
            if (barType === 'hp') isHit = r > 70 && r > g + 40 && r > b + 40;
            else if (barType === 'mp') isHit = b > 70 && b > r + 20 && b > g + 20;
            else if (barType === 'fp') isHit = g > 70 && g > r + 25 && g > b + 15;
            if (isHit) { if (x < left) left = x; if (x > right) right = x; }
          }
        }
        if (right > 0 && right > left) {
          barLeft  = left  / dpr;
          barRight = right / dpr;
          console.log(`[AutoHeal] ${barType} calibrated: barLeft=${barLeft.toFixed(1)} barRight=${barRight.toFixed(1)} (CSS px, dpr=${dpr})`);
        } else {
          console.warn(`[AutoHeal] ${barType} calibration: no colored pixels found – re-pick with bars full for best accuracy`);
        }
      } catch (e) { console.error('[AutoHeal] calibration error:', e.message); }
    }

    const cfg = loadConfig('autoheal.json') || {};
    if (!cfg[account]) cfg[account] = { barBounds: {}, hp: {}, mp: {}, fp: {} };
    if (!cfg[account].barBounds) cfg[account].barBounds = {};
    const barEntry = { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    if (barLeft !== null) { barEntry.barLeft = barLeft; barEntry.barRight = barRight; }
    cfg[account].barBounds[barType] = barEntry;
    console.log(`[AutoHeal] ${account} ${barType} rect saved:`, JSON.stringify(barEntry));
    try { saveConfig('autoheal.json', cfg); } catch {}
    pickerWindow?.close();
    settingsWindow?.webContents.send('autoheal-rect-picked', { account, barType, rect: barEntry });
  });

  // Picker: abgebrochen
  ipcMain.on('hp-picker-cancel', () => { pickerWindow?.close(); });

  // Alle Bars einmalig messen (Test-Button) – speichert Debug-PNGs in userData
  ipcMain.handle('test-hp-capture', async (_, account) => {
    const cfg  = loadConfig('autoheal.json');
    const acfg = cfg?.[account];
    const view = gameViews[account];
    if (!view) return { error: 'no-view' };
    const result = {};
    for (const barType of ['hp', 'mp', 'fp']) {
      const barEntry = acfg?.barBounds?.[barType];
      if (!barEntry) { result[barType] = null; continue; }
      if (barEntry.mode === 'pixel') {
        try {
          const pxList = Array.isArray(barEntry.pixels)
            ? barEntry.pixels
            : (barEntry.x != null ? [{ x: barEntry.x, y: barEntry.y }] : []);
          const statuses = [];
          for (const px of pxList) {
            if (!px) { statuses.push('?'); continue; }
            const cr = { x: Math.max(0, px.x - 1), y: Math.max(0, px.y - 3), width: 3, height: 7 };
            const img = await view.webContents.capturePage(cr);
            const bmp = img.toBitmap();
            const { width: pw, height: ph } = img.getSize();
            let found = false;
            for (let y = 0; y < ph && !found; y++) {
              for (let x = 0; x < pw && !found; x++) {
                const i = (y * pw + x) * 4;
                const b = bmp[i], g = bmp[i + 1], r = bmp[i + 2];
                if (barType === 'hp')      found = r > 70 && r > g + 40 && r > b + 40;
                else if (barType === 'mp') found = b > 70 && b > r + 20 && b > g + 20;
                else                       found = g > 70 && g > r + 25 && g > b + 15;
              }
            }
            statuses.push(found ? '✓' : '✗');
          }
          result[barType] = statuses.length ? `px: ${statuses.join(' ')}` : 'no pixels set';
        } catch { result[barType] = null; }
        continue;
      }
      const barRect = { x: barEntry.x, y: barEntry.y, width: barEntry.width, height: barEntry.height };
      try {
        const img = await view.webContents.capturePage(barRect);
        const { width, height } = img.getSize();
        if (!width || !height) { result[barType] = null; continue; }
        fs.writeFileSync(path.join(app.getPath('userData'), `debug-${barType}.png`), img.toPNG());
        const calStr = barEntry.barLeft != null ? ` cal=[${barEntry.barLeft.toFixed(0)},${barEntry.barRight.toFixed(0)}]` : ' (no cal)';
        console.log(`[AutoHeal] debug-${barType}.png saved (${width}×${height}px)${calStr}`);
        const dpr = width / barRect.width;
        const physLeft  = barEntry.barLeft  != null ? barEntry.barLeft  * dpr : null;
        const physRight = barEntry.barRight != null ? barEntry.barRight * dpr : null;
        result[barType] = estimateHpFromBarFill(img.toBitmap(), width, height, barType, physLeft, physRight);
      } catch (e) { result[barType] = null; console.error(`[AutoHeal] test ${barType}:`, e.message); }
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
    const view    = gameViews[account];
    if (!view) return;

    const wasRunning = automation.isRunning(account);
    if (wasRunning) stopAutomation(account);

    const baseDelay  = macro.delay || 200;
    const keys       = macro.keys  || [];
    const startDelay = wasRunning ? 100 : 0;

    let accumulatedDelay = startDelay;
    keys.forEach((keyCode, i) => {
      const thisDelay = i === 0 ? 0 : randomizeInterval(baseDelay);
      accumulatedDelay += thisDelay;

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
      }, accumulatedDelay);
    });

    if (wasRunning) {
      setTimeout(() => startAutomation(account), accumulatedDelay + 200);
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
  ['account1', 'account2'].forEach(acc => startAutoHeal(acc));
  // OCR init is fire-and-forget – a hanging tesseract download must not block startup
  initOcr().catch(e => console.error('[OCR] init error:', e.message));

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
