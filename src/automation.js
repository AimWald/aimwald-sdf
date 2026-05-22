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

// ±10% Variation für Anti-Detection
function randomizeInterval(baseMs) {
  const variation = baseMs * 0.1;
  return baseMs + (Math.random() * 2 - 1) * variation;
}

// Startet die Automation für einen Account
function start(account, webContents, onStateChange) {
  const s = state[account];
  if (s.running) return;
  s.running = true;

  const actions = (config[account] && config[account].actions) || [];
  actions.forEach(action => {
    if (!action.enabled) return;

    // Rekursive Funktion mit randomisiertem Intervall
    function scheduleNext() {
      if (!s.running) return;
      const nextDelay = randomizeInterval(action.intervalMs);
      const timer = setTimeout(() => {
        if (!s.running) return;
        sendKey(webContents, action.key);
        scheduleNext(); // nächste Ausführung planen
      }, nextDelay);
      s.timers.push(timer);
    }

    scheduleNext();
  });

  if (onStateChange) onStateChange(account, true);
}

// Stoppt alle Timer eines Accounts
function stop(account, onStateChange) {
  const s = state[account];
  s.running = false;
  s.timers.forEach(t => clearTimeout(t)); // clearTimeout statt clearInterval
  s.timers = [];
  if (onStateChange) onStateChange(account, false);
}

function isRunning(account) {
  return state[account].running;
}

module.exports = { setConfig, start, stop, isRunning };
