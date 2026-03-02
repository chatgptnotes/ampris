import { prisma } from '../config/database';
import { tagEngine } from './tag-engine.service';
import { realtimeService } from './realtime.service';

interface LastStoredPoint {
  value: number;
  timestamp: Date;
}

interface SwingingDoorState {
  lastStored: { value: number; timestamp: number };
  upperSlope: number;
  lowerSlope: number;
  lastReceived: { value: number; timestamp: number };
}

class HistorianCompressionService {
  private lastStored: Map<string, LastStoredPoint> = new Map();
  private lastStoredTime: Map<string, number> = new Map(); // epoch ms
  private swingState: Map<string, SwingingDoorState> = new Map();
  private configs: Map<string, any> = new Map(); // tagName -> config
  private statsCache: Map<string, { raw: number; stored: number }> = new Map();
  private cleanupInterval?: NodeJS.Timeout;
  private listenerActive = false;

  async initialize(): Promise<void> {
    // Load all configs
    const configs = await prisma.historianConfig.findMany({ where: { enabled: true } });
    for (const cfg of configs) {
      this.configs.set(cfg.tagName, cfg);
    }

    // Start listening to tag changes
    this.startListening();

    // Cleanup old data every hour
    this.cleanupInterval = setInterval(() => this.cleanupOldData(), 3600_000);

    console.log(`[HistorianCompression] Initialized with ${configs.length} tag configs`);
  }

  private startListening(): void {
    if (this.listenerActive) return;
    this.listenerActive = true;

    // Hook into tag engine's setTagValue by monkey-patching the broadcast
    // We listen for WebSocket tag:valueChanged events
    const checkInterval = setInterval(() => {
      try {
        const io = realtimeService.getIO();
        if (io) {
          // Listen on server-side for tag changes
          const originalSetTagValue = tagEngine.setTagValue.bind(tagEngine);
          tagEngine.setTagValue = (tagName: string, value: string | number | boolean, persist?: boolean) => {
            originalSetTagValue(tagName, value, persist);
            if (typeof value === 'number') {
              this.onTagValueChanged(tagName, value);
            }
          };
          clearInterval(checkInterval);
          console.log('[HistorianCompression] Listening to tag value changes');
        }
      } catch {}
    }, 2000);
  }

  private async onTagValueChanged(tagName: string, value: number): Promise<void> {
    const config = this.configs.get(tagName);
    // Default: no compression config means don't store (only store configured tags)
    if (!config) return;

    // Track raw points
    const stats = this.statsCache.get(tagName) || { raw: 0, stored: 0 };
    stats.raw++;
    this.statsCache.set(tagName, stats);

    const now = Date.now();
    const lastTime = this.lastStoredTime.get(tagName) || 0;

    // Min interval check
    if (config.minInterval > 0 && (now - lastTime) < config.minInterval * 1000) {
      return;
    }

    // Max interval check — force store
    const forceStore = config.maxInterval > 0 && (now - lastTime) >= config.maxInterval * 1000;

    let shouldStore = forceStore;

    if (!shouldStore) {
      switch (config.compressionType) {
        case 'none':
          shouldStore = true;
          break;
        case 'deadband':
          shouldStore = this.checkDeadband(tagName, value, config);
          break;
        case 'swinging_door':
          shouldStore = this.checkSwingingDoor(tagName, value, now, config);
          break;
        default:
          shouldStore = true;
      }
    }

    if (shouldStore) {
      await this.storePoint(tagName, value, config.projectId);
      this.lastStored.set(tagName, { value, timestamp: new Date() });
      this.lastStoredTime.set(tagName, now);
      stats.stored++;
    }
  }

  private checkDeadband(tagName: string, value: number, config: any): boolean {
    const last = this.lastStored.get(tagName);
    if (!last) return true; // First point always stored

    const diff = Math.abs(value - last.value);

    // Check absolute deadband
    if (config.deadband && config.deadband > 0) {
      return diff > config.deadband;
    }

    // Check percentage deadband
    if (config.deadbandPercent && config.deadbandPercent > 0) {
      const range = Math.abs(last.value) || 1; // avoid div by zero
      const pctChange = (diff / range) * 100;
      return pctChange > config.deadbandPercent;
    }

    return true;
  }

