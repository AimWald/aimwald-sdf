#!/bin/bash
# AimWald SDFlyff Installer for Steam Deck
# Usage: curl -L https://github.com/AimWald/aimwald-sdflyff/raw/main/install.sh | sh

set -e

REPO="AimWald/aimwald-sdflyff"
INSTALL_DIR="/home/deck"
APPIMAGE_NAME="SDFlyff.AppImage"
LAUNCH_SCRIPT="launch-sdflyff.sh"

echo "╔════════════════════════════════════════════════════╗"
echo "║   AimWald SDFlyff Installer for Steam Deck        ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Check if running on Steam Deck
if [ ! -d "/home/deck" ]; then
    echo "⚠️  Warning: /home/deck not found. Are you running this on a Steam Deck?"
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
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

export ELECTRON_OZONE_PLATFORM_HINT=auto
export XMODIFIERS=""
export GTK_IM_MODULE=""
export QT_IM_MODULE=""

/home/deck/SDFlyff.AppImage --appimage-extract-and-run --disable-gpu-sandbox
EOF

chmod +x "$LAUNCH_SCRIPT"
echo "✅ Launch script created: $INSTALL_DIR/$LAUNCH_SCRIPT"
echo ""

# Clean up old extracts
echo "🧹 Cleaning up old AppImage extracts..."
rm -rf /tmp/appimage_extracted_* 2>/dev/null || true

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
echo "   1. Add $INSTALL_DIR/$LAUNCH_SCRIPT as a Non-Steam Game"
echo "   2. Optional: Set custom artwork in Steam Library"
echo "      Download: https://github.com/$REPO/raw/main/build/steam-grid.png"
echo "   3. Launch from Game Mode"
echo ""
echo "🔄 To update, just run this installer again!"
echo ""
echo "📚 Documentation: https://github.com/$REPO"
echo "🐛 Report issues: https://github.com/$REPO/issues"
