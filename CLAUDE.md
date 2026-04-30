# Flyff Universe Electron Wrapper – Projektübersicht

## Ziel

Electron-App als Wrapper für https://universe.flyff.com, optimiert für das Steam Deck
(1280 × 800, original SteamOS von Valve). Unterstützt Multiboxing (zwei Accounts gleichzeitig),
eine Automation-Engine (Autoheal/Buff) und Gamepad-Steuerung.

## Erledigte Features

### Multiboxing
- Zwei vollständig isolierte `WebContentsView`-Instanzen laden beide `https://universe.flyff.com`
- Session-Isolation via Electron-Partitionen: `persist:account1` / `persist:account2`
- Cookies, LocalStorage und Login-Daten sind strikt getrennt
- Umschalten per globalShortcut **F9** (konfigurierbar in Settings)
- Nur der aktive View ist sichtbar; der inaktive View bleibt im Hintergrund am Leben

### Fenster & Auflösung
- Hauptfenster startet bei 1280 × 800 und wird sofort maximiert
- Rahmenloses Fenster (`frame: false`), die 30 px Toolbar ist in HTML/CSS realisiert
- **F11** wechselt Vollbild ein/aus (fest belegt, nicht konfigurierbar)
- Fenstergröße wird in `electron-store` gespeichert und beim nächsten Start wiederhergestellt

### Automation-Engine
- Konfigurierbare Aktions-Liste pro Account (Label, Taste 1–0/F1–F12, Intervall ms, an/aus)
- Aktionen können dynamisch hinzugefügt (`+ Aktion`) und gelöscht (`✕`) werden – keine feste Obergrenze
- Änderungen werden sofort gespeichert und laufende Automationen ohne Neustart übernommen (Live-Save)
- Aktionen werden via `webContents.sendInputEvent` direkt in den jeweiligen View injiziert
- **Läuft auch auf dem Hintergrund-Account** (nicht sichtbarer View) – ideal für Autoheal
- Pro Account separate Start/Stop-Buttons in der Toolbar: `▶ / ■` für Acc1 und Acc2
- Automation-Status wird in der Toolbar visuell angezeigt (grüne Buttons = aktiv)
- Globaler Toggle für den **aktiven** Account via **F10** (konfigurierbar)
- Standard-Config: Heal (1, 3 s), Buff 1 (2, 30 s), Buff 2 (3, 30 s), weitere disabled

### Gamepad-Support
- Polling via `requestAnimationFrame` im Toolbar-Renderer (kein setInterval-Cascade)
- Linker Stick (Axes 0+1): WASD-Tasten mit Hysterese (Press 0.40 / Release 0.20)
- Rechter Stick (Axes 2+3): Mausbewegung (Kameradrehung) **nur wenn L2 (`__RHOLD`) gehalten** – verhindert Cursor-Drift
- Maus-IPC gedrosselt auf 30 fps, Deltas akkumuliert – verhindert Queue-Flooding
- Virtueller Cursor wird beim Loslassen von `__RHOLD` zur Bildschirmmitte zurückgesetzt
- Deadzone: 0.25 (verhindert Drift)
- Button-Mapping konfigurierbar in Settings (Controller-Tab, Buttons 0–19) und `config/gamepad.json`
- Gamepad-Config wird live übernommen wenn Settings gespeichert werden (kein Neustart nötig)
- Edge-Detection: Tastendruck wird nur einmal ausgelöst, kein Auto-Repeat
- Maus-Cursor immer sichtbar via `insertCSS: cursor: default !important`
- Button-Presse senden **keyDown + char + keyUp** via `sendInputEvent` (sofort, kein Delay)
- **Space und J**: via CDP `Input.dispatchKeyEvent` mit 80ms Hold zwischen rawKeyDown und keyUp – Flyff pollt Input per `requestAnimationFrame`, keyUp im selben Tick lässt die Taste nie als "gedrückt" erscheinen; `sendInputEvent` funktioniert für Space/J nicht (isTrusted oder fehlende Felder)
- Weitere problematische Keys bei Bedarf in `CDP_KEYS` eintragen (`main.js`)

