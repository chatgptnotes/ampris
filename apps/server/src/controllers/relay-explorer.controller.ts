/**
 * Relay Explorer Controller
 *
 * Backend API for on-site relay connection, discovery, and register exploration.
 * Used by the Relay Explorer page to connect to ABB relays directly.
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { relayDiscoveryService } from '../services/relay-discovery.service';
import { mmsBrowseService } from '../services/mms-browse.service';
import { ModbusAdapter } from '../protocol/ModbusAdapter';
import {
  decodeAll,
  decodeRegisterValue,
  registersToHex,
  type ByteOrder,
} from '../protocol/modbus-register-parser';
import {
  ABB_RELAY_TEMPLATES,
  getAutoScanRanges,
  identifyRelayModel,
  getTemplateByModel,
  type RegisterDefinition,
} from '../protocol/abb-relay-templates';

// ─── Validation Schemas ─────────────────────────────

const discoverSchema = z.object({
  subnets: z.array(z.string()).optional(),
  timeout: z.number().int().min(100).max(30000).optional(),
});

const testConnectionSchema = z.object({
  host: z.string().min(1),
  modbusPort: z.number().int().min(1).max(65535).optional().default(502),
  mmsPort: z.number().int().min(1).max(65535).optional().default(102),
  timeout: z.number().int().min(100).max(30000).optional().default(3000),
});

const modbusReadSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional().default(502),
  slaveId: z.number().int().min(0).max(255).optional().default(1),
  functionCode: z.number().int().min(1).max(4).optional().default(3),
  startRegister: z.number().int().min(0).max(65535),
  count: z.number().int().min(1).max(125),
  byteOrder: z.enum(['BIG_ENDIAN', 'LITTLE_ENDIAN', 'MID_BIG', 'MID_LITTLE']).optional().default('BIG_ENDIAN'),
});

const modbusScanSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional().default(502),
  slaveId: z.number().int().min(0).max(255).optional().default(1),
});

const mmsBrowseSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).optional().default(102),
});

const exportTagsSchema = z.object({
  points: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    address: z.number(),
    dataType: z.string(),
    unit: z.string().optional(),
    scaleFactor: z.number().optional(),
    byteOrder: z.string().optional(),
    category: z.string().optional(),
  })),
  format: z.enum(['csv', 'json']).optional().default('json'),
  prefix: z.string().optional().default(''),
  deviceName: z.string().optional().default('ABB_Relay'),
});

// ─── Handlers ───────────────────────────────────────

/**
 * POST /api/relay-explorer/discover
 * Run all discovery methods in parallel and return found devices.
 */
export async function discover(req: Request, res: Response): Promise<void> {
  try {
    const { subnets, timeout } = discoverSchema.parse(req.body);
    const devices = await relayDiscoveryService.discoverAll(subnets, timeout);
    res.json({ devices, count: devices.length });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] Discover error:', err);
    res.status(500).json({ error: err.message || 'Discovery failed' });
  }
}

/**
 * POST /api/relay-explorer/test-connection
 * Test TCP connectivity to Modbus and MMS ports.
 */
export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const { host, modbusPort, mmsPort, timeout } = testConnectionSchema.parse(req.body);
    const result = await relayDiscoveryService.testAllPorts(host, modbusPort, mmsPort, timeout);
    res.json({
      host,
      modbus: { port: modbusPort, connected: result.modbus },
      mms: { port: mmsPort, connected: result.mms },
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] Test connection error:', err);
    res.status(500).json({ error: err.message || 'Connection test failed' });
  }
}

/**
 * POST /api/relay-explorer/modbus-read
 * Read specific Modbus registers and return raw + decoded values.
 */
export async function modbusRead(req: Request, res: Response): Promise<void> {
  let adapter: ModbusAdapter | null = null;
  try {
    const { host, port, slaveId, functionCode, startRegister, count, byteOrder } =
      modbusReadSchema.parse(req.body);

    adapter = new ModbusAdapter({
      id: 'explorer-read',
      name: 'Explorer Read',
      protocol: 'MODBUS_TCP',
      ipAddress: host,
      port,
      slaveId,
      pollingIntervalMs: 0,
      timeoutMs: 5000,
    });

    await adapter.connect();

    let rawRegisters: number[];
    if (functionCode === 3) {
      rawRegisters = await adapter.readAnalog(startRegister, count);
    } else if (functionCode === 4) {
      rawRegisters = await adapter.readInputRegisters(startRegister, count);
    } else if (functionCode === 1) {
      const bools = await adapter.readDigital(startRegister, count);
      rawRegisters = bools.map(b => b ? 1 : 0);
    } else {
      rawRegisters = await adapter.readAnalog(startRegister, count);
    }

    await adapter.disconnect();
    adapter = null;

    const decoded = decodeAll(rawRegisters, startRegister, byteOrder as ByteOrder);
    const rawHex = registersToHex(rawRegisters);

    res.json({
      host,
      port,
      slaveId,
      functionCode,
      startRegister,
      count,
      rawHex,
      rawRegisters,
      decoded,
    });
  } catch (err: any) {
    if (adapter) {
      try { await adapter.disconnect(); } catch { /* ignore */ }
    }
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] Modbus read error:', err);
    res.status(500).json({ error: err.message || 'Modbus read failed' });
  }
}