  private checkSwingingDoor(tagName: string, value: number, timestamp: number, config: any): boolean {
    const state = this.swingState.get(tagName);
    const threshold = config.slopeThreshold || 0.1;

    if (!state) {
      // First point — initialize
      this.swingState.set(tagName, {
        lastStored: { value, timestamp },
        upperSlope: Infinity,
        lowerSlope: -Infinity,
        lastReceived: { value, timestamp },
      });
      return true;
    }

    const dt = (timestamp - state.lastStored.timestamp) / 1000; // seconds
    if (dt === 0) return false;

    const slope = (value - state.lastStored.value) / dt;

    // Calculate new door slopes
    const upperSlope = Math.min(state.upperSlope, slope + threshold);
    const lowerSlope = Math.max(state.lowerSlope, slope - threshold);

    if (upperSlope < lowerSlope) {
      // Door has closed — store the previous point and reset
      this.swingState.set(tagName, {
        lastStored: { value: state.lastReceived.value, timestamp: state.lastReceived.timestamp },
        upperSlope: Infinity,
        lowerSlope: -Infinity,
        lastReceived: { value, timestamp },
      });
      return true;
    }

    // Update state
    state.upperSlope = upperSlope;
    state.lowerSlope = lowerSlope;
    state.lastReceived = { value, timestamp };
    return false;
  }

  private async storePoint(tagName: string, value: number, projectId: string): Promise<void> {
    try {
      // Find tag ID
      const tag = await prisma.tag.findFirst({ where: { name: tagName, projectId } });
      await prisma.tagHistory.create({
        data: {
          tagId: tag?.id || '00000000-0000-0000-0000-000000000000',
          tagName,
          value,
          timestamp: new Date(),
          quality: 'GOOD',
        },
      });
    } catch (err) {
      // Silently fail — don't break polling
    }
  }

  async updateConfig(config: any): Promise<void> {
    this.configs.set(config.tagName, config);
  }

  removeConfig(tagName: string): void {
    this.configs.delete(tagName);
    this.lastStored.delete(tagName);
    this.swingState.delete(tagName);
    this.lastStoredTime.delete(tagName);
  }

  async getStats(projectId: string): Promise<any[]> {
    const results: any[] = [];
    for (const [tagName, stats] of this.statsCache) {
      const config = this.configs.get(tagName);
      if (config && config.projectId === projectId) {
        const ratio = stats.raw > 0 ? Math.round((1 - stats.stored / stats.raw) * 10000) / 100 : 0;
        results.push({
          tagName,
          totalRawPoints: stats.raw,
          totalStored: stats.stored,
          compressionRatio: ratio,
          compressionType: config.compressionType,
        });
      }
    }
    return results;
  }

  async cleanupOldData(): Promise<void> {
    const configs = await prisma.historianConfig.findMany({ where: { enabled: true } });
    for (const config of configs) {
      const cutoff = new Date(Date.now() - config.retentionDays * 86400_000);
      await prisma.tagHistory.deleteMany({
        where: {
          tagName: config.tagName,
          timestamp: { lt: cutoff },
        },
      }).catch(() => {});
    }
  }

  async manualCleanup(projectId: string, beforeDate?: Date): Promise<{ deleted: number }> {
    const cutoff = beforeDate || new Date(Date.now() - 365 * 86400_000);
    const tags = await prisma.tag.findMany({ where: { projectId }, select: { name: true } });
    const tagNames = tags.map((t) => t.name);
    const result = await prisma.tagHistory.deleteMany({
      where: {
        tagName: { in: tagNames },
        timestamp: { lt: cutoff },
      },
    });
    return { deleted: result.count };
  }

  async getStorageStats(projectId: string): Promise<any> {
    const tags = await prisma.tag.findMany({ where: { projectId }, select: { name: true } });
    const tagNames = tags.map((t) => t.name);
    const totalPoints = await prisma.tagHistory.count({
      where: { tagName: { in: tagNames } },
    });
    // Estimate ~50 bytes per row
    const estimatedBytes = totalPoints * 50;
    return {
      totalPoints,
      estimatedSizeMB: Math.round(estimatedBytes / 1024 / 1024 * 100) / 100,
      tagCount: tagNames.length,
    };
  }

  shutdown(): void {
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
  }
}

export const historianCompressionService = new HistorianCompressionService();
