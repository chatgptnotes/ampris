#Requires -RunAsAdministrator
<#
.SYNOPSIS
    GridVision SCADA - Windows PowerShell Installer
.DESCRIPTION
    Automated installer for GridVision SCADA on Windows.
    Installs prerequisites, clones the repository, builds the app,
    creates shortcuts, and sets up a Windows service.
.NOTES
    Version: 1.0.0
    Publisher: GridVision Technologies
    Run: Right-click PowerShell -> Run as Administrator
         ./windows-setup.ps1
#>

param(
    [string]$InstallDir = "$env:ProgramFiles\GridVision",
    [string]$RepoUrl = "https://github.com/chatgptnotes/GridVision.git",
    [int]$Port = 5173,
    [switch]$SkipPrereqs,
    [switch]$Uninstall
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$Version = "1.0.0"
$ServiceName = "GridVisionSCADA"
$NodeMinVersion = 18

# --- Banner ---
Write-Host ""
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host "   GridVision SCADA Installer v$Version"   -ForegroundColor Cyan
Write-Host "   Windows PowerShell Installer"           -ForegroundColor Cyan
Write-Host "  ========================================" -ForegroundColor Cyan
Write-Host ""

# --- Uninstall ---
if ($Uninstall) {
    Write-Host "[INFO] Uninstalling GridVision SCADA..." -ForegroundColor Yellow

    # Stop and remove service
    $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($svc) {
        Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
        sc.exe delete $ServiceName | Out-Null
        Write-Host "[OK] Service removed" -ForegroundColor Green
    }

    # Remove install directory
    if (Test-Path $InstallDir) {
        Remove-Item -Path $InstallDir -Recurse -Force
        Write-Host "[OK] Installation directory removed" -ForegroundColor Green
    }

    # Remove desktop shortcut
    $shortcut = "$env:USERPROFILE\Desktop\GridVision SCADA.lnk"
    if (Test-Path $shortcut) {
        Remove-Item $shortcut -Force
    }

    # Remove Start Menu
    $startMenu = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\GridVision SCADA"
    if (Test-Path $startMenu) {
        Remove-Item $startMenu -Recurse -Force
    }

    Write-Host ""
    Write-Host "[OK] GridVision SCADA has been uninstalled." -ForegroundColor Green
    exit 0
}

# --- Helper Functions ---
function Test-Command($cmd) {
    try { Get-Command $cmd -ErrorAction Stop | Out-Null; return $true }
    catch { return $false }
}

function Write-Step($message) {
    Write-Host "[INFO] $message" -ForegroundColor White
}

function Write-Success($message) {
    Write-Host "[OK] $message" -ForegroundColor Green
}

function Write-Fail($message) {
    Write-Host "[ERROR] $message" -ForegroundColor Red
}

# --- Check Administrator ---
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Fail "This installer must be run as Administrator."
    Write-Host "Right-click PowerShell and select 'Run as Administrator'." -ForegroundColor Yellow
    exit 1
}

# --- Check Prerequisites ---
if (-not $SkipPrereqs) {
    Write-Host "--- Checking Prerequisites ---" -ForegroundColor Yellow
    Write-Host ""

    # Git
    if (Test-Command "git") {
        $gitVer = git --version
        Write-Success "Git found: $gitVer"
    } else {
        Write-Step "Git not found. Installing via winget..."
        try {
            winget install --id Git.Git -e --accept-package-agreements --accept-source-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Write-Success "Git installed"
        } catch {
            Write-Fail "Failed to install Git. Please install manually: https://git-scm.com"
            exit 1
        }
    }

    # Node.js
    if (Test-Command "node") {
        $nodeVer = node --version
        $nodeMajor = [int]($nodeVer -replace "v(\d+)\..*", '$1')
        if ($nodeMajor -ge $NodeMinVersion) {
            Write-Success "Node.js found: $nodeVer"
        } else {
            Write-Fail "Node.js v$NodeMinVersion+ required. Found: $nodeVer"
            Write-Step "Installing Node.js v20 LTS via winget..."
            winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
        }
    } else {
        Write-Step "Node.js not found. Installing v20 LTS via winget..."
        try {
            winget install --id OpenJS.NodeJS.LTS -e --accept-package-agreements --accept-source-agreements
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
            Write-Success "Node.js installed"
        } catch {
            Write-Fail "Failed to install Node.js. Please install from https://nodejs.org"
            exit 1
        }
    }

    # pnpm
    if (Test-Command "pnpm") {
        Write-Success "pnpm found"
    } else {
        Write-Step "Installing pnpm..."
        npm install -g pnpm
        Write-Success "pnpm installed"
    }

    Write-Host ""
}

# --- Clone or Update Repository ---
Write-Host "--- Installing GridVision SCADA ---" -ForegroundColor Yellow
Write-Host ""

