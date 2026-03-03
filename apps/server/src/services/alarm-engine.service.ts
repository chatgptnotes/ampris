import { prisma } from '../config/database';
import { tagEngine } from './tag-engine.service';
import { realtimeService } from './realtime.service';

interface PendingAlarm {
  definitionId: string;
  tagName: string;
  startedAt: number;
  delay: number;
}

class AlarmEngineService {
  private definitions: Map<string, any[]> = new Map(); // tagName -> definitions[]
  private pendingDelayed: Map<string, PendingAlarm> = new Map(); // defId -> pending
  private checkInterval?: NodeJS.Timeout;
  private shelveCheckInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    await this.loadDefinitions();

    // Check tag values every 500ms
    this.checkInterval = setInterval(() => this.evaluateAll(), 500);

    // Check shelve expiry every 30s
    this.shelveCheckInterval = setInterval(() => this.checkShelveExpiry(), 30000);

    console.log('[AlarmEngine] Initialized');
  }

  async loadDefinitions(): Promise<void> {
    const defs = await prisma.projectAlarmDefinition.findMany({
      where: { enabled: true },
    });
    this.definitions.clear();
    for (const def of defs) {
      const existing = this.definitions.get(def.tagName) || [];
      existing.push(def);
      this.definitions.set(def.tagName, existing);
    }
    console.log(`[AlarmEngine] Loaded ${defs.length} alarm definitions for ${this.definitions.size} tags`);
  }

  private async evaluateAll(): Promise<void> {
    for (const [tagName, defs] of this.definitions) {
      const tv = tagEngine.getTagValue(tagName);
      if (!tv) continue;

      for (const def of defs) {
        if (def.shelved || def.suppressed) continue;
        await this.evaluateDefinition(def, tv.value);
      }
    }
  }

  private async evaluateDefinition(def: any, rawValue: any): Promise<void> {
    const value = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue));
    const isTriggered = this.checkCondition(def.condition, value, def.setpoint, rawValue);

    // Find existing active alarm for this definition
    const existing = await prisma.projectActiveAlarm.findFirst({
      where: {
        definitionId: def.id,
        state: { in: ['ACTIVE_UNACK', 'ACTIVE_ACK'] },
      },
    });

    if (isTriggered && !existing) {
      // Check delay
      if (def.delay > 0) {
        const pending = this.pendingDelayed.get(def.id);
        if (!pending) {
          this.pendingDelayed.set(def.id, {
            definitionId: def.id,
            tagName: def.tagName,
            startedAt: Date.now(),
            delay: def.delay,
          });
          return;
        }
        if ((Date.now() - pending.startedAt) / 1000 < def.delay) {
          return;
        }
        this.pendingDelayed.delete(def.id);
      }

      // Activate alarm
      const alarm = await prisma.projectActiveAlarm.create({
        data: {
          definitionId: def.id,
          alarmName: def.name,
          tagName: def.tagName,
          condition: def.condition,
          severity: def.severity,
          triggerValue: isNaN(value) ? null : value,
          setpoint: def.setpoint,
          state: 'ACTIVE_UNACK',
          projectId: def.projectId,
        },
      });

      this.broadcast('alarm:activated', alarm);
    } else if (!isTriggered && existing) {
      // Clear alarm with deadband check
      if (def.deadband && def.setpoint != null) {
        const clearThreshold = this.getClearThreshold(def.condition, def.setpoint, def.deadband);
        if (!this.isBeyondClear(def.condition, value, clearThreshold)) {
          return; // Still within deadband
        }
      }

      this.pendingDelayed.delete(def.id);

      if (existing.state === 'ACTIVE_UNACK') {
        if (def.autoAck) {
          await prisma.projectActiveAlarm.update({
            where: { id: existing.id },
            data: { state: 'CLEARED', clearedAt: new Date(), acknowledgedAt: new Date(), acknowledgedBy: 'AUTO' },
          });
          this.broadcast('alarm:cleared', { ...existing, state: 'CLEARED' });
        } else {
          await prisma.projectActiveAlarm.update({
            where: { id: existing.id },
            data: { state: 'CLEARED_UNACK', clearedAt: new Date() },
          });
          this.broadcast('alarm:cleared', { ...existing, state: 'CLEARED_UNACK' });
        }
      } else if (existing.state === 'ACTIVE_ACK') {
        await prisma.projectActiveAlarm.delete({ where: { id: existing.id } });
        this.broadcast('alarm:cleared', { ...existing, state: 'CLEARED' });
      }
    } else if (!isTriggered && !existing) {
      this.pendingDelayed.delete(def.id);
    }
  }

  private checkCondition(condition: string, numValue: number, setpoint: number | null, rawValue: any): boolean {
    switch (condition) {
      case 'HI': return setpoint != null && numValue > setpoint;
      case 'HIHI': return setpoint != null && numValue > setpoint;
      case 'LO': return setpoint != null && numValue < setpoint;
      case 'LOLO': return setpoint != null && numValue < setpoint;
      case 'BOOL_TRUE': return rawValue === true || rawValue === 'true' || rawValue === 1 || rawValue === '1';
      case 'BOOL_FALSE': return rawValue === false || rawValue === 'false' || rawValue === 0 || rawValue === '0';
      default: return false;
    }
  }

  private getClearThreshold(condition: string, setpoint: number, deadband: number): number {
    switch (condition) {
      case 'HI':
      case 'HIHI':
        return setpoint - deadband;
      case 'LO':
      case 'LOLO':
        return setpoint + deadband;
      default:
        return setpoint;
    }
  }

  private isBeyondClear(condition: string, value: number, clearThreshold: number): boolean {
    switch (condition) {
      case 'HI':
      case 'HIHI':
        return value < clearThreshold;
      case 'LO':
      case 'LOLO':
        return value > clearThreshold;
      default:
        return true;
    }
  }

  async acknowledge(alarmId: string, userId: string, comment?: string): Promise<void> {
    const alarm = await prisma.projectActiveAlarm.findUnique({ where: { id: alarmId } });
    if (!alarm) throw new Error('Alarm not found');

    if (alarm.state === 'ACTIVE_UNACK') {
      await prisma.projectActiveAlarm.update({
        where: { id: alarmId },
        data: { state: 'ACTIVE_ACK', acknowledgedAt: new Date(), acknowledgedBy: userId, ackComment: comment },
      });
      this.broadcast('alarm:acknowledged', { id: alarmId, state: 'ACTIVE_ACK' });
    } else if (alarm.state === 'CLEARED_UNACK') {
      await prisma.projectActiveAlarm.delete({ where: { id: alarmId } });
      this.broadcast('alarm:acknowledged', { id: alarmId, state: 'CLEARED' });
    }
  }

  async acknowledgeAll(projectId?: string): Promise<number> {
    const where: any = { state: { in: ['ACTIVE_UNACK', 'CLEARED_UNACK'] } };
    if (projectId) where.projectId = projectId;

    const alarms = await prisma.projectActiveAlarm.findMany({ where });
    let count = 0;
    for (const alarm of alarms) {
      if (alarm.state === 'ACTIVE_UNACK') {
        await prisma.projectActiveAlarm.update({
          where: { id: alarm.id },
          data: { state: 'ACTIVE_ACK', acknowledgedAt: new Date(), acknowledgedBy: 'BULK' },
        });
        count++;
      } else if (alarm.state === 'CLEARED_UNACK') {
        await prisma.projectActiveAlarm.delete({ where: { id: alarm.id } });
        count++;
      }
    }
    this.broadcast('alarm:bulk-ack', { count });
    return count;
  }

  async shelve(definitionId: string, minutes: number, userId: string): Promise<void> {
    const shelvedUntil = new Date(Date.now() + minutes * 60 * 1000);
    await prisma.projectAlarmDefinition.update({
      where: { id: definitionId },
      data: { shelved: true, shelvedUntil, shelvedBy: userId },
    });
    await this.loadDefinitions();
    this.broadcast('alarm:shelved', { definitionId, shelvedUntil });
  }

  async unshelve(definitionId: string): Promise<void> {
    await prisma.projectAlarmDefinition.update({
      where: { id: definitionId },
      data: { shelved: false, shelvedUntil: null, shelvedBy: null },
    });
    await this.loadDefinitions();
  }

  async suppress(definitionId: string, userId: string): Promise<void> {
    await prisma.projectAlarmDefinition.update({
      where: { id: definitionId },
      data: { suppressed: true, suppressedBy: userId },
    });
    await this.loadDefinitions();
  }

  private async checkShelveExpiry(): Promise<void> {
    const now = new Date();
    await prisma.projectAlarmDefinition.updateMany({
      where: { shelved: true, shelvedUntil: { lte: now } },
      data: { shelved: false, shelvedUntil: null, shelvedBy: null },
    });
    await this.loadDefinitions();
  }

  private broadcast(event: string, data: any): void {
    try {
      const io = realtimeService.getIO();
      io.emit(event, data);
    } catch (err: any) { console.warn("[AlarmEngine] WS emit failed:", err.message); }
  }

  shutdown(): void {
    if (this.checkInterval) clearInterval(this.checkInterval);
    if (this.shelveCheckInterval) clearInterval(this.shelveCheckInterval);
  }
}

export const alarmEngine = new AlarmEngineService();
