import { prisma } from '../config/database';

interface DeviceStats {
  deviceId: string;
  deviceName: string;
  protocol: string;
  projectId: string;
  totalRequests: number;
  successCount: number;
  errorCount: number;
  timeoutCount: number;
  avgLatencyMs: number;
  maxLatencyMs: number;
  lastError: string | null;
  lastErrorAt: Date | null;
  bytesReceived: number;
  bytesSent: number;
  periodStart: Date;
}

interface FrameLog {
  direction: string;
  rawData: string;
  parsed: any;
  status: string;
  latencyMs?: number;
  errorDetail?: string;
}

class CommDiagnosticsService {
  private stats: Map<string, DeviceStats> = new Map();
  private recentLogs: Map<string, FrameLog[]> = new Map(); // deviceId -> logs (max 500)
  private rollupInterval?: NodeJS.Timeout;
  private logCleanupInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    // Rollup stats every hour
    this.rollupInterval = setInterval(() => this.rollupStats(), 3600_000);
    // Clean old logs every 6 hours
    this.logCleanupInterval = setInterval(() => this.cleanupLogs(), 6 * 3600_000);
    console.log('[CommDiagnostics] Initialized');
  }

  recordSuccess(deviceId: string, deviceName: string, protocol: string, latencyMs: number, tagCount: number, projectId: string): void {
    const s = this.getOrCreateStats(deviceId, deviceName, protocol, projectId);
    s.totalRequests++;
    s.successCount++;
    s.avgLatencyMs = ((s.avgLatencyMs * (s.totalRequests - 1)) + latencyMs) / s.totalRequests;
    if (latencyMs > s.maxLatencyMs) s.maxLatencyMs = latencyMs;
    // Estimate bytes: ~8 bytes per tag request, ~4 bytes per response
    s.bytesSent += tagCount * 8;
    s.bytesReceived += tagCount * 4;
  }

  recordError(deviceId: string, deviceName: string, protocol: string, latencyMs: number, error: string, projectId?: string): void {
    const s = this.getOrCreateStats(deviceId, deviceName, protocol, projectId || '');
    s.totalRequests++;
    s.errorCount++;
    s.lastError = error;
    s.lastErrorAt = new Date();
  }

  recordTimeout(deviceId: string, deviceName: string, protocol: string, projectId: string): void {
    const s = this.getOrCreateStats(deviceId, deviceName, protocol, projectId);
    s.totalRequests++;
    s.timeoutCount++;
  }

  logFrame(deviceId: string, deviceName: string, protocol: string, projectId: string, frame: FrameLog): void {
    const logs = this.recentLogs.get(deviceId) || [];
    logs.push(frame);
    if (logs.length > 500) logs.splice(0, logs.length - 500);
    this.recentLogs.set(deviceId, logs);

    // Persist to DB asynchronously (only some logs to avoid flooding)
    if (logs.length % 10 === 0) {
      prisma.commLog.create({
        data: {
          deviceId,
          deviceName,
          direction: frame.direction,
          protocol,
          rawData: frame.rawData,
          parsed: frame.parsed,
          status: frame.status,
          latencyMs: frame.latencyMs,
          errorDetail: frame.errorDetail,
          projectId,
        },
      }).catch(() => {});
    }
  }

  getSummary(projectId?: string): DeviceStats[] {
    const all = Array.from(this.stats.values());
    if (projectId) return all.filter((s) => s.projectId === projectId);
    return all;
  }

  getDeviceStats(deviceId: string): DeviceStats | undefined {
    return this.stats.get(deviceId);
  }

  getDeviceLogs(deviceId: string, limit: number = 100): FrameLog[] {
    const logs = this.recentLogs.get(deviceId) || [];
    return logs.slice(-limit);
  }

  getDeviceTraffic(deviceId: string): { bytesSent: number; bytesReceived: number; totalRequests: number } {
    const s = this.stats.get(deviceId);
    return {
      bytesSent: s?.bytesSent || 0,
      bytesReceived: s?.bytesReceived || 0,
      totalRequests: s?.totalRequests || 0,
    };
  }

  async pingDevice(deviceId: string): Promise<{ success: boolean; latencyMs: number; message: string }> {
    const device = await prisma.externalDevice.findUnique({ where: { id: deviceId } });
    if (!device) return { success: false, latencyMs: 0, message: 'Device not found' };

    // Simulated ping
    const latency = 1 + Math.random() * 20;
    const success = Math.random() > 0.1;
    return {
      success,
      latencyMs: Math.round(latency * 100) / 100,
      message: success ? `Ping to ${device.host || device.name} successful` : 'Ping timeout',
    };
  }

  resetAll(): void {
    this.stats.clear();
    this.recentLogs.clear();
  }

  getNetworkMap(projectId: string): any[] {
    const devices = Array.from(this.stats.values()).filter((s) => s.projectId === projectId);
    return devices.map((d) => ({
      deviceId: d.deviceId,
      deviceName: d.deviceName,
      protocol: d.protocol,
      status: d.errorCount > d.successCount * 0.5 ? 'error' : d.totalRequests > 0 ? 'online' : 'offline',
      successRate: d.totalRequests > 0 ? Math.round((d.successCount / d.totalRequests) * 10000) / 100 : 0,
      avgLatencyMs: Math.round(d.avgLatencyMs * 100) / 100,
      errorCount: d.errorCount,
    }));
  }

  private getOrCreateStats(deviceId: string, deviceName: string, protocol: string, projectId: string): DeviceStats {
    let s = this.stats.get(deviceId);
    if (!s) {
      s = {
        deviceId,
        deviceName,
        protocol,
        projectId,
        totalRequests: 0,
        successCount: 0,
        errorCount: 0,
        timeoutCount: 0,
        avgLatencyMs: 0,
        maxLatencyMs: 0,
        lastError: null,
        lastErrorAt: null,
        bytesReceived: 0,
        bytesSent: 0,
        periodStart: new Date(),
      };
      this.stats.set(deviceId, s);
    }
    return s;
  }

  private async rollupStats(): Promise<void> {
    for (const [deviceId, stats] of this.stats) {
      await prisma.commDiagnostics.create({
        data: {
          deviceId: stats.deviceId,
          deviceName: stats.deviceName,
          protocol: stats.protocol,
          totalRequests: stats.totalRequests,
          successCount: stats.successCount,
          errorCount: stats.errorCount,
          timeoutCount: stats.timeoutCount,
          avgLatencyMs: stats.avgLatencyMs,
          maxLatencyMs: stats.maxLatencyMs,
          lastError: stats.lastError,
          lastErrorAt: stats.lastErrorAt,
          bytesReceived: BigInt(stats.bytesReceived),
          bytesSent: BigInt(stats.bytesSent),
          projectId: stats.projectId,
          periodStart: stats.periodStart,
          periodEnd: new Date(),
        },
      }).catch(() => {});
    }
  }

  private async cleanupLogs(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 86400_000);
    await prisma.commLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    }).catch(() => {});
  }

  shutdown(): void {
    if (this.rollupInterval) clearInterval(this.rollupInterval);
    if (this.logCleanupInterval) clearInterval(this.logCleanupInterval);
  }
}

export const commDiagnosticsService = new CommDiagnosticsService();
