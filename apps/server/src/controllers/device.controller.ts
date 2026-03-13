import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { ABB_RELAY_TEMPLATES } from '../protocol/abb-relay-templates';
import { relayScannerService } from '../services/relay-scanner.service';

const protocolEnum = z.enum(['MODBUS_RTU', 'MODBUS_TCP', 'OPC_UA', 'DNP3', 'IEC61850']);

const createDeviceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  protocol: protocolEnum,
  enabled: z.boolean().optional(),
  host: z.string().max(200).optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  slaveId: z.number().int().min(0).max(255).optional().nullable(),
  serialPort: z.string().max(100).optional().nullable(),
  baudRate: z.number().int().optional().nullable(),
  dataBits: z.number().int().min(5).max(8).optional().nullable(),
  stopBits: z.number().int().min(1).max(2).optional().nullable(),
  parity: z.enum(['NONE', 'EVEN', 'ODD']).optional().nullable(),
  endpointUrl: z.string().max(500).optional().nullable(),
  securityMode: z.enum(['None', 'Sign', 'SignAndEncrypt']).optional().nullable(),
  securityPolicy: z.string().max(50).optional().nullable(),
  username: z.string().max(100).optional().nullable(),
  password: z.string().max(200).optional().nullable(),
  pollIntervalMs: z.number().int().min(100).optional(),
  timeoutMs: z.number().int().min(100).optional(),
  retryCount: z.number().int().min(0).max(10).optional(),
  projectId: z.string().uuid(),
});

const updateDeviceSchema = createDeviceSchema.partial().omit({ projectId: true });

