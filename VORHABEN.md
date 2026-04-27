# Flyff Universe Wrapper – Projektbeschreibung

## Was ist das?
Eine Electron-Desktop-App, die Flyff Universe (https://universe.flyff.com) als nativen
Wrapper verpackt – mit Features, die im Browser allein nicht möglich sind.

## Zielplattformen
- **Primär:** Steam Deck (Bazzite / SteamOS, 1280x800)
- **Sekundär:** Linux Desktop (Bazzite)

## Features

### 1. Multiboxing – 2 Accounts gleichzeitig
- Zwei vollständig isolierte Browser-Fenster (separate Cookie/Session-Stores)
- Jedes Fenster ist ein eigener Flyff-Login
- Umschalten zwischen den Fenstern mit einer konfigurierbaren Taste (z.B. F9)
- Optional: Side-by-Side-Ansicht oder Vollbild-Toggle

### 2. Steam Deck Optimierung
- Fenstergröße bei Start: 1280x800 (Steam Deck native Auflösung)
- Vollbildmodus per Tastendruck togglebar
- Als Nicht-Steam-Spiel einbindbar → Steam Input für Controller-Mapping

### 3. Controller Support
- Gamepad API (Chromium) → direktes Mapping ohne Steam Input
- Konfigurierbare Button-zu-Taste-Zuordnung pro Fenster (Multiboxing)
- Linker Stick → Mausbewegung oder WASD (umschaltbar)
- Rechter Stick → Kamerabewegung (Maus)

### 4. Automation Engine (Autoheal / Autobuff)
- Konfigurierbar per UI oder JSON-Datei
- Jede Aktion hat: Taste, Intervall (ms), Label, aktiv/inaktiv Toggle
- Tasten: ausschließlich **F1–F12** (Spiel-Skills liegen auf diesen Tasten)
- Im Settings-UI: Dropdown mit F1–F12, kein Freitext-Eingabefeld
- Beispiel-Config:
  ```json
  {
    "actions": [
      { "label": "Heal",   "key": "F1", "intervalMs": 3000,  "enabled": true },
      { "label": "Buff 1", "key": "F2", "intervalMs": 30000, "enabled": true },
      { "label": "Buff 2", "key": "F3", "intervalMs": 30000, "enabled": true },
      { "label": "Buff 3", "key": "F4", "intervalMs": 30000, "enabled": false }
    ]
  }
  ```
- Start/Stop per Hotkey oder UI-Button
- Separates Profil pro Account (Fenster 1 / Fenster 2)
- Automation pro Account einzeln aktivierbar/deaktivierbar (Account 1 an, Account 2 aus – oder beide)
- Hintergrund-BrowserView bleibt geladen und empfängt sendInputEvent auch ohne Fokus
- Beispiel: Account 2 läuft als Heal-Bot im Hintergrund während man Account 1 aktiv spielt

### 5. Konfiguration (persistent)
- electron-store für dauerhafte Speicherung
- Speichert: Automation-Profile, Hotkeys, Fensterpositionen, Auflösung
- Einstellungen bleiben nach Neustart erhalten

## Technischer Stack
- **Electron** (Chromium + Node.js)
- **Session Partitioning** für Cookie-Isolation
- **Gamepad API** für Controller
- **globalShortcut** für globale Hotkeys
- **BrowserView** für die Spielfenster (kein iframe)
- **electron-store** für Konfiguration
- **Kein Framework** für UI (vanilla HTML/CSS/JS reicht)

## Bewusst NICHT enthalten
- Kein APK/Android-Support
- Kein automatisches Klicken auf UI-Elemente (nur Tasten-Simulation)
- Kein Pixel-Reading / Vision-basiertes Autoplay
- Kein Netzwerk-Interception

## Projektstruktur
```
flyff-wrapper/
├── src/
│   ├── main.js          # Fenster-Management, IPC, Hotkeys, App-Lifecycle
│   ├── preload.js       # Sichere Bridge renderer ↔ main
│   ├── gamepad.js       # Controller-Polling + Mapping
│   ├── automation.js    # Autoheal/Buff Engine (setInterval-basiert)
│   └── ui/
│       ├── index.html   # Haupt-UI (Toolbar: Account-Switch, Start/Stop, Settings)
│       └── settings.html # Automation-Konfiguration per Formular
├── config/
│   └── automation.json  # Default-Config (wird nach ~/.config/flyff-wrapper kopiert)
├── sync.sh              # rsync → Steam Deck
└── package.json
```

## Risiken / Hinweise
- Autoheal/Automation kann gegen Flyff Universe ToS verstoßen → Nutzung auf eigene Gefahr
- Getestet auf Bazzite (Fedora-immutable) und SteamOS (Steam Deck)
- Kein Proton/Wine nötig (native Electron-App)
