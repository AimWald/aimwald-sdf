#!/bin/bash
# AimWald-SDF Quest Progress Backup Script
# Run this BEFORE uninstalling to preserve your quest data

set -e

BACKUP_DIR="/home/deck/sdf-backup"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/quest-progress-$TIMESTAMP.json"

echo "╔════════════════════════════════════════════════════╗"
echo "║   AimWald-SDF Quest Progress Backup                ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Find config directories (old and new names)
CONFIG_DIRS=(
    "$HOME/.config/flyff-wrapper"
    "$HOME/.config/aimwald-sdf"
    "$HOME/.config/aimwald-sdflyff"
    "$HOME/.config/com.flyff.wrapper"
    "$HOME/.config/com.aimwald.sdf"
)

FOUND_CONFIG=""
for dir in "${CONFIG_DIRS[@]}"; do
    if [ -f "$dir/config.json" ]; then
        FOUND_CONFIG="$dir"
        break
    fi
done

if [ -z "$FOUND_CONFIG" ]; then
    echo "❌ No config found! Checked:"
    for dir in "${CONFIG_DIRS[@]}"; do
        echo "   • $dir"
    done
    echo ""
    echo "The app may not have been run yet, or quest data is empty."
    exit 1
fi

echo "✅ Found config: $FOUND_CONFIG"
echo ""

# Extract quest progress from electron-store config.json
if command -v jq &> /dev/null; then
    # Use jq if available (cleaner)
    jq '.questProgress' "$FOUND_CONFIG/config.json" > "$BACKUP_FILE" 2>/dev/null || {
        echo "⚠️  jq extraction failed, copying full config..."
        cp "$FOUND_CONFIG/config.json" "$BACKUP_FILE"
    }
else
    # Fallback: copy entire config
    echo "ℹ️  jq not installed, backing up full config.json"
    cp "$FOUND_CONFIG/config.json" "$BACKUP_FILE"
fi

# Also backup entire config directory (automation, gamepad, etc.)
FULL_BACKUP="$BACKUP_DIR/full-config-$TIMESTAMP.tar.gz"
tar -czf "$FULL_BACKUP" -C "$HOME/.config" "$(basename "$FOUND_CONFIG")" 2>/dev/null

echo "✅ Backup complete!"
echo ""
echo "📂 Quest Progress: $BACKUP_FILE"
echo "📦 Full Config:    $FULL_BACKUP"
echo ""

# Show stats
if command -v jq &> /dev/null && [ -f "$BACKUP_FILE" ]; then
    QUEST_COUNT=$(jq 'length' "$BACKUP_FILE" 2>/dev/null || echo "?")
    DONE_COUNT=$(jq '[.[] | select(.done == true)] | length' "$BACKUP_FILE" 2>/dev/null || echo "?")
    echo "📊 Stats:"
    echo "   • Total tracked quests: $QUEST_COUNT"
    echo "   • Completed quests:     $DONE_COUNT"
    echo ""
fi

echo "🛡️  Backup saved to: $BACKUP_DIR"
echo ""
echo "Next steps:"
echo "  1. Uninstall old version (rm FlyffWrapper.AppImage, etc.)"
echo "  2. Install new version with: curl -L https://github.com/AimWald/aimwald-sdf/raw/main/install.sh | sh"
echo "  3. Restore with: ./restore-quest-progress.sh"
