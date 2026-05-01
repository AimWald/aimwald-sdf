# Flyff Universe Electron Wrapper - Guidelines

## Project Overview
This is an Electron-based wrapper for [Flyff Universe](https://universe.flyff.com), specifically optimized for the Valve Steam Deck (1280x800 resolution, SteamOS). It supports multiboxing with two isolated accounts, an automation engine for heals/buffs, gamepad support, and macro sequences.

## Architecture & Tech Stack
- **Electron**: Main framework.
- **Multiboxing**: Uses `WebContentsView` (preferred over deprecated `BrowserView`).
- **Isolation**: Strictly separated sessions via `persist:account1` and `persist:account2` partitions.
- **Automation**: `src/automation.js` manages key injection intervals via `sendInputEvent`.
- **Gamepad**: Polling via `requestAnimationFrame` in the toolbar renderer (`src/ui/index.html`).
- **Macros**: Configurable key sequences in `config/macros.json`.
- **Persistence**: `electron-store` (ESM) for app settings; `automation.json`, `gamepad.json`, `macros.json` in `userData` directory.

## Development & Build
- `npm start`: Runs the app with `--disable-gpu-sandbox`.
- `npm run build`: Packages the app as a Linux AppImage using `electron-builder`.
- **Deployment**: Copy the AppImage to `/home/deck/FlyffWrapper.AppImage` on the Steam Deck. Use `launch-flyff.sh` for optimal Wayland/SteamOS settings.

## Engineering Standards & Conventions
- **Versioning**: Always increment the version in `package.json` and update `CHANGELOG.md` with every change.
- **Context Isolation**: `contextIsolation: true` and `nodeIntegration: false` are mandatory.
- **Input Injection**:
    - Standard keys: Use `webContents.sendInputEvent({ type: 'keyDown', ... })`, `char`, then `keyUp`.
    - Special keys (Space, J): Use CDP `Input.dispatchKeyEvent` with an 80ms hold between `rawKeyDown` and `keyUp` to ensure the game's polling (rAF) registers the press.
- **Gamepad**: Accumulate deltas for mouse movement and throttle IPC to 30fps to avoid flooding the main process.
- **Settings**: The Settings window should be independent (`sandbox: true`, no `parent`) to avoid double-input issues under Wayland.

## Key Files
- `src/main.js`: Main process, window management, IPC, shortcuts.
- `src/automation.js`: Logic for auto-heal/buff timers.
- `src/ui/index.html`: Toolbar UI and Gamepad polling logic.
- `src/ui/settings.html`: Multi-tab settings interface.
- `config/*.json`: Default configurations.
