import { app, BrowserWindow, Menu, Tray, ipcMain, Notification, nativeImage, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { registerIpcHandlers } from './ipc/handlers';
import { startServer, stopServer, getServerPort } from './server-manager';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = process.env.NODE_ENV === 'development';

// In dev mode, load from Vite dev server; in production, load built files
const SERVER_URL = isDev
  ? (process.env.GRIDVISION_URL || 'http://localhost:5173')
  : ''; // Not used in production — we load file:// directly

function getWebAppPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'web-dist', 'index.html');
  }
  // Dev/local build — try the built web app
  return path.resolve(__dirname, '../../../web/dist/index.html');
}

// --- Window State Persistence ---
const stateFile = path.join(app.getPath('userData'), 'window-state.json');

interface WindowState {
  x?: number;
  y?: number;
  width: number;
  height: number;
  maximized: boolean;
}

function loadWindowState(): WindowState {
  try {
    if (fs.existsSync(stateFile)) {
      return JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    }
  } catch {}
  return { width: 1920, height: 1080, maximized: false };
}

function saveWindowState(): void {
  if (!mainWindow) return;
  try {
    const bounds = mainWindow.getBounds();
    const state: WindowState = {
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      maximized: mainWindow.isMaximized(),
    };
    fs.writeFileSync(stateFile, JSON.stringify(state));
  } catch {}
}

// --- Create Main Window ---
function createWindow(): void {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 1280,
    minHeight: 720,
    title: 'GridVision SCADA',
    icon: path.join(__dirname, '../assets/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    backgroundColor: '#0F172A',
    show: false,
  });

  if (state.maximized) {
    mainWindow.maximize();
  }

  // Load the app — in production, load from file://; in dev, from Vite server
  if (isDev) {
    mainWindow.loadURL(SERVER_URL);
  } else {
    const webPath = getWebAppPath();
    if (fs.existsSync(webPath)) {
      mainWindow.loadFile(webPath);
    } else {
      // Fallback to API server URL if built files not found
      mainWindow.loadURL(`http://localhost:${getServerPort()}`);
    }
  }

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Save state on resize/move
  mainWindow.on('resize', saveWindowState);
  mainWindow.on('move', saveWindowState);

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      if (tray) {
        showTrayNotification('GridVision SCADA', 'Application minimized to system tray.');
      }
    } else {
      saveWindowState();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Offline detection
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    if (errorCode === -106 || errorCode === -105 || errorCode === -2) {
      // Network errors — show offline page or retry
      showTrayNotification('GridVision SCADA', 'Connection lost. Retrying in 10 seconds...');
      setTimeout(() => {
        mainWindow?.loadURL(SERVER_URL);
      }, 10000);
    }
  });

  // Build menu bar
  buildMenu();
}

// --- System Tray ---
function createTray(): void {
  const iconPath = path.join(__dirname, '../assets/icon.png');
  let trayIcon: Electron.NativeImage;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('GridVision SCADA');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open GridVision',
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => { mainWindow?.show(); navigate('/'); },
    },
    {
      label: 'Alarms',
      click: () => { mainWindow?.show(); navigate('/alarms'); },
    },
    {
      label: 'Single Line Diagram',
      click: () => { mainWindow?.show(); navigate('/sld'); },
    },
    { type: 'separator' },
    {
      label: 'Minimize to Tray',
      click: () => mainWindow?.hide(),
    },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function showTrayNotification(title: string, body: string): void {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
}

