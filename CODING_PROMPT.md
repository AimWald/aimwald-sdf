# Coding Prompt – Flyff Universe Electron Wrapper

Nutze diesen Prompt mit Claude Code CLI (`claude`) oder Gemini CLI im Projektordner.

---

## Prompt (direkt verwendbar)

```
Ich baue eine Electron-App als Wrapper für das Browser-MMORPG Flyff Universe
(https://universe.flyff.com). Die App soll auf dem Steam Deck (1280x800, Bazzite/SteamOS)
laufen und folgende Features haben:

## Anforderungen

### 1. Zwei isolierte Browser-Fenster (Multiboxing)
- Zwei BrowserView-Instanzen, jede lädt https://universe.flyff.com
- Vollständige Cookie/Session-Isolation via Electron session partitions:
  partition: 'persist:account1' und partition: 'persist:account2'
- Umschalten zwischen den Fenstern per globalShortcut (Standard: F9, konfigurierbar)
- Nur das aktive Fenster ist sichtbar (Vollbild, 1280x800)

### 2. Fenster & Auflösung
- Hauptfenster: 1280x800 (Steam Deck native)
- Beim Start direkt Vollbild oder maximiert
- F11 togglet Vollbild

### 3. Automation Engine (Autoheal / Autobuff)
- Konfigurierbare Aktions-Liste (Label, Taste, Intervall in ms, enabled true/false)
- Aktionen werden per setInterval auf BEIDEN BrowserViews gleichzeitig ausgeführt via
  browserView.webContents.sendInputEvent({ type: 'keyDown', keyCode: '...' })
  direkt danach keyUp – unabhängig davon welches Fenster gerade sichtbar ist.
  Der Hintergrund-Account heallt und bufft also weiter während man Account 1 spielt.
- Separates Profil pro Account (account1, account2)
- Start/Stop per globalShortcut (Standard: F10) oder UI-Button
- Automation ist pro Account einzeln aktivierbar/deaktivierbar – unabhängig voneinander.
  In der Toolbar gibt es pro Account einen eigenen Start/Stop-Button:
  [▶ Acc1] [■ Acc1]  [▶ Acc2] [■ Acc2]
- Aktionen laufen auf dem jeweiligen BrowserView auch wenn er im Hintergrund ist
  (nicht sichtbar). BrowserView.webContents.sendInputEvent funktioniert ohne Fokus.
- Typischer Use-Case: Account 2 healt im Hintergrund automatisch, Account 1 wird aktiv gespielt.
- Erlaubte Tasten für Aktionen: F1 bis F12 (die Spiel-Skills liegen auf diesen Tasten)
- Im Settings-UI ist die Tastenwahl ein Dropdown mit genau diesen Optionen: F1, F2, F3, F4, F5, F6, F7, F8, F9, F10, F11, F12
- sendInputEvent keyCode muss exakt "F1" bis "F12" als String übergeben werden
- Default-Config in config/automation.json:
  {
    "account1": {
      "actions": [
        { "label": "Heal",   "key": "F1", "intervalMs": 3000,  "enabled": true },
        { "label": "Buff 1", "key": "F2", "intervalMs": 30000, "enabled": true },
        { "label": "Buff 2", "key": "F3", "intervalMs": 30000, "enabled": true },
        { "label": "Buff 3", "key": "F4", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 4", "key": "F5", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 5", "key": "F6", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 6", "key": "F7", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 7", "key": "F8", "intervalMs": 30000, "enabled": false }
      ]
    },
    "account2": {
      "actions": [
        { "label": "Heal",   "key": "F1", "intervalMs": 3000,  "enabled": true },
        { "label": "Buff 1", "key": "F2", "intervalMs": 30000, "enabled": true },
        { "label": "Buff 2", "key": "F3", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 3", "key": "F4", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 4", "key": "F5", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 5", "key": "F6", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 6", "key": "F7", "intervalMs": 30000, "enabled": false },
        { "label": "Buff 7", "key": "F8", "intervalMs": 30000, "enabled": false }
      ]
    }
  }

### 4. Controller Support (Gamepad API)
- Im preload.js: Gamepad API polling via setInterval (16ms)
- Linker Stick (axes 0+1): Mausbewegung simulieren via sendInputEvent mouseMove
- Rechter Stick (axes 2+3): ebenfalls Mausbewegung (Kamera), mit niedrigerer Sensitivität
- Button-Mapping konfigurierbar in config/gamepad.json:
  { "0": "Z", "1": "X", "2": "C", "3": "V" }  (Buttons → Tasten)
- Mapping wird auf aktives BrowserView-Fenster angewendet

### 5. Persistente Konfiguration
- electron-store für alle Einstellungen
- Speichert: activeAccount, automationRunning, hotkeys, windowBounds
- Beim Start wiederherstellen

### 6. Minimales UI (Toolbar)
- Schmale Toolbar (30px) am oberen Rand des Hauptfensters
- Buttons: [Account 1] [Account 2] [▶ Start] [■ Stop] [⚙ Settings]
- Settings öffnet ein kleines Fenster mit Formular zur Automation-Konfiguration
  (Tabelle: Label | Taste | Intervall | An/Aus Checkbox)
- Speichern-Button schreibt in electron-store

### 7. Projektstruktur
Erstelle folgende Dateien:
- package.json (mit electron, electron-store als dependencies)
- src/main.js (Hauptprozess: Fenster, BrowserViews, IPC, globalShortcuts)
- src/preload.js (contextBridge für sichere IPC-Kommunikation)
- src/gamepad.js (Gamepad-Polling, wird im main process genutzt)
- src/automation.js (Automation-Engine als Modul)
- src/ui/index.html (Toolbar UI)
- src/ui/settings.html (Einstellungs-Formular)
- config/automation.json (Default-Config)
- config/gamepad.json (Default Button-Mapping)

### Technische Vorgaben
- Electron 28+
- electron-store 8+ (ESM-kompatibel, ggf. mit dynamic import)
- Kein React/Vue/Angular – vanilla HTML/CSS/JS für UI
- Kein TypeScript (plain JavaScript)
- Sicherheit: contextIsolation: true, nodeIntegration: false, preload überall
- BrowserView statt WebContents direkt (bessere Isolation)
- Fehler sauber abfangen (try/catch bei sendInputEvent – Fenster könnte nicht bereit sein)

### Was NICHT implementiert werden soll
- Kein Pixel-Reading / Screenshot-Analyse
- Kein Netzwerk-Interception
- Kein automatisches Anmelden (Login bleibt manuell)
- Kein Auto-Updater

Implementiere alle Dateien vollständig und funktionsfähig. Beginne mit package.json
und src/main.js, dann die weiteren Dateien in der angegebenen Reihenfolge.
Kommentiere wichtige Abschnitte auf Deutsch.
```

---

## Verwendung

### Mit Claude Code CLI:
```bash
cd ~/projects/flyff-wrapper
claude
# Dann den obigen Prompt einfügen
```

### Mit Gemini CLI:
```bash
cd ~/projects/flyff-wrapper
gemini
# Dann den obigen Prompt einfügen
```

### Danach sofort testen:
```bash
npm install
npm start
```

---

## Folge-Prompts (nach der Erstimplementierung)

### Gamepad testen:
```
Füge in src/main.js eine Konsolen-Ausgabe hinzu, die beim Start zeigt ob ein
Gamepad erkannt wurde. Nutze dafür die Gamepad API im preload.js mit einem
gamepadconnected Event-Listener der eine IPC-Nachricht an main sendet.
```

### Automation UI verbessern:
```
Erweitere settings.html um die Möglichkeit, neue Aktionen per Button hinzuzufügen
und bestehende zu löschen. Änderungen sollen live in electron-store gespeichert
werden ohne dass die App neu gestartet werden muss.
```

### Steam Deck Geste:
```
Füge einen globalShortcut für Super+Tab hinzu (Steam Deck Geste) der zwischen
Account 1 und Account 2 umschaltet. Alternativ: Gamepad-Button 5 (L1) für Switch.
```
