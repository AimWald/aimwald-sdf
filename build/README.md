# AimWald-SDF - Icons & Artwork

## Files

- **`icon.svg`** - Vector logo (512×512)
- **`icon.png`** - App icon 512×512 (for electron-builder)
- **`icon-256.png`** - App icon 256×256
- **`icon-128.png`** - App icon 128×128
- **`steam-grid.svg`** - Steam library grid image (460×215)
- **`steam-grid.png`** - Steam library grid image PNG

## Usage

### App Icon (automatic)
The icon is automatically embedded in the AppImage during `npm run build` via electron-builder.

### Steam Library Artwork

1. Add the game to Steam (right-click `.AppImage` → Add to Steam)
2. In Steam Library, right-click the game → **Manage** → **Set custom artwork**
3. Select `build/steam-grid.png`

### SteamGridDB Integration (Advanced)

For even more artwork options:
1. Visit [SteamGridDB.com](https://www.steamgriddb.com/)
2. Search for "Flyff" or upload `steam-grid.png` as custom
3. Use [SGDBoop](https://www.steamgriddb.com/boop) to auto-apply artwork to your Steam library

## Design Elements

- **Color Palette:**
  - Background: `#1a1a3a` (dark blue-purple)
  - Primary: `#88aaff` (light blue)
  - Accent: `#5a8ad8` (mid blue)
  - Text: `#d0d0e8` (light grey)

- **Theme:**
  - "SD" = Steam Deck
  - Wings = Flyff (Flying + Fighting)
  - Gamepad icon = Controller support
  - Corners = Tech/Gaming aesthetic

## License

Same as main project (MIT). Feel free to modify for personal use.
