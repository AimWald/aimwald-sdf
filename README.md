# Flyff Universe Electron Wrapper

An Electron-based desktop wrapper for [Flyff Universe](https://universe.flyff.com), built and optimized for the **Valve Steam Deck** (1280×800, SteamOS). Also runs on any Linux desktop.

Supports **two accounts simultaneously**, a full **automation engine** (Auto-Heal, Buff, Macros), **gamepad control**, and an **in-app Madrigal Guide** with quests, questlines, and daily quest data.

---

## Table of Contents

1. [Installation](#installation)
2. [Steam Deck Setup](#steam-deck-setup)
3. [Multiboxing](#multiboxing)
4. [Auto-Heal](#auto-heal)
5. [Automation (Buff / Heal Timer)](#automation-buff--heal-timer)
6. [Macro Buttons](#macro-buttons)
7. [Gamepad Support](#gamepad-support)
8. [Madrigal Guide](#madrigal-guide)
9. [Hotkeys](#hotkeys)
10. [Settings Overview](#settings-overview)
11. [Development](#development)
12. [Credits](#credits)

---

## Installation

### Prerequisites
- [Node.js](https://nodejs.org/) v18+
- npm

### Run in dev mode
```bash
git clone https://github.com/Evaldazz/flyff-wrapper.git
cd flyff-wrapper
npm install
npm start
```

### Build AppImage (Linux)
```bash
npm run build
# Output: dist/FlyffWrapper.AppImage
```

---

## Steam Deck Setup

1. Copy `FlyffWrapper.AppImage` to `/home/deck/`
2. Create a launch script `/home/deck/launch-flyff.sh`:

```bash
#!/bin/bash
# Clean up old extracted AppImage directories to free /tmp space
rm -rf /tmp/appimage_extracted_*

export ELECTRON_OZONE_PLATFORM_HINT=auto
export XMODIFIERS=""
export GTK_IM_MODULE=""
export QT_IM_MODULE=""

/home/deck/FlyffWrapper.AppImage --appimage-extract-and-run --disable-gpu-sandbox
```

3. Make it executable: `chmod +x /home/deck/launch-flyff.sh`
4. Add it as a Non-Steam Game in Steam and launch from Game Mode.

The Steam virtual keyboard works in chat and text inputs. Camera control requires holding **L2** while moving the right stick.

---

## Multiboxing

The wrapper runs **two fully isolated game sessions** side by side:

- Account 1 and Account 2 each have separate cookies, LocalStorage, and login state — they never interfere.
- Only one account is visible at a time. The inactive account keeps running in the background (automation continues).
- Switch between accounts with **F9** (configurable in Settings → Hotkeys).
- The active account is highlighted in the toolbar (`1` / `2` buttons).
- To reset / log out an account: **Settings → Accounts → Reset Account 1/2**.

---

## Auto-Heal

Automatically presses a key when HP, MP, or FP drops below a configured threshold. Works on the **active (visible)** account.

Each bar (HP / MP / FP) can be monitored independently, with multiple actions per bar — for example Key `1` at 50% HP and Key `9` at 20% HP as an emergency backup.

### Bar Mode — drag-select the bar area

Best for exact percentages and multiple thresholds.

1. Open **Settings → Auto-Heal**.
2. Make sure your bars are **completely full**.
3. Leave the dropdown on **Bar** and click **📐**.
4. A fullscreen screenshot of the game appears — **click and drag** across the bar to select it.
5. The area and calibration data are saved automatically.
6. Enable the bar with the checkbox, add actions (key + threshold %), set the polling interval, and click **💾 Save**.

### Pixel Mode — single-click calibration

Simpler setup, no need to precisely frame the bar. Based on the same single-pixel color sampling technique used by other Flyff bots.

1. Make sure HP is **completely full**.
2. Switch the dropdown to **Pixel** and click **📍**.
3. Click once on the bar **at the threshold position** — for example, at roughly 40% of the bar width if you want to trigger at 40% HP.
4. The reference color is captured automatically from the game view.
5. Add an action — a threshold of `50` means "fire when the pixel's color channel drops to less than 50% of its calibration value".

> In Pixel mode the `< %` threshold is a ratio of the reference color channel (R for HP, B for MP, G for FP), not an exact HP percentage. 50 is a safe default for most cases.

### Test button (🔍)
Press **🔍** next to any bar to measure the current value and verify calibration without waiting for the next auto-heal cycle.

---

## Automation (Buff / Heal Timer)

The automation engine sends keypresses at fixed intervals. It runs even on the **background (invisible) account**, making it ideal for keeping buffs up on a second character.

### Setup
1. **Settings → Automation**
2. Configure per account: Label, Key (1–0, F1–F12), Interval in milliseconds, and an enable/disable toggle.
3. Click `+ Add action` to add more entries, `✕` to remove.
4. **💾 Save** — running automations restart immediately with the new config (no app restart needed).

### Start / Stop
- **Toolbar:** `▶ Acc1` / `■ Acc1` and `▶ Acc2` / `■ Acc2`
- **Hotkey:** **F10** (configurable) toggles automation on the currently active account.
- Running automations are shown with green toolbar buttons.

**Default actions (disabled by default):**
| Label | Key | Interval |
|-------|-----|----------|
| Heal | 1 | 3 000 ms |
| Buff 1 | 2 | 30 000 ms |
| Buff 2 | 3 | 30 000 ms |

---

## Macro Buttons

A macro fires a sequence of keypresses (e.g. a full buff rotation) with a configurable delay between each key. Each macro becomes a button in the toolbar.

**Default macros:**
- **Full Buff Acc1** — `F2, 1, 2, 3, 4, 5, 6, 7, 8, 9, F1` with 200 ms between keys
- **Full Buff Acc2** — same sequence for Account 2

Automation on the target account is automatically paused during macro execution and resumed afterwards.

### Setup
1. **Settings → Macros** — Label, Account (1 or 2), Keys (comma-separated), Delay (ms).
2. `+ Add macro` / `✕` to add or remove.
3. **💾 Save** — the toolbar button appears immediately.

---

## Gamepad Support

### Default Steam Deck Layout

| Button | Action |
|--------|--------|
| A (0) | Left click (attack / select) |
| B (1) | `.` — Clear target |
| X (2) | Key `3` |
| Y (3) | Space (Jump) |
| L1 (4) | Key `1` (Heal) |
| R1 (5) | Key `2` (Buff) |
| **L2 (6)** | **Hold for camera** — right stick becomes mouse while held |
| R2 (7) | Key `4` |
| Back (8) | Escape |
| Start (9) | M (Map) |
| D-Pad ↑ (12) | Scroll in (zoom) |
| D-Pad ↓ (13) | Scroll out (zoom) |
| D-Pad → (15) | Tab (switch skill bar) |

### Sticks

| Stick | Function |
|-------|----------|
| Left stick | WASD movement |
| Right stick | Mouse / camera — **only while L2 is held**, to prevent accidental camera drift |

Releasing L2 automatically resets the virtual cursor to the screen center and cancels any queued mouse movement.

### Auto-Targeting

Assign `__TARGET` to any button in **Settings → Controller**. When pressed, a spiral cursor sweeps outward from the screen center and clicks the first hovered target automatically. Configure the search radius in **Settings → Controller → Auto-Target**.

### Customization

All 20 buttons (0–19) are fully remappable in **Settings → Controller → Button Mapping**. Available actions include individual keys, left/right click, scroll up/down, and `__TARGET`.

---

## Madrigal Guide

Click **📖 Guide** in the toolbar to open the in-app overlay. The game view is hidden while the guide is open and restores when it is closed.

### Quests tab
- **492 quests** (Lv. 1–183) sourced from NaviKnight2765's spreadsheet.
- Columns: Level, Questline, Name, Recommendation, Exp, Difficulty, Items needed, Monsters to kill, Inventory slots unlocked, Rewards, Notes.
- **Filter bar:** Open / Done / All — default shows only open quests.
- **Live search** across name, questline, items, monsters, rewards, and notes.
- **Done checkbox** per quest — saved persistently across sessions.
- Clicking a quest name opens the Flyffipedia detail page in a separate window.

### Questlines tab
- **36 questlines** with start NPC, location, and level range.
- **Green bar:** quests completed (X/Y, from your Done checkboxes).
- **Orange bar:** inventory slots unlocked so far vs. total available in the questline.
- Click a questline row to filter the Quests tab to that questline.

### Dailies tab
- **Forsaken Tower** (Lv. 86–152) and **Kaillun** (Lv. 162–172) daily quests.
- **Your Level** input — type your level to hide quests above it.
- Columns: Level, Quest name, Exp, Monsters to kill, Penya reward.

### Monsters tab
- Quick reference grid for 53 monster entries.

---

## Hotkeys

| Key | Action | Configurable |
|-----|--------|:---:|
| **F9** | Switch active account | ✅ |
| **F10** | Toggle automation on active account | ✅ |
| **F11** | Toggle fullscreen | ❌ |

Change F9 and F10 in **Settings → Hotkeys**.

---

## Settings Overview

Open with **⚙ Settings** in the toolbar.

| Tab | What it does |
|-----|-------------|
| **Automation** | Per-account buff/heal action lists |
| **Controller** | Gamepad button mapping, auto-target radius |
| **Accounts** | Reset session (clear cookies / re-login) per account |
| **Hotkeys** | Account switch key, automation toggle key |
| **Macros** | Toolbar macro buttons (key sequences) |
| **Auto-Heal** | HP/MP/FP monitoring — Bar mode or Pixel mode per bar |
| **Memory** | Advanced: WASM heap scanner and JS object scanner for reading HP directly from game memory instead of pixel capture |

Click **💾 Save** to apply changes. Automation restarts immediately — no app restart needed.

---

## Development

```bash
npm install
npm start           # dev mode
npm run build       # build AppImage (output: dist/FlyffWrapper.AppImage)
```

Deploy to Steam Deck:
```bash
scp dist/FlyffWrapper.AppImage deck@<deck-ip>:/home/deck/
```

---

## Credits

**Quest data** (492 quests, 36 questlines, daily quests, difficulty ratings, recommendations, inventory slot tracking) — sourced from the spreadsheet by **NaviKnight2765**:

- Reddit: [u/NaviKnight2765](https://www.reddit.com/user/NaviKnight2765/)
- Original post: [I made a spreadsheet with detailed info about all quests and drops](https://www.reddit.com/r/FlyffUniverse/comments/1k0n6mo/i_made_a_spreadsheet_with_detailed_info_about_all/)

**Auto-targeting spiral search** — inspired by [Ariorh1337/flyff_bot](https://github.com/Ariorh1337/flyff_bot).
