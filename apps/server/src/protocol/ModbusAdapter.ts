import { EventEmitter } from 'events';
import type { ProtocolAdapter, ConnectionStatus, AdapterConfig } from './ProtocolAdapter';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const DEFAULT_TIMEOUT_MS = 2000;

export class ModbusAdapter extends EventEmitter implements ProtocolAdapter {
  private status: ConnectionStatus = 'DISCONNECTED';
  private statusCallbacks: Array<(connected: boolean) => void> = [];
  private config: AdapterConfig;
  private client: any = null;
  private reconnectTimer?: NodeJS.Timeout;
  private retryCount = 0;

  constructor(config: AdapterConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    this.status = 'CONNECTING';
    this.notifyStatusChange(false);

    try {
      const ModbusRTU = require('modbus-serial');
      this.client = new ModbusRTU();
      this.client.setTimeout(this.config.timeoutMs || DEFAULT_TIMEOUT_MS);

      await this.client.connectTCP(this.config.ipAddress, { port: this.config.port });
      if (this.config.slaveId) {
        this.client.setID(this.config.slaveId);
      }

      this.status = 'CONNECTED';
      this.retryCount = 0;
      this.notifyStatusChange(true);
      this.emit('connected', { name: this.config.name });
      console.log(`[ModbusAdapter] Connected: ${this.config.name} (${this.config.ipAddress}:${this.config.port})`);
    } catch (error: any) {
      console.error(`[ModbusAdapter] Connection failed for ${this.config.name}:`, error.message);
      this.status = 'ERROR';
      this.notifyStatusChange(false);
      this.emit('error', { name: this.config.name, error: error.message });
      this.scheduleReconnect();
    }
  }

  /**
   * Connect via Modbus RTU over serial port.
   */
  async connectRTU(
    serialPort: string,
    options?: { baudRate?: number; dataBits?: number; stopBits?: number; parity?: string },
  ): Promise<void> {
    this.status = 'CONNECTING';
    this.notifyStatusChange(false);

    try {
      const ModbusRTU = require('modbus-serial');
      this.client = new ModbusRTU();
      this.client.setTimeout(this.config.timeoutMs || DEFAULT_TIMEOUT_MS);

      await this.client.connectRTUBuffered(serialPort, {
        baudRate: options?.baudRate || 9600,
        dataBits: options?.dataBits || 8,
        stopBits: options?.stopBits || 1,
        parity: options?.parity?.toLowerCase() || 'none',
      });

      if (this.config.slaveId) {
        this.client.setID(this.config.slaveId);
      }

      this.status = 'CONNECTED';
      this.retryCount = 0;
      this.notifyStatusChange(true);
      this.emit('connected', { name: this.config.name, mode: 'rtu' });
      console.log(`[ModbusAdapter] RTU Connected: ${this.config.name} on ${serialPort}`);
    } catch (error: any) {
      console.error(`[ModbusAdapter] RTU connection failed for ${this.config.name}:`, error.message);
      this.status = 'ERROR';
      this.notifyStatusChange(false);
      this.emit('error', { name: this.config.name, error: error.message });
      this.scheduleReconnect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    try {
      if (this.client) {
        this.client.close(() => {});
        this.client = null;
      }
    } catch (err: any) {
      console.warn(`[ModbusAdapter] Disconnect error for ${this.config.name}:`, err.message);
    }
    this.status = 'DISCONNECTED';
    this.notifyStatusChange(false);
    this.emit('disconnected', { name: this.config.name });
  }

  async readAnalog(address: number, count: number): Promise<number[]> {
    if (this.status !== 'CONNECTED' || !this.client) throw new Error('Not connected');
    return this.withRetry(async () => {
      const result = await this.client.readHoldingRegisters(address, count);
      return result.data as number[];
    }, 'readHoldingRegisters');
  }

  async readInputRegisters(address: number, count: number): Promise<number[]> {
    if (this.status !== 'CONNECTED' || !this.client) throw new Error('Not connected');
    return this.withRetry(async () => {
      const result = await this.client.readInputRegisters(address, count);
      return result.data as number[];
    }, 'readInputRegisters');
  }

  async readDigital(address: number, count: number): Promise<boolean[]> {
    if (this.status !== 'CONNECTED' || !this.client) throw new Error('Not connected');
    return this.withRetry(async () => {
      const result = await this.client.readCoils(address, count);
      return result.data as boolean[];
    }, 'readCoils');
  }

  async writeDigital(address: number, value: boolean): Promise<boolean> {
    if (this.status !== 'CONNECTED' || !this.client) throw new Error('Not connected');
    return this.withRetry(async () => {
      await this.client.writeCoil(address, value);
      return true;
    }, 'writeCoil');
  }

  async readRawRegisters(address: number, count: number): Promise<number[]> {
    if (this.status !== 'CONNECTED' || !this.client) throw new Error('Not connected');
    return this.withRetry(async () => {
      const result = await this.client.readHoldingRegisters(address, count);
      return result.data as number[];
    }, 'readRawRegisters');
  }

  async readDiscreteInputs(address: number, count: number): Promise<boolean[]> {
    if (this.status !== 'CONNECTED' || !this.client) throw new Error('Not connected');
    return this.withRetry(async () => {
      const result = await this.client.readDiscreteInputs(address, count);
      return result.data as boolean[];
    }, 'readDiscreteInputs');
  }

  async writeSingleRegister(address: number, value: number): Promise<boolean> {
    if (this.status !== 'CONNECTED' || !this.client) throw new Error('Not connected');
    return this.withRetry(async () => {
      await this.client.writeRegister(address, value);
      return true;
    }, 'writeSingleRegister');
  }

  onStatusChange(callback: (connected: boolean) => void): void {
    this.statusCallbacks.push(callback);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private notifyStatusChange(connected: boolean): void {
    this.statusCallbacks.forEach((cb) => cb(connected));
  }

  private async withRetry<T>(fn: () => Promise<T>, opName: string): Promise<T> {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await fn();
      } catch (err: any) {
        console.warn(`[ModbusAdapter] ${this.config.name}.${opName} attempt ${attempt}/${MAX_RETRIES} failed:`, err.message);
        if (attempt === MAX_RETRIES) {
          this.status = 'ERROR';
          this.notifyStatusChange(false);
          this.scheduleReconnect();
          throw err;
        }
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      }
    }
    throw new Error('Unreachable');
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.retryCount++;
    const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1), 30000);
    console.log(`[ModbusAdapter] ${this.config.name} reconnecting in ${delay}ms (attempt ${this.retryCount})`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try {
        await this.connect();
      } catch (err: any) {
        console.error(`[ModbusAdapter] ${this.config.name} reconnect failed:`, err.message);
      }
    }, delay);
  }
}
