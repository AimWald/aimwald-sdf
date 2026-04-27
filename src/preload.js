'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('flyff', {

  // --- Account-Verwaltung ---
  switchAccount: (account) => ipcRenderer.send('switch-account', account),

  // --- Automation ---
  startAutomation: (account) => ipcRenderer.send('start-automation', account),
  stopAutomation:  (account) => ipcRenderer.send('stop-automation', account),

  // --- UI-Fenster ---
  openSettings: () => ipcRenderer.send('open-settings'),
  quitApp:      () => ipcRenderer.send('quit-app'),

  // --- Daten abfragen (Promise) ---
  getState:            () => ipcRenderer.invoke('get-state'),
  getAutomationConfig: () => ipcRenderer.invoke('get-automation-config'),
  getGamepadConfig:    () => ipcRenderer.invoke('get-gamepad-config'),
  getCredentials:      (account) => ipcRenderer.invoke('get-credentials', account),

  // --- Konfiguration speichern ---
  saveAutomationConfig: (cfg)           => ipcRenderer.send('save-automation-config', cfg),
  saveGamepadConfig:    (cfg)           => ipcRenderer.send('save-gamepad-config', cfg),
  saveHotkeys:          (keys)          => ipcRenderer.send('save-hotkeys', keys),
  saveCredentials:      (account, creds) => ipcRenderer.send('save-credentials', account, creds),

  // --- Events empfangen ---
  on: (channel, cb) => {
    const allowed = ['account-switched', 'automation-state-changed'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_event, ...args) => cb(...args));
  },

  // --- Gamepad-Input ---
  sendGamepadMove:    (dx, dy)  => ipcRenderer.send('gamepad-mouse-move',  { dx, dy }),
  sendGamepadButton:  (keyCode) => ipcRenderer.send('gamepad-button',      { keyCode }),
  sendGamepadKeyDown: (keyCode) => ipcRenderer.send('gamepad-keydown',     { keyCode }),
  sendGamepadKeyUp:   (keyCode) => ipcRenderer.send('gamepad-keyup',       { keyCode }),
  sendMouseDown:      (button)  => ipcRenderer.send('gamepad-mousedown',   { button }),
  sendMouseUp:        (button)  => ipcRenderer.send('gamepad-mouseup',     { button }),
});