/**
 * POST /api/relay-explorer/modbus-scan
 * Scan known ABB register ranges and return identified measurements.
 */
export async function modbusScan(req: Request, res: Response): Promise<void> {
  let adapter: ModbusAdapter | null = null;
  try {
    const { host, port, slaveId } = modbusScanSchema.parse(req.body);

    adapter = new ModbusAdapter({
      id: 'explorer-scan',
      name: 'Explorer Scan',
      protocol: 'MODBUS_TCP',
      ipAddress: host,
      port,
      slaveId,
      pollingIntervalMs: 0,
      timeoutMs: 5000,
    });

    await adapter.connect();

    const scanRanges = getAutoScanRanges();
    const validRanges: Array<{ start: number; count: number }> = [];
    const discoveredPoints: Array<{
      register: number;
      rawHex: string;
      value: number | boolean;
      dataType: string;
      matchedTemplate?: string;
      name?: string;
      description?: string;
      unit?: string;
    }> = [];

    for (const range of scanRanges) {
      try {
        const rawRegisters = await adapter.readAnalog(range.start, range.count);
        validRanges.push({ start: range.start, count: range.count });

        // Try to match registers against all known templates
        for (const template of ABB_RELAY_TEMPLATES) {
          for (const regDef of template.registers) {
            const offset = regDef.address - range.start;
            if (offset < 0 || offset >= rawRegisters.length) continue;

            try {
              const value = decodeRegisterValue(
                rawRegisters,
                offset,
                regDef.dataType,
                'BIG_ENDIAN',
                regDef.bitIndex,
              );

              // Only include if value looks reasonable
              if (typeof value === 'number' && !isNaN(value) && isFinite(value)) {
                // Avoid duplicates
                if (!discoveredPoints.find(p => p.register === regDef.address && p.name === regDef.name)) {
                  discoveredPoints.push({
                    register: regDef.address,
                    rawHex: registersToHex(rawRegisters.slice(offset, offset + (regDef.dataType === 'FLOAT32' ? 2 : 1))),
                    value,
                    dataType: regDef.dataType,
                    matchedTemplate: template.model,
                    name: regDef.name,
                    description: regDef.description,
                    unit: regDef.unit,
                  });
                }
              } else if (typeof value === 'boolean') {
                if (!discoveredPoints.find(p => p.register === regDef.address && p.name === regDef.name)) {
                  discoveredPoints.push({
                    register: regDef.address,
                    rawHex: registersToHex(rawRegisters.slice(offset, offset + 1)),
                    value,
                    dataType: regDef.dataType,
                    matchedTemplate: template.model,
                    name: regDef.name,
                    description: regDef.description,
                    unit: regDef.unit,
                  });
                }
              }
            } catch {
              // Skip registers that can't be decoded
            }
          }
        }
      } catch (err: any) {
        // Range not readable — skip silently
        console.debug(`[RelayExplorer] Range ${range.start}-${range.start + range.count} not readable: ${err.message}`);
      }
    }

    await adapter.disconnect();
    adapter = null;

    const identifiedModel = identifyRelayModel(validRanges);

    res.json({
      host,
      port,
      slaveId,
      identifiedModel: identifiedModel?.model || null,
      identifiedDescription: identifiedModel?.description || null,
      validRanges,
      discoveredPoints,
      totalPoints: discoveredPoints.length,
    });
  } catch (err: any) {
    if (adapter) {
      try { await adapter.disconnect(); } catch { /* ignore */ }
    }
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] Modbus scan error:', err);
    res.status(500).json({ error: err.message || 'Modbus scan failed' });
  }
}

/**
 * POST /api/relay-explorer/mms-browse
 * Browse IEC 61850 MMS server directory — returns the full data model tree.
 */
