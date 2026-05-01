# Changelog

## [1.48.0] – 2026-05-01
### Changed
- **Auto-Heal: OCR-primary, color-fallback** — each bar loop now reads numerical values (e.g. "386/386") via Tesseract.js first; color bar-fill scan is used only when OCR returns no result. OCR bounds are clamped to ≤ 100% to prevent garbage reads (e.g. misread "11339%") from triggering false heals.

## [1.47.2] – 2026-05-01
### Fixed
- **DPI Scaling (Scale Factor)**: Implemented automatic coordinate translation between logical and physical pixels. Selection boxes are now correctly mapped on high-DPI displays (like Steam Deck).
- **Picker Alignment**: The selection window is now perfectly centered over the game view, eliminating the 30px vertical offset from the toolbar.
- **Strict Color Checks**: Refined bar detection to require significant color dominance, effectively ignoring UI labels and borders.

## [1.47.1] – 2026-05-01
### Added
- **Horizontal Auto-Alignment**: The system now automatically detects the left and right edges of colored bars, clipping away labels ("HP/MP") to focus OCR only on numbers.
- **Adaptive OCR Binarization**: OCR now cycles through multiple contrast thresholds to find the best readability for varying game backgrounds.
- **3x OCR Scaling**: Increased image upscaling to 3x for improved character recognition on small bar fonts.
- **Robust Parsing**: Added support for misread slashes (e.g., '7', '|', 'I') in the numerical regex parser.

## [1.47.0] – 2026-05-01
### Added
- **OCR-First Auto-Heal**: The system now prioritizes reading numerical values (e.g., "386 / 386") and percentages directly from the bars using Tesseract.js. This provides much higher precision for bars with text overlays.
- **Improved Fallback**: Color-based scanning remains as a robust fallback if OCR fails to read a value.
- **Dynamic OCR Processing**: Real-time image pre-processing to isolate white text from colored backgrounds for optimal Tesseract recognition.

## [1.46.2] – 2026-05-01
### Fixed
- **Background Auto-Heal**: Hidden accounts now keep rendering off-screen, ensuring `capturePage` receives fresh frames even when an account is in the background.
- **Improved Detection Thresholds**: Increased brightness and saturation requirements to better distinguish the active bar fill from dark UI backgrounds, preventing values from getting "stuck" at 100%.
- **Background Throttling**: Disabled Electron's background throttling for game views to ensure consistent timer execution for automation.

## [1.46.1] – 2026-05-01
### Fixed
- **Bar-Fill Precision**: Reduced scanning margins to 1px, allowing for reliable 100% detection.
- **False-Positive Protection**: Implemented a double-check for 0% readings (waits 100ms and re-captures) to prevent "phantom" key presses caused by UI flickers or transient capture errors.
- **Improved Sensitivity**: Lowered color saturation/brightness thresholds to better detect dark bar colors.

## [1.46.0] – 2026-05-01
### Added
- **Multi-Bar Auto-Heal**: Support for HP, MP, and FP bars simultaneously. Each bar can have its own enable toggle, hotkey, threshold %, and check interval.
- **Auto-Detection**: The status window picker now automatically detects individual HP, MP, and FP bars by color signature within the selected status area.
- **Enhanced Pixel Analysis**: Improved bar-fill scanning that skips white text pixels (labels) to find the correct fill edge reliably even when text is overlapping the bar.
- **OCR Support**: Integrated Tesseract.js (Experimental) to optionally read numerical values ("386/386") or percentages from bars for higher precision.
### Changed
- **Auto-Heal Config**: Schema in `autoheal.json` updated to a per-bar structure; settings UI updated with a multi-row table per account.

## [1.45.0] – 2026-05-01
### Changed
- **Auto-Heal: bar-fill scan instead of OCR** — scans the middle row of the selected HP bar rect from right to left for the fill edge; works for any bar color (red, blue, green); no tesseract overhead, interval down to 200 ms minimum.
- **HP picker: screenshot background** — picker window now captures a screenshot of the game view and displays it as background instead of using compositor transparency. Works in Gamescope (Steam Deck Gaming Mode) where transparent windows show a black screen.

## [1.44.0] – 2026-04-30
### Added
- **HP-based Auto-Heal**: Settings → Auto-Heal tab — configurable per account (enable, heal key, HP threshold %, check interval ms). Uses `capturePage` on the configured HP bar area to count red pixels and estimate HP%.
- **HP bar picker**: "📐 Pick" button opens a transparent snipping-tool-style overlay over the game view; click and drag to select the HP bar area, coordinates are saved automatically.
- **HP test**: "🔍 Test" button captures the HP bar once and displays the estimated HP% in settings (useful for calibrating the threshold).
- Feature can be disabled independently per account — recommended off on Steam Deck to avoid stutter; use timed Automation for background-account healing.

