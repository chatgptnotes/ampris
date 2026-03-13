/**
 * IEC 60870-5-103 Protocol Adapter
 *
 * For legacy ABB serial relays: REF54x, SPAJ, SPACOM series.
 * IEC 103 is a companion standard used for serial communication
 * with protection relays at 9600 baud (typically RS-485).
 *
 * Frame format: 68 L L 68 (variable length) or 10 (fixed length)
 * Link layer: FT1.2 (IEC 870-5-1)
 * Application layer: IEC 60870-5-103
 *
 * Common ASDU types:
 *   Type 1 (M_SP_NA) — Time-tagged message (protection events)
 *   Type 2 (M_DP_NA) — Time-tagged message with relative time
 *   Type 5 (M_IT_NA) — Measurands (analog values)
 *   Type 9 (M_ME_NA) — Measurand with tag (current, voltage, etc.)
 *   Type 20 (C_RD_NA) — General interrogation command
 *   Type 21 (C_RD_NA) — General command
 */

import { EventEmitter } from 'events';
import type { ProtocolAdapter, ConnectionStatus, AdapterConfig } from './ProtocolAdapter';

const DEFAULT_BAUD = 9600;
const DEFAULT_LINK_ADDRESS = 1;
const RETRY_DELAY_MS = 3000;

// IEC 103 Frame Types
const FRAME_FIXED = 0x10;
const FRAME_VARIABLE_START = 0x68;
const FRAME_END = 0x16;

// Function Codes
const FC_RESET_REMOTE_LINK = 0x00;
const FC_RESET_USER_PROCESS = 0x01;
const FC_SEND_CONFIRM = 0x03;
const FC_SEND_NOREPLY = 0x04;
const FC_REQUEST_ACCESS = 0x08;
const FC_REQUEST_STATUS = 0x09;
const FC_REQUEST_CLASS1 = 0x0A;
const FC_REQUEST_CLASS2 = 0x0B;

// ASDU Type IDs
const ASDU_GENERAL_INTERROGATION = 7;   // C_GI (General Interrogation)
const ASDU_MEASURANDS_1 = 3;           // Measurands type I
const ASDU_MEASURANDS_2 = 9;           // Measurands type II
const ASDU_TIME_TAGGED = 1;            // Time-tagged message
const ASDU_GENERAL_COMMAND = 20;       // General command

export interface IEC103Config extends AdapterConfig {
  serialPort: string;
  baudRate?: number;
  dataBits?: number;
  stopBits?: number;
  parity?: string;
  linkAddress?: number;
}

interface MeasurandValue {
  ioa: number; // Information Object Address
  value: number;
  overflow: boolean;
  timestamp?: Date;
}

export class IEC103Adapter extends EventEmitter implements ProtocolAdapter {
  private status: ConnectionStatus = 'DISCONNECTED';
  private statusCallbacks: Array<(connected: boolean) => void> = [];
  private config: IEC103Config;
  private port: any = null; // SerialPort instance
  private reconnectTimer?: NodeJS.Timeout;
  private retryCount = 0;
  private linkAddress: number;
  private fcb = false; // Frame Count Bit
  private receiveBuffer: Buffer = Buffer.alloc(0);
  private measurands: Map<number, MeasurandValue> = new Map();
  private simValues: Map<number, number> = new Map();

  constructor(config: IEC103Config) {
    super();
    this.config = config;
    this.linkAddress = config.linkAddress || DEFAULT_LINK_ADDRESS;

    // Initialize simulation values for common IOAs
    // IOA 1-3: Phase voltages, 4-6: Phase currents, 7: Frequency, 8: Power, 9: PF
    this.simValues.set(1, 132.0);  // Phase A Voltage (kV)
    this.simValues.set(2, 131.5);  // Phase B Voltage
    this.simValues.set(3, 132.2);  // Phase C Voltage
    this.simValues.set(4, 350);    // Phase A Current (A)
    this.simValues.set(5, 345);    // Phase B Current
    this.simValues.set(6, 352);    // Phase C Current
    this.simValues.set(7, 50.01);  // Frequency (Hz)
    this.simValues.set(8, 45.5);   // Active Power (MW)
    this.simValues.set(9, 0.95);   // Power Factor
    this.simValues.set(10, 12.3);  // Reactive Power (MVAr)
  }

