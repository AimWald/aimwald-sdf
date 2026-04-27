'use strict';

// Preload läuft im Renderer-Context mit Node.js-Zugriff (sandbox: false).
// Exponiert ein sicheres API über contextBridge an den Renderer (index.html / settings.html).

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs   = require('fs');

contextBridge.exposeInMainWorld('flyff', {

  // --- Account-Verwaltung ---
  switchAccount: (account) => ipcRenderer.send('switch-account', account),

  // --- Automation ---
  startAutomation: (account) => ipcRenderer.send('start-automation', account),
  stopAutomation:  (account) => ipcRenderer.send('stop-automation', account),

  // --- UI-Fenster ---
  openSettings: () => ipcRenderer.send('open-settings'),

  // --- Daten abfragen (Promise) ---
  getState: ()            => ipcRenderer.invoke('get-state'),
  getAutomationConfig: () => ipcRenderer.invoke('get-automation-config'),
  getGamepadConfig: ()    => ipcRenderer.invoke('get-gamepad-config'),

  // --- Konfiguration speichern ---
  saveAutomationConfig: (cfg)  => ipcRenderer.send('save-automation-config', cfg),
  saveHotkeys:          (keys) => ipcRenderer.send('save-hotkeys', keys),

  // --- Events empfangen ---
  // Erlaubte Kanäle: account-switched, automation-state-changed
  on: (channel, cb) => {
    const allowed = ['account-switched', 'automation-state-changed'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_event, ...args) => cb(...args));
  },

  // --- Gamepad-Input an Main-Prozess senden ---
  // Wird vom Renderer (index.html) aufgerufen – Gamepad API läuft im Haupt-Renderer-Kontext,
  // weil navigator.getGamepads() im isolierten Preload-Kontext nicht zuverlässig funktioniert.
  sendGamepadMove:    (dx, dy)  => ipcRenderer.send('gamepad-mouse-move', { dx, dy }),
  sendGamepadButton:  (keyCode) => ipcRenderer.send('gamepad-button', { keyCode }),
  sendGamepadKeyDown: (keyCode) => ipcRenderer.send('gamepad-keydown', { keyCode }),
  sendGamepadKeyUp:   (keyCode) => ipcRenderer.send('gamepad-keyup',   { keyCode })
});
