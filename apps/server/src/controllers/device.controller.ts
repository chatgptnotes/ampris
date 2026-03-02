import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';

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