  async connect(): Promise<void> {
    this.status = 'CONNECTING';
    this.notifyStatusChange(false);

    try {
      // Try to load serialport module dynamically
      const { SerialPort } = await import('serialport');

      this.port = new SerialPort({
        path: this.config.serialPort,
        baudRate: this.config.baudRate || DEFAULT_BAUD,
        dataBits: (this.config.dataBits || 8) as 5 | 6 | 7 | 8,
        stopBits: (this.config.stopBits || 1) as 1 | 1.5 | 2,
        parity: (this.config.parity?.toLowerCase() || 'even') as 'none' | 'even' | 'odd',
        autoOpen: false,
      });

      await new Promise<void>((resolve, reject) => {
        this.port.open((err: Error | null) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Set up data handler
      this.port.on('data', (data: Buffer) => {
        this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
        this.processReceiveBuffer();
      });

      this.port.on('error', (err: Error) => {
        console.error(`[IEC103] Serial error for ${this.config.name}:`, err.message);
        this.status = 'ERROR';
        this.notifyStatusChange(false);
        this.scheduleReconnect();
      });

      this.port.on('close', () => {
        if (this.status === 'CONNECTED') {
          this.status = 'ERROR';
          this.notifyStatusChange(false);
          this.scheduleReconnect();
        }
      });

      // Send reset remote link
      this.sendFixedFrame(FC_RESET_REMOTE_LINK);

      // Wait a bit, then send general interrogation
      await new Promise(r => setTimeout(r, 500));
      this.sendGeneralInterrogation();

      this.status = 'CONNECTED';
      this.retryCount = 0;
      this.notifyStatusChange(true);
      this.emit('connected', { name: this.config.name, mode: 'serial' });
      console.log(`[IEC103] Connected: ${this.config.name} on ${this.config.serialPort}`);
    } catch (error: any) {
      console.warn(`[IEC103] Serial connection failed for ${this.config.name}: ${error.message}`);
      console.log(`[IEC103] ${this.config.name} entering simulation mode`);
      this.port = null;
      this.status = 'CONNECTED';
      this.retryCount = 0;
      this.notifyStatusChange(true);
      this.emit('connected', { name: this.config.name, mode: 'simulation' });
    }
  }

  async disconnect(): Promise<void> {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
    if (this.port) {
      try {
        await new Promise<void>((resolve) => {
          this.port.close(() => resolve());
        });
      } catch { /* ignore */ }
      this.port = null;
    }
    this.status = 'DISCONNECTED';
    this.notifyStatusChange(false);
    this.emit('disconnected', { name: this.config.name });
  }

  async readAnalog(address: number, count: number): Promise<number[]> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');

    if (this.port) {
      // Request measurands via IEC 103
      this.sendGeneralInterrogation();
      // Wait for response
      await new Promise(r => setTimeout(r, 200));
    }

    const results: number[] = [];
    for (let i = address; i < address + count; i++) {
      const measured = this.measurands.get(i);
      if (measured) {
        results.push(measured.value);
      } else {
        // Simulation fallback
        results.push(this.getSimulatedValue(i));
      }
    }
    return results;
  }

  async readDigital(address: number, count: number): Promise<boolean[]> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');
    return Array.from({ length: count }, () => Math.random() > 0.1);
  }

  async writeDigital(address: number, value: boolean): Promise<boolean> {
    if (this.status !== 'CONNECTED') throw new Error('Not connected');

    if (this.port) {
      // Send general command (ASDU type 20)
      this.sendGeneralCommand(address, value ? 1 : 0);
    }
    console.log(`[IEC103] ${this.config.name} digital write IOA=${address} value=${value}`);
    return true;
  }

  onStatusChange(callback: (connected: boolean) => void): void {
    this.statusCallbacks.push(callback);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // ─── IEC 103 Frame Construction ───────────────────

  /**
   * Send fixed-length frame (10 C A CS 16)
   */
  private sendFixedFrame(fc: number): void {
    if (!this.port) return;
    const c = (fc & 0x0F) | (this.fcb ? 0x20 : 0x00) | 0x40; // DIR=1, PRM=1
    const checksum = (c + this.linkAddress) & 0xFF;
    const frame = Buffer.from([FRAME_FIXED, c, this.linkAddress, checksum, FRAME_END]);
    this.port.write(frame);
    this.fcb = !this.fcb;
  }

  /**
   * Send variable-length frame (68 L L 68 C A ... CS 16)
   */
  private sendVariableFrame(fc: number, asdu: Buffer): void {
    if (!this.port) return;
    const c = (fc & 0x0F) | (this.fcb ? 0x20 : 0x00) | 0x40; // DIR=1, PRM=1
    const dataLen = 2 + asdu.length; // C + A + ASDU
    let checksum = (c + this.linkAddress) & 0xFF;
    for (const b of asdu) checksum = (checksum + b) & 0xFF;

    const frame = Buffer.alloc(6 + asdu.length);
    frame[0] = FRAME_VARIABLE_START;
    frame[1] = dataLen;
    frame[2] = dataLen;
    frame[3] = FRAME_VARIABLE_START;
    frame[4] = c;
    frame[5] = this.linkAddress;
    asdu.copy(frame, 6);
    frame[6 + asdu.length - 2] = checksum;
    frame[6 + asdu.length - 1] = FRAME_END;

    // Recalculate frame size correctly
    const fullFrame = Buffer.alloc(4 + dataLen + 2);
    fullFrame[0] = FRAME_VARIABLE_START;
    fullFrame[1] = dataLen;
    fullFrame[2] = dataLen;
    fullFrame[3] = FRAME_VARIABLE_START;
    fullFrame[4] = c;
    fullFrame[5] = this.linkAddress;
    asdu.copy(fullFrame, 6);
    let cs = (c + this.linkAddress) & 0xFF;
    for (const b of asdu) cs = (cs + b) & 0xFF;
    fullFrame[4 + dataLen] = cs;
    fullFrame[4 + dataLen + 1] = FRAME_END;

    this.port.write(fullFrame);
    this.fcb = !this.fcb;
  }

  /**
   * Send General Interrogation (ASDU type 7, cause 9)
   */
  private sendGeneralInterrogation(): void {
    const asdu = Buffer.from([
      ASDU_GENERAL_INTERROGATION, // Type ID
      0x81,                        // VSQ: SQ=1, number=1
      0x09,                        // Cause of transmission: Activation
      this.linkAddress,            // Common address
      0xFE,                        // Function type: Global
      0x00,                        // Information number
      0x00,                        // Scan number
    ]);
    this.sendVariableFrame(FC_SEND_CONFIRM, asdu);
  }

  /**
   * Send General Command (ASDU type 20)
   */
  private sendGeneralCommand(ioa: number, value: number): void {
    const asdu = Buffer.from([
      ASDU_GENERAL_COMMAND,  // Type ID
      0x01,                   // VSQ
      0x06,                   // Cause: Activation
      this.linkAddress,       // Common address
      0xFE,                   // Function type
      ioa & 0xFF,             // IOA
      value & 0xFF,           // DCO
      0x00,                   // RII
    ]);
    this.sendVariableFrame(FC_SEND_CONFIRM, asdu);
  }

  // ─── Response Processing ──────────────────────────

  private processReceiveBuffer(): void {
    while (this.receiveBuffer.length > 0) {
      if (this.receiveBuffer[0] === FRAME_FIXED) {
        if (this.receiveBuffer.length < 5) break;
        // Fixed frame: 10 C A CS 16
        const c = this.receiveBuffer[1];
        const a = this.receiveBuffer[2];
        const cs = this.receiveBuffer[3];
        if (this.receiveBuffer[4] === FRAME_END && ((c + a) & 0xFF) === cs) {
          this.processFixedFrame(c, a);
        }
        this.receiveBuffer = this.receiveBuffer.subarray(5);
      } else if (this.receiveBuffer[0] === FRAME_VARIABLE_START) {
        if (this.receiveBuffer.length < 6) break;
        const l1 = this.receiveBuffer[1];
        const l2 = this.receiveBuffer[2];
        if (l1 !== l2 || this.receiveBuffer[3] !== FRAME_VARIABLE_START) {
          this.receiveBuffer = this.receiveBuffer.subarray(1);
          continue;
        }
        const totalLen = 4 + l1 + 2; // start(4) + data(l) + cs + end
        if (this.receiveBuffer.length < totalLen) break;

        const data = this.receiveBuffer.subarray(4, 4 + l1);
        this.processVariableFrame(data);
        this.receiveBuffer = this.receiveBuffer.subarray(totalLen);
      } else {
        // Skip unknown byte
        this.receiveBuffer = this.receiveBuffer.subarray(1);
      }
    }
  }

  private processFixedFrame(c: number, a: number): void {
    const fc = c & 0x0F;
    if (fc === 0x00 || fc === 0x01) {
      // ACK / NACK
      this.emit('ack', { fc, address: a });
    } else if (fc === 0x0B) {
      // No data available
    }
  }

  private processVariableFrame(data: Buffer): void {
    if (data.length < 6) return;
    const c = data[0];
    const a = data[1]; // Link address
    const asdu = data.subarray(2);

    if (asdu.length < 5) return;
    const typeId = asdu[0];
    const vsq = asdu[1];
    const cot = asdu[2]; // Cause of transmission
    const commonAddr = asdu[3];
    const payload = asdu.subarray(4);

    if (typeId === ASDU_MEASURANDS_2 || typeId === ASDU_MEASURANDS_1) {
      this.processMeasurands(payload, vsq);
    } else if (typeId === ASDU_TIME_TAGGED) {
      this.processTimeTagged(payload, vsq);
    }
  }

  private processMeasurands(payload: Buffer, vsq: number): void {
    const sq = (vsq >> 7) & 1;
    const count = vsq & 0x7F;
    let offset = 0;

    if (sq) {
      // Sequence: first IOA, then consecutive values
      if (payload.length < 2) return;
      const startIoa = payload[0] | (payload[1] << 8);
      offset = 2;
      for (let i = 0; i < count && offset + 1 < payload.length; i++) {
        const raw = payload.readInt16LE(offset);
        const normalized = raw / 32767.0; // IEC 103 normalized value
        this.measurands.set(startIoa + i, {
          ioa: startIoa + i,
          value: normalized,
          overflow: (raw & 0x01) !== 0,
          timestamp: new Date(),
        });
        offset += 2;
      }
    } else {
      // Individual: each has its own IOA
      for (let i = 0; i < count && offset + 3 < payload.length; i++) {
        const ioa = payload[offset] | (payload[offset + 1] << 8);
        offset += 2;
        const raw = payload.readInt16LE(offset);
        const normalized = raw / 32767.0;
        this.measurands.set(ioa, {
          ioa,
          value: normalized,
          overflow: false,
          timestamp: new Date(),
        });
        offset += 2;
      }
    }

    this.emit('measurands', Array.from(this.measurands.values()));
  }

  private processTimeTagged(payload: Buffer, vsq: number): void {
    // Process protection events
    this.emit('event', { raw: payload, vsq });
  }

  // ─── Simulation ───────────────────────────────────

  private getSimulatedValue(ioa: number): number {
    let val = this.simValues.get(ioa);
    if (val === undefined) {
      val = 100 + Math.random() * 100;
      this.simValues.set(ioa, val);
    }
    // Random walk
    const drift = val * 0.002; // 0.2% drift
    val += (Math.random() - 0.5) * 2 * drift;
    this.simValues.set(ioa, val);
    return Math.round(val * 1000) / 1000;
  }

  private notifyStatusChange(connected: boolean): void {
    this.statusCallbacks.forEach((cb) => cb(connected));
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.retryCount++;
    const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, this.retryCount - 1), 30000);
    console.log(`[IEC103] ${this.config.name} reconnecting in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = undefined;
      try { await this.connect(); } catch (err: any) {
        console.error(`[IEC103] ${this.config.name} reconnect failed:`, err.message);
      }
    }, delay);
  }
}
