# AimWald-SDF - Icons & Artwork

## Files

### App Icons
- **`icon.png`** - App icon 512×512 (for electron-builder, dark blue with crosshair + bat)
- **`icon-256.png`** - App icon 256×256
- **`icon-128.png`** - App icon 128×128

### Steam Artwork
- **`steam-grid.png`** - Steam library grid image (460×215, horizontal capsule)
- **`steam-hero.png`** - Steam library hero image (1920×620, full background with text)
- **`steam-logo.png`** - Steam logo overlay (transparent, 400×200)
- **`preview-hero-with-logo.png`** - Preview/README banner (1920×620)

### Legacy (auto-generated, replaced by custom artwork)
- **`icon.svg`** - Old vector logo
- **`steam-grid.svg`** - Old vector grid

## Usage

### App Icon (automatic)
The icon is automatically embedded in the AppImage during `npm run build` via electron-builder.

### Steam Library Artwork

**Grid (Library View):**
1. Add the game to Steam (right-click `.AppImage` → Add to Steam)
2. In Steam Library, right-click the game → **Manage** → **Set custom artwork**
3. Select `build/steam-grid.png` (460×215)

**Hero (Big Picture / Details Page):**
1. Right-click game → **Manage** → **Set custom background**
2. Select `build/steam-hero.png` (1920×620)

**Logo (Overlay on Hero):**
1. Right-click game → **Manage** → **Set custom logo**
2. Select `build/steam-logo.png` (transparent overlay)

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
