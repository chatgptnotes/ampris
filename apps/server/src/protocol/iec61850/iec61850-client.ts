/**
 * IEC 61850 MMS Client (Pure TypeScript)
 *
 * Implements MMS (Manufacturing Message Specification) over TCP/IP
 * for browsing and reading IEC 61850 data from protection relays.
 *
 * MMS Protocol Stack:
 *   Application: MMS (ISO 9506)
 *   Presentation: ISO 8823 (ACSE)
 *   Session: ISO 8327 (COTP)
 *   Transport: RFC 1006 (TPKT over TCP port 102)
 *
 * This is a pure-JS client that handles the TPKT/COTP/MMS framing
 * and implements the core browse/read operations needed for relay discovery.
 *
 * For production use with high-speed data, consider the libiec61850 native addon.
 */

import * as net from 'net';
import { EventEmitter } from 'events';

// ─── Data Model Types ───────────────────────────────

export interface LogicalDevice {
  name: string;
  logicalNodes: LogicalNode[];
}

export interface LogicalNode {
  name: string;
  lnClass: string; // e.g. MMXU, XCBR, PTOC, PDIS
  dataObjects: DataObject[];
}

export interface DataObject {
  name: string;
  cdcType?: string; // e.g. MV, SPC, DPC, INS, SPS
  dataAttributes: DataAttribute[];
}

export interface DataAttribute {
  name: string;
  reference: string; // Full IEC 61850 reference path
  fc: string; // Functional Constraint: MX, ST, CF, CO, etc.
  type: string; // BasicType: FLOAT32, BOOLEAN, INT32, etc.
  value?: number | boolean | string;
}

export interface MmsServerDirectory {
  logicalDevices: LogicalDevice[];
  serverName?: string;
  vendorName?: string;
  modelName?: string;
}

// ─── MMS Protocol Constants ─────────────────────────

// TPKT Header (RFC 1006)
const TPKT_VERSION = 0x03;

// COTP (ISO 8073)
const COTP_CR = 0xE0;  // Connection Request
const COTP_CC = 0xD0;  // Connection Confirm
const COTP_DT = 0xF0;  // Data Transfer

// MMS PDU Tags (ASN.1 context-specific)
const MMS_INITIATE_REQUEST = 0xA8;
const MMS_INITIATE_RESPONSE = 0xA9;
const MMS_CONFIRMED_REQUEST = 0xA0;
const MMS_CONFIRMED_RESPONSE = 0xA1;

// MMS Service Tags
const MMS_GET_NAME_LIST = 0xA1;
const MMS_READ = 0xA4;
const MMS_GET_VARIABLE_ACCESS_ATTRIBUTES = 0xA6;

// ─── MMS Client ─────────────────────────────────────

export class IEC61850MmsClient extends EventEmitter {
  private socket: net.Socket | null = null;
  private connected = false;
  private host: string;
  private port: number;
  private timeoutMs: number;
  private invokeId = 0;
  private pendingRequests: Map<number, { resolve: (data: Buffer) => void; reject: (err: Error) => void; timer: NodeJS.Timeout }> = new Map();
  private receiveBuffer: Buffer = Buffer.alloc(0);

