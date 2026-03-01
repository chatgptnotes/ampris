import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getPlatform: () => ipcRenderer.invoke('get-platform'),

  // Navigation from menu
  onNavigate: (callback: (path: string) => void) =>
    ipcRenderer.on('navigate', (_event, path) => callback(path)),

  // Native notifications for critical alarms
  showNotification: (title: string, body: string, urgency?: 'low' | 'normal' | 'critical') =>
    ipcRenderer.invoke('show-native-notification', { title, body, urgency }),

  // Data export
  exportData: (data: string, defaultPath: string, filters?: { name: string; extensions: string[] }[]) =>
    ipcRenderer.invoke('export-data', { data, defaultPath, filters }),

  // Window controls
  minimizeToTray: () => ipcRenderer.invoke('minimize-to-tray'),
  toggleFullscreen: () => ipcRenderer.invoke('toggle-fullscreen'),
});
