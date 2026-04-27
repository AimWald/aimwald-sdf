'use strict';

// Laufzeit-Zustand pro Account: ob aktiv und aktive Timer-IDs
const state = {
  account1: { running: false, timers: [] },
  account2: { running: false, timers: [] }
};

// Aktuelle Automation-Config (wird von main.js gesetzt)
let config = { account1: { actions: [] }, account2: { actions: [] } };

function setConfig(automationConfig) {
  if (automationConfig) config = automationConfig;
}

// Sendet einen einzelnen Tastendruck an die WebContents eines Game-Views
function sendKey(webContents, keyCode) {
  try {
    webContents.sendInputEvent({ type: 'keyDown', keyCode });
    webContents.sendInputEvent({ type: 'keyUp', keyCode });
  } catch {
    // WebContentsView noch nicht bereit oder gerade navigiert – nächstes Intervall versucht es erneut
  }
}

// Startet die Automation für einen Account
function start(account, webContents, onStateChange) {
  const s = state[account];
  if (s.running) return;
  s.running = true;

  const actions = (config[account] && config[account].actions) || [];
  actions.forEach(action => {
    if (!action.enabled) return;
    const timer = setInterval(() => {
      if (!s.running) return;
      sendKey(webContents, action.key);
    }, action.intervalMs);
    s.timers.push(timer);
  });

  if (onStateChange) onStateChange(account, true);
}

// Stoppt alle Timer eines Accounts
function stop(account, onStateChange) {
  const s = state[account];
  s.running = false;
  s.timers.forEach(t => clearInterval(t));
  s.timers = [];
  if (onStateChange) onStateChange(account, false);
}

function isRunning(account) {
  return state[account].running;
}

module.exports = { setConfig, start, stop, isRunning };
