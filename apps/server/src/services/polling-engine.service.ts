import { prisma } from '../config/database';
import { tagEngine } from './tag-engine.service';
import { realtimeService } from './realtime.service';
import { commDiagnosticsService } from './comm-diagnostics.service';

interface DeviceStatus {
  deviceId: string;
  deviceName: string;
  protocol: string;
  status: 'polling' | 'stopped' | 'error';
  lastPoll: Date | null;
  lastError: string | null;
  tagCount: number;
  pollRate: number; // reads/sec
  avgLatencyMs: number;
  totalPolls: number;
  totalErrors: number;
  startedAt: Date | null;
}

interface ErrorLogEntry {
  deviceId: string;
  deviceName: string;
  error: string;
  timestamp: Date;
}

class PollingEngineService {
  private pollers: Map<string, NodeJS.Timeout> = new Map();
  private deviceStatus: Map<string, DeviceStatus> = new Map();
  private errorLog: ErrorLogEntry[] = [];
  private pollCounts: Map<string, { count: number; startTime: number }> = new Map();
  private latencyAccum: Map<string, { total: number; count: number }> = new Map();

  async startDevice(deviceId: string): Promise<void> {
    if (this.pollers.has(deviceId)) return;

    const device = await prisma.externalDevice.findUnique({
      where: { id: deviceId },
      include: { tags: true },
    });
    if (!device || !device.enabled) return;

    const status: DeviceStatus = {
      deviceId: device.id,
      deviceName: device.name,
      protocol: device.protocol,
      status: 'polling',
      lastPoll: null,
      lastError: null,
      tagCount: device.tags.length,
      pollRate: 0,
      avgLatencyMs: 0,
      totalPolls: 0,
      totalErrors: 0,
      startedAt: new Date(),
    };
    this.deviceStatus.set(deviceId, status);
    this.pollCounts.set(deviceId, { count: 0, startTime: Date.now() });
    this.latencyAccum.set(deviceId, { total: 0, count: 0 });

    const interval = setInterval(async () => {
      await this.pollDevice(device.id);
    }, device.pollIntervalMs);

    this.pollers.set(deviceId, interval);

    // Update DB status
    await prisma.externalDevice.update({
      where: { id: deviceId },
      data: { status: 'CONNECTED', lastConnectedAt: new Date() },
    }).catch(() => {});
  }

  async stopDevice(deviceId: string): Promise<void> {
    const interval = this.pollers.get(deviceId);
    if (interval) {
      clearInterval(interval);
      this.pollers.delete(deviceId);
    }
    const status = this.deviceStatus.get(deviceId);
    if (status) {
      status.status = 'stopped';
    }

    await prisma.externalDevice.update({
      where: { id: deviceId },
      data: { status: 'DISCONNECTED' },
    }).catch(() => {});
  }

  async startAll(projectId: string): Promise<void> {
    const devices = await prisma.externalDevice.findMany({
      where: { projectId, enabled: true },
    });
    for (const device of devices) {
      await this.startDevice(device.id);
    }
  }

  async stopAll(): Promise<void> {
    for (const [deviceId] of this.pollers) {
      await this.stopDevice(deviceId);
    }
  }

  getStatus(): DeviceStatus[] {
    return Array.from(this.deviceStatus.values());
  }

  getStats(): {
    totalDevices: number;
    activeDevices: number;
    totalPolls: number;
    totalErrors: number;
    avgLatencyMs: number;
    totalTagsPolled: number;
    totalReadsPerSec: number;
    errorRate: number;
    uptime: number;
  } {
    const statuses = Array.from(this.deviceStatus.values());
    const active = statuses.filter((s) => s.status === 'polling');
    const totalPolls = statuses.reduce((sum, s) => sum + s.totalPolls, 0);
    const totalErrors = statuses.reduce((sum, s) => sum + s.totalErrors, 0);
    const totalTags = statuses.reduce((sum, s) => sum + s.tagCount, 0);
    const totalReadsPerSec = statuses.reduce((sum, s) => sum + s.pollRate, 0);

    let totalLatency = 0;
    let latencyCount = 0;
    for (const acc of this.latencyAccum.values()) {
      totalLatency += acc.total;
      latencyCount += acc.count;
    }

    const oldestStart = statuses.reduce((min, s) => {
      if (s.startedAt && (!min || s.startedAt < min)) return s.startedAt;
      return min;
    }, null as Date | null);

    return {
      totalDevices: statuses.length,
      activeDevices: active.length,
      totalPolls,
      totalErrors,
      avgLatencyMs: latencyCount > 0 ? Math.round((totalLatency / latencyCount) * 100) / 100 : 0,
      totalTagsPolled: totalTags,
      totalReadsPerSec: Math.round(totalReadsPerSec * 100) / 100,
      errorRate: totalPolls > 0 ? Math.round((totalErrors / totalPolls) * 10000) / 100 : 0,
      uptime: oldestStart ? Date.now() - oldestStart.getTime() : 0,
    };
  }

