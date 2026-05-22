#!/bin/bash
# AimWald-SDF Steam Artwork Installer
# Automatically installs custom artwork for the Non-Steam game

set -e

REPO="AimWald/aimwald-sdf"
STEAM_DIR="$HOME/.local/share/Steam"
ARTWORK_DIR="/tmp/sdf-artwork"

echo "╔════════════════════════════════════════════════════╗"
echo "║   AimWald-SDF Steam Artwork Installer             ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if Steam is installed
if [ ! -d "$STEAM_DIR" ]; then
    echo "❌ Steam directory not found: $STEAM_DIR"
    echo ""
    echo "Please make sure Steam is installed and you've run it at least once."
    exit 1
fi

# Find Steam userdata directory
USER_DATA_DIR="$STEAM_DIR/userdata"
if [ ! -d "$USER_DATA_DIR" ]; then
    echo "❌ Steam userdata directory not found."
    exit 1
fi

# Find the first user ID (usually there's only one on Steam Deck)
USER_ID=$(ls -1 "$USER_DATA_DIR" | grep -E '^[0-9]+$' | head -1)
if [ -z "$USER_ID" ]; then
    echo "❌ No Steam user ID found in $USER_DATA_DIR"
    exit 1
fi

GRID_DIR="$USER_DATA_DIR/$USER_ID/config/grid"
echo "✓ Found Steam user: $USER_ID"
echo "✓ Grid directory: $GRID_DIR"
echo ""

# Create grid directory if it doesn't exist
mkdir -p "$GRID_DIR"

# Download artwork
echo "📥 Downloading artwork from GitHub..."
mkdir -p "$ARTWORK_DIR"
cd "$ARTWORK_DIR"

curl -sL -o steam-grid.png "https://github.com/$REPO/raw/main/build/steam-grid.png" || { echo "❌ Download failed"; exit 1; }
curl -sL -o steam-hero.png "https://github.com/$REPO/raw/main/build/steam-hero.png" || { echo "❌ Download failed"; exit 1; }
curl -sL -o steam-logo.png "https://github.com/$REPO/raw/main/build/steam-logo.png" || { echo "❌ Download failed"; exit 1; }
curl -sL -o icon.png "https://github.com/$REPO/raw/main/build/icon.png" || { echo "❌ Download failed"; exit 1; }

echo "✓ Downloaded 4 artwork files"
echo ""

# Find the App ID for AimWald-SDF in Steam shortcuts
SHORTCUTS_VDF="$USER_DATA_DIR/$USER_ID/config/shortcuts.vdf"

if [ ! -f "$SHORTCUTS_VDF" ]; then
    echo "⚠️  No shortcuts.vdf found. You need to add the game to Steam first!"
    echo ""
    echo "Steps:"
    echo "  1. Open Steam (Desktop Mode)"
    echo "  2. Games → Add a Non-Steam Game"
    echo "  3. Browse → /home/deck/launch-sdf.sh"
    echo "  4. Add the game"
    echo "  5. Run this script again"
    echo ""
    echo "Artwork files are ready in: $ARTWORK_DIR"
    exit 1
fi

# Try to find App ID by searching for "sdf" or "aimwald" in shortcuts
# This is a heuristic approach - might need manual verification
echo "🔍 Searching for AimWald-SDF in Steam shortcuts..."

# Parse shortcuts.vdf to find app IDs (binary format, so this is approximate)
# Steam generates App IDs as: (CRC32 of exe path + game name) | 0x80000000
# For manual install, we'll list all shortcuts and let user choose

SHORTCUT_COUNT=$(strings "$SHORTCUTS_VDF" | grep -i "appname" | wc -l)
if [ "$SHORTCUT_COUNT" -eq 0 ]; then
    echo "⚠️  No Non-Steam games found in shortcuts."
    exit 1
fi

echo "Found $SHORTCUT_COUNT Non-Steam game(s)"
echo ""
echo "📋 Listing all Non-Steam games:"
strings "$SHORTCUTS_VDF" | grep -i "appname" -A 1 | grep -v "^--$" | nl
echo ""

# List existing grid files to show current App IDs
echo "📋 Current grid files (App IDs):"
ls -1 "$GRID_DIR" | grep -E '^[0-9]+' | sed 's/[^0-9].*//' | sort -u | nl
echo ""

echo "⚙️  Manual Installation:"
echo ""
echo "To find your game's App ID:"
echo "  1. Start Steam in Desktop Mode"
echo "  2. Right-click AimWald-SDF → Manage → Add to favorites (or any action)"
echo "  3. The App ID will appear in the URL or logs"
echo ""
echo "Or try this: Launch the game once, then check the newest files in:"
echo "  ls -lt $GRID_DIR | head -20"
echo ""
read -p "Enter the App ID for AimWald-SDF (or press Enter to auto-detect): " APP_ID

if [ -z "$APP_ID" ]; then
    # Auto-detect: use the highest App ID (most recently added)
    APP_ID=$(ls -1 "$GRID_DIR" | grep -oE '^[0-9]+' | sort -u | tail -1)
    if [ -z "$APP_ID" ]; then
        echo "❌ Could not auto-detect App ID. Please run the game once, then re-run this script."
        exit 1
    fi
    echo "🔍 Auto-detected App ID: $APP_ID"
    read -p "Is this correct? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Cancelled. Please specify the correct App ID."
        exit 1
    fi
fi

# Copy artwork with correct naming
echo ""
echo "📦 Installing artwork for App ID: $APP_ID"

cp "$ARTWORK_DIR/steam-grid.png" "$GRID_DIR/${APP_ID}.png"
cp "$ARTWORK_DIR/steam-hero.png" "$GRID_DIR/${APP_ID}_hero.png"
cp "$ARTWORK_DIR/steam-logo.png" "$GRID_DIR/${APP_ID}_logo.png"
cp "$ARTWORK_DIR/icon.png" "$GRID_DIR/${APP_ID}p.png"  # portrait/vertical

echo "✓ Installed grid (horizontal): ${APP_ID}.png"
echo "✓ Installed hero (background): ${APP_ID}_hero.png"
echo "✓ Installed logo (overlay):    ${APP_ID}_logo.png"
echo "✓ Installed icon (portrait):   ${APP_ID}p.png"

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║              ✅ Artwork installed!                 ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "🎨 Restart Steam to see the changes."
echo "   (Or switch to Game Mode and back)"
echo ""
echo "If artwork doesn't appear, verify the App ID with:"
echo "  ls -lt $GRID_DIR | head -10"

# Cleanup
rm -rf "$ARTWORK_DIR"
