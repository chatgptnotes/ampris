# GridVision SCADA - macOS Installation Guide

Version 1.0.0 | GridVision Technologies

---

## Prerequisites

- **macOS 12.0 (Monterey)** or later
- **Xcode Command Line Tools** (installer will prompt if missing)
- Apple Silicon (M1/M2/M3) or Intel Mac
- At least 4 GB RAM and 5 GB free disk space
- Internet connection for downloading dependencies

---

## Quick Install (One-Liner)

Open Terminal and run:

```bash
curl -fsSL https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/macos/install.sh | bash
```

This will:
1. Check macOS version (12.0+ required)
2. Install Homebrew (if not present)
3. Install Node.js, pnpm, PostgreSQL 16, Redis, and TimescaleDB via Homebrew
4. Clone the GridVision repository
5. Build the web application
6. Create and configure the database
7. Generate `.env` with a random JWT secret
8. Create a LaunchAgent for auto-start on login
9. Create an Applications shortcut
10. Open GridVision in your default browser

---

## Manual Installation

### 1. Install Xcode Command Line Tools

```bash
xcode-select --install
```

### 2. Install Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

For Apple Silicon Macs, add Homebrew to your PATH:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

### 3. Install Dependencies

```bash
brew install node pnpm postgresql@16 redis
brew tap timescale/tap && brew install timescaledb
```

### 4. Start Services

```bash
brew services start postgresql@16
brew services start redis
```

### 5. Clone and Build

```bash
git clone https://github.com/chatgptnotes/GridVision.git ~/Applications/GridVision
cd ~/Applications/GridVision
pnpm install
cd apps/web && npx vite build && cd ../..
```

### 6. Setup Database

```bash
psql -U $USER -d postgres -c "CREATE USER gridvision WITH PASSWORD 'gridvision_pass';"
psql -U $USER -d postgres -c "CREATE DATABASE gridvision_scada OWNER gridvision;"
psql -U $USER -d gridvision_scada -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"
```

### 7. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
# Generate a secure JWT secret:
openssl rand -hex 32
```

### 8. Run

```bash
pnpm dev
# Open http://localhost:5173
# Login: admin@gridvision.local / admin123
```

---

## Homebrew Dependencies

| Package         | Purpose                          |
|----------------|----------------------------------|
| `node`         | JavaScript runtime (v20 LTS)    |
| `pnpm`         | Package manager                  |
| `postgresql@16`| Database server                  |
| `redis`        | Cache and pub/sub messaging      |
| `timescaledb`  | Time-series extension (optional) |

---

## LaunchAgent Management

GridVision installs a LaunchAgent that starts the server automatically on login.

```bash
# Start
launchctl start com.gridvision.scada

# Stop
launchctl stop com.gridvision.scada

# Disable auto-start
launchctl unload ~/Library/LaunchAgents/com.gridvision.scada.plist

# Re-enable auto-start
launchctl load ~/Library/LaunchAgents/com.gridvision.scada.plist

# View logs
tail -f ~/Applications/GridVision/logs/gridvision.log
tail -f ~/Applications/GridVision/logs/gridvision-error.log
```

---

## Uninstalling

```bash
bash ~/Applications/GridVision/installers/macos/uninstall.sh
# or
bash /usr/local/gridvision/installers/macos/uninstall.sh
```

The uninstaller will:
- Stop and remove the LaunchAgent
- Remove the installation directory
- Remove the Applications shortcut
- Optionally drop the database
- Optionally uninstall Homebrew packages

---

## Troubleshooting

### Xcode Command Line Tools not found

```bash
xcode-select --install
```

If the dialog doesn't appear, reset and retry:

```bash
sudo xcode-select --reset
xcode-select --install
```

### Gatekeeper blocks the installer

If macOS shows "cannot be opened because it is from an unidentified developer":

```bash
# Allow the script to run
chmod +x install.sh
bash install.sh
```

Or go to **System Settings > Privacy & Security** and click "Allow Anyway".

### Homebrew issues on Apple Silicon

Ensure Homebrew is in your PATH:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
source ~/.zprofile
```

### Port already in use

```bash
# Find what's using port 5173
lsof -i :5173

# Or port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### PostgreSQL won't start

```bash
# Check status
brew services list

# Restart PostgreSQL
brew services restart postgresql@16

# Check logs
tail -100 /opt/homebrew/var/log/postgresql@16.log
```

### Permission denied errors

```bash
# Fix ownership of install directory
sudo chown -R $USER ~/Applications/GridVision
# or
sudo chown -R $USER /usr/local/gridvision
```

### Apple Silicon vs Intel

The installer automatically detects your Mac's architecture. All Homebrew packages install native versions for your platform. No Rosetta 2 translation is needed.