  getErrorLog(): ErrorLogEntry[] {
    return this.errorLog.slice(-50);
  }

  private async pollDevice(deviceId: string): Promise<void> {
    const startTime = Date.now();
    const status = this.deviceStatus.get(deviceId);
    if (!status) return;

    try {
      const device = await prisma.externalDevice.findUnique({
        where: { id: deviceId },
        include: { tags: true },
      });
      if (!device) return;

      status.tagCount = device.tags.length;

      // Route to protocol handler
      switch (device.protocol) {
        case 'MODBUS_TCP':
          await this.pollModbusTCP(device, device.tags);
          break;
        case 'MODBUS_RTU':
          await this.pollModbusRTU(device, device.tags);
          break;
        case 'OPC_UA':
          await this.pollOPCUA(device, device.tags);
          break;
        case 'DNP3':
          await this.pollDNP3(device, device.tags);
          break;
        default:
          await this.pollGeneric(device, device.tags);
      }

      const latency = Date.now() - startTime;
      status.lastPoll = new Date();
      status.status = 'polling';
      status.totalPolls++;

      // Update poll rate
      const pc = this.pollCounts.get(deviceId)!;
      pc.count++;
      const elapsed = (Date.now() - pc.startTime) / 1000;
      status.pollRate = elapsed > 0 ? Math.round((pc.count / elapsed) * 100) / 100 : 0;

      // Update latency
      const la = this.latencyAccum.get(deviceId)!;
      la.total += latency;
      la.count++;
      status.avgLatencyMs = Math.round((la.total / la.count) * 100) / 100;

      // Report to comm diagnostics
      commDiagnosticsService.recordSuccess(deviceId, device.name, device.protocol, latency, device.tags.length, device.projectId);

    } catch (err: any) {
      const latency = Date.now() - startTime;
      status.status = 'error';
      status.lastError = err.message;
      status.totalErrors++;

      this.errorLog.push({
        deviceId,
        deviceName: status.deviceName,
        error: err.message,
        timestamp: new Date(),
      });
      if (this.errorLog.length > 200) this.errorLog.splice(0, this.errorLog.length - 200);

      commDiagnosticsService.recordError(deviceId, status.deviceName, status.protocol, latency, err.message, status.deviceName ? undefined : undefined);
    }
  }

  // ─── Protocol Handlers (simulated) ───────────────

  private async pollModbusTCP(device: any, tags: any[]): Promise<void> {
    // Group tags by address type
    const groups: Record<string, any[]> = {};
    for (const tag of tags) {
      const addrType = tag.addressType || 'HOLDING_REGISTER';
      if (!groups[addrType]) groups[addrType] = [];
      groups[addrType].push(tag);
    }

    // Simulate Modbus read per group
    // FC3: Holding Registers, FC4: Input Registers, FC1: Coils, FC2: Discrete Inputs
    for (const [addrType, groupTags] of Object.entries(groups)) {
      for (const tag of groupTags) {
        const rawValue = this.simulateRead(tag);
        const scaled = this.applyScaling(rawValue, tag);
        tagEngine.setTagValue(tag.name, scaled, true);

        // Log TX/RX for Modbus frame
        const addr = parseInt(tag.address || '0');
        const slaveId = device.slaveId || 1;
        const fc = addrType === 'COIL' ? 1 : addrType === 'DISCRETE_INPUT' ? 2 : addrType === 'HOLDING_REGISTER' ? 3 : 4;
        commDiagnosticsService.logFrame(device.id, device.name, device.protocol, device.projectId, {
          direction: 'TX',
          rawData: this.buildModbusRequestHex(slaveId, fc, addr, tag.wordCount || 1),
          parsed: { slaveId, functionCode: fc, startAddress: addr, quantity: tag.wordCount || 1 },
          status: 'SUCCESS',
        });
        commDiagnosticsService.logFrame(device.id, device.name, device.protocol, device.projectId, {
          direction: 'RX',
          rawData: this.buildModbusResponseHex(slaveId, fc, scaled),
          parsed: { slaveId, functionCode: fc, value: scaled },
          status: 'SUCCESS',
        });
      }
    }
  }

  private async pollModbusRTU(device: any, tags: any[]): Promise<void> {
    // Same as TCP but over serial — simulation identical
    await this.pollModbusTCP(device, tags);
  }

