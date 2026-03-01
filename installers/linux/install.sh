#!/bin/bash
# ============================================================
#  GridVision SCADA Installer for Ubuntu/Debian
#  Version: 1.0.0
#  Publisher: GridVision Technologies
# ============================================================

set -e

VERSION="1.0.0"
INSTALL_DIR="/opt/gridvision"
REPO_URL="https://github.com/chatgptnotes/GridVision.git"
SERVICE_USER="gridvision"
NODE_MIN_VERSION=18
PORT=5173

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
    echo -e "${CYAN}   Linux (Ubuntu/Debian) Installer${NC}"
    echo -e "${CYAN}  ======================================${NC}"
    echo ""
}

log_info()    { echo -e "${NC}[INFO] $1${NC}"; }
log_success() { echo -e "${GREEN}[OK]   $1${NC}"; }
log_warn()    { echo -e "${YELLOW}[WARN] $1${NC}"; }
log_error()   { echo -e "${RED}[ERROR] $1${NC}"; }

# --- Check root ---
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "This installer must be run as root."
        echo "  Usage: sudo bash install.sh"
        exit 1
    fi
}

# --- Check prerequisites ---
check_prereqs() {
    log_info "Checking prerequisites..."

    # Check OS
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        log_info "Detected OS: $PRETTY_NAME"
        if [[ "$ID" != "ubuntu" && "$ID" != "debian" && "$ID_LIKE" != *"debian"* && "$ID_LIKE" != *"ubuntu"* ]]; then
            log_warn "This installer is designed for Ubuntu/Debian. Other distros may work but are untested."
        fi
    fi

    # Check available disk space (need at least 2GB)
    AVAIL_KB=$(df /opt --output=avail 2>/dev/null | tail -1 | tr -d ' ')
    if [ -n "$AVAIL_KB" ] && [ "$AVAIL_KB" -lt 2097152 ]; then
        log_warn "Less than 2 GB free disk space on /opt. Installation may fail."
    fi

    apt-get update -qq
    log_success "Prerequisites check passed"
}

# --- Install Node.js ---
install_node() {
    if command -v node &>/dev/null; then
        NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
        if [ "$NODE_VER" -ge "$NODE_MIN_VERSION" ]; then
            log_success "Node.js found: $(node --version)"
            return
        else
            log_warn "Node.js $(node --version) is too old. Installing v20 LTS..."
        fi
    else
        log_info "Node.js not found. Installing v20 LTS..."
    fi

    # Install via NodeSource
    apt-get install -y ca-certificates curl gnupg
    mkdir -p /etc/apt/keyrings
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg 2>/dev/null || true
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list
    apt-get update -qq
    apt-get install -y nodejs

    log_success "Node.js installed: $(node --version)"

    # Install pnpm
    if ! command -v pnpm &>/dev/null; then
        npm install -g pnpm
        log_success "pnpm installed"
    fi
}

# --- Install PostgreSQL + TimescaleDB ---
install_postgres() {
    if command -v psql &>/dev/null; then
        log_success "PostgreSQL already installed"
        return
    fi

    log_info "Installing PostgreSQL 16..."
    apt-get install -y postgresql postgresql-contrib

    # Start PostgreSQL
    systemctl enable postgresql
    systemctl start postgresql

    log_success "PostgreSQL installed and started"

    # Try to install TimescaleDB
    log_info "Attempting to install TimescaleDB..."
    if apt-get install -y timescaledb-2-postgresql-16 2>/dev/null; then
        timescaledb-tune --quiet --yes 2>/dev/null || true
        systemctl restart postgresql
        log_success "TimescaleDB installed"
    else
        log_warn "TimescaleDB not available from default repos. Skipping (optional)."
        log_info "  Install manually: https://docs.timescale.com/install/latest/"
    fi
}

# --- Install Redis ---
install_redis() {
    if command -v redis-server &>/dev/null; then
        log_success "Redis already installed"
        return
    fi

    log_info "Installing Redis..."
    apt-get install -y redis-server
    systemctl enable redis-server
    systemctl start redis-server

    log_success "Redis installed and started"
}

# --- Clone and build GridVision ---
install_gridvision() {
    # Install git if missing
    if ! command -v git &>/dev/null; then
        apt-get install -y git
    fi

    # Install pnpm if missing
    if ! command -v pnpm &>/dev/null; then
        npm install -g pnpm
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

# --- Create systemd service ---
create_service() {
    log_info "Creating systemd service..."

    cat > /etc/systemd/system/gridvision.service << 'EOF'
[Unit]
Description=GridVision SCADA Server
Documentation=https://github.com/chatgptnotes/GridVision
After=network.target postgresql.service redis-server.service
Wants=postgresql.service redis-server.service

[Service]
Type=simple
User=gridvision
Group=gridvision
WorkingDirectory=/opt/gridvision
ExecStart=/usr/bin/node apps/server/dist/index.js
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=gridvision
Environment=NODE_ENV=production
EnvironmentFile=/opt/gridvision/.env

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=/opt/gridvision
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

    # Create service user
    if ! id "$SERVICE_USER" &>/dev/null; then
        useradd --system --home-dir "$INSTALL_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
        log_success "Service user '$SERVICE_USER' created"
    fi

    # Set permissions
    chown -R "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR"

    systemctl daemon-reload
    log_success "Systemd service created"
}

# --- Setup database ---
setup_database() {
    log_info "Setting up database..."

    # Check if database exists
    if sudo -u postgres psql -lqt | cut -d\| -f1 | grep -qw gridvision_scada; then
        log_success "Database 'gridvision_scada' already exists"
        return
    fi

    sudo -u postgres psql << 'EOSQL'
CREATE USER gridvision WITH PASSWORD 'gridvision_pass';
CREATE DATABASE gridvision_scada OWNER gridvision;
GRANT ALL PRIVILEGES ON DATABASE gridvision_scada TO gridvision;
\c gridvision_scada
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;
EOSQL

    log_success "Database 'gridvision_scada' created"
}

# --- Generate .env ---
generate_env() {
    if [ -f "$INSTALL_DIR/.env" ]; then
        log_info ".env file already exists. Skipping."
        return
    fi

    log_info "Generating .env configuration..."
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | xxd -p | tr -d '\n')

    cat > "$INSTALL_DIR/.env" << EOF
# GridVision SCADA Environment Configuration
# Generated by installer on $(date)
DATABASE_URL=postgresql://gridvision:gridvision_pass@localhost:5432/gridvision_scada
REDIS_URL=redis://localhost:6379
JWT_SECRET=${JWT_SECRET}
PORT=3001
CORS_ORIGIN=http://localhost:${PORT}
NODE_ENV=production
EOF

    chown "$SERVICE_USER:$SERVICE_USER" "$INSTALL_DIR/.env"
    chmod 600 "$INSTALL_DIR/.env"

    log_success ".env file generated"
}

# --- Main ---
main() {
    print_banner

    check_root
    check_prereqs
    install_node
    install_postgres
    install_redis
    install_gridvision
    setup_database
    generate_env
    create_service

    # Enable and start
    systemctl enable gridvision
    systemctl start gridvision || log_warn "Service failed to start. Check: journalctl -u gridvision"

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
    echo -e "    ${CYAN}sudo systemctl status gridvision${NC}"
    echo -e "    ${CYAN}sudo systemctl restart gridvision${NC}"
    echo -e "    ${CYAN}sudo journalctl -u gridvision -f${NC}"
    echo ""
    echo -e "  To uninstall:"
    echo -e "    ${CYAN}sudo bash /opt/gridvision/installers/linux/uninstall.sh${NC}"
    echo ""
}

main "$@"
