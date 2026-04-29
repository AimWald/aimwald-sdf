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

  // --- Events empfangen ---
  on: (channel, cb) => {
    const allowed = ['account-switched', 'automation-state-changed', 'gamepad-config-updated', 'macros-updated'];
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
