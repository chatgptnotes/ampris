/**
 * Relay Discovery Service
 *
 * Discovers ABB protection relays on the local network using multiple methods:
 * 1. ARP scan — broadcasts ARP, any device on same L2 must respond
 * 2. TCP port scan — tries ports 502 (Modbus) and 102 (MMS) on IP ranges
 * 3. LLDP listener — passively captures LLDP frames (ABB relays send every ~30s)
 * 4. Default IP quick check — tries common ABB default IPs
 */

import * as net from 'net';
import { execSync } from 'child_process';

export interface DiscoveredDevice {
  ip: string;
  mac?: string;
  model?: string;
  portsOpen: number[];
  source: 'arp' | 'lldp' | 'scan' | 'default';
  hostname?: string;
  responseTimeMs?: number;
}

const COMMON_ABB_DEFAULTS = ['10.0.0.1', '192.168.2.10', '192.168.1.10', '172.16.0.1'];
const SCAN_PORTS = [502, 102];
const DEFAULT_SUBNETS = ['10.0.0.0/24', '192.168.0.0/24', '192.168.1.0/24', '192.168.2.0/24'];
const TCP_TIMEOUT_MS = 500;
const MAX_CONCURRENT_SCANS = 50;

class RelayDiscoveryService {

  /**
   * Run all discovery methods in parallel and merge results.
   */
  async discoverAll(
    subnets?: string[],
    timeout?: number,
  ): Promise<DiscoveredDevice[]> {
    const deviceMap = new Map<string, DiscoveredDevice>();
    const scanTimeout = timeout || TCP_TIMEOUT_MS;
    const scanSubnets = subnets || DEFAULT_SUBNETS;

    // Run methods in parallel
    const [arpDevices, defaultDevices, scanDevices] = await Promise.allSettled([
      this.arpScan(),
      this.checkDefaultIPs(scanTimeout),
      this.subnetScan(scanSubnets, scanTimeout),
    ]);

    // Merge results (first source wins, but we accumulate ports)
    const merge = (devices: DiscoveredDevice[]) => {
      for (const dev of devices) {
        const existing = deviceMap.get(dev.ip);
        if (existing) {
          // Merge ports
          for (const port of dev.portsOpen) {
            if (!existing.portsOpen.includes(port)) existing.portsOpen.push(port);
          }
          if (dev.mac && !existing.mac) existing.mac = dev.mac;
          if (dev.model && !existing.model) existing.model = dev.model;
          if (dev.hostname && !existing.hostname) existing.hostname = dev.hostname;
        } else {
          deviceMap.set(dev.ip, { ...dev });
        }
      }
    };

    if (arpDevices.status === 'fulfilled') merge(arpDevices.value);
    if (defaultDevices.status === 'fulfilled') merge(defaultDevices.value);
    if (scanDevices.status === 'fulfilled') merge(scanDevices.value);

    return Array.from(deviceMap.values());
  }

