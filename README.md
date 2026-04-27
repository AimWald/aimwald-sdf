# Flyff Universe Desktop Wrapper

A lightweight Electron wrapper for [Flyff Universe](https://universe.flyff.com) with Steam Deck support, multiboxing, controller input and a configurable automation engine for heals and buffs.

---

## Features

- **Multiboxing** – Two fully isolated browser sessions side by side. Each window has its own cookies, localStorage and login state. Switch between accounts with a single hotkey.
- **Steam Deck optimized** – Preconfigured to 1280×800, fullscreen toggle via F11, designed for handheld use.
- **Controller support** – Gamepad API integration. Left stick controls mouse movement, buttons map to configurable keyboard keys.
- **Automation engine** – Per-account heal and buff scheduler using F1–F12 keys. Each action has a configurable interval and can be toggled individually. Runs on background accounts too.
- **Persistent config** – All settings (hotkeys, automation profiles, window state) saved via electron-store and restored on next launch.

---

## Screenshots

> Coming soon.

---

## Requirements

- [Node.js](https://nodejs.org) v22+
- [Electron](https://www.electronjs.org) v28+

---

## Installation

```bash
git clone https://github.com/Evaldazz/flyff-wrapper
cd flyff-wrapper
npm install
npm start
```

---

## Steam Deck Setup

1. Switch to Desktop Mode
2. Open a terminal and enable SSH:
   ```bash
   passwd
   sudo systemctl enable --now sshd
   ```
3. On your development machine, sync the project:
   ```bash
   rsync -av --exclude node_modules . deck@192.168.178.30:/home/deck/flyff-wrapper/
   ```
4. On the Steam Deck:
   ```bash
   cd ~/flyff-wrapper
   npm install
   npm start
   ```
5. Add as a Non-Steam Game to use Steam Input for controller layout.

---

## Automation Config

Edit `config/automation.json` or use the in-app settings panel.

```json
{
  "account1": {
    "actions": [
      { "label": "Heal",   "key": "F1", "intervalMs": 3000,  "enabled": true },
      { "label": "Buff 1", "key": "F2", "intervalMs": 30000, "enabled": true },
      { "label": "Buff 2", "key": "F3", "intervalMs": 30000, "enabled": false }
    ]
  },
  "account2": {
    "actions": [
      { "label": "Heal",   "key": "F1", "intervalMs": 3000,  "enabled": true }
    ]
  }
}
```

Each action targets its account's browser window directly — even when running in the background.

---

## Default Hotkeys

| Action | Key |
|---|---|
| Switch account | F9 |
| Toggle automation | F10 |
| Toggle fullscreen | F11 |

All hotkeys are configurable in settings.

---

## Disclaimer

This project is not affiliated with Gala Lab or the Flyff Universe team. Use of automation features may violate the game's [Terms of Service](https://universe.flyff.com/terms). Use at your own risk.

---

## License

MIT