## [1.43.0] – 2026-04-30
### Added
- **Dailies level filter**: "Your Level" input in the Dailies tab — shows only daily quests at or below the entered level. Forsaken Tower quests start at Lv. 86, Kaillun at Lv. 162. Empty field shows all quests.

## [1.42.0] – 2026-04-30
### Added
- **Quest filter bar**: Open / Done / All toggle in the Guide Quests tab. Default is "Open" — completed quests are hidden by default. Quest count shown above the table.
### Fixed
- **Quest detail window close button**: A floating "✕ Close" red button is now injected into every page loaded in the quest detail window (including when navigating within the site). Works in Gamescope where window decorations are absent.
### Changed
- Quest table font size increased from 10px to 13px for readability on Steam Deck; table is now horizontally scrollable if needed.

## [1.41.0] – 2026-04-29
### Added
- **Questlines tab** in the Guide: all 36 questlines from the spreadsheet with progress bars (quests completed / total), inventory slots unlocked vs. still available — computed live from your Done checkboxes. Clicking a questline row filters the Quests tab by that questline.
- **Dailies tab** in the Guide: Forsaken Tower daily quests (Lv. 86–152) and Kaillun daily quests (Lv. 162–172) with exp, monsters to kill, and penya reward.
- `config/questlines.json` (36 entries) and `config/dailies.json` (39 entries) added to AppImage bundle.
### Changed
- Quest table font size increased from 9px to 10px, padding increased — entries are more readable and long text wraps to multiple lines.

## [1.39.0] – 2026-04-29
### Added
- **Quest links**: All 492 quest names are now clickable and open the flyffipedia.com detail page in a separate, movable window. URLs extracted from the NaviKnight2765 spreadsheet XLSX hyperlinks.

## [1.38.0] – 2026-04-29
### Fixed
- **Notes column alignment**: Notes text is now clamped to 2 lines via a wrapper div with `-webkit-line-clamp`; row heights stay consistent regardless of note length. Full text appears as a tooltip on hover.

## [1.37.0] – 2026-04-29
### Fixed
- **Account switch while guide is open**: Pressing F9 no longer makes the game view appear over the guide overlay. An `overlayOpen` flag in `main.js` ensures `updateViewBounds()` keeps the view hidden until all overlays are closed.
- **URL protocol guard**: `openQuestUrl()` now rejects any URL that does not start with `http://` or `https://`.

## [1.36.0] – 2026-04-29
### Added
- **Complete quest database**: 492 quests (Lv. 1–183) imported from NaviKnight2765's spreadsheet (previously 5 placeholders).
- New columns: **Items**, **Monsters**, **Notes** — 1:1 data from the spreadsheet.
- Color-coded recommendation labels: Prioritize (green), Mandatory (yellow), Skip (grey).
- Extended difficulty colors: Hard / Very Hard / Extreme / Impossible each have distinct colors.
- Search now also covers Items, Rewards, and Notes fields.
### Fixed
- Crash in search when `questline` was empty (added null-check).
- Quest IDs containing apostrophes (e.g. "Vagrant's Journey") no longer break the `onchange` handler.

## [1.35.0] – 2026-04-29
### Added
- **Quest detail window**: Clicking a quest name in the Guide opens the full wiki/database description in a separate window that can be moved and closed independently.

## [1.34.0] – 2026-04-29
### Added
- **Extended guide data**: All available columns from the spreadsheet integrated.
- New columns: **NPC / Location** (who starts the quest and where) and **Inventory Slots**.
- Extended search: now also finds quests by NPC name or location.
- Optimized layout for 800p display.

## [1.33.0] – 2026-04-29
### Fixed
- **Overlay visibility**: Guide and Changelog are now correctly displayed above the game view. The game view is automatically hidden while any overlay is open.

## [1.32.0] – 2026-04-29
### Added
- **Quest progress tracking**: "Done" checkboxes for each quest in the Guide.
- Progress is saved persistently in `electron-store` and restored on next launch.
- Completed quests are visually dimmed and struck through.

## [1.31.0] – 2026-04-29
### Added
- **Full data integration**: All 11 columns from the quest spreadsheet added to the Guide.
- New columns: Recommendation, XP details (Exp, Exp2, Experience), Difficulty, Items, Monsters, Notable Rewards.
- Optimized layout for 800p; compact XP summary and smart column widths.
- Search now also covers quest monsters.

## [1.30.0] – 2026-04-29
### Added
- **Madrigal Guide**: In-app guide overlay (📖 Guide button in toolbar) with quest and monster data.

