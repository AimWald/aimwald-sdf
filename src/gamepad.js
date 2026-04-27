'use strict';

// Wird im Preload-Context ausgeführt – hat Zugriff auf browser-seitige Gamepad-API
// und auf Node.js-seitiges ipcRenderer (da preload sandbox: false)

const POLL_INTERVAL_MS = 16;   // ~60 fps
const DEADZONE = 0.15;
const SPEED_LEFT  = 8;          // Linker Stick: Haupt-Mausbewegung
const SPEED_RIGHT = 4;          // Rechter Stick: Kamera (langsamer)

// Merkt sich welche Buttons beim letzten Poll gedrückt waren (Edge-Detection)
const prevButtonState = {};

function applyDeadzone(value) {
  return Math.abs(value) < DEADZONE ? 0 : value;
}

// Startet das Polling. ipcRenderer wird aus dem Preload übergeben.
function start(ipcRenderer, buttonMap) {
  const mapping = buttonMap || {};

  setInterval(() => {
    const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];

    for (const gp of gamepads) {
      if (!gp) continue;

      // Linker Stick (axes 0 + 1) → schnelle Mausbewegung
      const lx = applyDeadzone(gp.axes[0] || 0);
      const ly = applyDeadzone(gp.axes[1] || 0);
      // Rechter Stick (axes 2 + 3) → Kamerabewegung, gedämpft
      const rx = applyDeadzone(gp.axes[2] || 0);
      const ry = applyDeadzone(gp.axes[3] || 0);

      const dx = lx * SPEED_LEFT + rx * SPEED_RIGHT;
      const dy = ly * SPEED_LEFT + ry * SPEED_RIGHT;

      if (dx !== 0 || dy !== 0) {
        ipcRenderer.send('gamepad-mouse-move', { dx, dy });
      }

      // Buttons: nur beim erstmaligen Drücken auslösen (kein Auto-Repeat)
      gp.buttons.forEach((btn, idx) => {
        const stateKey = `${gp.index}_${idx}`;
        const isPressed = btn.pressed;
        if (isPressed && !prevButtonState[stateKey]) {
          const keyCode = mapping[String(idx)];
          if (keyCode) {
            ipcRenderer.send('gamepad-button', { keyCode });
          }
        }
        prevButtonState[stateKey] = isPressed;
      });
    }
  }, POLL_INTERVAL_MS);
}

module.exports = { start };
