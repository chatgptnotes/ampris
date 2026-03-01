# GridVision SCADA - Linux Installation Guide

## Quick Install (Ubuntu/Debian)

```bash
curl -fsSL https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/linux/install.sh | sudo bash
```

Or download and run:

```bash
wget https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/linux/install.sh
chmod +x install.sh
sudo ./install.sh
```

## What the Installer Does

1. **Checks prerequisites** — verifies OS, disk space, updates apt
2. **Installs Node.js v20 LTS** — via NodeSource repository (if not present)
3. **Installs PostgreSQL 16** — with TimescaleDB extension (optional)
4. **Installs Redis** — for caching and pub/sub
5. **Clones GridVision** — to `/opt/gridvision`
6. **Installs dependencies** — runs `pnpm install`
7. **Builds the web app** — production build with Vite
8. **Creates systemd service** — `gridvision.service` with security hardening
9. **Sets up database** — creates user, database, and extensions
10. **Generates `.env`** — with random JWT secret

## Prerequisites

| Component  | Minimum        | Recommended       |
|-----------|----------------|-------------------|
| OS        | Ubuntu 20.04   | Ubuntu 22.04 LTS  |
| Node.js   | v18.0          | v20 LTS           |
| RAM       | 4 GB           | 8+ GB             |
| Disk      | 2 GB free      | 10+ GB (SSD)      |
| Arch      | x86_64         | x86_64             |

## Service Management

```bash
# Check status
sudo systemctl status gridvision

# Start / Stop / Restart
sudo systemctl start gridvision
sudo systemctl stop gridvision
sudo systemctl restart gridvision

# View logs
sudo journalctl -u gridvision -f

# View recent logs
sudo journalctl -u gridvision --since "1 hour ago"
```

## Post-Installation

### Default Credentials
- **URL**: http://localhost:5173
- **Email**: admin@gridvision.local
- **Password**: admin123

### Configuration
Edit `/opt/gridvision/.env`:

```bash
sudo nano /opt/gridvision/.env
sudo systemctl restart gridvision
```

### Using Docker Instead
If you prefer Docker deployment:

```bash
cd /opt/gridvision
docker compose up -d
```

## Supported Distributions

| Distribution       | Status    |
|-------------------|-----------|
| Ubuntu 22.04 LTS  | Tested    |
| Ubuntu 20.04 LTS  | Tested    |
| Debian 12         | Tested    |
| Debian 11         | Supported |
| Linux Mint 21+    | Supported |

Other Debian-based distributions may work but are not officially tested.

## Troubleshooting

### Service fails to start
```bash
sudo journalctl -u gridvision -n 50 --no-pager
```

### Database connection error
```bash
sudo systemctl status postgresql
sudo -u postgres psql -l
```

### Permission denied
```bash
sudo chown -R gridvision:gridvision /opt/gridvision
```

### Port already in use
Edit `/opt/gridvision/.env` and change the PORT value, then restart.

## Uninstallation

```bash
sudo bash /opt/gridvision/installers/linux/uninstall.sh
```

Or manually:
```bash
sudo systemctl stop gridvision
sudo systemctl disable gridvision
sudo rm /etc/systemd/system/gridvision.service
sudo systemctl daemon-reload
sudo rm -rf /opt/gridvision
sudo userdel gridvision
```