if (Test-Path "$InstallDir\.git") {
    Write-Step "Existing installation found. Updating..."
    Push-Location $InstallDir
    git pull origin main
    Pop-Location
    Write-Success "Repository updated"
} else {
    if (Test-Path $InstallDir) {
        Remove-Item $InstallDir -Recurse -Force
    }
    Write-Step "Cloning repository..."
    git clone $RepoUrl $InstallDir
    Write-Success "Repository cloned to $InstallDir"
}

# --- Install Dependencies ---
Write-Step "Installing dependencies (this may take a few minutes)..."
Push-Location $InstallDir
pnpm install
Pop-Location
Write-Success "Dependencies installed"

# --- Build Web App ---
Write-Step "Building web application..."
Push-Location "$InstallDir\apps\web"
try {
    npx vite build
    Write-Success "Web application built"
} catch {
    Write-Host "[WARN] Build failed. Dev mode will still work." -ForegroundColor Yellow
}
Pop-Location

# --- Create .env File ---
$envFile = "$InstallDir\.env"
if (-not (Test-Path $envFile)) {
    Write-Step "Generating .env configuration..."
    $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
    @"
# GridVision SCADA Environment Configuration
DATABASE_URL=postgresql://gridvision:gridvision_pass@localhost:5432/gridvision_scada
REDIS_URL=redis://localhost:6379
JWT_SECRET=$jwtSecret
PORT=3001
CORS_ORIGIN=http://localhost:$Port
NODE_ENV=production
"@ | Set-Content $envFile
    Write-Success ".env file created"
}

# --- Create Windows Service ---
Write-Step "Setting up Windows service..."
$nssm = "$InstallDir\nssm.exe"
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if (-not $svc) {
    # Create a simple service wrapper script
    $serviceScript = "$InstallDir\service.bat"
    @"
@echo off
cd /d "$InstallDir"
node apps/server/dist/index.js
"@ | Set-Content $serviceScript

    # Use sc.exe to create service (nssm not needed for basic service)
    Write-Host "[INFO] Service can be registered with NSSM or Task Scheduler." -ForegroundColor Yellow
    Write-Host "       For now, creating a scheduled task for auto-start..." -ForegroundColor Yellow

    $action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c `"$serviceScript`"" -WorkingDirectory $InstallDir
    $trigger = New-ScheduledTaskTrigger -AtStartup
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1)
    Register-ScheduledTask -TaskName $ServiceName -Action $action -Trigger $trigger -Settings $settings -Description "GridVision SCADA Server" -RunLevel Highest -Force | Out-Null
    Write-Success "Scheduled task '$ServiceName' created for auto-start"
}

# --- Create Desktop Shortcut ---
Write-Step "Creating shortcuts..."
$WshShell = New-Object -ComObject WScript.Shell

# Desktop
$shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\GridVision SCADA.lnk")
$shortcut.TargetPath = "http://localhost:$Port"
$shortcut.Description = "GridVision SCADA Dashboard"
$shortcut.Save()

# Start Menu
$startMenuDir = "$env:ProgramData\Microsoft\Windows\Start Menu\Programs\GridVision SCADA"
if (-not (Test-Path $startMenuDir)) { New-Item -ItemType Directory -Path $startMenuDir -Force | Out-Null }

$shortcut2 = $WshShell.CreateShortcut("$startMenuDir\GridVision SCADA.lnk")
$shortcut2.TargetPath = "http://localhost:$Port"
$shortcut2.Description = "GridVision SCADA Dashboard"
$shortcut2.Save()

$shortcut3 = $WshShell.CreateShortcut("$startMenuDir\GridVision Dev Server.lnk")
$shortcut3.TargetPath = "cmd.exe"
$shortcut3.Arguments = "/k cd /d `"$InstallDir`" && pnpm dev"
$shortcut3.Description = "Start GridVision in Development Mode"
$shortcut3.Save()

Write-Success "Shortcuts created"

# --- Done ---
Write-Host ""
Write-Host "  ========================================" -ForegroundColor Green
Write-Host "   Installation Complete!" -ForegroundColor Green
Write-Host "  ========================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Install Location : $InstallDir" -ForegroundColor White
Write-Host "  Dashboard URL    : http://localhost:$Port" -ForegroundColor White
Write-Host "  Default Login    : admin@gridvision.local / admin123" -ForegroundColor White
Write-Host ""
Write-Host "  Quick Start:" -ForegroundColor Yellow
Write-Host "    cd `"$InstallDir`"" -ForegroundColor Gray
Write-Host "    pnpm dev" -ForegroundColor Gray
Write-Host ""
Write-Host "  To uninstall:" -ForegroundColor Yellow
Write-Host "    ./windows-setup.ps1 -Uninstall" -ForegroundColor Gray
Write-Host ""

# Open browser
$openBrowser = Read-Host "Open GridVision in browser now? (y/n)"
if ($openBrowser -eq "y") {
    Start-Process "http://localhost:$Port"
}
