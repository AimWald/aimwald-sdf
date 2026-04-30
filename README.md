# Flyff Universe Electron Wrapper

An Electron-based wrapper for [Flyff Universe](https://universe.flyff.com), optimized for the Valve Steam Deck (1280×800, SteamOS).

## Features

- **Multiboxing** — Two fully isolated accounts running simultaneously via separate `WebContentsView` sessions.
- **Automation** — Per-account auto-heal/buff engine with configurable keys and intervals. Runs on the background account too.
- **Gamepad Support** — Full controller support: WASD movement (left stick), mouse/camera (right stick + L2), customizable button mappings, auto-targeting via spiral search.
- **Macro Buttons** — Configurable key-sequence buttons in the toolbar (e.g. Full Buff with a single press).
- **Madrigal Guide** — In-app overlay with four tabs:
  - **Quests** — 492 quests (Lv. 1–183) with recommendation, exp, difficulty, items, monsters, inventory slots, rewards, and notes. Clickable quest names open the Flyffipedia detail page. Done checkboxes with persistent progress tracking.
  - **Questlines** — 36 questlines with live progress bars showing quests completed and inventory slots unlocked vs. still available (calculated from your Done checkboxes).
  - **Dailies** — Forsaken Tower (Lv. 86–152) and Kaillun (Lv. 162–172) daily quests with exp, monsters to kill, and penya reward.
  - **Monsters** — Quick monster reference grid.

## Credits

**Quest data** (492 quests, 36 questlines, daily quests, difficulty ratings, recommendations, inventory slot tracking) — sourced from the spreadsheet by **NaviKnight2765**:

- Reddit: [u/NaviKnight2765](https://www.reddit.com/user/NaviKnight2765/)
- Original post: [I made a spreadsheet with detailed info about all quests and drops](https://www.reddit.com/r/FlyffUniverse/comments/1k0n6mo/i_made_a_spreadsheet_with_detailed_info_about_all/)

**Auto-targeting spiral search** — inspired by [Ariorh1337/flyff_bot](https://github.com/Ariorh1337/flyff_bot).

## Development

```bash
npm install
npm start           # dev mode
npm run build       # build AppImage
```
