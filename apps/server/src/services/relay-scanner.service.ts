/**
 * Relay Scanner Service (Phase 1)
 *
 * Scans IP ranges for Modbus/MMS devices, attempts identification,
 * and suggests templates for relay configuration.
 */

import * as net from 'net';
import { ModbusAdapter } from '../protocol/ModbusAdapter';
import { ABB_RELAY_TEMPLATES, getAutoScanRanges, identifyRelayModel } from '../protocol/abb-relay-templates';

export interface ScanResult {
  host: string;
  port: number;
  identified: boolean;
  model?: string;
  description?: string;
  suggestedTemplate?: string;
  responseTimeMs: number;
}

class RelayScannerService {

  /**
   * Scan an IP range for Modbus devices on port 502.
   */
  async scanIPRange(
    startIP: string,
    endIP: string,
    port: number = 502,
    timeout: number = 2000,
  ): Promise<ScanResult[]> {
    const results: ScanResult[] = [];
    const ips = this.expandIPRange(startIP, endIP);

    // Scan in batches of 20
    const batchSize = 20;
    for (let i = 0; i < ips.length; i += batchSize) {
      const batch = ips.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map(ip => this.probeHost(ip, port, timeout)),
      );
      for (const result of batchResults) {
        if (result) results.push(result);
      }
    }

    return results;
  }

  /**
   * Attempt to identify a relay by reading known register ranges.
   */
  async identifyRelay(host: string, port: number = 502, slaveId: number = 1): Promise<ScanResult> {
    const startTime = Date.now();
    const adapter = new ModbusAdapter({
      id: 'scanner-identify',
      name: 'Scanner Identify',
      protocol: 'MODBUS_TCP',
      ipAddress: host,
      port,
      slaveId,
      pollingIntervalMs: 0,
      timeoutMs: 3000,
    });

    try {
      await adapter.connect();

      const scanRanges = getAutoScanRanges();
      const validRanges: Array<{ start: number; count: number }> = [];

      for (const range of scanRanges) {
        try {
          await adapter.readAnalog(range.start, range.count);
          validRanges.push({ start: range.start, count: range.count });
        } catch {
          // Range not available
        }
      }

      await adapter.disconnect();

      const model = identifyRelayModel(validRanges);
      return {
        host,
        port,
        identified: !!model,
        model: model?.model,
        description: model?.description,
        suggestedTemplate: model?.model,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (err: any) {
      try { await adapter.disconnect(); } catch { /* ignore */ }
      return {
        host,
        port,
        identified: false,
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  // ─── Private helpers ──────────────────────────────

  private async probeHost(ip: string, port: number, timeout: number): Promise<ScanResult | null> {
    const startTime = Date.now();
    const open = await this.tcpConnect(ip, port, timeout);
    if (!open) return null;

    return {
      host: ip,
      port,
      identified: false,
      responseTimeMs: Date.now() - startTime,
    };
  }

  private tcpConnect(host: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('timeout', () => { socket.destroy(); resolve(false); });
      socket.on('error', () => { socket.destroy(); resolve(false); });
      socket.connect(port, host);
    });
  }

  private expandIPRange(startIP: string, endIP: string): string[] {
    const ips: string[] = [];
    const startParts = startIP.split('.').map(Number);
    const endParts = endIP.split('.').map(Number);

    const startNum = (startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3];
    const endNum = (endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3];

    // Limit to 1024 IPs max
    const limit = Math.min(endNum, startNum + 1023);

    for (let n = startNum; n <= limit; n++) {
      ips.push(`${(n >>> 24) & 0xFF}.${(n >>> 16) & 0xFF}.${(n >>> 8) & 0xFF}.${n & 0xFF}`);
    }

    return ips;
  }
}

export const relayScannerService = new RelayScannerService();
