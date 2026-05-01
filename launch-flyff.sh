#!/bin/bash
# Clean up old AppImage extractions to save RAM in /tmp
# (On Steam Deck, /tmp is tmpfs and can fill up quickly)
rm -rf /tmp/appimage_extracted_*

# Ensure we use the correct display even when started via SSH
export DISPLAY=:0
export WAYLAND_DISPLAY=gamescope-0
export GAMESCOPE_WAYLAND_DISPLAY=gamescope-0
export XDG_RUNTIME_DIR=/run/user/1000

# Wayland / SteamOS optimization for Electron/Ozone
export ELECTRON_OZONE_PLATFORM_HINT=auto

# Deactivate IBus/Fcitx to prevent double-input issues under Wayland
export XMODIFIERS=""
export GTK_IM_MODULE=""
export QT_IM_MODULE=""

# Run the AppImage
# Using --appimage-extract-and-run is often more stable in Gamescope
/home/deck/FlyffWrapper.AppImage --appimage-extract-and-run
