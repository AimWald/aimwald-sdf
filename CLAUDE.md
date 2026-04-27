# Flyff Universe Electron Wrapper – Projektübersicht

## Ziel

Electron-App als Wrapper für https://universe.flyff.com, optimiert für das Steam Deck
(1280 × 800, Bazzite/SteamOS). Unterstützt Multiboxing (zwei Accounts gleichzeitig),
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
- Konfigurierbare Aktions-Liste pro Account (Label, Taste F1–F12, Intervall ms, an/aus)
- Aktionen werden via `webContents.sendInputEvent` direkt in den jeweiligen View injiziert
- **Läuft auch auf dem Hintergrund-Account** (nicht sichtbarer View) – ideal für Autoheal
- Pro Account separate Start/Stop-Buttons in der Toolbar: `▶ / ■` für Acc1 und Acc2
- Automation-Status wird in der Toolbar visuell angezeigt (grüne Buttons = aktiv)
- Globaler Toggle für den **aktiven** Account via **F10** (konfigurierbar)
- Standard-Config: Heal (F1, 3 s), Buff 1 (F2, 30 s), Buff 2 (F3, 30 s), weitere disabled

### Gamepad-Support
- Polling alle 16 ms (~60 fps) via Browser Gamepad API in `src/gamepad.js`
- Linker Stick (Axes 0+1): Mausbewegung (Geschwindigkeit 8 px/Tick)
- Rechter Stick (Axes 2+3): Kamerabewegung (Geschwindigkeit 4 px/Tick, gedämpft)
- Deadzone: 0.15 (verhindert Drift)
- Button-Mapping konfigurierbar in `config/gamepad.json` (Button-Index → Taste)
- Edge-Detection: Tastendruck wird nur einmal ausgelöst, kein Auto-Repeat

### Konfiguration & Persistenz
- `electron-store` speichert: `activeAccount`, `hotkeys`, `windowBounds`
- Automation-Config in `config/automation.json` (lesbar/bearbeitbar im Settings-Fenster)
- Gamepad-Mapping in `config/gamepad.json` (direkte JSON-Bearbeitung)
- Beim Start wird der zuletzt aktive Account wiederhergestellt

### UI – Toolbar (30 px)
- Account-Buttons: `1` / `2` (aktiver Button hervorgehoben)
- Automation-Buttons je Account: `▶ Acc1` `■ Acc1` `▶ Acc2` `■ Acc2`
- `⚙ Settings` öffnet das Einstellungs-Fenster
- `✕` schließt die App
- Toolbar ist draggable (`-webkit-app-region: drag`), Buttons haben `no-drag`

### UI – Settings-Fenster
- Tab **Automation**: Tabelle mit Label, Taste (F1–F12 Dropdown), Intervall, Checkbox pro Aktion, für beide Accounts
- Tab **Hotkeys**: Texteingabe für Account-Switch-Taste und Automation-Toggle-Taste
- `💾 Speichern` schreibt Config sofort auf Disk und startet laufende Automationen mit neuer Config neu

## Offene Punkte / mögliche Erweiterungen

### Funktionalität
- [ ] **Gamepad-Config im Settings-UI** – `config/gamepad.json` ist aktuell nur manuell editierbar
- [ ] **Automation-Aktionen hinzufügen/löschen** – Settings-Tabelle hat feste 8 Einträge, kein +/- Button
- [ ] **Automation-Profil-Wahl in der Toolbar** – aktuell fest: account1 ↔ account2-Profil
- [ ] **Reconnect-Logik** – wenn das Spiel die Session verliert, automatisch neu laden
- [ ] **Benachrichtigung bei Automation-Fehler** – stille Fehler in `sendInputEvent` werden nur geloggt
- [ ] **Tastatur-Shortcut für Vollbild auch per IPC** – aktuell nur via F11 globalShortcut

### Steam Deck / Deployment
- [ ] **Electron Forge / electron-builder** – kein Packaging/Installer vorhanden; `npm start` nötig
- [ ] **Steam-Eintrag (.desktop-Datei)** – damit die App in SteamOS als Non-Steam-Spiel läuft
- [ ] **Gamescope-Kompatibilität testen** – Gamescope (Steam Deck Game Mode) hat eigene Fokus-Regeln
- [ ] **Wayland-spezifische Fenster-Flags** – `--ozone-platform=wayland` ggf. nötig auf Bazzite

### Code-Qualität
- [ ] **Gamepad-Config live neu laden** – Änderungen an `config/gamepad.json` brauchen App-Neustart
- [ ] **IPC-Fehlerbehandlung im Renderer** – `window.flyff.*`-Aufrufe haben kein Error-Handling
- [ ] **Unit-Tests** für `automation.js` (Timer-Logik) und `gamepad.js` (Deadzone, Edge-Detection)

## Projektstruktur

```
flyff-wrapper/
├── package.json              – Electron 41, electron-store 11
├── config/
│   ├── automation.json       – Aktions-Config (Heal/Buff Tasten + Intervalle)
│   └── gamepad.json          – Button-Index → Taste Mapping
└── src/
    ├── main.js               – Hauptprozess: Fenster, Views, IPC, Shortcuts
    ├── automation.js         – Timer-Engine (start/stop/isRunning pro Account)
    ├── gamepad.js            – Gamepad-Polling-Modul (Preload-Context)
    ├── preload.js            – contextBridge → window.flyff API
    └── ui/
        ├── index.html        – 30 px Toolbar
        └── settings.html     – Einstellungs-Fenster
```

## App starten

```bash
npm install   # nur beim ersten Mal nötig
npm start
```

## Technische Hinweise

- **electron-store** ist ESM-only (v8+) → wird via `await import('electron-store')` geladen
- **WebContentsView** statt BrowserView (BrowserView ab Electron 30 deprecated)
- **contextIsolation: true, nodeIntegration: false** überall gesetzt
- **sandbox: false** im Preload nötig, damit `require('./gamepad.js')` und `fs` funktionieren
- Automation läuft auf dem **Hintergrund-View** via `sendInputEvent` ohne Fokus-Anforderung