## [1.29.0] – 2026-04-29
### Added
- Initial monster list support (preparation for Madrigal Guide).
- README.md created with credits for NaviKnight2765 (monster/quest data source).

## [1.28.0] – 2026-04-29
### Added
- **Macro buttons** in the toolbar: configurable key sequences (e.g. Full Buff) executed with a single button press.
- Defaults: "Full Buff Acc1" and "Full Buff Acc2" (F2, 1–9, F1 with 200 ms delay).
- Automation is automatically paused during macro execution and resumed afterwards.
- Settings → Macros tab: configure label, account, keys (comma-separated), delay; add/remove macros dynamically.

## [1.27.0] – 2026-04-28
### Fixed
- Removed 80 ms hold and `focus()` from the regular `sendInputEvent` path — normal keys (I, 1, 2, M, …) are sent immediately; the hold remains only in the CDP path (Space/J).

## [1.26.0] – 2026-04-28
### Fixed
- Jump (Space/J): CDP key now holds 80 ms between `rawKeyDown` and `keyUp` — the game polls input via rAF (~16 ms), so a `keyUp` in the same tick meant the key was never registered as pressed.
- All other buttons: `view.webContents.focus()` + 80 ms hold before `sendInputEvent` — prevents events being silently dropped without an active view focus.
- Added J to `CDP_KEYS` (in case Jump is rebound to J in Flyff).

## [1.25.0] – 2026-04-28
### Fixed
- Jump (Space): switched to CDP `Input.dispatchKeyEvent` instead of `dispatchEvent`/`sendInputEvent` — sets all fields correctly (`code:'Space'`, `key:' '`, `text:' '`, `windowsVirtualKeyCode:32`, `isTrusted:true`), identical to a real OS keypress.

## [1.24.0] – 2026-04-28
### Fixed
- Jump (Space): changed dispatch target from `document` to `canvas` (fallback: `body`) — DOM events bubble upward (canvas→body→document→window), not downward; dispatching on `document` never reached canvas-level listeners.

## [1.23.0] – 2026-04-28
### Fixed
- Jump (Space): `sendInputEvent` does not reliably set `event.code` for Space — Space button now uses `executeJavaScript` + `dispatchEvent` with explicit `code:'Space'`, `key:' '`, `keyCode:32`.

## [1.22.0] – 2026-04-28
### Fixed
- Jump (Space) via controller: `char` event is now sent in addition to `keyDown`/`keyUp` — Flyff evaluates `keypress` for Jump, which `keyDown` alone did not trigger.
### Changed
- Auto-target spiral search ~3.5× faster: STEP 0.18→0.35, TIGHTNESS 4→6 (37 px spacing), TICK_MS 20→16 — scan to 300 px radius now takes ~2.3 s instead of ~8.3 s.

## [1.21.0] – 2026-04-28
### Changed
- UI fully translated to English (toolbar tooltips, settings labels, button names, dropdown options).

## [1.20.0] – 2026-04-28
### Fixed
- Space (Jump) and Enter now work correctly via controller: `sendInputEvent` expects `' '` and `'\r'`, not the accelerator names `'Space'`/`'Return'`.

## [1.19.0] – 2026-04-28
### Fixed
- Double key inputs (Settings + webpage): `XMODIFIERS=""`, `GTK_IM_MODULE=""`, `QT_IM_MODULE=""` added to launch script — disables IBus/Fcitx input method that duplicated keystrokes under Wayland.
- Removed `before-input-event` fallback entirely — was unreliable on Wayland and contributed to double inputs.
### Removed
- Auto-fill credentials (username/password) removed from Settings — login is handled via Google on the website.

## [1.18.0] – 2026-04-28
### Added
- Settings → Accounts: "Reset Session" buttons per account — clears cookies and stored login data for the partition and reloads the page.

## [1.17.0] – 2026-04-28
### Fixed
- Fixed double key inputs when typing: `before-input-event` fallback now only forwards keys if the game view is not already focused (`isFocused()` check).

## [1.16.0] – 2026-04-28
### Fixed
- Gamepad button mapping is now updated live when Settings are saved — no app restart required for new assignments to take effect.

## [1.15.0] – 2026-04-28
### Changed
- Controller tab now shows buttons 0–19 (previously 0–15) — back buttons L4/R4/L5/R5 (index 16–19) are assignable if Steam Input passes them through.

## [1.14.0] – 2026-04-28
### Added
- Auto-targeting via spiral search: `__TARGET` as a new gamepad action — moves the cursor spirally from screen center and clicks when the game signals a target (cursor style change).
- Configurable spiral radius (px) in Settings → Controller tab.
- Changelog button in toolbar (📋) opens an overlay with version history.