### Standard-Controller-Layout (Steam Deck)
| Button | Aktion |
|--------|--------|
| A (0) | Linksklick (Angriff/Auswählen) |
| B (1) | `.` – Clear Target (in Spiel unter Menu→Keys auf `.` legen) |
| X (2) | Taste 3 |
| Y (3) | Leertaste (Jump) |
| L1 (4) | Taste 1 (Heal) |
| R1 (5) | Taste 2 (Buff) |
| L2 (6) | Rechtsklick halten (Kamera drehen) |
| R2 (7) | Taste 4 |
| Back (8) | Escape |
| Start (9) | M (Karte) |
| D-Pad ↑ (12) | Zoom rein (Scrollrad) |
| D-Pad ↓ (13) | Zoom raus (Scrollrad) |
| D-Pad → (15) | Tab (Skillbar wechseln) |

### Auto-Targeting
- Gamepad-Aktion `__TARGET` (zuweisbar im Controller-Tab)
- Injiziert via `executeJavaScript` ein Spiral-Skript in den aktiven Game-View
- Bewegt den Cursor spiralförmig von der Bildschirmmitte nach außen (Archimedean spiral)
- Parameter: STEP=0.35 rad/tick, TIGHTNESS=6 px/rad (~37px Abstand), TICK_MS=16 → Scan bis 300px in ~2.3s
- MutationObserver + synchrone Cursor-Style-Prüfung erkennen Ziel-Hover (`document.body.style.cursor` / Canvas)
- Bei Treffer: MouseDown/MouseUp an der aktuellen Cursor-Position → Ziel wird selektiert
- Konfigurierbarer Radius (px) in Settings → Controller → "Auto-Target" gespeichert in `gamepad.json` als `targetRadius`

### Madrigal Guide (📖 Guide-Button in der Toolbar)
- Overlay (position: fixed, inset: 30px 0 0 0) legt sich über den Game-View; Game-View wird via `set-game-view-visibility` IPC versteckt, solange der Guide offen ist
- **`overlayOpen`-Flag in `main.js`**: `updateViewBounds()` setzt Game-View nur sichtbar wenn `overlayOpen === false` – verhindert dass F9-Wechsel den View über den Guide legt
- Tab **Quests**: 492 Quests (Lv. 1–183) aus NaviKnight2765' Spreadsheet; Spalten: Lv, Questline, Name, Rec, Exp, Diff, Items, Monsters, Inv, Rewards, Notes
- Tab **Monsters**: 53 Monster-Einträge als kompaktes Grid
- Tab **Questlines**: 36 Questlines als Tabelle mit Start-NPC/Location, Level-Range und zwei Progress-Bars:
  - Grüne Bar: Quests abgeschlossen (X/Y, berechnet live aus Done-Checkboxen)
  - Orange Bar: Inventory Slots freigeschaltet (X/Y, Summe der `inv`-Felder aus `quests.json`)
  - Klick auf eine Questline-Zeile filtert den Quests-Tab nach dieser Questline
- Tab **Dailies**: Forsaken Tower Daily Quests (Lv. 86–152) und Kaillun Daily Quests (Lv. 162–172) mit Exp, Monsters to Kill, Penya-Reward; **„Your Level"-Eingabefeld** filtert auf `lv <= eingabe` (leer = alle)
- Tab **Quests** hat eine **Filter-Bar** (Open / Done / All); Standard ist „Open" → abgeschlossene Quests werden versteckt; Quest-Anzahl wird angezeigt
- Live-Suche filtert über Name, Questline, Items, Monsters, Rewards, Notes, Rec und Level
- **Checkbox „Done"** pro Quest – Status wird in `electron-store` unter `questProgress` gespeichert (Key: `"lv-line-name"`)
- **Quest-Detail-Fenster**: öffnet flyffipedia.com-Link in separatem `BrowserWindow`; injiziert via `src/quest-preload.js` (contextBridge → `window.questWin.close()`) einen roten „✕ Close"-Button nach jedem `did-finish-load` – nötig weil Gamescope keine Fensterdekorationen anzeigt
- Quest-IDs werden mit `replace(/'/g, "\\'")` escaped bevor sie als inline-`onchange`-Parameter verwendet werden
- `openQuestUrl()` akzeptiert nur `http://` / `https://` URLs (Protokoll-Guard)
- Daten: `config/quests.json` (492), `config/monsters.json` (53), `config/questlines.json` (36), `config/dailies.json` (39) – alle read-only im AppImage-Bundle

### Changelog
- `CHANGELOG.md` liegt im Projekt-Root, wird ins AppImage gebündelt
- Toolbar-Button `📋` öffnet Changelog-Overlay direkt in der App (über dem Game-View)
- **Nach jeder Änderung CHANGELOG.md aktualisieren** – Version hochzählen + Eintrag hinzufügen

