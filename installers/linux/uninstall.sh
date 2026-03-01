#!/bin/bash
# ============================================================
#  GridVision SCADA - Linux Uninstaller
#  Cleanly removes GridVision SCADA from the system
# ============================================================

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="/opt/gridvision"
SERVICE_USER="gridvision"

echo ""
echo -e "${CYAN}  ======================================${NC}"
echo -e "${CYAN}   GridVision SCADA Uninstaller${NC}"
echo -e "${CYAN}  ======================================${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}[ERROR] This script must be run as root.${NC}"
    echo "  Usage: sudo bash uninstall.sh"
    exit 1
fi

# Confirm
echo -e "${YELLOW}This will remove GridVision SCADA from your system.${NC}"
echo ""
echo "  The following will be removed:"
echo "    - Systemd service (gridvision)"
echo "    - Installation directory ($INSTALL_DIR)"
echo "    - Service user ($SERVICE_USER)"
echo ""
echo "  The following will NOT be removed:"
echo "    - PostgreSQL and its databases"
echo "    - Redis"
echo "    - Node.js"
echo ""
read -p "Continue with uninstallation? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Uninstallation cancelled."
    exit 0
fi

# Stop and disable service
echo -e "[INFO] Stopping GridVision service..."
systemctl stop gridvision 2>/dev/null || true
systemctl disable gridvision 2>/dev/null || true
rm -f /etc/systemd/system/gridvision.service
systemctl daemon-reload
echo -e "${GREEN}[OK]   Service removed${NC}"

# Remove installation directory
if [ -d "$INSTALL_DIR" ]; then
    echo -e "[INFO] Removing installation directory..."
    rm -rf "$INSTALL_DIR"
    echo -e "${GREEN}[OK]   $INSTALL_DIR removed${NC}"
fi

# Remove service user
if id "$SERVICE_USER" &>/dev/null; then
    echo -e "[INFO] Removing service user..."
    userdel "$SERVICE_USER" 2>/dev/null || true
    echo -e "${GREEN}[OK]   User '$SERVICE_USER' removed${NC}"
fi

# Optional: Remove database
echo ""
read -p "Also remove the GridVision database? (y/N) " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    if command -v psql &>/dev/null; then
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS gridvision_scada;" 2>/dev/null || true
        sudo -u postgres psql -c "DROP USER IF EXISTS gridvision;" 2>/dev/null || true
        echo -e "${GREEN}[OK]   Database removed${NC}"
    fi
fi

echo ""
echo -e "${GREEN}  ======================================${NC}"
echo -e "${GREEN}   Uninstallation Complete${NC}"
echo -e "${GREEN}  ======================================${NC}"
echo ""
echo -e "  GridVision SCADA has been removed from your system."
echo ""