// POST /api/devices
export async function createDevice(req: Request, res: Response): Promise<void> {
  try {
    const data = createDeviceSchema.parse(req.body);
    const device = await prisma.externalDevice.create({ data });
    res.status(201).json(device);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Create device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/devices
export async function getDevices(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, protocol } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    if (protocol) where.protocol = String(protocol);

    const devices = await prisma.externalDevice.findMany({
      where,
      include: { _count: { select: { tags: true } } },
      orderBy: { name: 'asc' },
    });
    res.json(devices);
  } catch (err) {
    console.error('Get devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/devices/:id
export async function getDevice(req: Request, res: Response): Promise<void> {
  try {
    const device = await prisma.externalDevice.findUnique({
      where: { id: req.params.id },
      include: { _count: { select: { tags: true } } },
    });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    res.json(device);
  } catch (err) {
    console.error('Get device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/devices/:id
export async function updateDevice(req: Request, res: Response): Promise<void> {
  try {
    const data = updateDeviceSchema.parse(req.body);
    const device = await prisma.externalDevice.update({
      where: { id: req.params.id },
      data,
    });
    res.json(device);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Update device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/devices/:id
export async function deleteDevice(req: Request, res: Response): Promise<void> {
  try {
    await prisma.externalDevice.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Device not found' });
      return;
    }
    console.error('Delete device error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/devices/:id/test-connection
export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const device = await prisma.externalDevice.findUnique({ where: { id: req.params.id } });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    // Simulate connection test based on protocol
    let success = false;
    let message = '';
    const startTime = Date.now();

    try {
      switch (device.protocol) {
        case 'MODBUS_TCP':
          if (!device.host || !device.port) {
            message = 'Host and port are required for Modbus TCP';
            break;
          }
          // Attempt TCP socket connection
          success = await testTcpConnection(device.host, device.port, device.timeoutMs);
          message = success ? `Connected to ${device.host}:${device.port}` : `Connection refused at ${device.host}:${device.port}`;
          break;

        case 'MODBUS_RTU':
          if (!device.serialPort) {
            message = 'Serial port is required for Modbus RTU';
            break;
          }
          message = `Serial port ${device.serialPort} configured (physical test requires hardware)`;
          success = true;
          break;

        case 'OPC_UA':
          if (!device.endpointUrl) {
            message = 'Endpoint URL is required for OPC UA';
            break;
          }
          message = `OPC UA endpoint ${device.endpointUrl} configured`;
          success = true;
          break;

        case 'DNP3':
        case 'IEC61850':
          if (!device.host || !device.port) {
            message = 'Host and port are required';
            break;
          }
          success = await testTcpConnection(device.host, device.port, device.timeoutMs);
          message = success ? `Connected to ${device.host}:${device.port}` : `Connection refused at ${device.host}:${device.port}`;
          break;

        default:
          message = `Unknown protocol: ${device.protocol}`;
      }
    } catch (connErr: any) {
      message = connErr.message || 'Connection test failed';
    }

    const elapsed = Date.now() - startTime;

    // Update device status
    await prisma.externalDevice.update({
      where: { id: device.id },
      data: {
        status: success ? 'CONNECTED' : 'ERROR',
        lastError: success ? null : message,
        lastConnectedAt: success ? new Date() : device.lastConnectedAt,
      },
    });

    res.json({ success, message, elapsedMs: elapsed });
  } catch (err) {
    console.error('Test connection error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/devices/:id/tags
export async function getDeviceTags(req: Request, res: Response): Promise<void> {
  try {
    const device = await prisma.externalDevice.findUnique({ where: { id: req.params.id } });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const tags = await prisma.tag.findMany({
      where: { deviceId: device.id },
      orderBy: { name: 'asc' },
    });
    res.json(tags);
  } catch (err) {
    console.error('Get device tags error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/devices/relay-templates
export async function getRelayTemplates(_req: Request, res: Response): Promise<void> {
  const templates = ABB_RELAY_TEMPLATES.map(t => ({
    model: t.model,
    manufacturer: t.manufacturer,
    series: t.series,
    description: t.description,
    defaultPort: t.defaultPort,
    defaultSlaveId: t.defaultSlaveId,
    registerCount: t.registers.length,
  }));
  res.json(templates);
}

// POST /api/devices/scan
export async function scanDevices(req: Request, res: Response): Promise<void> {
  try {
    const schema = z.object({
      startIP: z.string().min(1),
      endIP: z.string().min(1),
      port: z.number().int().min(1).max(65535).optional().default(502),
      timeout: z.number().int().min(100).max(30000).optional().default(2000),
    });
    const { startIP, endIP, port, timeout } = schema.parse(req.body);
    const results = await relayScannerService.scanIPRange(startIP, endIP, port, timeout);
    res.json({ results, count: results.length });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Scan devices error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/devices/:id/generate-tags
export async function generateTags(req: Request, res: Response): Promise<void> {
  try {
    const schema = z.object({
      templateModel: z.string().min(1),
      bayName: z.string().optional().default(''),
      prefix: z.string().optional().default(''),
    });
    const { templateModel, bayName, prefix } = schema.parse(req.body);

    const device = await prisma.externalDevice.findUnique({ where: { id: req.params.id } });
    if (!device) {
      res.status(404).json({ error: 'Device not found' });
      return;
    }

    const template = ABB_RELAY_TEMPLATES.find(t => t.model === templateModel);
    if (!template) {
      res.status(404).json({ error: `Template not found: ${templateModel}` });
      return;
    }

    // Generate tags from template registers
    const tags = [];
    for (const reg of template.registers) {
      const tagName = [prefix, bayName, reg.name].filter(Boolean).join('_');
      const tag = await prisma.tag.create({
        data: {
          name: tagName,
          description: reg.description,
          type: 'EXTERNAL',
          dataType: reg.dataType === 'FLOAT32' ? 'FLOAT' : reg.dataType === 'BIT' ? 'BOOLEAN' : 'INTEGER',
          unit: reg.unit || null,
          address: String(reg.address),
          addressType: 'HOLDING_REGISTER',
          byteOrder: 'BIG_ENDIAN',
          wordCount: reg.dataType === 'FLOAT32' ? 2 : 1,
          bitIndex: reg.bitIndex,
          scaleFactor: reg.scaleFactor || 1,
          scaleOffset: 0,
          deviceId: device.id,
          projectId: device.projectId,
        },
      });
      tags.push(tag);
    }

    res.status(201).json({ tags, count: tags.length });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Generate tags error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/devices/serial-ports
export async function getSerialPorts(_req: Request, res: Response): Promise<void> {
  try {
    let ports: Array<{ path: string; manufacturer?: string; serialNumber?: string; pnpId?: string }> = [];
    try {
      const { SerialPort } = require('serialport');
      const list = await SerialPort.list();
      ports = list.map((p: any) => ({
        path: p.path,
        manufacturer: p.manufacturer || undefined,
        serialNumber: p.serialNumber || undefined,
        pnpId: p.pnpId || undefined,
      }));
    } catch {
      // serialport not installed — try platform-native fallback
      const { execSync } = require('child_process');
      if (process.platform === 'win32') {
        try {
          const output = execSync('wmic path Win32_SerialPort get DeviceID,Description /format:csv', { encoding: 'utf-8', timeout: 5000 });
          for (const line of output.split('\n')) {
            const parts = line.trim().split(',');
            if (parts.length >= 3 && parts[1]) {
              ports.push({ path: parts[2], manufacturer: parts[1] });
            }
          }
        } catch { /* no serial ports */ }
        // Also check for USB-serial adapters via registry
        if (ports.length === 0) {
          try {
            const output = execSync('reg query HKLM\\HARDWARE\\DEVICEMAP\\SERIALCOMM', { encoding: 'utf-8', timeout: 5000 });
            for (const line of output.split('\n')) {
              const match = line.match(/\s+(COM\d+)\s*$/);
              if (match) ports.push({ path: match[1] });
            }
          } catch { /* no serial ports */ }
        }
      } else {
        // Linux/macOS
        try {
          const { readdirSync } = require('fs');
          const devFiles = readdirSync('/dev').filter((f: string) => f.startsWith('ttyS') || f.startsWith('ttyUSB') || f.startsWith('ttyACM') || f.startsWith('tty.'));
          ports = devFiles.map((f: string) => ({ path: `/dev/${f}` }));
        } catch { /* no serial ports */ }
      }
    }
    res.json({ ports, count: ports.length });
  } catch (err) {
    console.error('Get serial ports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Helper: test TCP connection
function testTcpConnection(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const net = require('net');
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
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
