#!/bin/bash
# ============================================================
#  GridVision SCADA Installer for macOS
#  Version: 1.0.0
#  Publisher: GridVision Technologies
#  Supports: Apple Silicon (M1/M2/M3) and Intel Macs
#  Minimum: macOS Monterey 12.0
# ============================================================

set -e

VERSION="1.0.0"
REPO_URL="https://github.com/chatgptnotes/GridVision.git"
PORT=5173
MIN_MACOS_VERSION="12"

# Determine install directory
if [ -w /usr/local ]; then
    INSTALL_DIR="/usr/local/gridvision"
else
    INSTALL_DIR="$HOME/Applications/GridVision"
fi

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

print_banner() {
    echo ""
    echo -e "${CYAN}  ======================================${NC}"
    echo -e "${CYAN}   GridVision SCADA Installer v${VERSION}${NC}"
    echo -e "${CYAN}   macOS Installer${NC}"
    echo -e "${CYAN}  ======================================${NC}"
    echo ""
}

log_info()    { echo -e "${NC}[INFO] $1${NC}"; }
log_success() { echo -e "${GREEN}[OK]   $1${NC}"; }
log_warn()    { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_error()   { echo -e "${RED}[ERROR] $1${NC}"; }

# --- Check macOS version ---
check_macos_version() {
    log_info "Checking macOS version..."

    if [[ "$(uname)" != "Darwin" ]]; then
        log_error "This installer is for macOS only."
        exit 1
    fi

    MACOS_VERSION=$(sw_vers -productVersion)
    MACOS_MAJOR=$(echo "$MACOS_VERSION" | cut -d. -f1)

    if [ "$MACOS_MAJOR" -lt "$MIN_MACOS_VERSION" ]; then
        log_error "macOS $MACOS_VERSION is not supported. Minimum required: macOS 12.0 (Monterey)."
        exit 1
    fi

    # Detect architecture
    ARCH=$(uname -m)
    if [ "$ARCH" = "arm64" ]; then
        log_success "macOS $MACOS_VERSION detected (Apple Silicon)"
    else
        log_success "macOS $MACOS_VERSION detected (Intel)"
    fi
}

# --- Check Xcode CLI tools ---
check_xcode_cli() {
    if ! xcode-select -p &>/dev/null; then
        log_info "Installing Xcode Command Line Tools..."
        xcode-select --install 2>/dev/null || true
        echo ""
        echo -e "${YELLOW}  Xcode Command Line Tools installation started.${NC}"
        echo -e "${YELLOW}  Please complete the installation dialog, then re-run this script.${NC}"
        echo ""
        exit 0
    fi
    log_success "Xcode Command Line Tools installed"
}

# --- Install Homebrew ---
install_homebrew() {
    if command -v brew &>/dev/null; then
        log_success "Homebrew already installed"
        return
    fi

    log_info "Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

    # Add Homebrew to PATH for Apple Silicon
    if [ -f /opt/homebrew/bin/brew ]; then
        eval "$(/opt/homebrew/bin/brew shellenv)"
        # Add to shell profile if not present
        SHELL_PROFILE="$HOME/.zprofile"
        if ! grep -q 'homebrew' "$SHELL_PROFILE" 2>/dev/null; then
            echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$SHELL_PROFILE"
        fi
    fi

    log_success "Homebrew installed"
}

# --- Install dependencies via Homebrew ---
install_dependencies() {
    log_info "Installing dependencies via Homebrew..."

    # Node.js
    if ! command -v node &>/dev/null; then
        log_info "Installing Node.js..."
        brew install node
    else
        log_success "Node.js already installed: $(node --version)"
    fi

    # pnpm
    if ! command -v pnpm &>/dev/null; then
        log_info "Installing pnpm..."
        brew install pnpm
    else
        log_success "pnpm already installed"
    fi

    # PostgreSQL 16
    if ! brew list postgresql@16 &>/dev/null; then
        log_info "Installing PostgreSQL 16..."
        brew install postgresql@16
        brew services start postgresql@16
    else
        log_success "PostgreSQL 16 already installed"
        brew services start postgresql@16 2>/dev/null || true
    fi

    # Redis
    if ! brew list redis &>/dev/null; then
        log_info "Installing Redis..."
        brew install redis
        brew services start redis
    else
        log_success "Redis already installed"
        brew services start redis 2>/dev/null || true
    fi

    # TimescaleDB
    log_info "Installing TimescaleDB..."
    brew tap timescale/tap 2>/dev/null || true
    if brew install timescaledb 2>/dev/null; then
        timescaledb-tune --quiet --yes 2>/dev/null || true
        brew services restart postgresql@16 2>/dev/null || true
        log_success "TimescaleDB installed"
    else
        log_warn "TimescaleDB installation skipped (optional). Install manually later."
    fi

    log_success "All dependencies installed"
}

# --- Clone and build GridVision ---
install_gridvision() {
    # Install git if missing (should come with Xcode CLI tools)
    if ! command -v git &>/dev/null; then
        brew install git
    fi

    if [ -d "$INSTALL_DIR/.git" ]; then
        log_info "Existing installation found. Updating..."
        cd "$INSTALL_DIR"
        git pull origin main
    else
        log_info "Cloning GridVision SCADA..."
        if [ -d "$INSTALL_DIR" ]; then
            rm -rf "$INSTALL_DIR"
        fi
        mkdir -p "$(dirname "$INSTALL_DIR")"
        git clone "$REPO_URL" "$INSTALL_DIR"
    fi

    cd "$INSTALL_DIR"
    log_info "Installing dependencies..."
    pnpm install

    log_info "Building web application..."
    cd apps/web
    npx vite build || log_warn "Web build failed. Dev mode will still work."
    cd "$INSTALL_DIR"

    log_success "GridVision SCADA installed to $INSTALL_DIR"
}

# --- Setup database ---
setup_database() {
    log_info "Setting up database..."

    # Ensure PostgreSQL PATH is available
    export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

    # Wait for PostgreSQL to be ready
    for i in {1..10}; do
        if pg_isready -q 2>/dev/null; then
            break
        fi
        sleep 1
    done

    # Check if database exists
    if psql -U "$USER" -d postgres -lqt 2>/dev/null | cut -d\| -f1 | grep -qw gridvision_scada; then
        log_success "Database 'gridvision_scada' already exists"
        return
    fi

    # Create user and database (macOS uses current user as superuser by default)
    psql -U "$USER" -d postgres << 'EOSQL'
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'gridvision') THEN
        CREATE USER gridvision WITH PASSWORD 'gridvision_pass';
    END IF;
END
$$;
CREATE DATABASE gridvision_scada OWNER gridvision;
GRANT ALL PRIVILEGES ON DATABASE gridvision_scada TO gridvision;
EOSQL

    # Enable TimescaleDB if available
    psql -U "$USER" -d gridvision_scada -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;" 2>/dev/null || true

    log_success "Database 'gridvision_scada' created"
}