  constructor(host: string, port: number = 102, timeoutMs: number = 10000) {
    super();
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.socket) this.socket.destroy();
        reject(new Error(`Connection timeout after ${this.timeoutMs}ms`));
      }, this.timeoutMs);

      this.socket = new net.Socket();

      this.socket.on('data', (data: Buffer) => {
        this.receiveBuffer = Buffer.concat([this.receiveBuffer, data]);
        this.processReceiveBuffer();
      });

      this.socket.on('error', (err: Error) => {
        clearTimeout(timer);
        this.connected = false;
        this.rejectAllPending(err);
        reject(err);
      });

      this.socket.on('close', () => {
        this.connected = false;
        this.rejectAllPending(new Error('Connection closed'));
        this.emit('disconnected');
      });

      this.socket.connect(this.port, this.host, async () => {
        clearTimeout(timer);
        try {
          await this.sendCOTPConnectionRequest();
          await this.sendMmsInitiateRequest();
          this.connected = true;
          this.emit('connected');
          resolve();
        } catch (err) {
          this.socket?.destroy();
          reject(err);
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    this.rejectAllPending(new Error('Client disconnecting'));
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.connected = false;
  }

  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the server directory — list of Logical Devices.
   * Equivalent to IedConnection_getServerDirectory() in libiec61850.
   */
  async getServerDirectory(): Promise<string[]> {
    const response = await this.sendMmsGetNameListRequest('VMD', '');
    return this.parseNameListResponse(response);
  }

  /**
   * Get directory of a Logical Device — list of Logical Nodes.
   * Equivalent to IedConnection_getLogicalDeviceDirectory().
   */
  async getLogicalDeviceDirectory(ldName: string): Promise<string[]> {
    const response = await this.sendMmsGetNameListRequest('DOMAIN', ldName);
    return this.parseNameListResponse(response);
  }

  /**
   * Get directory of a Logical Node — list of Data Objects.
   * Equivalent to IedConnection_getLogicalNodeDirectory().
   */
  async getLogicalNodeDirectory(ldName: string, lnName: string): Promise<string[]> {
    const reference = `${ldName}/${lnName}`;
    const response = await this.sendMmsGetNameListRequest('NAMED_VARIABLE', reference);
    return this.parseNameListResponse(response);
  }

  /**
   * Read a float value from the server.
   */
  async readFloatValue(reference: string): Promise<number> {
    const response = await this.sendMmsReadRequest(reference);
    return this.parseFloatFromResponse(response);
  }

  /**
   * Read a boolean value from the server.
   */
  async readBooleanValue(reference: string): Promise<boolean> {
    const response = await this.sendMmsReadRequest(reference);
    return this.parseBooleanFromResponse(response);
  }

  /**
   * Read an integer value from the server.
   */
  async readInt32Value(reference: string): Promise<number> {
    const response = await this.sendMmsReadRequest(reference);
    return this.parseIntFromResponse(response);
  }

  /**
   * Browse the complete data model tree.
   * Returns full hierarchy: LDs -> LNs -> DOs -> DAs
   */
  async browseFullModel(): Promise<MmsServerDirectory> {
    const result: MmsServerDirectory = { logicalDevices: [] };

    // Step 1: Get Logical Devices
    const ldNames = await this.getServerDirectory();

    for (const ldName of ldNames) {
      const ld: LogicalDevice = { name: ldName, logicalNodes: [] };

      try {
        // Step 2: Get Logical Nodes for each LD
        const lnNames = await this.getLogicalDeviceDirectory(ldName);

        for (const lnName of lnNames) {
          const lnClass = this.extractLNClass(lnName);
          const ln: LogicalNode = { name: lnName, lnClass, dataObjects: [] };

          try {
            // Step 3: Get Data Objects for each LN
            const doNames = await this.getLogicalNodeDirectory(ldName, lnName);

            for (const doName of doNames) {
              const dataObj: DataObject = { name: doName, dataAttributes: [] };

              // We don't recursively browse DAs by default (too slow for initial discovery)
              // User can expand individual DOs in the UI
              ln.dataObjects.push(dataObj);
            }
          } catch {
            // Some LNs may not be browsable
          }

          ld.logicalNodes.push(ln);
        }
      } catch {
        // Some LDs may not be browsable
      }

      result.logicalDevices.push(ld);
    }

    return result;
  }

  // ─── TPKT / COTP / MMS Protocol Implementation ───

  private sendRaw(data: Buffer): void {
    if (!this.socket) throw new Error('Not connected');
    // Wrap in TPKT header
    const tpkt = Buffer.alloc(4 + data.length);
    tpkt[0] = TPKT_VERSION;
    tpkt[1] = 0;
    tpkt.writeUInt16BE(4 + data.length, 2);
    data.copy(tpkt, 4);
    this.socket.write(tpkt);
  }

  private async sendCOTPConnectionRequest(): Promise<void> {
    // COTP Connection Request (CR) PDU
    const cotpCR = Buffer.from([
      0x0B,       // Length indicator
      COTP_CR,    // CR code
      0x00, 0x01, // Destination reference
      0x00, 0x00, // Source reference
      0x00,       // Class 0
      // Parameters
      0xC0, 0x01, 0x0A, // TPDU size: 1024
      0xC1, 0x02, 0x00, 0x01, // Calling TSAP
    ]);
    this.sendRaw(cotpCR);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('COTP CC timeout')), this.timeoutMs);
      const handler = () => {
        clearTimeout(timer);
        // We'll check the response in processReceiveBuffer
        resolve();
      };
      this.once('cotp-cc', handler);
      // Also handle timeout
      this.once('cotp-error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private async sendMmsInitiateRequest(): Promise<void> {
    // MMS Initiate Request wrapped in COTP DT
    // Simplified ASN.1 encoding
    const mmsInitiate = Buffer.from([
      // COTP DT header
      0x02, COTP_DT, 0x80,
      // Session / Presentation layer (simplified)
      // MMS Initiate Request
      MMS_INITIATE_REQUEST, 0x1A,
      // Local Detail Calling
      0x80, 0x03, 0x00, 0xFD, 0xE8,
      // Proposed Max Services Outstanding Calling
      0x81, 0x01, 0x05,
      // Proposed Max Services Outstanding Called
      0x82, 0x01, 0x05,
      // Proposed Data Structure Nesting Level
      0x83, 0x01, 0x0A,
      // Init Request Detail
      0xA4, 0x0A,
        0x80, 0x01, 0x01, // proposed version
        0x81, 0x03, 0x05, 0xF1, 0x00, // parameter CBB
        0x82, 0x0C, 0x03, 0xEE, 0x08, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
    ]);
    this.sendRaw(mmsInitiate);

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('MMS Initiate timeout')), this.timeoutMs);
      this.once('mms-initiate-response', () => {
        clearTimeout(timer);
        resolve();
      });
      this.once('mms-error', (err: Error) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  private async sendMmsGetNameListRequest(objectClass: string, domainId: string): Promise<Buffer> {
    const id = ++this.invokeId;

    // Build GetNameList request
    // ObjectClass: 0=VMD, 1=DOMAIN, 2=NAMED_VARIABLE
    const objectClassTag = objectClass === 'VMD' ? 0 : objectClass === 'DOMAIN' ? 1 : 2;

    // Build ASN.1 encoded request
    const parts: Buffer[] = [];

    // InvokeID
    parts.push(this.asn1Encode(0x02, this.asn1EncodeInteger(id)));

    // GetNameList
    const gnlParts: Buffer[] = [];
    // objectClass (context 0)
    gnlParts.push(this.asn1Encode(0xA0, Buffer.from([0x02, 0x01, objectClassTag])));

    // objectScope (context 1)
    if (objectClass === 'VMD') {
      gnlParts.push(this.asn1Encode(0xA1, Buffer.from([0x80, 0x00]))); // VMD-specific
    } else if (objectClass === 'DOMAIN') {
      const domainBuf = Buffer.from(domainId, 'utf-8');
      gnlParts.push(this.asn1Encode(0xA1, this.asn1Encode(0x81, domainBuf))); // domain-specific
    } else {
      const refBuf = Buffer.from(domainId, 'utf-8');
      gnlParts.push(this.asn1Encode(0xA1, this.asn1Encode(0x81, refBuf)));
    }

    const gnlBody = Buffer.concat(gnlParts);
    parts.push(this.asn1Encode(0xA1, gnlBody));

    const mmsBody = this.asn1Encode(MMS_CONFIRMED_REQUEST, Buffer.concat(parts));

    // Wrap in COTP DT
    const cotp = Buffer.from([0x02, COTP_DT, 0x80]);
    const frame = Buffer.concat([cotp, mmsBody]);
    this.sendRaw(frame);

    return this.waitForResponse(id);
  }

  private async sendMmsReadRequest(reference: string): Promise<Buffer> {
    const id = ++this.invokeId;

    // Parse reference: "LD/LN$FC$DO$DA" format
    const parts: Buffer[] = [];

    // InvokeID
    parts.push(this.asn1Encode(0x02, this.asn1EncodeInteger(id)));

    // Read request
    const readParts: Buffer[] = [];
    // Variable access specification — list of variable
    const varSpec: Buffer[] = [];
    const refBuf = Buffer.from(reference, 'utf-8');
    // ObjectName — domain specific
    const slashIdx = reference.indexOf('/');
    if (slashIdx > 0) {
      const domain = reference.substring(0, slashIdx);
      const item = reference.substring(slashIdx + 1);
      const domainBuf = Buffer.from(domain, 'utf-8');
      const itemBuf = Buffer.from(item, 'utf-8');
      const nameBody = Buffer.concat([
        this.asn1Encode(0x1A, domainBuf), // VisibleString (domain)
        this.asn1Encode(0x1A, itemBuf),   // VisibleString (item)
      ]);
      varSpec.push(this.asn1Encode(0xA0, this.asn1Encode(0xA1, nameBody)));
    } else {
      varSpec.push(this.asn1Encode(0xA0, this.asn1Encode(0xA0, this.asn1Encode(0x1A, refBuf))));
    }

    readParts.push(this.asn1Encode(0xA0, Buffer.concat(varSpec)));

    parts.push(this.asn1Encode(0xA4, Buffer.concat(readParts)));

    const mmsBody = this.asn1Encode(MMS_CONFIRMED_REQUEST, Buffer.concat(parts));
    const cotp = Buffer.from([0x02, COTP_DT, 0x80]);
    const frame = Buffer.concat([cotp, mmsBody]);
    this.sendRaw(frame);

    return this.waitForResponse(id);
  }

  private waitForResponse(invokeId: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingRequests.delete(invokeId);
        reject(new Error(`MMS request ${invokeId} timeout`));
      }, this.timeoutMs);

      this.pendingRequests.set(invokeId, { resolve, reject, timer });
    });
  }

  // ─── Response Processing ──────────────────────────

  private processReceiveBuffer(): void {
    while (this.receiveBuffer.length >= 4) {
      // Parse TPKT header
      if (this.receiveBuffer[0] !== TPKT_VERSION) {
        // Not a valid TPKT — skip byte
        this.receiveBuffer = this.receiveBuffer.subarray(1);
        continue;
      }

      const tpktLen = this.receiveBuffer.readUInt16BE(2);
      if (this.receiveBuffer.length < tpktLen) {
        break; // Wait for more data
      }

      const tpdu = this.receiveBuffer.subarray(4, tpktLen);
      this.receiveBuffer = this.receiveBuffer.subarray(tpktLen);

      this.processTpdu(tpdu);
    }
  }

  private processTpdu(tpdu: Buffer): void {
    if (tpdu.length < 2) return;

    const headerLen = tpdu[0];
    const pduType = tpdu[1] & 0xF0;

    if (pduType === COTP_CC) {
      this.emit('cotp-cc');
      return;
    }

    if (pduType === COTP_DT) {
      const payload = tpdu.subarray(headerLen + 1);
      this.processMmsPayload(payload);
      return;
    }
  }

  private processMmsPayload(payload: Buffer): void {
    if (payload.length < 2) return;

    const tag = payload[0];

    if (tag === MMS_INITIATE_RESPONSE) {
      this.emit('mms-initiate-response');
      return;
    }

    if (tag === MMS_CONFIRMED_RESPONSE) {
      // Parse invoke ID
      const bodyStart = this.asn1HeaderLen(payload);
      const body = payload.subarray(bodyStart);

      if (body.length >= 3 && body[0] === 0x02) {
        const idLen = body[1];
        let invokeId = 0;
        for (let i = 0; i < idLen; i++) {
          invokeId = (invokeId << 8) | body[2 + i];
        }

        const pending = this.pendingRequests.get(invokeId);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(invokeId);
          pending.resolve(body.subarray(2 + idLen));
        }
      }
      return;
    }
  }

  // ─── Response Parsers ─────────────────────────────

  private parseNameListResponse(data: Buffer): string[] {
    const names: string[] = [];
    // Walk ASN.1 to find VisibleString (0x1A) entries
    this.walkAsn1(data, (tag: number, value: Buffer) => {
      if (tag === 0x1A) {
        names.push(value.toString('utf-8'));
      }
    });
    return names;
  }

  private parseFloatFromResponse(data: Buffer): number {
    // Walk to find floating-point value (tag 0x87 in MMS)
    let result = 0;
    this.walkAsn1(data, (tag: number, value: Buffer) => {
      if (tag === 0x87 && value.length >= 5) {
        // MMS floating point: 1 byte exponent width + IEEE 754 bytes
        result = value.readFloatBE(1);
      }
    });
    return result;
  }

  private parseBooleanFromResponse(data: Buffer): boolean {
    let result = false;
    this.walkAsn1(data, (tag: number, value: Buffer) => {
      if (tag === 0x83 && value.length >= 1) {
        result = value[0] !== 0;
      }
    });
    return result;
  }

  private parseIntFromResponse(data: Buffer): number {
    let result = 0;
    this.walkAsn1(data, (tag: number, value: Buffer) => {
      if (tag === 0x85 && value.length >= 1) {
        // Signed integer
        if (value.length === 1) result = value.readInt8(0);
        else if (value.length === 2) result = value.readInt16BE(0);
        else if (value.length >= 4) result = value.readInt32BE(0);
      }
    });
    return result;
  }

  // ─── ASN.1 Helpers ────────────────────────────────

  private asn1Encode(tag: number, value: Buffer): Buffer {
    const len = value.length;
    if (len < 0x80) {
      const result = Buffer.alloc(2 + len);
      result[0] = tag;
      result[1] = len;
      value.copy(result, 2);
      return result;
    } else if (len < 0x100) {
      const result = Buffer.alloc(3 + len);
      result[0] = tag;
      result[1] = 0x81;
      result[2] = len;
      value.copy(result, 3);
      return result;
    } else {
      const result = Buffer.alloc(4 + len);
      result[0] = tag;
      result[1] = 0x82;
      result.writeUInt16BE(len, 2);
      value.copy(result, 4);
      return result;
    }
  }

  private asn1EncodeInteger(value: number): Buffer {
    if (value < 0x80) return Buffer.from([value]);
    if (value < 0x8000) return Buffer.from([(value >> 8) & 0xFF, value & 0xFF]);
    return Buffer.from([(value >> 24) & 0xFF, (value >> 16) & 0xFF, (value >> 8) & 0xFF, value & 0xFF]);
  }

  private asn1HeaderLen(buf: Buffer): number {
    if (buf.length < 2) return 2;
    if (buf[1] < 0x80) return 2;
    if (buf[1] === 0x81) return 3;
    if (buf[1] === 0x82) return 4;
    return 2;
  }

  private walkAsn1(data: Buffer, callback: (tag: number, value: Buffer) => void): void {
    let offset = 0;
    while (offset < data.length - 1) {
      const tag = data[offset];
      let lenByte = data[offset + 1];
      let headerSize = 2;
      let contentLen = lenByte;

      if (lenByte === 0x81) {
        if (offset + 2 >= data.length) break;
        contentLen = data[offset + 2];
        headerSize = 3;
      } else if (lenByte === 0x82) {
        if (offset + 3 >= data.length) break;
        contentLen = data.readUInt16BE(offset + 2);
        headerSize = 4;
      } else if (lenByte >= 0x80) {
        break; // Unsupported length encoding
      }

      const valueStart = offset + headerSize;
      const valueEnd = valueStart + contentLen;
      if (valueEnd > data.length) break;

      const value = data.subarray(valueStart, valueEnd);
      callback(tag, value);

      // If constructed (bit 5 set), recurse into children
      if (tag & 0x20) {
        this.walkAsn1(value, callback);
      }

      offset = valueEnd;
    }
  }

  private extractLNClass(lnName: string): string {
    // IEC 61850 LN naming: LLN0, LPHD, MMXU1, XCBR1, PTOC1, etc.
    // Extract the class (letters before the instance number)
    const match = lnName.match(/^([A-Z]+)/);
    return match ? match[1] : lnName;
  }

  private rejectAllPending(err: Error): void {
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }
}
