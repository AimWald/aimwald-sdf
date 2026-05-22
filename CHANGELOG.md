# Changelog

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