export async function mmsBrowse(req: Request, res: Response): Promise<void> {
  try {
    const { host, port } = mmsBrowseSchema.parse(req.body);
    const model = await mmsBrowseService.browse(host, port);
    res.json({
      host,
      port,
      model,
      totalLDs: model.logicalDevices.length,
      totalLNs: model.logicalDevices.reduce((sum, ld) => sum + ld.logicalNodes.length, 0),
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] MMS browse error:', err);
    res.status(500).json({ error: err.message || 'MMS browse failed' });
  }
}

/**
 * POST /api/relay-explorer/mms-browse-full
 * Full MMS browse (alias for mms-browse, used by frontend).
 */
export async function mmsBrowseFull(req: Request, res: Response): Promise<void> {
  return mmsBrowse(req, res);
}

/**
 * POST /api/relay-explorer/mms-discover-measurements
 * Discover measurement points (MMXU, XCBR, etc.) with semantic mapping.
 */
export async function mmsDiscoverMeasurements(req: Request, res: Response): Promise<void> {
  try {
    const { host, port } = mmsBrowseSchema.parse(req.body);
    const measurements = await mmsBrowseService.discoverMeasurements(host, port);
    res.json({
      host,
      port,
      measurements,
      totalPoints: measurements.length,
    });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] MMS discover measurements error:', err);
    res.status(500).json({ error: err.message || 'MMS discover measurements failed' });
  }
}

/**
 * POST /api/relay-explorer/mms-export-icd
 * Export the relay's data model as an ICD/SCL XML file.
 */
export async function mmsExportICD(req: Request, res: Response): Promise<void> {
  try {
    const { host, port } = mmsBrowseSchema.parse(req.body);
    const icdXml = await mmsBrowseService.exportAsICD(host, port);
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename="${host.replace(/\./g, '_')}_model.icd"`);
    res.send(icdXml);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] MMS export ICD error:', err);
    res.status(500).json({ error: err.message || 'MMS export ICD failed' });
  }
}

/**
 * GET /api/relay-explorer/ln-classes
 * Get descriptions for IEC 61850 Logical Node classes.
 */
export async function getLNClasses(_req: Request, res: Response): Promise<void> {
  res.json(mmsBrowseService.getLNClassDescriptions());
}

/**
 * GET /api/relay-explorer/templates
 * List available relay templates.
 */
export async function getTemplates(_req: Request, res: Response): Promise<void> {
  const templates = ABB_RELAY_TEMPLATES.map(t => ({
    model: t.model,
    manufacturer: t.manufacturer,
    series: t.series,
    description: t.description,
    defaultPort: t.defaultPort,
    defaultSlaveId: t.defaultSlaveId,
    registerCount: t.registers.length,
    categories: {
      measurement: t.registers.filter(r => r.category === 'measurement').length,
      protection: t.registers.filter(r => r.category === 'protection').length,
      status: t.registers.filter(r => r.category === 'status').length,
      energy: t.registers.filter(r => r.category === 'energy').length,
    },
  }));
  res.json(templates);
}

/**
 * GET /api/relay-explorer/templates/:model
 * Get full register map for a specific template.
 */
export async function getTemplateRegisters(req: Request, res: Response): Promise<void> {
  const template = getTemplateByModel(req.params.model);
  if (!template) {
    res.status(404).json({ error: `Template not found: ${req.params.model}` });
    return;
  }
  res.json(template);
}

/**
 * POST /api/relay-explorer/export-tags
 * Export discovered points as CSV or JSON for tag import.
 */
export async function exportTags(req: Request, res: Response): Promise<void> {
  try {
    const { points, format, prefix, deviceName } = exportTagsSchema.parse(req.body);

    const tags = points.map((p, i) => ({
      name: prefix ? `${prefix}_${p.name}` : p.name,
      description: p.description || p.name,
      type: 'EXTERNAL',
      dataType: p.dataType === 'FLOAT32' ? 'FLOAT' : p.dataType === 'BIT' ? 'BOOLEAN' : 'INTEGER',
      unit: p.unit || '',
      address: String(p.address),
      addressType: 'HOLDING_REGISTER',
      byteOrder: p.byteOrder || 'BIG_ENDIAN',
      wordCount: p.dataType === 'FLOAT32' ? 2 : 1,
      scaleFactor: p.scaleFactor || 1,
      scaleOffset: 0,
      deviceName,
      category: p.category || 'measurement',
    }));

    if (format === 'csv') {
      const header = 'name,description,type,dataType,unit,address,addressType,byteOrder,wordCount,scaleFactor,scaleOffset,deviceName';
      const rows = tags.map(t =>
        `${t.name},${t.description},${t.type},${t.dataType},${t.unit},${t.address},${t.addressType},${t.byteOrder},${t.wordCount},${t.scaleFactor},${t.scaleOffset},${t.deviceName}`
      );
      const csv = [header, ...rows].join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${deviceName}_tags.csv"`);
      res.send(csv);
    } else {
      res.json({ tags, count: tags.length });
    }
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('[RelayExplorer] Export tags error:', err);
    res.status(500).json({ error: err.message || 'Export failed' });
  }
}
