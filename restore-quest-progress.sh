#!/bin/bash
# AimWald-SDF Quest Progress Restore Script
# Run this AFTER installing the new version

set -e

BACKUP_DIR="/home/deck/sdf-backup"

echo "╔════════════════════════════════════════════════════╗"
echo "║   AimWald-SDF Quest Progress Restore               ║"
echo "╚════════════════════════════════════════════════════╝"
echo ""

if [ ! -d "$BACKUP_DIR" ]; then
    echo "❌ No backup found at $BACKUP_DIR"
    echo ""
    echo "Run backup-quest-progress.sh first!"
    exit 1
fi

# Find latest backup
LATEST_QUEST=$(ls -t "$BACKUP_DIR"/quest-progress-*.json 2>/dev/null | head -1)
LATEST_FULL=$(ls -t "$BACKUP_DIR"/full-config-*.tar.gz 2>/dev/null | head -1)

if [ -z "$LATEST_QUEST" ]; then
    echo "❌ No quest progress backup found in $BACKUP_DIR"
    exit 1
fi

echo "📂 Found backups:"
echo "   • Quest Progress: $(basename "$LATEST_QUEST")"
[ -n "$LATEST_FULL" ] && echo "   • Full Config:    $(basename "$LATEST_FULL")"
echo ""

# Find NEW config directory
NEW_CONFIG="$HOME/.config/aimwald-sdf"

if [ ! -d "$NEW_CONFIG" ]; then
    echo "⚠️  Config directory not found: $NEW_CONFIG"
    echo ""
    echo "Creating directory..."
    mkdir -p "$NEW_CONFIG"

    # If full backup exists, extract it
    if [ -n "$LATEST_FULL" ]; then
        echo "📦 Restoring full config from backup..."
        tar -xzf "$LATEST_FULL" -C "$HOME/.config/"

        # Rename if needed
        EXTRACTED=$(tar -tzf "$LATEST_FULL" | head -1 | cut -d'/' -f1)
        if [ "$EXTRACTED" != "aimwald-sdf" ] && [ -d "$HOME/.config/$EXTRACTED" ]; then
            echo "🔄 Renaming $EXTRACTED → aimwald-sdf"
            mv "$HOME/.config/$EXTRACTED" "$NEW_CONFIG"
        fi

        echo "✅ Full config restored!"
        exit 0
    fi
fi

# Check if config.json exists
if [ ! -f "$NEW_CONFIG/config.json" ]; then
    echo "ℹ️  No config.json found. Creating from backup..."

    # Create minimal config with quest progress
    if command -v jq &> /dev/null; then
        jq -n --slurpfile qp "$LATEST_QUEST" '{questProgress: $qp[0]}' > "$NEW_CONFIG/config.json"
    else
        # Fallback: wrap in questProgress key manually
        echo "{\"questProgress\":" > "$NEW_CONFIG/config.json"
        cat "$LATEST_QUEST" >> "$NEW_CONFIG/config.json"
        echo "}" >> "$NEW_CONFIG/config.json"
    fi
else
    echo "ℹ️  Config exists. Merging quest progress..."

    # Backup current config
    cp "$NEW_CONFIG/config.json" "$NEW_CONFIG/config.json.bak"

    if command -v jq &> /dev/null; then
        # Merge quest progress into existing config
        jq --slurpfile qp "$LATEST_QUEST" '.questProgress = $qp[0]' "$NEW_CONFIG/config.json.bak" > "$NEW_CONFIG/config.json"
    else
        echo "⚠️  jq not installed. Manual merge required."
        echo "   Backup: $LATEST_QUEST"
        echo "   Target: $NEW_CONFIG/config.json"
        exit 1
    fi
fi

echo ""
echo "✅ Quest progress restored!"
echo ""

# Show stats
if command -v jq &> /dev/null && [ -f "$NEW_CONFIG/config.json" ]; then
    QUEST_COUNT=$(jq '.questProgress | length' "$NEW_CONFIG/config.json" 2>/dev/null || echo "?")
    DONE_COUNT=$(jq '[.questProgress[] | select(.done == true)] | length' "$NEW_CONFIG/config.json" 2>/dev/null || echo "?")
    echo "📊 Restored:"
    echo "   • Total tracked quests: $QUEST_COUNT"
    echo "   • Completed quests:     $DONE_COUNT"
    echo ""
fi

echo "🎮 Start the app and open the Guide to verify your progress!"
echo ""
echo "Backup kept at: $BACKUP_DIR"
