'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flyff', {

  // --- Account-Verwaltung ---
  switchAccount: (account) => ipcRenderer.send('switch-account', account),

  // --- Automation ---
  startAutomation: (account) => ipcRenderer.send('start-automation', account),
  stopAutomation:  (account) => ipcRenderer.send('stop-automation', account),

  // --- UI-Fenster ---
  openSettings:  () => ipcRenderer.send('open-settings'),
  closeSettings: () => ipcRenderer.send('close-settings'),
  openQuestUrl:  (url) => ipcRenderer.send('open-quest-url', url),
  quitApp:       () => ipcRenderer.send('quit-app'),
  setGameViewVisibility: (visible) => ipcRenderer.send('set-game-view-visibility', visible),

  // --- Daten abfragen (Promise) ---
  getState:            () => ipcRenderer.invoke('get-state'),
  getAutomationConfig: () => ipcRenderer.invoke('get-automation-config'),
  getGamepadConfig:    () => ipcRenderer.invoke('get-gamepad-config'),
  getMacros:           () => ipcRenderer.invoke('get-macros'),
  // --- Konfiguration speichern ---
  saveAutomationConfig: (cfg)           => ipcRenderer.send('save-automation-config', cfg),
  saveGamepadConfig:    (cfg)           => ipcRenderer.send('save-gamepad-config', cfg),
  saveHotkeys:          (keys)          => ipcRenderer.send('save-hotkeys', keys),
  saveMacros:           (macros)        => ipcRenderer.send('save-macros', macros),

  // --- Macros ausführen ---
  runMacro: (id) => ipcRenderer.send('run-macro', id),

  // --- Auto-Heal ---
  getAutoHealConfig:  ()        => ipcRenderer.invoke('get-autoheal-config'),
  saveAutoHealConfig: (cfg)     => ipcRenderer.send('save-autoheal-config', cfg),
  openHpPicker:       (account, barType) => ipcRenderer.send('open-hp-picker', { account, barType }),
  testHpCapture:      (account) => ipcRenderer.invoke('test-hp-capture', account),

  // --- WASM Memory Scanner ---
  wasmDiagnose:  (params)  => ipcRenderer.invoke('wasm-diagnose', params),
  wasmJsScan:    (params)  => ipcRenderer.invoke('wasm-js-scan', params),
  wasmScan:      (params)  => ipcRenderer.invoke('wasm-scan', params),
  wasmNeighbors: (params)  => ipcRenderer.invoke('wasm-neighbors', params),
  wasmSave:      (params)  => ipcRenderer.send('wasm-save', params),
  wasmClear:     (params)  => ipcRenderer.send('wasm-clear', params),

  // --- HP-Picker (wird im Picker-Fenster aufgerufen) ---
  hpPickerDone:   (rect) => ipcRenderer.send('hp-picker-done', rect),
  hpPickerCancel: ()     => ipcRenderer.send('hp-picker-cancel'),

  // --- Events empfangen ---
  on: (channel, cb) => {
    const allowed = ['account-switched', 'automation-state-changed', 'gamepad-config-updated', 'macros-updated', 'autoheal-rect-picked', 'hp-picker-bg'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_event, ...args) => cb(...args));
  },

  // --- Gamepad-Input ---
  sendGamepadMove:    (dx, dy)        => ipcRenderer.send('gamepad-mouse-move',  { dx, dy }),
  sendGamepadButton:  (keyCode)       => ipcRenderer.send('gamepad-button',      { keyCode }),
  sendGamepadKeyDown: (keyCode)       => ipcRenderer.send('gamepad-keydown',     { keyCode }),
  sendGamepadKeyUp:   (keyCode)       => ipcRenderer.send('gamepad-keyup',       { keyCode }),
  sendMouseDown:      (button)        => ipcRenderer.send('gamepad-mousedown',   { button }),
  sendMouseUp:        (button)        => ipcRenderer.send('gamepad-mouseup',     { button }),
  sendGamepadScroll:  (deltaX, deltaY) => ipcRenderer.send('gamepad-scroll',     { deltaX, deltaY }),
  resetCursor:        ()               => ipcRenderer.send('gamepad-reset-cursor'),
  searchTarget:       ()               => ipcRenderer.send('search-target'),
  getChangelog:       ()               => ipcRenderer.invoke('get-changelog'),
  getMonsters:        ()               => ipcRenderer.invoke('get-monsters'),
  getQuests:          ()               => ipcRenderer.invoke('get-quests'),
  getQuestlines:      ()               => ipcRenderer.invoke('get-questlines'),
  getDailies:         ()               => ipcRenderer.invoke('get-dailies'),
  getQuestProgress:    ()               => ipcRenderer.invoke('get-quest-progress'),
  saveQuestProgress:   (progress)       => ipcRenderer.send('save-quest-progress', progress),
  clearSession:       (account)        => ipcRenderer.invoke('clear-session', account),
});
