# GridVision SCADA - Desktop Application (Electron)

Cross-platform desktop application with system tray, native notifications, and offline detection.

## Features

- **System Tray** — Minimize to tray with quick-access context menu
- **Native Notifications** — OS-level alerts for critical alarms with taskbar flashing
- **Offline Detection** — Automatic reconnection when server becomes unreachable
- **Window State Persistence** — Remembers window size, position, and maximized state
- **Full Menu Bar** — File, View, Tools, Help menus with keyboard shortcuts
- **Single Instance Lock** — Prevents multiple app instances
- **Auto-updater Stub** — Ready for electron-updater integration

## Quick Start

### Prerequisites

- Node.js v18+
- The GridVision web server running at `http://localhost:5173`

### Development

```bash
cd apps/electron

# Install dependencies
pnpm install

# Start in development mode
pnpm dev
```

### Build Distributable

```bash
# Build for current platform
pnpm build

# Build for specific platforms
pnpm build:win     # Windows (.exe NSIS installer)
pnpm build:linux   # Linux (.AppImage + .deb)
pnpm build:mac     # macOS (.dmg)
```

Output files will be in the `release/` directory.

## Configuration

Set environment variables before launching:

| Variable           | Default                    | Description                |
|-------------------|----------------------------|----------------------------|
| `GRIDVISION_URL`  | `http://localhost:5173`    | Web app URL to load        |
| `NODE_ENV`        | `production`               | Set to `development` for DevTools |

## Keyboard Shortcuts

| Shortcut       | Action                |
|---------------|-----------------------|
| Ctrl+1        | Dashboard             |
| Ctrl+2        | Single Line Diagram   |
| Ctrl+3        | Alarms                |
| Ctrl+4        | Trends                |
| Ctrl+5        | Reports               |
| Ctrl+6        | Analytics             |
| Ctrl+R        | Reload                |
| F11           | Toggle Fullscreen     |
| F12           | Toggle DevTools       |
| Ctrl+Q        | Quit                  |
| Ctrl+O        | Open in Browser       |

## Project Structure

```
apps/electron/
  src/
    main.ts         # Electron main process (window, tray, menu)
    preload.ts      # Context bridge (notifications, export, window controls)
    ipc/
      handlers.ts   # IPC handlers (data export, notifications)
  assets/
    icon.png        # App icon (Linux)
    icon.ico        # App icon (Windows)
    icon.icns       # App icon (macOS)
  electron-builder.yml
  package.json
  tsconfig.json
```

## Adding Custom Icons

Replace the placeholder icons in `assets/`:

- `icon.png` — 512x512 PNG for Linux
- `icon.ico` — Multi-resolution ICO for Windows
- `icon.icns` — macOS icon bundle

## Native Notification API

The renderer process can trigger native notifications via the preload bridge:

```typescript
// In your React components
if (window.electronAPI) {
  window.electronAPI.showNotification(
    'Critical Alarm',
    'Transformer TX-1 overcurrent detected',
    'critical'  // 'low' | 'normal' | 'critical'
  );
}
```

Critical notifications will also flash the taskbar icon.
