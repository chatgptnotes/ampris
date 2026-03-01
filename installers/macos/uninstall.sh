#!/bin/bash
# ============================================================
#  GridVision SCADA - macOS Uninstaller
#  Cleanly removes GridVision SCADA from macOS
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

PLIST_LABEL="com.gridvision.scada"
PLIST_FILE="$HOME/Library/LaunchAgents/${PLIST_LABEL}.plist"

# Determine install directory
if [ -d "/usr/local/gridvision" ]; then
    INSTALL_DIR="/usr/local/gridvision"
elif [ -d "$HOME/Applications/GridVision" ]; then
    INSTALL_DIR="$HOME/Applications/GridVision"
else
    INSTALL_DIR=""
fi

echo ""
echo -e "${CYAN}  ======================================${NC}"
echo -e "${CYAN}   GridVision SCADA macOS Uninstaller${NC}"
echo -e "${CYAN}  ======================================${NC}"
echo ""

# Check macOS
if [[ "$(uname)" != "Darwin" ]]; then
    echo -e "${RED}[ERROR] This uninstaller is for macOS only.${NC}"
    exit 1
fi

# Confirm
echo -e "${YELLOW}This will remove GridVision SCADA from your system.${NC}"
echo ""
echo "  The following will be removed:"
echo "    - LaunchAgent ($PLIST_LABEL)"
[ -n "$INSTALL_DIR" ] && echo "    - Installation directory ($INSTALL_DIR)"
echo "    - Applications shortcut"
echo ""
echo "  The following will NOT be removed:"
echo "    - PostgreSQL and its databases"
echo "    - Redis"
echo "    - Node.js / Homebrew"
echo ""
read -p "Continue with uninstallation? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

# Stop and remove LaunchAgent
echo -e "[INFO] Stopping GridVision LaunchAgent..."
launchctl stop "$PLIST_LABEL" 2>/dev/null || true
launchctl unload "$PLIST_FILE" 2>/dev/null || true
rm -f "$PLIST_FILE"
echo -e "${GREEN}[OK]   LaunchAgent removed${NC}"

# Remove installation directory
if [ -n "$INSTALL_DIR" ] && [ -d "$INSTALL_DIR" ]; then
    echo -e "[INFO] Removing installation directory..."
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}[OK]   $INSTALL_DIR removed${NC}"
else
    echo -e "${YELLOW}[WARN] Installation directory not found. Skipping.${NC}"
fi

# Remove Applications shortcut
if [ -f "/Applications/GridVision SCADA.command" ]; then
    echo -e "[INFO] Removing Applications shortcut..."
    rm -f "/Applications/GridVision SCADA.command"
    echo -e "${GREEN}[OK]   Applications shortcut removed${NC}"
fi

# Optional: Remove database
echo ""
read -p "Also remove the GridVision database? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
    if command -v psql &>/dev/null; then
        psql -U "$USER" -d postgres -c "DROP DATABASE IF EXISTS gridvision_scada;" 2>/dev/null || true
        psql -U "$USER" -d postgres -c "DROP USER IF EXISTS gridvision;" 2>/dev/null || true
        echo -e "${GREEN}[OK]   Database removed${NC}"
    else
        echo -e "${YELLOW}[WARN] psql not found. Remove database manually.${NC}"
    fi
fi

# Optional: Remove Homebrew packages
echo ""
read -p "Also uninstall Homebrew packages (postgresql@16, redis, timescaledb)? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    brew services stop postgresql@16 2>/dev/null || true
    brew services stop redis 2>/dev/null || true
    brew uninstall timescaledb 2>/dev/null || true
    brew uninstall postgresql@16 2>/dev/null || true
    brew uninstall redis 2>/dev/null || true
    brew untap timescale/tap 2>/dev/null || true
    echo -e "${GREEN}[OK]   Homebrew packages removed${NC}"
fi

echo ""
echo -e "${GREEN}  ======================================${NC}"
echo -e "${GREEN}   Uninstallation Complete${NC}"
echo -e "${GREEN}  ======================================${NC}"
echo ""
echo -e "  GridVision SCADA has been removed from your Mac."
echo ""
