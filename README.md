# AimWald-SDF (SteamDeckFlyff)

<p align="center">
  <img src="build/preview-hero-with-logo.png" alt="AimWald-SDF Banner" width="100%">
</p>

<p align="center">
  <strong>Desktop wrapper for <a href="https://universe.flyff.com">Flyff Universe</a></strong><br>
  Multiboxing • Automation • Gamepad Support • Quest Guide
</p>

<p align="center">
  Built and optimized for the <strong>Valve Steam Deck</strong> (SteamOS) — also runs on any Linux desktop
</p>

---

## 💡 Why This Exists

Playing Flyff Universe in a web browser on the Steam Deck is incredibly uncomfortable. The game requires a lot of keyboard keys for normal gameplay — buffs, heals, skill rotations — which is painful to manage with the virtual keyboard and without proper gamepad mapping.

I'm not a programmer, but with modern AI assistance (Claude), building something like this became possible. This wrapper solves the core problems:
- **Gamepad control** that actually works (WASD movement, camera on right stick, mapped skill keys)
- **Multiboxing** for running a second character (or player shop) in the background
- **Automation** for repetitive actions (buff rotations, heal macros) so you can focus on gameplay instead of spamming keys

What started as a personal Steam Deck quality-of-life project turned into a full-featured wrapper with quest guides, auto-heal, and even a virtual keyboard — all built iteratively with AI.

---

## ✨ Features at a Glance

- **Up to 4 accounts simultaneously** — Account 1 & 2 always loaded, Account 3 & 4 optional (e.g. player shop in background)
- **Auto-Heal/MP/FP** — Pixel-based or bar-scan monitoring with multiple thresholds per bar
- **Automation Engine** — Timed buff/heal rotations that run even on background accounts
- **Macro Buttons** — Toolbar buttons for full buff sequences (configurable key lists)
- **Follow + Board Hotkey** — Press one button to send Z + Alt+6 (for follow + mount) to any account
- **Gamepad Control** — Full Steam Deck layout with WASD movement, camera control (right stick while holding L2), and auto-targeting
- **Virtual Keyboard** — Built-in on-screen keyboard (F8 toggle) — no need to open Steam's overlay
- **Madrigal Guide** — 492 quests, 36 questlines, daily quests, with progress tracking and export/import
- **Quest Progress Export/Import** — Backup your quest data as JSON; survives AppImage updates

---

## 📥 Installation

### Steam Deck (One-Command Install)

Open Konsole (Desktop Mode) and run:
```bash
curl -L https://aimwald.github.io/sdf/install.sh | sh
```

Or with full GitHub URL:
```bash
curl -L https://github.com/AimWald/aimwald-sdf/raw/main/install.sh | sh
```

This will:
- Download the latest AppImage
- Install to `/home/deck/`
- Create launch script with proper environment variables
- Clean up old AppImage extracts

Then add `/home/deck/launch-sdf.sh` as a **Non-Steam Game** and launch from Game Mode.

**Optional: Add custom artwork to Steam Library**

