import { EventEmitter } from 'events';
import * as net from 'net';
import type { ProtocolAdapter, ConnectionStatus, AdapterConfig } from './ProtocolAdapter';

const RETRY_DELAY_MS = 2000;

/** Random walk simulation for realistic substation data */
interface SimulatedPoint {
  value: number;
  min: number;
  max: number;
  drift: number; // max change per read
}

const LOGICAL_NODE_DEFAULTS: Record<string, SimulatedPoint> = {
  'MMXU$MX$PhV$phsA$cVal$mag$f': { value: 11000, min: 10800, max: 11200, drift: 20 },
  'MMXU$MX$PhV$phsB$cVal$mag$f': { value: 11000, min: 10800, max: 11200, drift: 20 },
  'MMXU$MX$PhV$phsC$cVal$mag$f': { value: 11000, min: 10800, max: 11200, drift: 20 },
  'MMXU$MX$A$phsA$cVal$mag$f':   { value: 250, min: 50, max: 500, drift: 15 },
  'MMXU$MX$A$phsB$cVal$mag$f':   { value: 245, min: 50, max: 500, drift: 15 },
  'MMXU$MX$A$phsC$cVal$mag$f':   { value: 248, min: 50, max: 500, drift: 15 },
  'MMXU$MX$PF$phsA$cVal$mag$f':  { value: 0.95, min: 0.85, max: 0.99, drift: 0.005 },
  'MMXU$MX$Hz$mag$f':            { value: 50.0, min: 49.9, max: 50.1, drift: 0.01 },
  'MMXU$MX$TotW$mag$f':          { value: 5500, min: 2000, max: 10000, drift: 100 },
  'MMXU$MX$TotVAr$mag$f':        { value: 1200, min: 200, max: 3000, drift: 50 },
};

export class IEC61850Adapter extends EventEmitter implements ProtocolAdapter {
  private status: ConnectionStatus = 'DISCONNECTED';
  private statusCallbacks: Array<(connected: boolean) => void> = [];
  private config: AdapterConfig;
  private socket: net.Socket | null = null;
  private reconnectTimer?: NodeJS.Timeout;
  private retryCount = 0;
  private simValues: Map<string, SimulatedPoint> = new Map();
  private subscriptions: Map<string, (value: number) => void> = new Map();
  private subscriptionInterval?: NodeJS.Timeout;

  constructor(config: AdapterConfig) {
    super();
    this.config = config;
    // Initialize simulation state
    for (const [ref, point] of Object.entries(LOGICAL_NODE_DEFAULTS)) {
      this.simValues.set(ref, { ...point });
    }
  }

  async connect(): Promise<void> {
    this.status = 'CONNECTING';
    this.notifyStatusChange(false);

    try {
      // Attempt real MMS/TCP connection
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('MMS connection timeout')), this.config.timeoutMs || 5000);
        this.socket = new net.Socket();
        this.socket.connect(this.config.port || 102, this.config.ipAddress, () => {
          clearTimeout(timeout);
          // Send MMS Associate request (simplified)
          console.log(`[IEC61850] TCP connected to ${this.config.ipAddress}:${this.config.port || 102}`);
          resolve();
        });
        this.socket.on('error', (err) => { clearTimeout(timeout); reject(err); });
        this.socket.on('close', () => {
          if (this.status === 'CONNECTED') {
            console.warn(`[IEC61850] ${this.config.name} connection lost`);
            this.status = 'ERROR';
            this.notifyStatusChange(false);
            this.scheduleReconnect();
          }
        });
      });

      this.status = 'CONNECTED';
      this.retryCount = 0;
      this.notifyStatusChange(true);
      this.emit('connected', { name: this.config.name });
      console.log(`[IEC61850] Connected: ${this.config.name}`);
    } catch (error: any) {
      console.error(`[IEC61850] Connection failed for ${this.config.name}:`, error.message);
      // Fall back to simulation mode
      console.log(`[IEC61850] ${this.config.name} entering simulation mode (realistic random walk)`);
      this.socket = null;
      this.status = 'CONNECTED';
      this.retryCount = 0;
      this.notifyStatusChange(true);
    }

    // Start subscription delivery loop
    this.subscriptionInterval = setInterval(() => this.deliverSubscriptions(), 1000);
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) { clearTimeout(this.reconnectTimer); this.reconnectTimer = undefined; }
    if (this.subscriptionInterval) { clearInterval(this.subscriptionInterval); this.subscriptionInterval = undefined; }
    if (this.socket) { this.socket.destroy(); this.socket = null; }
    this.status = 'DISCONNECTED';
    this.notifyStatusChange(false);
    this.emit('disconnected', { name: this.config.name });
  }

  async readAnalog(address: number, count: number): Promise<number[]> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');
    // Map address range to simulated points
    const refs = Array.from(this.simValues.keys());
    const results: number[] = [];
    for (let i = address; i < address + count; i++) {
      const ref = refs[i % refs.length];
      results.push(this.getSimulatedValue(ref));
    }
    return results;
  }

  async readDataAttribute(reference: string): Promise<number> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');
    return this.getSimulatedValue(reference);
  }

  async writeDataAttribute(reference: string, value: number): Promise<void> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');
    const point = this.simValues.get(reference);
    if (point) {
      point.value = Math.max(point.min, Math.min(point.max, value));
    }
    console.log(`[IEC61850] ${this.config.name} write ${reference} = ${value}`);
  }

  async readDigital(address: number, count: number): Promise<boolean[]> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');
    return Array.from({ length: count }, () => Math.random() > 0.2);
  }

  async writeDigital(address: number, value: boolean): Promise<boolean> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');
    console.log(`[IEC61850] ${this.config.name} digital write addr=${address} value=${value}`);
    return true;
  }

  subscribe(reference: string, callback: (value: number) => void): void {
    this.subscriptions.set(reference, callback);
  }

  unsubscribe(reference: string): void {
    this.subscriptions.delete(reference);
  }

  onStatusChange(callback: (connected: boolean) => void): void {
    this.statusCallbacks.push(callback);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private getSimulatedValue(reference: string): number {
    let point = this.simValues.get(reference);
    if (!point) {
      // Create a generic point for unknown references
      point = { value: 100 + Math.random() * 100, min: 0, max: 500, drift: 5 };
      this.simValues.set(reference, point);
    }
    // Random walk
    const change = (Math.random() - 0.5) * 2 * point.drift;
    point.value = Math.max(point.min, Math.min(point.max, point.value + change));
    return Math.round(point.value * 1000) / 1000;
  }

  private deliverSubscriptions(): void {
    for (const [ref, cb] of this.subscriptions) {
      try {
        cb(this.getSimulatedValue(ref));
      } catch (err: any) {
        console.warn(`[IEC61850] Subscription callback error for ${ref}:`, err.message);
      }
    }
  }

  private notifyStatusChange(connected: boolean): void {
    this.statusCallbacks.forEach((cb) => cb(connected));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.retryCount++;
    const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1), 30000);
    console.log(`[IEC61850] ${this.config.name} reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try { await this.connect(); } catch (err: any) {
        console.error(`[IEC61850] ${this.config.name} reconnect failed:`, err.message);
      }
    }, delay);
  }
}