  private async pollOPCUA(device: any, tags: any[]): Promise<void> {
    for (const tag of tags) {
      const rawValue = this.simulateRead(tag);
      const scaled = this.applyScaling(rawValue, tag);
      tagEngine.setTagValue(tag.name, scaled, true);

      commDiagnosticsService.logFrame(device.id, device.name, device.protocol, device.projectId, {
        direction: 'TX',
        rawData: `ReadRequest(${tag.address || tag.name})`,
        parsed: { nodeId: tag.address || tag.name, operation: 'Read' },
        status: 'SUCCESS',
      });
      commDiagnosticsService.logFrame(device.id, device.name, device.protocol, device.projectId, {
        direction: 'RX',
        rawData: `ReadResponse(${scaled})`,
        parsed: { nodeId: tag.address || tag.name, value: scaled, statusCode: 'Good' },
        status: 'SUCCESS',
      });
    }
  }

  private async pollDNP3(device: any, tags: any[]): Promise<void> {
    for (const tag of tags) {
      const rawValue = this.simulateRead(tag);
      const scaled = this.applyScaling(rawValue, tag);
      tagEngine.setTagValue(tag.name, scaled, true);
    }
  }

  private async pollGeneric(device: any, tags: any[]): Promise<void> {
    for (const tag of tags) {
      const rawValue = this.simulateRead(tag);
      const scaled = this.applyScaling(rawValue, tag);
      tagEngine.setTagValue(tag.name, scaled, true);
    }
  }

  // ─── Simulation ───────────────────────────────────

  private simulateRead(tag: any): number | boolean | string {
    const dataType = tag.dataType || 'FLOAT';

    switch (dataType) {
      case 'BOOLEAN':
        return Math.random() > 0.5;
      case 'INTEGER': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        return Math.round(min + Math.random() * (max - min));
      }
      case 'FLOAT': {
        const min = tag.minValue ?? 0;
        const max = tag.maxValue ?? 100;
        // Sine wave with noise for realistic data
        const t = Date.now() / 1000;
        const base = (min + max) / 2;
        const amp = (max - min) / 4;
        const value = base + amp * Math.sin(t * 0.1 + (tag.name?.length || 0)) + (Math.random() - 0.5) * amp * 0.1;
        return Math.round(Math.max(min, Math.min(max, value)) * 1000) / 1000;
      }
      case 'STRING':
        return `SIM_${Date.now() % 1000}`;
      default:
        return Math.random() * 100;
    }
  }

  private applyScaling(rawValue: number | boolean | string, tag: any): number | boolean | string {
    if (typeof rawValue !== 'number') return rawValue;
    const factor = tag.scaleFactor ?? 1;
    const offset = tag.scaleOffset ?? 0;
    return Math.round((rawValue * factor + offset) * 1000) / 1000;
  }

  private buildModbusRequestHex(slaveId: number, fc: number, startAddr: number, quantity: number): string {
    const bytes = [
      slaveId,
      fc,
      (startAddr >> 8) & 0xff, startAddr & 0xff,
      (quantity >> 8) & 0xff, quantity & 0xff,
    ];
    return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }

  private buildModbusResponseHex(slaveId: number, fc: number, value: any): string {
    const numVal = typeof value === 'number' ? Math.round(value) : 0;
    const bytes = [
      slaveId,
      fc,
      2, // byte count
      (numVal >> 8) & 0xff, numVal & 0xff,
    ];
    return bytes.map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
  }

  // ─── Stubs for real protocol libraries ────────────
  // Uncomment and implement when adding real modbus/opcua npm packages:

  // private async modbusReadRegisters(host: string, port: number, slaveId: number, startAddr: number, count: number): Promise<number[]> {
  //   // const client = new ModbusRTU();
  //   // await client.connectTCP(host, { port });
  //   // client.setID(slaveId);
  //   // const data = await client.readHoldingRegisters(startAddr, count);
  //   // return data.data;
  //   throw new Error('Real Modbus not implemented — install modbus-serial');
  // }

  // private async opcuaReadNodes(endpointUrl: string, nodeIds: string[]): Promise<any[]> {
  //   // const { OPCUAClient, DataType } = require('node-opcua');
  //   // const client = OPCUAClient.create({ endpointMustExist: false });
  //   // await client.connect(endpointUrl);
  //   // const session = await client.createSession();
  //   // const results = await session.read(nodeIds.map(id => ({ nodeId: id })));
  //   // await session.close();
  //   // await client.disconnect();
  //   // return results;
  //   throw new Error('Real OPC UA not implemented — install node-opcua');
  // }
}

export const pollingEngine = new PollingEngineService();