### Macro-Buttons
- Konfigurierbare Key-Sequenz-Buttons in der Toolbar (z.B. „Full Buff Acc1", „Full Buff Acc2")
- Standard: F2, 1, 2, 3, 4, 5, 6, 7, 8, 9, F1 mit 200ms Abstand zwischen Keys
- Automation des Ziel-Accounts wird während der Ausführung automatisch pausiert und danach fortgesetzt
- Macros laufen auf dem konfigurierten Account – auch wenn dieser gerade im Hintergrund ist
- Config: `config/macros.json` (Array mit `id`, `label`, `account`, `keys[]`, `delay`)
- Settings → Tab **Macros**: Label, Account, Keys (kommagetrennt), Delay ms; dynamisch hinzufügen/löschen
- Neue Macros werden sofort nach Save als Toolbar-Button sichtbar (via `macros-updated` IPC-Event)

### Konfiguration & Persistenz
- `electron-store` speichert: `activeAccount`, `hotkeys`, `windowBounds`, `questProgress`
- `automation.json`, `gamepad.json` und `macros.json` werden in `app.getPath('userData')` gespeichert (`~/.config/flyff-wrapper/`)
- `quests.json`, `monsters.json`, `questlines.json` und `dailies.json` sind **read-only** im AppImage-Bundle – nur via `bundledConfigPath`, nicht in userData
- Beim ersten Start wird die gebündelte Default-Config (automation/gamepad/macros) nach userData kopiert
- AppImage-Updates überschreiben Nutzer-Configs **nicht**
- Beim Start wird der zuletzt aktive Account wiederhergestellt

### UI – Toolbar (30 px)
- Account-Buttons: `1` / `2` (aktiver Button hervorgehoben)
- Automation-Buttons je Account: `▶ Acc1` `■ Acc1` `▶ Acc2` `■ Acc2`
- `⚙ Settings` öffnet das Einstellungs-Fenster
- Versionsnummer sichtbar (grau, zwischen Settings und Gamepad-Status)
- Gamepad-Status-Indikator: zeigt Anzahl verbundener Controller
- `✕` schließt die App
- Toolbar ist draggable (`-webkit-app-region: drag`), Buttons haben `no-drag`

### UI – Settings-Fenster
- Unabhängiges Fenster (kein `parent: mainWindow`, `sandbox: true`) – verhindert Doppel-Input unter Wayland
- UI vollständig auf Englisch
- `✕ Close`-Button im Footer (IPC `close-settings`)
- Tab **Automation**: Tabelle mit Label, Taste (1–0, F1–F12 Dropdown), Intervall, Checkbox; dynamisch erweiterbar; separiert pro Account
- Tab **Controller**: Button-Mapping Tabelle (Buttons 0–19, alle Sonderaktionen wählbar inkl. Scroll, Mausklick, Auto-Target); konfigurierbarer Auto-Target-Radius
- Tab **Accounts**: „Reset Session"-Buttons pro Account – löscht Cookies/Login der Partition und lädt Seite neu
- Tab **Hotkeys**: Texteingabe für Account-Switch-Taste und Automation-Toggle-Taste
- Tab **Macros**: Macro-Buttons konfigurieren (Label, Account, Keys kommagetrennt, Delay); dynamisch hinzufügen/löschen
- `💾 Save` schreibt Config sofort auf Disk und startet laufende Automationen mit neuer Config neu

### Steam Deck Deployment
- AppImage wird via `electron-builder` gebaut: `npm run build`
- Datei liegt auf dem Deck unter `/home/deck/FlyffWrapper.AppImage`
- Startup-Skript: `/home/deck/launch-flyff.sh` (setzt Wayland-Flags, `--appimage-extract-and-run`)
- Das Script löscht vor dem Start alle alten `/tmp/appimage_extracted_*`-Verzeichnisse – verhindert dass `/tmp` (tmpfs, 7.3 GB RAM) volläuft
- Übertragen via: `scp dist/FlyffWrapper.AppImage deck@192.168.178.30:/home/deck/`
- **Version immer in `package.json` hochzählen** vor dem Build – sichtbar in der Toolbar

## Offene Punkte / mögliche Erweiterungen

