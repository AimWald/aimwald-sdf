# Flyff Universe Wrapper – Setup Plan

## Übersicht
Electron-App für Flyff Universe mit Multiboxing, Controller-Support und Autoheal.
Entwicklung auf Bazzite, Testen auf Steam Deck via rsync.

---

## Phase 1 – Bazzite (Entwicklungsrechner)

### 1.1 mise installieren (Node-Version-Manager, funktioniert auf immutablem OS)
```bash
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
source ~/.bashrc
```

### 1.2 Node.js installieren
```bash
mise install node@22
mise use --global node@22
node -v   # sollte v22.x.x zeigen
npm -v
```

### 1.3 Git prüfen (meist vorinstalliert)
```bash
git --version
git config --global user.name "Dein Name"
git config --global user.email "deine@email.de"
```

### 1.4 Projektordner anlegen
```bash
mkdir -p ~/projects/flyff-wrapper
cd ~/projects/flyff-wrapper
npm init -y
npm install --save-dev electron
npm install electron-store    # persistente Config
```

### 1.5 Claude Code CLI installieren (optional, für KI-Unterstützung)
```bash
npm install -g @anthropic-ai/claude-code
# ODER Gemini CLI:
npm install -g @google/generative-ai-cli
```

### 1.6 Sync-Skript erstellen
```bash
# ~/projects/flyff-wrapper/sync.sh
#!/bin/bash
DECK_IP="192.168.178.30"
DECK_USER="deck"
REMOTE_DIR="/home/deck/flyff-wrapper"

rsync -av --exclude node_modules --exclude .git \
  ~/projects/flyff-wrapper/ \
  $DECK_USER@$DECK_IP:$REMOTE_DIR

echo "Sync fertig."
```
```bash
chmod +x ~/projects/flyff-wrapper/sync.sh
```

---

## Phase 2 – Steam Deck vorbereiten

### 2.1 Desktop Mode öffnen
Steam → Power → Switch to Desktop

### 2.2 Passwort setzen (zwingend für SSH)
```bash
# Konsole öffnen (Discover → Konsole, oder Taskleiste)
passwd
# Passwort eingeben (z.B. "deck123" – wird nicht angezeigt)
```

### 2.3 SSH aktivieren
```bash
sudo systemctl enable --now sshd
sudo systemctl status sshd   # sollte "active (running)" zeigen
```

### 2.4 IP-Adresse notieren
```bash
ip a | grep "inet " | grep -v 127
# z.B. 192.168.178.50 → in sync.sh eintragen
```

### 2.5 SSH-Key vom Entwicklungsrechner kopieren (einmalig)
```bash
# Auf Bazzite ausführen:
ssh-keygen -t ed25519 -C "flyff-dev"   # falls noch kein Key vorhanden
ssh-copy-id deck@192.168.178.30
# Einmal Passwort eingeben → danach passwortlos
```

### 2.6 Node.js auf Steam Deck (via mise)
```bash
# Auf Steam Deck via SSH oder direkt in Konsole:
curl https://mise.run | sh
echo 'eval "$(~/.local/bin/mise activate bash)"' >> ~/.bashrc
source ~/.bashrc
mise install node@22
mise use --global node@22
```

### 2.7 Erster Sync-Test
```bash
# Auf Bazzite:
cd ~/projects/flyff-wrapper
./sync.sh

# Auf Steam Deck:
cd ~/flyff-wrapper
npm install
npm start
```

---

## Phase 3 – Entwicklungs-Workflow (laufend)

```bash
# Auf Bazzite: Code ändern → sync → auf Deck testen
./sync.sh
ssh deck@192.168.178.30 "cd flyff-wrapper && pkill electron; npm start &"
```

### Optionaler Auto-Sync bei Dateiänderung
```bash
# Bazzite: inotify-tools installieren (via distrobox oder toolbox)
distrobox enter dev -- sudo dnf install -y inotify-tools

# Watcher starten:
while inotifywait -r -e modify,create,delete ~/projects/flyff-wrapper/src/; do
  ./sync.sh
done
```

---

## Verzeichnisstruktur (Ziel)

```
flyff-wrapper/
├── src/
│   ├── main.js              # Electron Hauptprozess (Fenster, IPC, Hotkeys)
│   ├── preload.js           # Sicherheits-Bridge
│   ├── gamepad.js           # Controller-Mapping
│   ├── automation.js        # Autoheal/Autobuff Engine
│   └── ui/
│       ├── index.html       # Haupt-UI (Account-Switcher, Settings)
│       └── settings.html    # Automation-Konfiguration
├── config/
│   └── automation.json      # Default-Konfiguration
├── sync.sh                  # rsync-Skript
├── package.json
└── README.md
```

---

## Checkliste

- [ ] mise + Node.js auf Bazzite installiert
- [ ] Projektordner + npm init erledigt
- [ ] SSH auf Steam Deck aktiviert
- [ ] IP notiert und in sync.sh eingetragen
- [ ] SSH-Key kopiert (passwortloser Login)
- [ ] Node.js auf Steam Deck installiert
- [ ] Erster Sync erfolgreich
- [ ] `npm start` auf Steam Deck funktioniert
