# Changelog

## v1.64.0 (2026-05-29)

### Features
- **Guide Monsters:** Reworked the monster guide into a multi-column layout that reads left-to-right by level instead of filling one column top-to-bottom first
- **Guide Monsters:** Added local element icon assets plus weak/strong matchup indicators directly inside each monster entry
- **Guide Monsters:** Added Flyff API monster portraits in the guide for monsters that expose an API icon filename
- **Build:** Added dedicated `build:linux` and `build:win` scripts for release packaging

### Bug Fixes
- **Macros:** Macro sequences now accept comma as an actual key and support modifier combinations like `Ctrl+1`, `Alt+1`, and `Control+F2`
- **Guide Monsters:** Weak-to and strong-against are now derived from Flyff API resistance values instead of a simplified hard-coded guess
- **Guide Monsters:** Cached monster fallback data is normalized into the same richer guide format as live API data

## v1.63.0 (2026-05-28)

### Features
- **Follow + Board:** Added configurable follow/board button bindings in Settings instead of hard-wiring `Z` and `Alt+6`
- **Guide Monsters:** The monster guide now loads the full Flyff monster list from the official API and caches it locally as fallback

### Bug Fixes
- **Macros:** Fixed comma input in macro key sequences by suspending global shortcuts while the Settings window is focused
- **Guide Monsters:** Corrected monster levels by using API `level` data instead of the old simplified bundled list

## v1.62.0 (2026-05-22)

### Features
- **Macros:** Expanded fullbuff sequence to include '0' key and F1 (full sequence: F2, 1-9, 0, F1)
- **UI Simplification:** All interval/delay settings now use **seconds** instead of milliseconds for better user experience

### Bug Fixes
- **Gamepad:** Fixed configuration loading to properly merge bundled defaults with user settings — buttons are now pre-configured on first launch
- **Settings:** Disabled sandbox mode to fix dropdown menu flickering on Wayland/SteamOS
- **Config Merge:** Improved merge logic to preserve bundled defaults when user config keys are empty

### Changes
- **Automation:** Interval field now accepts seconds (e.g., "3" instead of "3000") with 0.1sec precision
- **Macros:** Delay field now accepts seconds (default: 2sec) with 0.1sec precision  
- **AutoHeal:** Interval field now accepts seconds (default: 0.5sec for HP, 1sec for MP/FP) with 0.1sec precision
- **Gamepad Settings:** Removed Back Buttons (L4/R4/L5/R5) from UI — configure these in Steam Controller settings instead
- **Virtual Keyboard:** Removed entirely (was not functional/usable)
- All timing configs maintain backward compatibility with old ms-based values

## v1.61.0 (2026-05-22)

### Bug Fixes
- **Quest Guide:** Removed unnecessary "Open" radio button — now shows only "Done" (✓) and "Skip" (⊗) checkboxes
- **Virtual Keyboard:** Removed F8 hotkey (conflicted with in-game Action Bar 8) — use 🔤 toolbar button instead
- **Hotkeys:** Clarified that wrapper hotkeys (F9/F10) are captured globally and won't reach the game

### Documentation
- Added CRITICAL touchscreen setup instructions for Steam Deck
- Added CRITICAL in-game keybind requirement (Clear Target = `.`)
- Added comprehensive risk warnings for automation features
- Clarified two-layer controller configuration (In-App vs Steam)
- Added recommended Steam Controller setup (back buttons, D-Pad, trackpad)

---

## v1.60.0 (Previous)

### Features
- Anti-detection: ±10% random variation for automation intervals
- Multi-instance support (up to 4 accounts)
- Quest progress improvements
- Virtual keyboard improvements
