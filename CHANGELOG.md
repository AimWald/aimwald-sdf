# Changelog

## [1.10.0] – 2025-04-28
### Fixed
- `automation.json` und `gamepad.json` werden jetzt in `app.getPath('userData')` (`~/.config/flyff-wrapper/`) gespeichert – AppImage-Updates überschreiben gespeicherte Einstellungen nicht mehr

## [1.9.0] – 2025-04-28
### Changed
- `gamepad.json`: L2 (Button 6) ist jetzt Kamera (Rechtsklick halten), X (Button 2) → Taste 3

## [1.8.0] – 2025-04-28
### Fixed
- Cursor-Reset zurück zur Bildschirmmitte nur noch beim Loslassen von `__RHOLD` (Kamera-Button), nicht beim Zurückführen des Sticks

## [1.7.0] – 2025-04-28
### Fixed
- Maus-IPC wird nicht mehr gesendet wenn der Cursor an der Kante klemmt und die Position unverändert bleibt (verhindert Queue-Flood)
- Cursor-Reset auf Bildschirmmitte nach Kameraschwenk (IPC `gamepad-reset-cursor`)
- Cursor-Clamp korrigiert: `w-1` / `h-TOOLBAR_H-1` statt `w` / `h-TOOLBAR_H`

## [1.6.0] – 2025-04-28
### Fixed
- Focus-Keeper im Main-Prozess: aktiver Game-View wird alle 200 ms neu fokussiert, damit Keyboard-Events via `sendInputEvent` nie dauerhaft blockieren

## [1.5.0] – 2025-04-28
### Fixed
- `webContents.focus()` wird bei `gamepad-keydown` und in `updateViewBounds()` aufgerufen – Game-View behält Input-Focus länger

## [1.4.0] – 2025-04-28
### Fixed
- Gamepad-Polling von `setInterval(16ms)` auf `requestAnimationFrame` umgestellt – kein Callback-Cascade wenn ein Frame zu lang dauert
- Maus-IPC auf max. 30 fps gedrosselt, Deltas zwischen Frames akkumuliert – verhindert IPC-Queue-Flooding

## [1.3.0] – 2025-04-28
### Fixed
- `autocomplete="new-password"` auf Benutzername-Feldern in Settings – verhindert Chromium-Autofill-Doppeleingabe bei `type="text"`

## [1.2.0] – 2025-04-28
### Fixed
- Settings-Fenster: `parent: mainWindow` entfernt und `sandbox: true` gesetzt – behebt doppelte Tastatureingaben durch gemeinsamen Keyboard-Event-Pfad unter Wayland

## [1.1.0] – 2025-04-28
### Added
- Versionsnummer in der Toolbar sichtbar (grau, zwischen Settings und Gamepad-Status)
- Settings: `✕ Schließen`-Button im Footer (IPC `close-settings`)
- Controller: Scrollrad-Support (`__SCROLL_UP` / `__SCROLL_DOWN`) für Zoom via D-Pad
- Controller: `.`-Taste (Clear Target) als Option im Button-Mapping
- `preload.js`: `resetCursor`, `sendGamepadScroll`, `closeSettings` ergänzt

### Changed
- Automation-Tasten-Dropdown zeigt 1–0 zuerst, dann F1–F12
- `automation.json` Standard-Keys: `1`, `2`, `3` statt `F1`, `F2`, `F3`
- `gamepad.json` überarbeitet nach Steam-Deck-Layout (A=Linksklick, B=Clear Target, L1/R1=Skills 1/2, L2=Kamera, D↑/↓=Zoom, D→=Tab)
- Controller: WASD-Hysterese (Press 0.40 / Release 0.20), Deadzone rechter Stick 0.25
- Maus-Cursor im Spiel sichtbar (`insertCSS`: `cursor: default !important`)
- Settings-Fenster: unabhängig von mainWindow (kein `parent`), `sandbox: true`

## [1.0.0] – vor 2025-04-28
### Added
- Multiboxing mit zwei isolierten WebContentsViews (`persist:account1` / `persist:account2`)
- Automation-Engine: konfigurierbare Aktionen pro Account (Taste + Intervall), läuft auch im Hintergrund
- Gamepad-Polling im Toolbar-Renderer: linker Stick → WASD, rechter Stick → Maus/Kamera
- Konfigurierbare Button-Mappings in `config/gamepad.json`
- Settings-Fenster: Tabs für Automation, Controller, Accounts, Hotkeys
- Auto-Fill für Login-Daten (optional, pro Account)
- electron-builder AppImage-Packaging für Steam Deck
- Startup-Skript `launch-flyff.sh` mit Wayland-Flags