## [1.13.0] – 2026-04-28
### Added
- Automation actions can now be added (`+ Add action`) and removed (`✕`) dynamically — no fixed limit of 8 entries.
- Live-save: changes to automation actions (label, key, interval, checkbox, add, delete) are saved immediately and running automations are restarted without an app restart.

## [1.12.0] – 2026-04-28
### Fixed
- Right stick now only moves the mouse when L2 (`__RHOLD`) is held — prevents invisible cursor drift without active camera rotation.

## [1.11.0] – 2026-04-28
### Fixed
- Removed 200 ms focus-keeper — was the cause of app-wide double inputs (every key was sent twice).
- Removed `webContents.focus()` from the gamepad keydown handler — second source of double inputs.
- `before-input-event` fallback: if the toolbar renderer accidentally has keyboard focus, keys are forwarded once to the game view without calling `focus()`.

## [1.10.0] – 2025-04-28
### Fixed
- `automation.json` and `gamepad.json` are now stored in `app.getPath('userData')` (`~/.config/flyff-wrapper/`) — AppImage updates no longer overwrite saved settings.

## [1.9.0] – 2025-04-28
### Changed
- `gamepad.json`: L2 (button 6) is now camera (hold right-click), X (button 2) → key 3.

## [1.8.0] – 2025-04-28
### Fixed
- Cursor reset to screen center now only triggers when releasing `__RHOLD` (camera button), not when returning the stick to center.

## [1.7.0] – 2025-04-28
### Fixed
- Mouse IPC is no longer sent when the cursor is stuck at the edge and the position hasn't changed (prevents IPC queue flooding).
- Cursor reset to screen center after camera pan (IPC `gamepad-reset-cursor`).
- Cursor clamp corrected: `w-1` / `h-TOOLBAR_H-1` instead of `w` / `h-TOOLBAR_H`.

## [1.6.0] – 2025-04-28
### Fixed
- Focus-keeper in main process: active game view is re-focused every 200 ms so keyboard events via `sendInputEvent` are never permanently blocked.

## [1.5.0] – 2025-04-28
### Fixed
- `webContents.focus()` is called on `gamepad-keydown` and in `updateViewBounds()` — game view retains input focus longer.

## [1.4.0] – 2025-04-28
### Fixed
- Gamepad polling switched from `setInterval(16ms)` to `requestAnimationFrame` — no callback cascade when a frame takes too long.
- Mouse IPC throttled to max 30 fps, deltas accumulated between frames — prevents IPC queue flooding.

## [1.3.0] – 2025-04-28
### Fixed
- `autocomplete="new-password"` on username fields in Settings — prevents Chromium autofill double-input on `type="text"` fields.

## [1.2.0] – 2025-04-28
### Fixed
- Settings window: removed `parent: mainWindow` and set `sandbox: true` — fixes double key inputs caused by shared keyboard event path under Wayland.

## [1.1.0] – 2025-04-28
### Added
- Version number visible in toolbar (grey, between Settings and gamepad status).
- Settings: `✕ Close` button in footer (IPC `close-settings`).
- Controller: scroll wheel support (`__SCROLL_UP` / `__SCROLL_DOWN`) for zoom via D-Pad.
- Controller: `.` key (Clear Target) as an option in button mapping.
- `preload.js`: added `resetCursor`, `sendGamepadScroll`, `closeSettings`.
### Changed
- Automation key dropdown shows 1–0 first, then F1–F12.
- `automation.json` default keys: `1`, `2`, `3` instead of `F1`, `F2`, `F3`.
- `gamepad.json` revised for Steam Deck layout (A=left click, B=Clear Target, L1/R1=skills 1/2, L2=camera, D↑/↓=zoom, D→=Tab).
- Controller: WASD hysteresis (press 0.40 / release 0.20), right stick deadzone 0.25.
- Mouse cursor visible in game (`insertCSS`: `cursor: default !important`).
- Settings window: independent from mainWindow (no `parent`), `sandbox: true`.

## [1.0.0] – before 2025-04-28
### Added
- Multiboxing with two isolated WebContentsViews (`persist:account1` / `persist:account2`).
- Automation engine: configurable actions per account (key + interval), runs in background.
- Gamepad polling in toolbar renderer: left stick → WASD, right stick → mouse/camera.
- Configurable button mappings in `config/gamepad.json`.
- Settings window: tabs for Automation, Controller, Accounts, Hotkeys.
- Auto-fill for login credentials (optional, per account).
- electron-builder AppImage packaging for Steam Deck.
- Startup script `launch-flyff.sh` with Wayland flags.
