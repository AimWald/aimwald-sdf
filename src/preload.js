'use strict';

// Preload läuft im Renderer-Context mit Node.js-Zugriff (sandbox: false).
// Exponiert ein sicheres API über contextBridge an den Renderer (index.html / settings.html).

const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs   = require('fs');
const gamepad = require('./gamepad.js');

contextBridge.exposeInMainWorld('flyff', {

  // --- Account-Verwaltung ---
  switchAccount: (account) => ipcRenderer.send('switch-account', account),

  // --- Automation ---
  startAutomation: (account) => ipcRenderer.send('start-automation', account),
  stopAutomation:  (account) => ipcRenderer.send('stop-automation', account),

  // --- UI-Fenster ---
  openSettings: () => ipcRenderer.send('open-settings'),

  // --- Daten abfragen (Promise) ---
  getState: ()               => ipcRenderer.invoke('get-state'),
  getAutomationConfig: ()    => ipcRenderer.invoke('get-automation-config'),

  // --- Konfiguration speichern ---
  saveAutomationConfig: (cfg)    => ipcRenderer.send('save-automation-config', cfg),
  saveHotkeys:          (keys)   => ipcRenderer.send('save-hotkeys', keys),

  // --- Events empfangen ---
  // Erlaubte Kanäle: account-switched, automation-state-changed
  on: (channel, cb) => {
    const allowed = ['account-switched', 'automation-state-changed'];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_event, ...args) => cb(...args));
  },

  // --- Gamepad-Polling starten ---
  // Wird explizit von index.html aufgerufen, damit Settings-Fenster kein Polling startet
  startGamepadPolling: () => {
    let buttonMap = { '0': 'Z', '1': 'X', '2': 'C', '3': 'V' };
    try {
      const cfgPath = path.join(__dirname, '..', 'config', 'gamepad.json');
      buttonMap = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    } catch {
      // Default-Mapping beibehalten
    }
    gamepad.start(ipcRenderer, buttonMap);
  }
});
