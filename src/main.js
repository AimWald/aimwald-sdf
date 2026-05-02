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
let currentPickerTarget = null; // { account, barType }
const hpHealActive  = {};  // account → boolean: steuert den async Heal-Loop
const wasmScanState = {};  // `${account}_${bar}` → candidates[] (stored between refine steps)
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
      sandbox: false,
      backgroundThrottling: true
    }
  });

  view2 = new WebContentsView({
    webPreferences: {
      partition: 'persist:account2',  // Isolierte Session für Account 2
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: true
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
  const hiddenBounds  = { x: -w - 100, y: TOOLBAR_H, width: w, height: h - TOOLBAR_H };

  if (activeAccount === 'account1') {
    view1.setBounds(activeBounds);
    view1.setVisible(!overlayOpen);
    if (!overlayOpen) view1.webContents.focus();
    view2.setBounds(hiddenBounds);
    view2.setVisible(true);
  } else {
    view2.setBounds(activeBounds);
    view2.setVisible(!overlayOpen);
    if (!overlayOpen) view2.webContents.focus();
    view1.setBounds(hiddenBounds);
    view1.setVisible(true);
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
  return Math.round(Math.min(100, ((median - L) / span) * 100));
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

async function runBarLoop(account, barType, barCfg, barEntry, view, wasmCfg = null) {
  const delay    = Math.max(barCfg.intervalMs || 500, 200);
  const cooldown = 1500;
  const actions  = barCfg.actions?.length
    ? barCfg.actions
    : [{ key: barCfg.key, threshold: barCfg.threshold }];
  const lastPressed = actions.map(() => 0);

  const barRect  = barEntry
    ? { x: barEntry.x, y: barEntry.y, width: barEntry.width, height: barEntry.height }
    : null;

  // Pre-build WASM read expression (avoids template work in hot loop)
  const wasmExpr = wasmCfg?.offset != null
    ? `(()=>{try{const h=${wasmCfg.heapExpr||'Module.HEAPF32'};if(!h)return null;` +
      `const c=h[${wasmCfg.offset}];` +
      `const m=${wasmCfg.maxOffset != null ? `h[${wasmCfg.maxOffset}]` : String(Number(wasmCfg.maxHp) || 0)};` +
      `return(m>0&&c>=0&&c<=m*1.1)?Math.round(c/m*100):null;}catch(e){return null;}})()`
    : null;

  while (hpHealActive[account]) {
    const t0 = Date.now();
    try {
      if (view && mainWindow) {
        let pct = null;

        if (wasmExpr) {
          pct = await view.webContents.executeJavaScript(wasmExpr);
        } else if (barRect) {
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
    } catch (e) { console.error(`[AutoHeal] ${account} ${barType} error:`, e.message); }
    const wait = Math.max(0, delay - (Date.now() - t0));
    await new Promise(r => setTimeout(r, wait));
  }
}

function startAutoHeal(account) {
  stopAutoHeal(account);
  const cfg  = loadConfig('autoheal.json');
  const acfg = cfg?.[account];

  const bars = ['hp', 'mp', 'fp'];
  const anyEnabled = bars.some(b => acfg?.[b]?.enabled);
  if (!anyEnabled) return;

  const wasm = acfg?.wasm || {};
  const hasAnySource = bars.some(b => {
    if (!acfg?.[b]?.enabled) return false;
    return acfg?.barBounds?.[b] || wasm[b]?.offset != null;
  });
  if (!hasAnySource) return;

  const view = account === 'account1' ? view1 : view2;
  hpHealActive[account] = true;

  for (const barType of bars) {
    const barCfg  = acfg[barType];
    const barEntry = acfg?.barBounds?.[barType] || null;
    const wasmCfg  = wasm[barType] || null;
    if (!barCfg?.enabled) continue;
    if (!barEntry && wasmCfg?.offset == null) continue;
    const src = wasmCfg?.offset != null ? `wasm:${wasmCfg.offset}` : `pixel:[${barEntry.x},${barEntry.y}]`;
    console.log(`[AutoHeal] ${account} ${barType} started – src=${src} interval=${barCfg.intervalMs}ms`);
    runBarLoop(account, barType, barCfg, barEntry, view, wasmCfg);
  }
}

async function openHpPicker(account, barType) {
  if (pickerWindow) pickerWindow.close();
  if (!mainWindow) return;
  currentPickerTarget = { account, barType };
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
    if (bgDataUrl) pickerWindow?.webContents.send('hp-picker-bg', { bg: bgDataUrl, barType: currentPickerTarget?.barType });
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

  // ── WASM Memory Scanner ───────────────────────────────────────────────────

  // Discover candidate typed array heap expressions in the page's global scope
  ipcMain.handle('wasm-diagnose', async (_, { account }) => {
    const view = account === 'account1' ? view1 : view2;
    if (!view) return { error: 'View not available' };
    const script = `(()=>{
      const found=[];
      const seen=new Set();
      function add(expr,len,type){
        if(seen.has(expr))return;seen.add(expr);
        found.push({expr,sizeMB:Math.round(len*4/1024/1024),type});
      }
      const TYPES=[
        ['HEAPF32',Float32Array,'f32'],['HEAP32',Int32Array,'i32'],['HEAPU32',Uint32Array,'u32'],
        ['HEAPF64',Float64Array,'f64'],['HEAP16',Int16Array,'i16'],['HEAPU8',Uint8Array,'u8'],
      ];
      for(const k of Object.keys(window)){
        try{
          const v=window[k];
          if(!v||typeof v!=='object')continue;
          for(const [prop,Ctor,type] of TYPES){
            if(v[prop] instanceof Ctor&&v[prop].length>500000)add(k+'.'+prop,v[prop].length,type);
          }
          if(v instanceof WebAssembly.Memory&&v.buffer.byteLength>2000000){
            add('new Int32Array('+k+'.buffer)',v.buffer.byteLength/4,'i32');
            add('new Float32Array('+k+'.buffer)',v.buffer.byteLength/4,'f32');
          }
        }catch{}
      }
      return found.length?found:{error:'No large typed array found in window scope'};
    })()`;
    try { return await view.webContents.executeJavaScript(script, true); }
    catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('wasm-scan', async (_, { account, bar, value, heapExpr, refine = false }) => {
    const view = account === 'account1' ? view1 : view2;
    if (!view) return { error: 'View not available' };
    const key = `${account}_${bar}`;
    const hExpr = heapExpr || 'Module.HEAPF32';
    // integers need exact match (±1 for rounding); floats need small tolerance
    const isInt = /HEAP32|HEAPU32|HEAP16|HEAPU8|Int32|Uint32/.test(hExpr);
    const tol = isInt ? 1 : 1;  // same value, but logic differs: ints match exact or ±1, floats match within ±1

    let script;
    if (refine && wasmScanState[key]?.length) {
      script = `(()=>{try{
        const h=${hExpr};if(!h)return{error:'heap not found'};
        const c=${JSON.stringify(wasmScanState[key])};
        const t=${Math.round(value)},tol=${tol};
        const r=c.filter(i=>{const v=h[i];return v>=t-tol&&v<=t+tol;});
        return{candidates:r};
      }catch(e){return{error:e.message};}})()`;
    } else {
      script = `(()=>{try{
        const h=${hExpr};
        if(!h)return{error:'${hExpr} not available – run Diagnose first'};
        const t=${Math.round(value)},tol=${tol},r=[];
        for(let i=0;i<h.length;i++){const v=h[i];if(v>=t-tol&&v<=t+tol){r.push(i);if(r.length>=5000)break;}}
        return{candidates:r};
      }catch(e){return{error:e.message};}})()`;
    }

    try {
      const res = await view.webContents.executeJavaScript(script, true);
      if (res?.candidates) {
        wasmScanState[key] = res.candidates;
        return { count: res.candidates.length, candidates: res.candidates.length <= 30 ? res.candidates : [] };
      }
      return res;
    } catch (e) { return { error: e.message }; }
  });

  ipcMain.handle('wasm-neighbors', async (_, { account, offset, heapExpr, range = 10 }) => {
    const view = account === 'account1' ? view1 : view2;
    if (!view) return null;
    const hExpr = heapExpr || 'Module.HEAPF32';
    try {
      return await view.webContents.executeJavaScript(
        `(()=>{try{const h=${hExpr};if(!h)return null;
          const r=[];for(let i=${offset}-${range};i<=${offset}+${range};i++){if(i>=0&&i<h.length)r.push({i,v:Math.round(h[i]*10)/10});}
          return r;}catch(e){return null;}})()`, true
      );
    } catch { return null; }
  });

  ipcMain.on('wasm-save', (_, { account, bar, offset, maxOffset, maxHp, heapExpr }) => {
    const cfg = loadConfig('autoheal.json') || {};
    if (!cfg[account]) cfg[account] = {};
    if (!cfg[account].wasm) cfg[account].wasm = {};
    const entry = { offset };
    if (heapExpr)          entry.heapExpr  = heapExpr;
    if (maxOffset != null) entry.maxOffset = maxOffset;
    else if (maxHp != null) entry.maxHp   = maxHp;
    cfg[account].wasm[bar] = entry;
    saveConfig('autoheal.json', cfg);
    startAutoHeal(account);
  });

  ipcMain.on('wasm-clear', (_, { account, bar }) => {
    const cfg = loadConfig('autoheal.json') || {};
    if (cfg[account]?.wasm?.[bar]) delete cfg[account].wasm[bar];
    saveConfig('autoheal.json', cfg);
  });

  // HP-Bar-Picker öffnen
  ipcMain.on('open-hp-picker', (_, { account, barType }) => openHpPicker(account, barType).catch(e => console.error('HP picker:', e)));

  // Picker: Rechteck wurde ausgewählt → direkt als barBounds[barType] speichern
  // Kalibriert barLeft/barRight aus dem Picker-Screenshot (funktioniert korrekt wenn Bars voll sind)
  ipcMain.on('hp-picker-done', (_, rect) => {
    const target = currentPickerTarget;
    if (!target) { pickerWindow?.close(); return; }
    const { account, barType } = target;

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
            if (barType === 'hp') isHit = r > 60 && r > g + 15 && r > b + 15;
            else if (barType === 'mp') isHit = b > 60 && b > r + 15 && b > g + 15;
            else if (barType === 'fp') isHit = g > 60 && g > r + 15 && g > b + 10;
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
    if (!acfg?.barBounds || Object.keys(acfg.barBounds).length === 0) return { error: 'no-rect' };
    const view = account === 'account1' ? view1 : view2;
    if (!view) return { error: 'no-view' };
    const result = {};
    for (const barType of ['hp', 'mp', 'fp']) {
      const barEntry = acfg.barBounds[barType];
      if (!barEntry) { result[barType] = null; continue; }
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