### Funktionalität
- [ ] **HP-basiertes Healing via Pixel-Capture**: `webContents.capturePage(rect)` auf den HP-Bar-Bereich (kleines Rect, <1ms CPU), Pixel-Farbe auslesen um HP-% zu schätzen, bei Unterschreitung eines Schwellwerts konfigurierte Taste drücken. Kein OCR nötig (zu langsam: 200–600ms/Aufruf), kein Memory-Reading (bricht nach jedem Patch). Erst Position der HP-Bar auf 1280×800 kalibrieren.
  - **Untersuchungsergebnis**: Flyff Universe rendert komplett auf einem einzigen WebGL-Canvas (2561×1320px bei DPR 1.5). Keine DOM-Elemente für HP, keine exponierten JS-Globals. Pixel-Capture ist der einzige machbare Ansatz ohne externe Dependencies.
- [ ] **Automation-Profil-Wahl in der Toolbar** – aktuell fest: account1 ↔ account2-Profil
- [ ] **Reconnect-Logik** – wenn das Spiel die Session verliert, automatisch neu laden
- [ ] **Benachrichtigung bei Automation-Fehler** – stille Fehler in `sendInputEvent` werden nur geloggt

### Code-Qualität
- [ ] **IPC-Fehlerbehandlung im Renderer** – `window.flyff.*`-Aufrufe haben kein Error-Handling
- [ ] **Unit-Tests** für `automation.js` (Timer-Logik) und Gamepad-Polling (Deadzone, Hysterese)

## Projektstruktur

```
flyff-wrapper/
├── package.json              – Electron 41, electron-store 11, Version
├── CHANGELOG.md              – Versionshistorie
├── config/
│   ├── automation.json       – Default-Config (Heal/Buff Tasten + Intervalle)
│   ├── gamepad.json          – Default Button-Index → Taste Mapping
│   ├── macros.json           – Default Macro-Buttons (Full Buff Acc1 + Acc2)
│   ├── quests.json           – 492 Quests (Lv. 1–183), read-only, aus NaviKnight2765-Spreadsheet
│   ├── monsters.json         – 53 Monster-Einträge, read-only
│   ├── questlines.json       – 36 Questlines mit NPC/Location und Level-Range, read-only
│   └── dailies.json          – 39 Daily Quests (Forsaken Tower + Kaillun), read-only
└── src/
    ├── main.js               – Hauptprozess: Fenster, Views, IPC, Shortcuts
    ├── automation.js         – Timer-Engine (start/stop/isRunning pro Account)
    ├── preload.js            – contextBridge → window.flyff API (Toolbar + Guide)
    ├── quest-preload.js      – contextBridge → window.questWin.close() (Quest-Detail-Fenster)
    └── ui/
        ├── index.html        – 30 px Toolbar + Guide-Overlay + Gamepad-Polling
        └── settings.html     – Einstellungs-Fenster (5 Tabs inkl. Macros)
```

> `src/gamepad.js` existiert noch im Repo, wird aber nicht mehr verwendet.
> Polling läuft seit v1.0 direkt im Toolbar-Renderer (`index.html`).

## App starten (Entwicklung)

```bash
npm install   # nur beim ersten Mal nötig
npm start
```

## Build & Deploy auf Steam Deck

```bash
npm run build
scp dist/FlyffWrapper.AppImage deck@192.168.178.30:/home/deck/
```

## Technische Hinweise

- **electron-store** ist ESM-only (v8+) → wird via `await import('electron-store')` geladen
- **WebContentsView** statt BrowserView (BrowserView ab Electron 30 deprecated)
- **contextIsolation: true, nodeIntegration: false** überall gesetzt
- **sandbox: false** im Preload des Hauptfensters (nutzt `require('electron')`)
- **sandbox: true** im Settings-Fenster (kein Node.js nötig, verhindert Input-Probleme)
- Automation läuft auf dem **Hintergrund-View** via `sendInputEvent` ohne Fokus-Anforderung
- Gamepad-Polling via `requestAnimationFrame` im Toolbar-Renderer; Maus-IPC max 30 fps
- Configs werden in `app.getPath('userData')` gespeichert, nicht im AppImage-Bundle
- Wayland: `ELECTRON_OZONE_PLATFORM_HINT=auto` im Startup-Skript gesetzt; `XMODIFIERS=""`, `GTK_IM_MODULE=""`, `QT_IM_MODULE=""` deaktivieren IBus/Fcitx (verhindert doppelte Eingaben)
- **sendInputEvent für Tasten**: `keyDown` + `char` + `keyUp` – `char` entspricht DOM-`keypress` und ist für Space/Jump nötig; `KEY_NAME_MAP` konvertiert Accelerator-Namen für `char`-Events (`'Space'` → `' '`)
- `before-input-event`-Fallback entfernt – war unter Wayland Quelle für Doppel-Inputs