# --- Generate .env ---
generate_env() {
    if [ -f "$INSTALL_DIR/.env" ]; then
        log_info ".env file already exists. Skipping."
        return
    fi

    log_info "Generating .env configuration..."
    JWT_SECRET=$(openssl rand -hex 32)

    cat > "$INSTALL_DIR/.env" << EOF
# GridVision SCADA Environment Configuration
# Generated by macOS installer on $(date)
DATABASE_URL=postgresql://gridvision:gridvision_pass@localhost:5432/gridvision_scada
REDIS_URL=redis://localhost:6379
JWT_SECRET=${JWT_SECRET}
PORT=3001
CORS_ORIGIN=http://localhost:${PORT}
NODE_ENV=production
EOF

    chmod 600 "$INSTALL_DIR/.env"
    log_success ".env file generated"
}

# --- Create LaunchAgent for auto-start ---
create_launch_agent() {
    log_info "Creating LaunchAgent for auto-start..."

    PLIST_DIR="$HOME/Library/LaunchAgents"
    PLIST_FILE="$PLIST_DIR/com.gridvision.scada.plist"
    NODE_PATH=$(which node)

    mkdir -p "$PLIST_DIR"

    cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.gridvision.scada</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NODE_PATH}</string>
        <string>${INSTALL_DIR}/apps/server/dist/index.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${INSTALL_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${INSTALL_DIR}/logs/gridvision.log</string>
    <key>StandardErrorPath</key>
    <string>${INSTALL_DIR}/logs/gridvision-error.log</string>
</dict>
</plist>
EOF

    mkdir -p "$INSTALL_DIR/logs"

    # Load the agent
    launchctl load "$PLIST_FILE" 2>/dev/null || true

    log_success "LaunchAgent created and loaded"
}

# --- Create Applications alias ---
create_app_alias() {
    log_info "Creating Applications shortcut..."

    # Create a simple launcher script
    LAUNCHER="/Applications/GridVision SCADA.command"
    cat > "$LAUNCHER" << EOF
#!/bin/bash
# GridVision SCADA Launcher
open http://localhost:${PORT}
EOF
    chmod +x "$LAUNCHER"

    log_success "Applications shortcut created"
}

# --- Main ---
main() {
    print_banner

    check_macos_version
    check_xcode_cli
    install_homebrew
    install_dependencies
    install_gridvision
    setup_database
    generate_env
    create_launch_agent
    create_app_alias

    echo ""
    echo -e "${GREEN}  ======================================${NC}"
    echo -e "${GREEN}   Installation Complete!${NC}"
    echo -e "${GREEN}  ======================================${NC}"
    echo ""
    echo -e "  Install Location : ${INSTALL_DIR}"
    echo -e "  Dashboard URL    : http://localhost:${PORT}"
    echo -e "  Default Login    : admin@gridvision.local / admin123"
    echo ""
    echo -e "  Service Commands:"
    echo -e "    ${CYAN}launchctl start com.gridvision.scada${NC}"
    echo -e "    ${CYAN}launchctl stop com.gridvision.scada${NC}"
    echo -e "    ${CYAN}tail -f ${INSTALL_DIR}/logs/gridvision.log${NC}"
    echo ""
    echo -e "  To uninstall:"
    echo -e "    ${CYAN}bash ${INSTALL_DIR}/installers/macos/uninstall.sh${NC}"
    echo ""

    # Open browser
    log_info "Opening GridVision in your browser..."
    sleep 2
    open "http://localhost:${PORT}" 2>/dev/null || true
}

main "$@"
