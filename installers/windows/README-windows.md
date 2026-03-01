# GridVision SCADA - Windows Installation Guide

## Quick Install (Recommended)

### PowerShell Installer (Automated)

1. Open **PowerShell as Administrator**
2. Run:
   ```powershell
   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
   irm https://raw.githubusercontent.com/chatgptnotes/GridVision/main/installers/windows/windows-setup.ps1 | iex
   ```

   Or download and run locally:
   ```powershell
   ./windows-setup.ps1
   ```

### What the installer does:
- Checks for Git, Node.js, and pnpm (installs if missing via winget)
- Clones the GridVision repository to `C:\Program Files\GridVision`
- Installs dependencies with pnpm
- Builds the web application
- Generates `.env` configuration with a random JWT secret
- Creates a Windows scheduled task for auto-start
- Creates Desktop and Start Menu shortcuts

## Alternative: Batch Installer

For systems without PowerShell 5+, use the batch installer:

1. Right-click `install.bat` → **Run as administrator**
2. Follow the on-screen prompts

## Alternative: Inno Setup Installer

For creating a distributable `.exe` installer:

1. Install [Inno Setup](https://jrsoftware.org/isinfo.php)
2. Open `GridVision-Setup.iss` in Inno Setup Compiler
3. Click **Build → Compile**
4. The installer `.exe` will be created in the `output/` directory

## Prerequisites

| Component | Minimum     | Recommended   |
|-----------|-------------|---------------|
| OS        | Windows 10  | Windows 11    |
| Node.js   | v18.0       | v20 LTS       |
| RAM       | 4 GB        | 8+ GB         |
| Disk      | 2 GB free   | 10+ GB (SSD)  |

## Installer Options

```powershell
# Custom install directory
./windows-setup.ps1 -InstallDir "D:\GridVision"

# Custom port
./windows-setup.ps1 -Port 8080

# Skip prerequisite checks
./windows-setup.ps1 -SkipPrereqs

# Uninstall
./windows-setup.ps1 -Uninstall
```

## Post-Installation

### Starting GridVision
- **Desktop shortcut**: Double-click "GridVision SCADA" on your desktop
- **Start Menu**: GridVision SCADA → Start GridVision Server
- **Command line**:
  ```cmd
  cd "C:\Program Files\GridVision"
  pnpm dev
  ```

### Default Credentials
- **URL**: http://localhost:5173
- **Email**: admin@gridvision.local
- **Password**: admin123

### Running with Docker (Optional)
If you prefer Docker:
```cmd
cd "C:\Program Files\GridVision"
docker compose up -d
```

## Troubleshooting

### "Execution Policy" error
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

### Port 5173 in use
```powershell
./windows-setup.ps1 -Port 3000
```

### Node.js not found after install
Restart PowerShell/Terminal to refresh PATH.

### Service won't start
Check the scheduled task in Task Scheduler → "GridVisionSCADA".

## Uninstallation

```powershell
./windows-setup.ps1 -Uninstall
```

This removes:
- Installation directory
- Desktop shortcut
- Start Menu entries
- Scheduled task
