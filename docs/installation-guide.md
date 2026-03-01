# GridVision SCADA - Installation Guide

Version 1.0.0 | GridVision Technologies

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Docker Deployment (Recommended)](#docker-deployment-recommended)
3. [Manual Installation — Linux](#manual-installation--linux)
4. [Manual Installation — Windows](#manual-installation--windows)
5. [Desktop App (Electron)](#desktop-app-electron)
6. [Configuration Reference](#configuration-reference)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Minimum System Requirements

| Component  | Minimum          | Recommended        |
|-----------|------------------|--------------------|
| CPU       | 2 cores          | 4+ cores           |
| RAM       | 4 GB             | 8+ GB              |
| Disk      | 20 GB            | 50+ GB (SSD)       |
| OS        | Windows 10 / Ubuntu 20.04 | Ubuntu 22.04 LTS |
| Node.js   | v18.0            | v20 LTS            |
| Docker    | v20.0            | v24+ with Compose v2 |
| PostgreSQL| 14               | 16 with TimescaleDB |

### Network Requirements

| Port  | Service      | Direction |
|-------|-------------|-----------|
| 5173  | Web UI      | Inbound   |
| 3001  | API Server  | Inbound   |
| 5432  | PostgreSQL  | Internal  |
| 6379  | Redis       | Internal  |
| 502   | Modbus TCP  | Outbound  |

---

## Docker Deployment (Recommended)

Docker provides the fastest and most reliable deployment.

### Step 1: Install Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Log out and back in

# Verify
docker --version
docker compose version
```

### Step 2: Clone Repository

```bash
git clone https://github.com/chatgptnotes/GridVision.git
cd GridVision
```

### Step 3: Configure Environment

```bash
cp .env.example .env
nano .env
```

Required environment variables:

```bash
DATABASE_URL=postgresql://gridvision:gridvision_pass@postgres:5432/gridvision_scada
REDIS_URL=redis://redis:6379
JWT_SECRET=your-secure-random-secret-change-this
PORT=3001
CORS_ORIGIN=http://localhost:5173
NODE_ENV=production
```

**Important**: Change `JWT_SECRET` to a secure random string in production.

### Step 4: Start Services

```bash
docker compose up -d
```

### Step 5: Verify

```bash
# Check services are running
docker compose ps

# Check logs
docker compose logs -f

# Open browser
http://localhost:5173
```

### Step 6: Login

- **Email**: admin@gridvision.local
- **Password**: admin123

### Docker Commands

```bash
# Stop
docker compose down

# Restart
docker compose restart

# View logs
docker compose logs -f server

# Update
git pull && docker compose up -d --build

# Reset database (destructive)
docker compose down -v && docker compose up -d
```

---

## Manual Installation — Linux

### Automated Installer

```bash
curl -fsSL https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/linux/install.sh | sudo bash
```

### Manual Steps

#### 1. Install Node.js v20 LTS

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo npm install -g pnpm
```

#### 2. Install PostgreSQL

```bash
sudo apt-get install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

#### 3. Install Redis

```bash
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

#### 4. Create Database

```bash
sudo -u postgres psql <<EOF
CREATE USER gridvision WITH PASSWORD 'gridvision_pass';
CREATE DATABASE gridvision_scada OWNER gridvision;
GRANT ALL PRIVILEGES ON DATABASE gridvision_scada TO gridvision;
EOF
```

#### 5. Clone & Build

```bash
sudo git clone https://github.com/chatgptnotes/GridVision.git /opt/gridvision
cd /opt/gridvision
sudo pnpm install
cd apps/web && sudo npx vite build && cd ../..
```

#### 6. Configure

```bash
sudo cp .env.example .env
sudo nano .env
# Edit DATABASE_URL, JWT_SECRET, etc.
```

#### 7. Create Service

```bash
sudo tee /etc/systemd/system/gridvision.service <<EOF
[Unit]
Description=GridVision SCADA Server
After=postgresql.service redis-server.service

[Service]
Type=simple
User=gridvision
WorkingDirectory=/opt/gridvision
ExecStart=/usr/bin/node apps/server/dist/index.js
Restart=always
EnvironmentFile=/opt/gridvision/.env

[Install]
WantedBy=multi-user.target
EOF

sudo useradd --system --home-dir /opt/gridvision gridvision
sudo chown -R gridvision:gridvision /opt/gridvision
sudo systemctl daemon-reload
sudo systemctl enable gridvision
sudo systemctl start gridvision
```

#### 8. Uninstall

```bash
sudo bash /opt/gridvision/installers/linux/uninstall.sh
```

---

## Manual Installation — Windows

### Automated Installer

```powershell
# Run PowerShell as Administrator
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
./windows-setup.ps1
```

Download from: `https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/windows/windows-setup.ps1`

### Manual Steps

1. Install [Node.js v20 LTS](https://nodejs.org)
2. Install [Git for Windows](https://git-scm.com)
3. Open Command Prompt as Administrator:

```cmd
npm install -g pnpm
git clone https://github.com/chatgptnotes/GridVision.git "%ProgramFiles%\GridVision"
cd "%ProgramFiles%\GridVision"
pnpm install
cd apps\web && npx vite build
```

4. Copy `.env.example` to `.env` and edit
5. Run: `pnpm dev`
6. Open: http://localhost:5173

---

## Desktop App (Electron)

### Building from Source

```bash
cd apps/electron
pnpm install
pnpm build          # Current platform
pnpm build:win      # Windows .exe
pnpm build:linux    # Linux .AppImage + .deb
pnpm build:mac      # macOS .dmg
```

### Running in Development

```bash
cd apps/electron
pnpm dev
```

The desktop app connects to the web server at `http://localhost:5173`. Ensure the server is running first.

---

## Configuration Reference

### Environment Variables

| Variable         | Required | Default    | Description |
|-----------------|----------|------------|-------------|
| `DATABASE_URL`  | Yes      | —          | PostgreSQL connection string |
| `REDIS_URL`     | Yes      | —          | Redis connection string |
| `JWT_SECRET`    | Yes      | —          | Secret for JWT token signing |
| `PORT`          | No       | 3001       | API server port |
| `CORS_ORIGIN`   | No       | *          | Allowed CORS origin |
| `NODE_ENV`      | No       | development| Environment mode |
| `GEMINI_API_KEY`| No       | —          | Gemini AI integration key |
| `SMTP_HOST`     | No       | —          | SMTP server for email alerts |
| `SMTP_PORT`     | No       | 587        | SMTP server port |
| `SMTP_USER`     | No       | —          | SMTP username |
| `SMTP_PASS`     | No       | —          | SMTP password |

### Database Configuration

GridVision uses PostgreSQL with optional TimescaleDB extension for time-series optimization.

```
postgresql://user:password@host:port/database
```

### Redis Configuration

Redis is used for session caching, pub/sub messaging, and real-time data buffering.

```
redis://host:port
```

---

## Troubleshooting

### Web UI not loading

1. Check if the server is running:
   ```bash
   curl http://localhost:3001/api/health
   ```
2. Check server logs:
   ```bash
   docker compose logs server    # Docker
   journalctl -u gridvision -f   # systemd
   ```
3. Verify the web build exists:
   ```bash
   ls apps/web/dist/
   ```

### Database connection failed

1. Verify PostgreSQL is running:
   ```bash
   sudo systemctl status postgresql
   ```
2. Test connection:
   ```bash
   psql -U gridvision -d gridvision_scada -h localhost
   ```
3. Check `DATABASE_URL` in `.env`

### WebSocket disconnections

1. Check if a reverse proxy is blocking WebSocket upgrades
2. Ensure `CORS_ORIGIN` matches your access URL
3. Check browser console for connection errors

### Port conflicts

If port 5173 or 3001 is in use:
```bash
# Find what's using the port
lsof -i :5173
# Kill the process or change PORT in .env
```

### Permission denied (Linux)

```bash
sudo chown -R gridvision:gridvision /opt/gridvision
```

### Docker: Container keeps restarting

```bash
docker compose logs server --tail 50
# Usually a database connection issue — wait for postgres to be ready
docker compose restart server
```
