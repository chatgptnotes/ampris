import { prisma } from '../config/database';
import { realtimeService } from './realtime.service';

type RedundancyState = 'standalone' | 'active' | 'standby' | 'failover';

interface PartnerStatus {
  connected: boolean;
  lastHeartbeat: Date | null;
  latencyMs: number;
}

class RedundancyService {
  private heartbeatInterval?: NodeJS.Timeout;
  private syncInterval?: NodeJS.Timeout;
  private currentState: RedundancyState = 'standalone';
  private partnerStatus: PartnerStatus = { connected: false, lastHeartbeat: null, latencyMs: 0 };
  private startedAt: Date = new Date();
  private projectId: string | null = null;

  async initialize(projectId: string): Promise<void> {
    this.projectId = projectId;
    const config = await prisma.redundancyConfig.findUnique({ where: { projectId } });
    if (!config) return;

    this.currentState = config.status as RedundancyState;

    // Start heartbeat simulation
    this.heartbeatInterval = setInterval(() => this.sendHeartbeat(), config.heartbeatMs);
    this.syncInterval = setInterval(() => this.syncState(), config.syncInterval);

    console.log(`[Redundancy] Initialized as ${config.role} (${config.status})`);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.projectId) return;

    const config = await prisma.redundancyConfig.findUnique({ where: { projectId: this.projectId } });
    if (!config || !config.partnerHost) return;

    // Simulated heartbeat — in production, this would be an HTTP/TCP call to partner
    const simulatedLatency = 2 + Math.random() * 10;
    const simulatedSuccess = Math.random() > 0.02; // 2% failure rate

    if (simulatedSuccess) {
      this.partnerStatus = {
        connected: true,
        lastHeartbeat: new Date(),
        latencyMs: Math.round(simulatedLatency * 100) / 100,
      };

      await prisma.redundancyConfig.update({
        where: { projectId: this.projectId },
        data: { lastHeartbeat: new Date() },
      }).catch(() => {});

      try {
        realtimeService.getIO().emit('redundancy:heartbeat', {
          status: this.currentState,
          partnerConnected: true,
          latencyMs: simulatedLatency,
          timestamp: new Date(),
        });
      } catch {}
    } else {
      // Check if partner is down long enough for failover
      const lastHb = this.partnerStatus.lastHeartbeat;
      if (lastHb && (Date.now() - lastHb.getTime()) > config.failoverTimeout) {
        if (config.autoFailover && this.currentState === 'standby') {
          await this.triggerFailover('Heartbeat lost for ' + config.failoverTimeout + 'ms');
        }
      }
      this.partnerStatus.connected = false;
    }
  }

  private async syncState(): Promise<void> {
    if (!this.projectId) return;

    // Simulated sync
    await prisma.redundancyConfig.update({
      where: { projectId: this.projectId },
      data: { lastSync: new Date() },
    }).catch(() => {});
  }

  async triggerFailover(reason: string): Promise<void> {
    if (!this.projectId) return;

    const previousState = this.currentState;
    this.currentState = 'active';

    await prisma.redundancyConfig.update({
      where: { projectId: this.projectId },
      data: { status: 'active', role: 'PRIMARY' },
    }).catch(() => {});

    await prisma.failoverEvent.create({
      data: {
        type: 'FAILOVER_COMPLETE',
        fromRole: previousState === 'standby' ? 'STANDBY' : previousState.toUpperCase(),
        toRole: 'PRIMARY',
        reason,
        details: { previousState, timestamp: new Date() },
        projectId: this.projectId,
      },
    }).catch(() => {});

    try {
      realtimeService.getIO().emit('redundancy:failover', {
        fromRole: previousState,
        toRole: 'active',
        reason,
        timestamp: new Date(),
      });
    } catch {}

    console.log(`[Redundancy] Failover: ${previousState} → active (${reason})`);
  }

  async promote(projectId: string): Promise<void> {
    this.projectId = projectId;
    const previousState = this.currentState;
    this.currentState = 'active';

    await prisma.redundancyConfig.update({
      where: { projectId },
      data: { status: 'active', role: 'PRIMARY' },
    });

    await prisma.failoverEvent.create({
      data: {
        type: 'FAILOVER_COMPLETE',
        fromRole: previousState.toUpperCase(),
        toRole: 'PRIMARY',
        reason: 'Manual promotion',
        projectId,
      },
    });

    try {
      realtimeService.getIO().emit('redundancy:failover', {
        fromRole: previousState,
        toRole: 'active',
        reason: 'Manual promotion',
        timestamp: new Date(),
      });
    } catch {}
  }

  async demote(projectId: string): Promise<void> {
    this.projectId = projectId;
    const previousState = this.currentState;
    this.currentState = 'standby';

    await prisma.redundancyConfig.update({
      where: { projectId },
      data: { status: 'standby', role: 'STANDBY' },
    });

    await prisma.failoverEvent.create({
      data: {
        type: 'SWITCHBACK',
        fromRole: previousState.toUpperCase(),
        toRole: 'STANDBY',
        reason: 'Manual demotion',
        projectId,
      },
    });

    try {
      realtimeService.getIO().emit('redundancy:switchback', {
        fromRole: previousState,
        toRole: 'standby',
        reason: 'Manual demotion',
        timestamp: new Date(),
      });
    } catch {}
  }

  async testFailover(projectId: string): Promise<void> {
    const config = await prisma.redundancyConfig.findUnique({ where: { projectId } });
    if (!config) throw new Error('No redundancy config found');

    // Simulate failover sequence
    await prisma.failoverEvent.create({
      data: {
        type: 'HEARTBEAT_LOST',
        fromRole: config.role,
        toRole: config.role,
        reason: 'Test failover initiated',
        projectId,
      },
    });

    // Brief delay then complete
    await new Promise((r) => setTimeout(r, 500));

    await this.triggerFailover('Test failover');
  }

  getStatus(projectId: string): {
    role: string;
    status: string;
    uptime: number;
    partner: PartnerStatus;
    lastSync: Date | null;
  } {
    return {
      role: this.currentState === 'active' ? 'PRIMARY' : this.currentState === 'standby' ? 'STANDBY' : this.currentState.toUpperCase(),
      status: this.currentState,
      uptime: Date.now() - this.startedAt.getTime(),
      partner: this.partnerStatus,
      lastSync: null,
    };
  }

  shutdown(): void {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.syncInterval) clearInterval(this.syncInterval);
  }
}

export const redundancyService = new RedundancyService();
