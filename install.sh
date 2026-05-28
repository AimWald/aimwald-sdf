#!/bin/bash
# AimWald-SDF (SteamDeckFlyff) Installer for Steam Deck
# Usage: curl -L https://aimwald.github.io/sdf/install.sh | sh

set -e

REPO="AimWald/aimwald-sdf"
INSTALL_DIR="$HOME"  # Use $HOME instead of hardcoded /home/deck to support any user
APPIMAGE_NAME="AimWald-SDF.AppImage"
LAUNCH_SCRIPT="launch-sdf.sh"

echo "╔════════════════════════════════════════════════════╗"
echo "║   AimWald-SDF Installer for Steam Deck            ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if HOME directory exists (removed hardcoded /home/deck check for broader compatibility)
if [ -z "$HOME" ] || [ ! -d "$HOME" ]; then
    echo "❌ Error: HOME directory not found"
    exit 1
fi

echo "📥 Fetching latest release..."
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$LATEST_RELEASE" ]; then
    echo "❌ Failed to fetch latest release. Trying direct download..."
    DOWNLOAD_URL="https://github.com/$REPO/releases/latest/download/$APPIMAGE_NAME"
else
    echo "✅ Latest version: $LATEST_RELEASE"
    DOWNLOAD_URL="https://github.com/$REPO/releases/download/$LATEST_RELEASE/$APPIMAGE_NAME"
fi

echo ""
echo "📦 Downloading AppImage..."
cd "$INSTALL_DIR"

# Clean up old AppImage
if [ -f "$APPIMAGE_NAME" ]; then
    echo "🗑️  Removing old AppImage..."
    rm -f "$APPIMAGE_NAME"
fi

# Download new AppImage
if ! curl -L -o "$APPIMAGE_NAME" "$DOWNLOAD_URL"; then
    echo "❌ Download failed! Please check your internet connection."
    exit 1
fi

echo "✅ AppImage downloaded: $INSTALL_DIR/$APPIMAGE_NAME"
echo ""

# Make executable
echo "🔧 Making AppImage executable..."
chmod +x "$APPIMAGE_NAME"

# Create launch script
echo "📝 Creating launch script..."
cat > "$LAUNCH_SCRIPT" << 'EOF'
#!/bin/bash
# Clean up old extracted AppImage directories to free /tmp space (tmpfs, limited RAM)
rm -rf /tmp/appimage_extracted_*

# Gaming Mode display configuration
export DISPLAY=${DISPLAY:-:0}
export WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-gamescope-0}
export GAMESCOPE_WAYLAND_DISPLAY=${GAMESCOPE_WAYLAND_DISPLAY:-gamescope-0}
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-/run/user/$(id -u)}

# Use X11 for Electron/Ozone (more stable than Wayland in Gaming Mode)
export ELECTRON_OZONE_PLATFORM_HINT=x11

# Disable input method modules that can cause crashes
export XMODIFIERS=""
export GTK_IM_MODULE=""
export QT_IM_MODULE=""

# Execute AppImage with proper quoting and flags
"$HOME/AimWald-SDF.AppImage" --appimage-extract-and-run --disable-gpu-sandbox --no-sandbox
EOF

chmod +x "$LAUNCH_SCRIPT"
echo "✅ Launch script created: $INSTALL_DIR/$LAUNCH_SCRIPT"
echo ""

# Download artwork installer script
echo "📥 Downloading artwork installer..."
ARTWORK_SCRIPT="install-steam-artwork.sh"
curl -sL -o "$ARTWORK_SCRIPT" "https://github.com/$REPO/raw/main/install-steam-artwork.sh" || {
    echo "⚠️  Failed to download artwork installer"
}

if [ -f "$ARTWORK_SCRIPT" ]; then
    chmod +x "$ARTWORK_SCRIPT"
    echo "✅ Artwork installer: $INSTALL_DIR/$ARTWORK_SCRIPT"
fi
echo ""

# Clean up old extracts
echo "🧹 Cleaning up old AppImage extracts..."
rm -rf /tmp/appimage_extracted_* 2>/dev/null || true

echo ""
echo "🎨 Installing Steam artwork..."

# Find Steam directory and user ID
STEAM_DIR="$HOME/.local/share/Steam"
if [ -d "$STEAM_DIR/userdata" ]; then
    USER_ID=$(ls -1 "$STEAM_DIR/userdata" | grep -E '^[0-9]+$' | head -1)
    if [ -n "$USER_ID" ]; then
        GRID_DIR="$STEAM_DIR/userdata/$USER_ID/config/grid"
        mkdir -p "$GRID_DIR"

        # Download artwork to temp directory
        ARTWORK_TMP="/tmp/sdf-artwork-$$"
        mkdir -p "$ARTWORK_TMP"

        echo "   → Downloading artwork files..."
        curl -sL -o "$ARTWORK_TMP/steam-grid.png" "https://github.com/$REPO/raw/main/build/steam-grid.png" 2>/dev/null || true
        curl -sL -o "$ARTWORK_TMP/steam-hero.png" "https://github.com/$REPO/raw/main/build/steam-hero.png" 2>/dev/null || true
        curl -sL -o "$ARTWORK_TMP/steam-logo.png" "https://github.com/$REPO/raw/main/build/steam-logo.png" 2>/dev/null || true
        curl -sL -o "$ARTWORK_TMP/icon.png" "https://github.com/$REPO/raw/main/build/icon.png" 2>/dev/null || true

        # Store in a known location for later use
        ARTWORK_CACHE="$HOME/.cache/aimwald-sdf-artwork"
        mkdir -p "$ARTWORK_CACHE"
        cp -f "$ARTWORK_TMP"/*.png "$ARTWORK_CACHE/" 2>/dev/null || true
        rm -rf "$ARTWORK_TMP"

        echo "   ✓ Artwork downloaded to cache"
        echo "   ℹ️  Artwork will be applied after adding the game to Steam"
        echo "      Run: $INSTALL_DIR/install-steam-artwork.sh"
    else
        echo "   ⚠️  Steam user not found - skipping artwork download"
    fi
else
    echo "   ⚠️  Steam not found - skipping artwork download"
fi

echo ""
echo "╔════════════════════════════════════════════════════╗"
echo "║              ✅ Installation complete!             ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""
echo "📂 Files installed:"
echo "   • $INSTALL_DIR/$APPIMAGE_NAME"
echo "   • $INSTALL_DIR/$LAUNCH_SCRIPT"
echo ""
echo "🎮 Next steps:"
echo "   1. Add $INSTALL_DIR/$LAUNCH_SCRIPT as a Non-Steam Game (Desktop Mode)"
echo "      Steam → Games → Add a Non-Steam Game → Browse"
echo "   2. Install artwork: $INSTALL_DIR/install-steam-artwork.sh"
echo "   3. Restart Steam to see artwork"
echo "   4. Launch from Game Mode"
echo ""
echo "🔄 To update, just run this installer again!"
echo ""
echo "📚 Documentation: https://github.com/$REPO"
echo "🐛 Report issues: https://github.com/$REPO/issues"