// --- Menu Bar ---
function buildMenu(): void {
  const menu = Menu.buildFromTemplate([
    {
      label: 'File',
      submenu: [
        {
          label: 'Open in Browser',
          accelerator: 'CmdOrCtrl+O',
          click: () => shell.openExternal(SERVER_URL),
        },
        { type: 'separator' },
        {
          label: 'Preferences',
          accelerator: 'CmdOrCtrl+,',
          click: () => navigate('/settings'),
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            isQuitting = true;
            app.quit();
          },
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Dashboard', accelerator: 'CmdOrCtrl+1', click: () => navigate('/') },
        { label: 'Single Line Diagram', accelerator: 'CmdOrCtrl+2', click: () => navigate('/sld') },
        { label: 'Alarms', accelerator: 'CmdOrCtrl+3', click: () => navigate('/alarms') },
        { label: 'Trends', accelerator: 'CmdOrCtrl+4', click: () => navigate('/trends') },
        { label: 'Reports', accelerator: 'CmdOrCtrl+5', click: () => navigate('/reports') },
        { label: 'Analytics', accelerator: 'CmdOrCtrl+6', click: () => navigate('/analytics') },
        { type: 'separator' },
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
        { label: 'Toggle DevTools', accelerator: 'F12', click: () => mainWindow?.webContents.toggleDevTools() },
        { type: 'separator' },
        { label: 'Full Screen', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        { label: 'Zoom In', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { label: 'Reset Zoom', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
      ],
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Control Panel',
          click: () => navigate('/control'),
        },
        {
          label: 'Simulator',
          click: () => navigate('/simulator'),
        },
        { type: 'separator' },
        {
          label: 'Audit Log',
          click: () => navigate('/audit'),
        },
        {
          label: 'User Management',
          click: () => navigate('/users'),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Documentation',
          click: () => shell.openExternal('https://github.com/chatgptnotes/GridVision/tree/main/docs'),
        },
        {
          label: 'Report Issue',
          click: () => shell.openExternal('https://github.com/chatgptnotes/GridVision/issues'),
        },
        { type: 'separator' },
        {
          label: 'Check for Updates',
          click: () => checkForUpdates(),
        },
        { type: 'separator' },
        {
          label: 'About GridVision SCADA',
          click: () => showAbout(),
        },
      ],
    },
  ]);

  Menu.setApplicationMenu(menu);
}

// --- Navigation ---
function navigate(routePath: string): void {
  mainWindow?.webContents.executeJavaScript(
    `window.location.hash = '${routePath}'`
  );
}

// --- About Dialog ---
function showAbout(): void {
  const { dialog } = require('electron');
  dialog.showMessageBox(mainWindow!, {
    type: 'info',
    title: 'About GridVision SCADA',
    message: `GridVision SCADA v${app.getVersion()}`,
    detail: [
      'SCADA Application for Smart Distribution Substations',
      '',
      'Features:',
      '  - Real-time monitoring & control',
      '  - Protocol support: Modbus TCP, IEC 61850, DNP3',
      '  - Advanced analytics & reporting',
      '  - Alarm management with escalation',
      '',
      'Built with Electron + React + TypeScript',
      '',
      'Publisher: GridVision Technologies',
      'https://github.com/chatgptnotes/GridVision',
    ].join('\n'),
  });
}

// --- Auto-updater stub ---
function checkForUpdates(): void {
  // In a production app, integrate electron-updater here.
  // For now, open the releases page.
  shell.openExternal('https://github.com/chatgptnotes/GridVision/releases');
}

// --- IPC Handlers ---
function setupIPC(): void {
  registerIpcHandlers();

  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('get-platform', () => process.platform);

  // Native notification from renderer
  ipcMain.handle('show-native-notification', (_event, { title, body, urgency }) => {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title,
        body,
        urgency: urgency || 'normal',
      });
      notification.show();

      // Flash taskbar for critical alarms
      if (urgency === 'critical' && mainWindow) {
        mainWindow.flashFrame(true);
        setTimeout(() => mainWindow?.flashFrame(false), 5000);
      }
    }
  });

  // Window controls from renderer
  ipcMain.handle('minimize-to-tray', () => mainWindow?.hide());
  ipcMain.handle('toggle-fullscreen', () => {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
  });
}

// --- App Lifecycle ---
app.whenReady().then(async () => {
  // Start embedded server before creating window
  try {
    const serverReady = await startServer();
    if (serverReady) {
      console.log(`[GridVision] Embedded server ready on port ${getServerPort()}`);
    } else {
      console.warn('[GridVision] Server did not respond to health check — continuing anyway');
    }
  } catch (err) {
    console.error('[GridVision] Failed to start embedded server:', err);
  }

  // Set environment for renderer (API/WS URLs)
  process.env.VITE_API_URL = `http://localhost:${getServerPort()}`;
  process.env.VITE_WS_URL = `http://localhost:${getServerPort()}`;

  createWindow();
  createTray();
  setupIPC();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  saveWindowState();
  stopServer();
});

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
