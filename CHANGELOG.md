# Changelog

## [1.27.0] – 2026-04-28
### Fixed
- 80ms Hold und focus() aus normalem sendInputEvent-Pfad entfernt – reguläre Keys (I, 1, 2, M, …) funktionieren sofort und brauchen kein Hold; Hold bleibt nur im CDP-Pfad (Space/J)

## [1.26.0] – 2026-04-28
### Fixed
- Jump (Space/J): CDP-Taste hält jetzt 80ms zwischen rawKeyDown und keyUp – Spiel pollt Input per rAF (~16ms), keyUp im selben Tick ließ die Taste nie als "gedrückt" erscheinen
- Alle anderen Button-Keys: `view.webContents.focus()` + 80ms Hold vor sendInputEvent – verhindert dass Events ohne aktiven View-Fokus still gedroppt werden
- J zu CDP_KEYS hinzugefügt (falls Jump in Flyff auf J umgestellt)

## [1.25.0] – 2026-04-28
### Fixed
- Jump (Space): CDP `Input.dispatchKeyEvent` statt `dispatchEvent`/`sendInputEvent` – setzt alle Felder korrekt (`code:'Space'`, `key:' '`, `text:' '`, `windowsVirtualKeyCode:32`, `isTrusted:true`), identisch zu echtem OS-Keypress (SD-Tastatur)

## [1.24.0] – 2026-04-28
### Fixed
- Jump (Space): Dispatch-Target von `document` auf `canvas` (fallback: `body`) geändert – DOM-Events bubblen nur nach OBEN (canvas→body→document→window), nicht nach unten; Dispatch auf `document` erreichte Canvas-level Listener nie

## [1.23.0] – 2026-04-28
### Fixed
- Jump (Space): `sendInputEvent` setzt `event.code` für Space nicht zuverlässig → Space-Button nutzt jetzt `executeJavaScript` + `dispatchEvent` mit explizitem `code:'Space'`, `key:' '`, `keyCode:32`

## [1.22.0] – 2026-04-28
### Fixed
- Jump (Space) via Controller: `char`-Event wird jetzt zusätzlich zu `keyDown`/`keyUp` gesendet – Flyff wertet `keypress` für Jump aus, das `keyDown` allein löste es nicht aus
### Changed
- Auto-Target Spiralsuche ~3.5× schneller: STEP 0.18→0.35, TIGHTNESS 4→6 (37px Abstand), TICK_MS 20→16 – Scan bis 300px Radius dauert jetzt ~2.3s statt ~8.3s

## [1.21.0] – 2026-04-28
### Changed
- UI fully translated to English (toolbar tooltips, settings labels, button names, dropdown options)

## [1.20.0] – 2026-04-28
### Fixed
- Leertaste (Space/Jump) und Enter funktionieren jetzt korrekt via Controller: `sendInputEvent` erwartet `' '` bzw. `'\r'`, nicht die Accelerator-Namen `'Space'`/`'Return'`

## [1.19.0] – 2026-04-28
### Fixed
- Doppelte Tastatureingaben (Settings + Webpage): `XMODIFIERS=""`, `GTK_IM_MODULE=""`, `QT_IM_MODULE=""` im Launch-Skript – deaktiviert IBus/Fcitx Input-Method die unter Wayland/Bazzite Eingaben verdoppelt
- `before-input-event`-Fallback vollständig entfernt – war auf Wayland nicht zuverlässig und hat Doubles mitverursacht
### Removed
- Auto-Fill Credentials (Benutzername/Passwort) aus Settings entfernt – Login erfolgt via Google auf der Webseite

## [1.18.0] – 2026-04-28
### Added
- Settings → Accounts: „Session zurücksetzen"-Buttons pro Account – löscht Cookies und gespeicherte Login-Daten der Partition und lädt die Seite neu

## [1.17.0] – 2026-04-28
### Fixed
- Doppelte Tastatureingaben beim Schreiben behoben: `before-input-event`-Fallback leitet Tasten jetzt nur weiter wenn der Game-View nicht bereits fokussiert ist (`isFocused()`-Check)

## [1.16.0] – 2026-04-28
### Fixed
- Gamepad Button-Mapping wird jetzt live aktualisiert wenn Settings gespeichert werden – kein App-Neustart mehr nötig damit neue Zuweisungen wirken

## [1.15.0] – 2026-04-28
### Changed
- Controller-Tab zeigt jetzt Buttons 0–19 (statt 0–15) – Back-Buttons L4/R4/L5/R5 (Index 16–19) sind zuweisbar, sofern Steam Input sie als Standard-Button durchreicht

## [1.14.0] – 2026-04-28
### Added
- Auto-Targeting via Spiralsuche: `__TARGET` als neue Gamepad-Aktion – bewegt den Cursor spiralförmig von der Bildschirmmitte, klickt sobald das Spiel ein Ziel signalisiert (Cursor-Style-Änderung)
- Konfigurierbarer Spiral-Radius (px) im Settings → Controller-Tab
- Changelog-Button in der Toolbar (📋) öffnet Overlay mit Versionshistorie

## [1.13.0] – 2026-04-28
### Added
- Automation-Aktionen können jetzt dynamisch hinzugefügt (`+ Aktion hinzufügen`) und gelöscht (`✕`) werden – keine feste Grenze von 8 Einträgen mehr
- Live-Save: Änderungen an Automation-Aktionen (Label, Taste, Intervall, Checkbox, Add, Delete) werden sofort gespeichert und laufende Automationen ohne App-Neustart neu gestartet

## [1.12.0] – 2026-04-28
### Fixed
- Rechter Stick bewegt die Maus jetzt nur noch wenn L2 (`__RHOLD`) gehalten wird – verhindert unsichtbaren Cursor-Drift ohne aktive Kameradrehung

## [1.11.0] – 2026-04-28
### Fixed
- 200 ms Focus-Keeper entfernt – war Ursache für app-weite Doppel-Inputs (jede Taste wurde zweimal gesendet)
- `webContents.focus()` aus Gamepad-Keydown-Handler entfernt – zweite Quelle für Doppel-Inputs
- `before-input-event`-Fallback: wenn der Toolbar-Renderer versehentlich Keyboard-Focus hat, werden Tasten einmalig ans Game-View weitergeleitet ohne `focus()` aufzurufen

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
