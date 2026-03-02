import { ChildProcess, spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import http from 'http';
import { app } from 'electron';

const SERVER_PORT = 3002;
const HEALTH_CHECK_INTERVAL = 1000;
const HEALTH_CHECK_TIMEOUT = 30000;
const RESTART_DELAY = 3000;
const MAX_RESTARTS = 5;

let serverProcess: ChildProcess | null = null;
let restartCount = 0;
let intentionalKill = false;
let logStream: fs.WriteStream | null = null;

function getServerPath(): string {
  // In production (packaged app), server is in extraResources
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'server');
  }
  // In development, use the local server directory
  return path.resolve(__dirname, '../../../server');
}

function getLogPath(): string {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  return path.join(logsDir, `server-${new Date().toISOString().slice(0, 10)}.log`);
}

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`;
  if (logStream) {
    logStream.write(line);
  }
  console.log(`[ServerManager] ${msg}`);
}

function healthCheck(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${SERVER_PORT}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForReady(): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < HEALTH_CHECK_TIMEOUT) {
    if (await healthCheck()) {
      return true;
    }
    await new Promise((r) => setTimeout(r, HEALTH_CHECK_INTERVAL));
  }
  return false;
}

export async function startServer(): Promise<boolean> {
  const serverPath = getServerPath();
  logStream = fs.createWriteStream(getLogPath(), { flags: 'a' });

  log(`Starting server from: ${serverPath}`);

  const env = {
    ...process.env,
    PORT: String(SERVER_PORT),
    NODE_ENV: 'production',
    DATABASE_URL: process.env.DATABASE_URL || 'postgresql://gridvision:gridvision_pass@localhost:5432/gridvision_scada',
  };

  // Determine entry point
  let entryPoint: string;
  if (app.isPackaged) {
    entryPoint = path.join(serverPath, 'dist', 'index.js');
  } else {
    // Dev mode — try dist/index.js first, fall back to tsx
    const distEntry = path.join(serverPath, 'dist', 'index.js');
    if (fs.existsSync(distEntry)) {
      entryPoint = distEntry;
    } else {
      entryPoint = path.join(serverPath, 'src', 'index.ts');
      // Use tsx for TypeScript
      serverProcess = spawn('npx', ['tsx', entryPoint], {
        cwd: serverPath,
        env,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
      });
      setupProcessHandlers();
      const ready = await waitForReady();
      log(ready ? 'Server is ready (tsx mode)' : 'Server failed to start (tsx mode)');
      return ready;
    }
  }

  serverProcess = spawn('node', [entryPoint], {
    cwd: serverPath,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  setupProcessHandlers();
  const ready = await waitForReady();
  log(ready ? 'Server is ready' : 'Server failed to start');
  return ready;
}

function setupProcessHandlers(): void {
  if (!serverProcess) return;

  serverProcess.stdout?.on('data', (data: Buffer) => {
    log(`[stdout] ${data.toString().trim()}`);
  });

  serverProcess.stderr?.on('data', (data: Buffer) => {
    log(`[stderr] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code, signal) => {
    log(`Server exited with code=${code} signal=${signal}`);
    serverProcess = null;

    if (!intentionalKill && restartCount < MAX_RESTARTS) {
      restartCount++;
      log(`Auto-restarting server (attempt ${restartCount}/${MAX_RESTARTS}) in ${RESTART_DELAY}ms...`);
      setTimeout(() => {
        startServer().catch((err) => log(`Restart failed: ${err}`));
      }, RESTART_DELAY);
    }
  });

  serverProcess.on('error', (err) => {
    log(`Server process error: ${err.message}`);
  });
}

export function stopServer(): void {
  intentionalKill = true;
  if (serverProcess) {
    log('Stopping server...');
    serverProcess.kill('SIGTERM');
    // Force kill after 5 seconds
    setTimeout(() => {
      if (serverProcess) {
        log('Force killing server...');
        serverProcess.kill('SIGKILL');
      }
    }, 5000);
  }
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

export function getServerPort(): number {
  return SERVER_PORT;
}
