import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { redis } from '../config/database';
import { env } from '../config/environment';
import { alarmService } from './alarm.service';
import { historianService } from './historian.service';
import { SimulatorAdapter } from '../protocol/SimulatorAdapter';
import type { RealTimeValue } from '@gridvision/shared';

interface TagMeta {
  tag: string;
  type: 'analog' | 'digital';
  unit?: string;
  description: string;
}

export class RealtimeService {
  private io!: SocketIOServer;
  private subscriber = redis.duplicate();
  private currentValues: Map<string, RealTimeValue> = new Map();
  private tagList: TagMeta[] = [];
  private simulator?: SimulatorAdapter;

  // Batched emission — accumulate values and emit every 250ms
  private pendingMeasurements: RealTimeValue[] = [];
  private pendingDigitals: RealTimeValue[] = [];
  private batchTimer?: NodeJS.Timeout;

  initialize(httpServer: HttpServer): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: env.CORS_ORIGIN,
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.io.on('connection', (socket: Socket) => {
      console.log(`Client connected: ${socket.id}`);

      // Send current snapshot on connect
      socket.emit('snapshot', Object.fromEntries(this.currentValues));

      // Tag subscription
      socket.on('subscribe:tags', (tags: string[]) => {
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            socket.join(`tag:${tag}`);
          }
        }
      });

      socket.on('unsubscribe:tags', (tags: string[]) => {
        if (Array.isArray(tags)) {
          for (const tag of tags) {
            socket.leave(`tag:${tag}`);
          }
        }
      });

      socket.on('subscribe:substation', (substationId: string) => {
        socket.join(`substation:${substationId}`);
      });

      socket.on('unsubscribe:substation', (substationId: string) => {
        socket.leave(`substation:${substationId}`);
      });

      // Heartbeat pong
      socket.on('ping', () => {
        socket.emit('pong', { serverTime: Date.now() });
      });

      socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
      });
    });

    this.subscribeToRedis();

    // Start batched emission timer
    this.batchTimer = setInterval(() => this.flushBatch(), 250);

    console.log('WebSocket server initialized');
  }

  // ─────────────────── Simulator integration ───────────────────

  startSimulator(): void {
    this.simulator = new SimulatorAdapter({
      id: 'sim-1',
      name: 'MSEDCL 33/11kV Simulator',
      protocol: 'SIMULATOR',
      ipAddress: '127.0.0.1',
      port: 0,
      pollingIntervalMs: 1000,
      timeoutMs: 5000,
    });

    // Build tag list from simulator
    this.tagList = this.simulator.getTagDefinitions().map((d) => ({
      tag: d.tag,
      type: d.type,
      unit: d.unit,
      description: d.description,
    }));

    // Wire up value change callback
    this.simulator.setValueChangeCallback((tag, value, unit) => {
      const rtValue: RealTimeValue = {
        tag,
        value,
        quality: 0,
        timestamp: new Date(),
      };
      this.currentValues.set(tag, rtValue);

      if (typeof value === 'number') {
        this.pendingMeasurements.push(rtValue);
        // Record to ring buffer for historian
        historianService.recordToRingBuffer(tag, value, 0);
      } else {
        this.pendingDigitals.push(rtValue);
      }
    });

    this.simulator.connect();
    console.log(`[RealtimeService] Simulator started with ${this.tagList.length} tags`);
  }

  // ─────────────────── Batch emission ───────────────────

  private flushBatch(): void {
    if (this.pendingMeasurements.length > 0) {
      this.io.emit('measurements:batch', this.pendingMeasurements);
      this.pendingMeasurements = [];
    }
    if (this.pendingDigitals.length > 0) {
      this.io.emit('digitals:batch', this.pendingDigitals);
      this.pendingDigitals = [];
    }
  }

  // ─────────────────── Redis subscriptions ───────────────────

  private subscribeToRedis(): void {
    this.subscriber.subscribe('alarms:raised', 'alarms:cleared', 'alarms:acknowledged', 'alarms:shelved');

    this.subscriber.on('message', (channel: string, message: string) => {
      try {
        const data = JSON.parse(message);
        switch (channel) {
          case 'alarms:raised':
            this.io.emit('alarm:raised', data);
            break;
          case 'alarms:cleared':
            this.io.emit('alarm:cleared', data);
            break;
          case 'alarms:acknowledged':
            this.io.emit('alarm:acknowledged', data);
            break;
          case 'alarms:shelved':
            this.io.emit('alarm:shelved', data);
            break;
        }
      } catch (err) {
        console.error('Redis message parse error:', err);
      }
    });
  }

  // ─────────────────── Publishing (existing API) ───────────────────

  async publishMeasurement(tag: string, dataPointId: string, value: number, quality: number = 0): Promise<void> {
    const rtValue: RealTimeValue = {
      tag,
      value,
      quality,
      timestamp: new Date(),
    };

    this.currentValues.set(tag, rtValue);
    this.io.emit('measurement', rtValue);

    // Store in historian DB
    await historianService.recordMeasurement(dataPointId, value, quality);

    // Also record to ring buffer
    historianService.recordToRingBuffer(tag, value, quality);

    // Evaluate alarms
    await alarmService.evaluateAnalog(dataPointId, value);
  }

  async publishDigitalState(tag: string, dataPointId: string, state: boolean, quality: number = 0): Promise<void> {
    const previousValue = this.currentValues.get(tag);
    const previousState = previousValue ? Boolean(previousValue.value) : undefined;

    const rtValue: RealTimeValue = {
      tag,
      value: state,
      quality,
      timestamp: new Date(),
    };

    this.currentValues.set(tag, rtValue);
    this.io.emit('digital_state', rtValue);

    // Store in historian
    await historianService.recordDigitalState(dataPointId, state, quality);

    // Evaluate alarms
    await alarmService.evaluateDigital(dataPointId, state, previousState);

    // Log SOE if state changed
    if (previousState !== undefined && previousState !== state) {
      await historianService.recordSOEEvent(
        dataPointId,
        previousState ? 'CLOSED' : 'OPEN',
        state ? 'CLOSED' : 'OPEN',
      );
    }
  }

  // ─────────────────── Getters ───────────────────

  getCurrentValue(tag: string): RealTimeValue | undefined {
    return this.currentValues.get(tag);
  }

  getAllCurrentValues(): Record<string, RealTimeValue> {
    return Object.fromEntries(this.currentValues);
  }

  getTagList(): TagMeta[] {
    return this.tagList;
  }

  getIO(): SocketIOServer {
    return this.io;
  }
}

export const realtimeService = new RealtimeService();