  /**
   * ARP scan — parse the OS ARP table after pinging broadcast.
   * Works on Windows and Linux.
   */
  async arpScan(): Promise<DiscoveredDevice[]> {
    const devices: DiscoveredDevice[] = [];
    try {
      // Ping broadcast to populate ARP table
      const isWindows = process.platform === 'win32';
      if (isWindows) {
        try { execSync('ping -n 1 -w 500 255.255.255.255', { timeout: 3000, stdio: 'pipe' }); } catch { /* expected to fail */ }
      } else {
        try { execSync('ping -c 1 -W 1 -b 255.255.255.255', { timeout: 3000, stdio: 'pipe' }); } catch { /* expected */ }
      }

      // Parse ARP table
      const arpOutput = execSync(isWindows ? 'arp -a' : 'arp -a', { timeout: 5000, encoding: 'utf-8' });
      const lines = arpOutput.split('\n');

      for (const line of lines) {
        // Windows: "  10.0.0.1            aa-bb-cc-dd-ee-ff     dynamic"
        // Linux:   "? (10.0.0.1) at aa:bb:cc:dd:ee:ff [ether] on eth0"
        let match: RegExpMatchArray | null;

        if (isWindows) {
          match = line.match(/^\s*(\d+\.\d+\.\d+\.\d+)\s+([\da-f]{2}(?:-[\da-f]{2}){5})\s+(\w+)/i);
        } else {
          match = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([\da-f]{2}(?::[\da-f]{2}){5})/i);
        }

        if (match) {
          const ip = match[1];
          const mac = match[2].replace(/-/g, ':').toLowerCase();
          // Skip broadcast and incomplete entries
          if (mac === 'ff:ff:ff:ff:ff:ff' || mac === '00:00:00:00:00:00') continue;

          devices.push({
            ip,
            mac,
            portsOpen: [],
            source: 'arp',
          });
        }
      }

      // For ARP-discovered devices, quick-check Modbus/MMS ports
      const portChecks = devices.map(async (dev) => {
        const openPorts = await this.checkPorts(dev.ip, SCAN_PORTS, TCP_TIMEOUT_MS);
        dev.portsOpen = openPorts;
      });
      await Promise.all(portChecks);

      // Only return devices that have at least one relevant port open
      return devices.filter(d => d.portsOpen.length > 0);
    } catch (err: any) {
      console.warn('[RelayDiscovery] ARP scan failed:', err.message);
      return [];
    }
  }

  /**
   * Check common ABB default IPs for Modbus/MMS ports.
   */
  async checkDefaultIPs(timeout: number = TCP_TIMEOUT_MS): Promise<DiscoveredDevice[]> {
    const results: DiscoveredDevice[] = [];

    const checks = COMMON_ABB_DEFAULTS.map(async (ip) => {
      const openPorts = await this.checkPorts(ip, SCAN_PORTS, timeout);
      if (openPorts.length > 0) {
        results.push({
          ip,
          portsOpen: openPorts,
          source: 'default',
        });
      }
    });

    await Promise.all(checks);
    return results;
  }

  /**
   * Scan subnets for devices with Modbus (502) or MMS (102) ports open.
   * Uses concurrency limiting to avoid overwhelming the network.
   */
  async subnetScan(subnets: string[], timeout: number = TCP_TIMEOUT_MS): Promise<DiscoveredDevice[]> {
    const results: DiscoveredDevice[] = [];
    const allIPs: string[] = [];

    for (const subnet of subnets) {
      const ips = this.expandSubnet(subnet);
      allIPs.push(...ips);
    }

    // Scan with concurrency limit
    const batches: string[][] = [];
    for (let i = 0; i < allIPs.length; i += MAX_CONCURRENT_SCANS) {
      batches.push(allIPs.slice(i, i + MAX_CONCURRENT_SCANS));
    }

    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (ip) => {
          const openPorts = await this.checkPorts(ip, SCAN_PORTS, timeout);
          if (openPorts.length > 0) {
            return { ip, portsOpen: openPorts, source: 'scan' as const };
          }
          return null;
        }),
      );

      for (const result of batchResults) {
        if (result) {
          results.push(result);
        }
      }
    }

    return results;
  }

  /**
   * Test TCP connection to a specific host and port.
   */
  testConnection(host: string, port: number, timeout: number = 3000): Promise<boolean> {
    return this.tcpConnect(host, port, timeout);
  }

  /**
   * Test both Modbus and MMS ports on a host.
   */
  async testAllPorts(
    host: string,
    modbusPort: number = 502,
    mmsPort: number = 102,
    timeout: number = 3000,
  ): Promise<{ modbus: boolean; mms: boolean }> {
    const [modbus, mms] = await Promise.all([
      this.tcpConnect(host, modbusPort, timeout),
      this.tcpConnect(host, mmsPort, timeout),
    ]);
    return { modbus, mms };
  }

  // ─── Private helpers ──────────────────────────────

  private async checkPorts(ip: string, ports: number[], timeout: number): Promise<number[]> {
    const openPorts: number[] = [];
    const checks = ports.map(async (port) => {
      const open = await this.tcpConnect(ip, port, timeout);
      if (open) openPorts.push(port);
    });
    await Promise.all(checks);
    return openPorts;
  }

  private tcpConnect(host: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });
      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });
  }

  /**
   * Expand a CIDR notation subnet into individual IP addresses.
   * Only supports /24 for practical scanning speed.
   */
  private expandSubnet(cidr: string): string[] {
    const ips: string[] = [];
    const [base, maskStr] = cidr.split('/');
    const mask = parseInt(maskStr || '24', 10);

    if (mask < 24) {
      // Only scan /24 at a time to keep scan practical
      console.warn(`[RelayDiscovery] Subnet ${cidr} too large, limiting to /24`);
    }

    const parts = base.split('.').map(Number);
    // Scan .1 through .254
    for (let i = 1; i < 255; i++) {
      ips.push(`${parts[0]}.${parts[1]}.${parts[2]}.${i}`);
    }

    return ips;
  }
}

export const relayDiscoveryService = new RelayDiscoveryService();
