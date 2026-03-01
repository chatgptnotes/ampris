@echo off
REM ============================================================
REM  GridVision SCADA - Windows Batch Installer
REM  Version: 1.0.0
REM  Publisher: GridVision Technologies
REM ============================================================

setlocal enabledelayedexpansion

echo.
echo  ======================================
echo   GridVision SCADA Installer v1.0.0
echo   Windows Batch Installer
echo  ======================================
echo.

set "INSTALL_DIR=%ProgramFiles%\GridVision"
set "REPO_URL=https://github.com/chatgptnotes/GridVision.git"
set "NODE_MIN_VERSION=18"

REM --- Check for Administrator Privileges ---
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] This installer requires administrator privileges.
    echo         Right-click and select "Run as administrator".
    pause
    exit /b 1
)

REM --- Check for Git ---
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Git is not installed.
    echo         Download from: https://git-scm.com/download/win
    pause
    exit /b 1
)

REM --- Check for Node.js ---
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Node.js not found. Downloading installer...
    echo        Please install Node.js v20 LTS from https://nodejs.org
    start https://nodejs.org/en/download/
    echo.
    echo After installing Node.js, re-run this installer.
    pause
    exit /b 1
)

REM --- Verify Node.js version ---
for /f "tokens=1 delims=v." %%a in ('node --version') do set "NODE_VER=%%a"
for /f "tokens=2 delims=v." %%a in ('node --version') do set "NODE_VER=%%a"
if !NODE_VER! lss %NODE_MIN_VERSION% (
    echo [ERROR] Node.js v%NODE_MIN_VERSION%+ required. Found:
    node --version
    pause
    exit /b 1
)
echo [OK] Node.js found:
node --version

REM --- Check for pnpm ---
where pnpm >nul 2>&1
if %errorlevel% neq 0 (
    echo [INFO] Installing pnpm...
    npm install -g pnpm
    if %errorlevel% neq 0 (
        echo [ERROR] Failed to install pnpm.
        pause
        exit /b 1
    )
)
echo [OK] pnpm found

REM --- Clone Repository ---
echo.
echo [INFO] Cloning GridVision SCADA...
if exist "%INSTALL_DIR%" (
    echo [INFO] Installation directory exists. Updating...
    cd /d "%INSTALL_DIR%"
    git pull origin main
) else (
    git clone "%REPO_URL%" "%INSTALL_DIR%"
)
if %errorlevel% neq 0 (
    echo [ERROR] Failed to clone repository.
    pause
    exit /b 1
)
echo [OK] Repository cloned to %INSTALL_DIR%

REM --- Install Dependencies ---
echo.
echo [INFO] Installing dependencies...
cd /d "%INSTALL_DIR%"
call pnpm install
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)
echo [OK] Dependencies installed

REM --- Build Web Application ---
echo.
echo [INFO] Building web application...
cd /d "%INSTALL_DIR%\apps\web"
call npx vite build
if %errorlevel% neq 0 (
    echo [WARN] Web build failed. You can still run in dev mode.
)

REM --- Create Desktop Shortcut ---
echo.
echo [INFO] Creating desktop shortcut...
set "SHORTCUT=%USERPROFILE%\Desktop\GridVision SCADA.url"
echo [InternetShortcut] > "%SHORTCUT%"
echo URL=http://localhost:5173 >> "%SHORTCUT%"
echo IconIndex=0 >> "%SHORTCUT%"
echo [OK] Desktop shortcut created

REM --- Create Start Menu Entry ---
set "STARTMENU=%ProgramData%\Microsoft\Windows\Start Menu\Programs\GridVision SCADA"
if not exist "%STARTMENU%" mkdir "%STARTMENU%"
copy "%SHORTCUT%" "%STARTMENU%\GridVision SCADA.url" >nul 2>&1

REM --- Create Launch Script ---
set "LAUNCHER=%INSTALL_DIR%\start-gridvision.bat"
(
echo @echo off
echo cd /d "%INSTALL_DIR%"
echo echo Starting GridVision SCADA...
echo start /b pnpm dev
echo timeout /t 5 /nobreak ^>nul
echo start http://localhost:5173
) > "%LAUNCHER%"
echo [OK] Launch script created

echo.
echo  ======================================
echo   Installation Complete!
echo  ======================================
echo.
echo   Install Location: %INSTALL_DIR%
echo   Launch: Run start-gridvision.bat
echo   URL: http://localhost:5173
echo   Login: admin@gridvision.local / admin123
echo.
echo   To start now, press any key...
pause
start http://localhost:5173