Download artwork from the repo:
- **Grid** (Library): [steam-grid.png](https://github.com/AimWald/aimwald-sdf/raw/main/build/steam-grid.png) (460×215)
- **Hero** (Background): [steam-hero.png](https://github.com/AimWald/aimwald-sdf/raw/main/build/steam-hero.png) (1920×620)
- **Logo** (Overlay): [steam-logo.png](https://github.com/AimWald/aimwald-sdf/raw/main/build/steam-logo.png) (transparent)

Apply in Steam:
1. Right-click game → **Manage** → **Set custom artwork** (Grid)
2. Right-click game → **Manage** → **Set custom background** (Hero)
3. Right-click game → **Manage** → **Set custom logo** (Logo overlay)

### Manual Installation (Linux)

1. Download the latest `AimWald-SDF.AppImage` from [Releases](https://github.com/AimWald/aimwald-sdf/releases)
2. Make it executable: `chmod +x AimWald-SDF.AppImage`
3. Run: `./AimWald-SDF.AppImage`

### Manual Steam Deck Setup (Advanced)

1. Copy `AimWald-SDF.AppImage` to `/home/deck/`
2. Create a launch script `/home/deck/launch-sdf.sh`:

```bash
#!/bin/bash
# Clean up old extracted AppImage directories to free /tmp space
rm -rf /tmp/appimage_extracted_*

export ELECTRON_OZONE_PLATFORM_HINT=auto
export XMODIFIERS=""
export GTK_IM_MODULE=""
export QT_IM_MODULE=""

/home/deck/AimWald-SDF.AppImage --appimage-extract-and-run --disable-gpu-sandbox
```

3. Make it executable: `chmod +x /home/deck/launch-sdf.sh`
4. Add `/home/deck/launch-sdf.sh` as a **Non-Steam Game** in Steam
5. Launch from Game Mode

### Build from Source

```bash
git clone https://github.com/AimWald/aimwald-sdf.git
cd aimwald-sdf
npm install
npm start              # dev mode
npm run build          # builds dist/AimWald-SDF.AppImage
```

---

## 🎮 Multiboxing (Up to 4 Accounts)

### Account 1 & 2
- **Always loaded** — each has isolated cookies/login state
- Full automation support (buff/heal/macros)
- Switch with **F9** (configurable in Settings → Hotkeys)
- Cannot be closed

### Account 3 & 4
- **Optional** — open via `+ Acc3` / `+ Acc4` buttons in toolbar
- Ideal for player shops running in background
- **Switch-only** — no automation buttons (just account switching)
- Close via `✕ Acc3` / `✕ Acc4` buttons

Only one account is visible at a time. Inactive accounts keep running in the background — automation continues.

---

## 💊 Auto-Heal / MP / FP

Automatically presses configured keys when HP/MP/FP drops below thresholds. Runs on **background accounts** too (no need to keep them visible).

### Setup

1. **Settings → Auto-Heal** tab
2. Choose **Bar** or **Pixel** mode for each bar (HP, MP, FP)

### Bar Mode (recommended)
- Make bars **completely full**
- Click **📐** next to the bar
- Drag-select the bar area in the screenshot
- App calibrates left/right edges automatically
- Add actions: Key + Threshold % (e.g. Key `1` at `< 50%`)
- Multiple actions per bar supported (e.g. heal at 50%, emergency heal at 20%)

### Pixel Mode
- Make bar **completely full**
- Switch dropdown to **Pixel**, click **📍**
- Click once on the bar at your desired threshold position
- Add action: Key + Threshold ratio (50 = safe default)

### Test
Press **🔍** to test current reading without waiting for the heal cycle.

---

## ⚙️ Automation (Buff / Heal Timers)

Sends keypresses at fixed intervals — runs even when the account is in the background.

### Setup
1. **Settings → Automation** tab
2. Per account: Label, Key (1–0, F1–F12), Interval (ms), Enable checkbox
3. `+ Add action` to add more, `✕` to remove
4. **💾 Save** — running automations restart immediately

### Control
- **Toolbar:** `▶ Acc1` / `■ Acc1` and `▶ Acc2` / `■ Acc2`
- **Hotkey:** **F10** (configurable) toggles automation for the active account
- Green toolbar buttons = automation running

**Default actions (disabled by default):**
| Label | Key | Interval |
|-------|-----|----------|
| Heal | 1 | 3,000 ms |
| Buff 1 | 2 | 30,000 ms |
| Buff 2 | 3 | 30,000 ms |

---

## 🚢 Follow + Board Hotkey

Sends **Z** (follow) + **Alt+6** (board) in sequence.

### Usage
- **Hotkey:** `,` (comma, configurable in Settings → Hotkeys) — sends to **active account**
- **Toolbar buttons:** `⛵ Acc1` and `⛵ Acc2` — send to **specific account** (even if in background)

Example: You're on Acc1, press the `⛵ Acc2` button → Acc2 executes follow+board in the background without switching views.

---

## 🛡️ Anti-Detection (Randomized Timing)

All automation intervals include **±10% random variation** to avoid constant timing patterns that might trigger anti-cheat detection. This makes automated actions appear more human-like.

**Example:**
- You set interval: `2000 ms`
- Actual interval: randomly varies between `1800–2200 ms` each execution

**Applies to:**
- **Automation timers** (buff/heal rotations)
- **Auto-Heal polling** (HP/MP/FP check intervals)
- **Macro key delays**

No configuration needed — randomization is built-in and automatic.

---

## 🎮 Gamepad Support (Steam Deck)

### Default Button Layout

| Button | Action |
|--------|--------|
| A (0) | Left click (attack / select) |
| B (1) | `.` — Clear target |
| X (2) | Key `3` |
| Y (3) | Space (Jump) |
| L1 (4) | Key `1` (Heal) |
| R1 (5) | Key `2` (Buff) |
| L2 (6) | Right click hold (for camera drag — not needed with right-stick arrow keys) |
| R2 (7) | Key `4` |
| Back (8) | Escape |
| Start (9) | M (Map) |
| D-Pad ↑ (12) | Scroll in (zoom) |
| D-Pad ↓ (13) | Scroll out (zoom) |
| D-Pad → (15) | Tab (switch skill bar) |

### Sticks
- **Left stick:** WASD movement (hysteresis: press at 0.40, release at 0.20 to prevent jitter)
- **Right stick:** Arrow keys (camera control) — mapped to ↑↓←→ for smooth in-game camera rotation

No L2-hold required for camera anymore.

### Auto-Targeting
Assign `__TARGET` to any button in **Settings → Controller**. When pressed, a spiral cursor sweeps from screen center and clicks the first hovered target. Configure search radius in **Settings → Controller → Auto-Target**.

### Customization
All 20 buttons (0–19) are remappable in **Settings → Controller**.

---

## 🎹 Virtual Keyboard

Built-in on-screen keyboard overlay — no need for Steam's sidebar.

- **Toggle:** Press **F8** or click **🔤** in toolbar
- Sends keys directly to the active game view
- Stays open when you click between chat fields (unlike Steam keyboard)
- Includes: QWERTY layout + numbers + Backspace/Enter/Space

---

## 🗺️ Madrigal Guide

Click **📖 Guide** in the toolbar to open the in-app overlay.

### Quests Tab
- **492 quests** (Lv. 1–183) sourced from NaviKnight2765's spreadsheet
- Columns: Level, Questline, Name, Recommendation, Exp, Difficulty, Items, Monsters, Inventory slots, Rewards, Notes
- **Filter bar:** Open / Done / Skipped / All (default: Open)
- **Status tracking:** Radio buttons per quest — Open (○), Done (✓), or Skipped (⊗)
- **Live search** across all fields
- Click quest name → opens Flyffipedia detail page

### Questlines Tab
- **36 questlines** with start NPC, location, level range
- **Green progress bar:** quests completed (excludes skipped)
- **Orange bar:** inventory slots unlocked so far
- Click row → filters Quests tab to that questline

### Dailies Tab
- **Forsaken Tower** (Lv. 86–152) and **Kaillun** (Lv. 162–172)
- **Your Level** input: filters to quests at or below your level
- Columns: Level, Name, Exp, Monsters to kill, Penya

### Monsters Tab
- Quick reference grid for 53 monsters

### Export / Import Progress
- **📤 Export Progress** → saves quest data as JSON file (backup before updates)
- **📥 Import Progress** → restores from backup
- Your progress is stored in `~/.config/flyff-wrapper/` and survives AppImage updates

---

## 🔘 Macro Buttons

Macros fire key sequences with configurable delays. Each macro becomes a toolbar button.

**Default macros:**
- **Full Buff Acc1** — `F2, 1, 2, 3, 4, 5, 6, 7, 8, 9, F1` with 200ms delay
- **Full Buff Acc2** — same sequence for Acc2

### Setup
1. **Settings → Macros** — Label, Account (1–4), Keys (comma-separated), Delay (ms)
2. `+ Add macro` / `✕` to manage
3. **💾 Save** — button appears immediately in toolbar

Automation on the target account pauses during macro execution and resumes after.

---

## ⌨️ Hotkeys

| Key | Action | Configurable |
|-----|--------|:---:|
| **F9** | Switch active account | ✅ |
| **F10** | Toggle automation on active account | ✅ |
| **`,`** | Follow + Board (Z + Alt+6) on active account | ✅ |
| **F8** | Toggle virtual keyboard | ❌ |
| **F11** | Toggle fullscreen | ❌ |

Change configurable hotkeys in **Settings → Hotkeys**.

---

## ⚙️ Settings Overview

Open with **⚙ Settings** in the toolbar.

| Tab | What it does |
|-----|-------------|
| **Automation** | Per-account buff/heal action lists (key + interval + enable) |
| **Controller** | Gamepad button mapping (0–19), auto-target radius |
| **Accounts** | Reset session per account (clear cookies / force re-login) |
| **Hotkeys** | Account switch, automation toggle, follow+board |
| **Macros** | Toolbar macro buttons (key sequences) |
| **Auto-Heal** | HP/MP/FP monitoring — Bar or Pixel mode per bar |

Click **💾 Save** to apply. Running automations restart immediately — no app restart needed.

---

## 📦 AppImage Updates

All user data is stored in `~/.config/flyff-wrapper/`:
- Automation config
- Gamepad config
- Macros
- Auto-Heal calibration
- Quest progress

**AppImage updates do NOT overwrite your settings.** Just replace the `.AppImage` file and re-run.

Use **Export Progress** in the Guide for an extra backup before updating.

---

## 🛠️ Development

```bash
git clone https://github.com/AimWald/aimwald-sdf.git
cd aimwald-sdf
npm install
npm start              # dev mode (Electron + devtools)
npm run build          # builds dist/AimWald-SDF.AppImage
```

Deploy to Steam Deck:
```bash
scp dist/AimWald-SDF.AppImage deck@<deck-ip>:/home/deck/
# Or run the installer again to update
```

---

## 🙏 Credits

**Quest data** (492 quests, 36 questlines, difficulty ratings, recommendations, inventory slot tracking) sourced from the spreadsheet by **NaviKnight2765**:
- Reddit: [u/NaviKnight2765](https://www.reddit.com/user/NaviKnight2765/)
- Original post: [I made a spreadsheet with detailed info about all quests and drops](https://www.reddit.com/r/FlyffUniverse/comments/1k0n6mo/i_made_a_spreadsheet_with_detailed_info_about_all/)

**Auto-targeting spiral search** inspired by [Ariorh1337/flyff_bot](https://github.com/Ariorh1337/flyff_bot).

---

## ⚠️ Disclaimer

This project is an **independent, community-driven wrapper** for Flyff Universe and is **not affiliated with, endorsed by, or sponsored by Gala Lab Corp., Galanet, or any official Flyff developers**.

- **Flyff Universe** is a trademark of Gala Lab Corp.
- This wrapper is provided **as-is** for educational and personal use.
- Use at your own risk. The author is not responsible for any consequences of using this software, including potential violations of Flyff Universe's Terms of Service.
- **Automation features** (auto-heal, buff timers) may be against the game's Terms of Service. Use responsibly and at your own discretion.

**Support the official game:**  
If you enjoy Flyff Universe, consider supporting the developers by purchasing in-game items or subscribing to premium services at [universe.flyff.com](https://universe.flyff.com).

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 🐛 Issues & Feedback

Report bugs or request features at [github.com/AimWald/aimwald-sdf/issues](https://github.com/AimWald/aimwald-sdf/issues)

---

## 💬 About the Name

**AimWald-SDF** = **S**team**D**eck**F**lyff by AimWald

The project started as a personal quality-of-life wrapper for playing Flyff Universe on the Steam Deck, where the web browser experience is uncomfortable and lacks proper gamepad support. With modern AI assistance (Claude), what began as a simple fix turned into a full-featured multiboxing wrapper with automation, quest guides, and more.
