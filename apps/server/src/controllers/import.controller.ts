import { Request, Response } from 'express';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as XLSX from 'xlsx';
import { prisma } from '../config/database';
import { tagEngine } from '../services/tag-engine.service';

const CSV_COLUMNS = [
  'name', 'description', 'type', 'dataType', 'unit', 'minValue', 'maxValue',
  'initialValue', 'simPattern', 'simFrequency', 'simAmplitude', 'simOffset',
  'formula', 'group', 'deviceName', 'addressType', 'address', 'scaleFactor', 'scaleOffset',
];

const VALID_TYPES = ['INTERNAL', 'SIMULATED', 'CALCULATED', 'EXTERNAL'];
const VALID_DATA_TYPES = ['BOOLEAN', 'INTEGER', 'FLOAT', 'STRING'];

function parseFileToRows(buffer: Buffer, mimetype: string): Record<string, string>[] {
  if (mimetype === 'text/csv' || mimetype === 'application/vnd.ms-excel') {
    return parse(buffer, { columns: true, skip_empty_lines: true, trim: true });
  }
  // Excel
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json<Record<string, string>>(sheet, { defval: '' });
}

function validateRow(row: Record<string, string>, index: number): { errors: string[]; data: any } {
  const errors: string[] = [];
  if (!row.name || !row.name.trim()) errors.push(`Row ${index + 1}: name is required`);
  if (!row.type || !VALID_TYPES.includes(row.type.toUpperCase())) errors.push(`Row ${index + 1}: invalid type "${row.type}"`);
  if (!row.dataType || !VALID_DATA_TYPES.includes(row.dataType.toUpperCase())) errors.push(`Row ${index + 1}: invalid dataType "${row.dataType}"`);

  return {
    errors,
    data: {
      name: (row.name || '').trim(),
      description: row.description || null,
      type: (row.type || '').toUpperCase(),
      dataType: (row.dataType || '').toUpperCase(),
      unit: row.unit || null,
      minValue: row.minValue ? parseFloat(row.minValue) : null,
      maxValue: row.maxValue ? parseFloat(row.maxValue) : null,
      initialValue: row.initialValue || '0',
      simPattern: row.simPattern || null,
      simFrequency: row.simFrequency ? parseFloat(row.simFrequency) : null,
      simAmplitude: row.simAmplitude ? parseFloat(row.simAmplitude) : null,
      simOffset: row.simOffset ? parseFloat(row.simOffset) : null,
      formula: row.formula || null,
      group: row.group || null,
      deviceName: row.deviceName || null,
      addressType: row.addressType || null,
      address: row.address || null,
      scaleFactor: row.scaleFactor ? parseFloat(row.scaleFactor) : null,
      scaleOffset: row.scaleOffset ? parseFloat(row.scaleOffset) : null,
    },
  };
}

// POST /api/import/tags/preview
export async function previewImport(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const rows = parseFileToRows(req.file.buffer, req.file.mimetype);
    const preview = rows.slice(0, 10).map((row, i) => {
      const { errors, data } = validateRow(row, i);
      return { ...data, _errors: errors, _row: i + 1 };
    });
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    res.json({ totalRows: rows.length, preview, columns, expectedColumns: CSV_COLUMNS });
  } catch (err) {
    console.error('Preview import error:', err);
    res.status(500).json({ error: 'Failed to parse file' });
  }
}

// POST /api/import/tags
export async function importTags(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const projectId = req.body.projectId;
    if (!projectId) { res.status(400).json({ error: 'projectId is required' }); return; }

    const rows = parseFileToRows(req.file.buffer, req.file.mimetype);

    // Get existing devices for name lookup
    const devices = await prisma.externalDevice.findMany({ where: { projectId }, select: { id: true, name: true } });
    const deviceMap = new Map(devices.map(d => [d.name.toLowerCase(), d.id]));

    // Get existing tag names
    const existingTags = await prisma.tag.findMany({ where: { projectId }, select: { name: true } });
    const existingNames = new Set(existingTags.map(t => t.name.toLowerCase()));

    let imported = 0, skipped = 0, errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const { errors: rowErrors, data } = validateRow(rows[i], i);
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        errorCount++;
        continue;
      }
      if (existingNames.has(data.name.toLowerCase())) {
        skipped++;
        continue;
      }

      try {
        const deviceId = data.deviceName ? deviceMap.get(data.deviceName.toLowerCase()) || null : null;
        await prisma.tag.create({
          data: {
            name: data.name,
            description: data.description,
            type: data.type,
            dataType: data.dataType,
            unit: data.unit,
            minValue: data.minValue,
            maxValue: data.maxValue,
            initialValue: data.initialValue,
            currentValue: data.initialValue || '0',
            simPattern: data.simPattern,
            simFrequency: data.simFrequency,
            simAmplitude: data.simAmplitude,
            simOffset: data.simOffset,
            formula: data.formula,
            group: data.group,
            projectId,
            deviceId,
            addressType: data.addressType,
            address: data.address,
            scaleFactor: data.scaleFactor,
            scaleOffset: data.scaleOffset,
          },
        });
        existingNames.add(data.name.toLowerCase());
        // Init in engine
        tagEngine.setTagValue(data.name, data.initialValue || '0', false);
        imported++;
      } catch (err: any) {
        if (err.code === 'P2002') { skipped++; } else { errorCount++; errors.push(`Row ${i + 1}: ${err.message}`); }
      }
    }

    tagEngine.restartSimulators();
    res.json({ imported, skipped, errors: errorCount, errorDetails: errors.slice(0, 20), total: rows.length });
  } catch (err) {
    console.error('Import tags error:', err);
    res.status(500).json({ error: 'Import failed' });
  }
}

// POST /api/import/tags/template
export async function downloadTemplate(_req: Request, res: Response): Promise<void> {
  try {
    const csv = stringify([CSV_COLUMNS, [
      'PUMP.flow_rate', 'Main pump flow rate', 'SIMULATED', 'FLOAT', 'L/s', '0', '100', '50',
      'sine', '0.1', '25', '50', '', 'Pumps', '', '', '', '', '',
    ]], { header: false });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=gridvision-tag-template.csv');
    res.send(csv);
  } catch (err) {
    console.error('Template download error:', err);
    res.status(500).json({ error: 'Failed to generate template' });
  }
}

// GET /api/export/tags
export async function exportTags(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, format } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);

    const tags = await prisma.tag.findMany({
      where,
      include: { device: { select: { name: true } } },
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });

    if (format === 'json') {
      res.json(tags);
      return;
    }

    // CSV
    const rows = tags.map(t => ({
      name: t.name,
      description: t.description || '',
      type: t.type,
      dataType: t.dataType,
      unit: t.unit || '',
      minValue: t.minValue ?? '',
      maxValue: t.maxValue ?? '',
      initialValue: t.initialValue || '',
      simPattern: t.simPattern || '',
      simFrequency: t.simFrequency ?? '',
      simAmplitude: t.simAmplitude ?? '',
      simOffset: t.simOffset ?? '',
      formula: t.formula || '',
      group: t.group || '',
      deviceName: t.device?.name || '',
      addressType: t.addressType || '',
      address: t.address || '',
      scaleFactor: t.scaleFactor ?? '',
      scaleOffset: t.scaleOffset ?? '',
    }));

    const csv = stringify(rows, { header: true, columns: CSV_COLUMNS });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=gridvision-tags-export.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export tags error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
}

// GET /api/export/tag-history
export async function exportTagHistory(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, tags: tagNames, from, to, format } = req.query;
    const where: any = {};
    if (tagNames) {
      const names = String(tagNames).split(',');
      where.tagName = { in: names };
    }
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(String(from));
      if (to) where.timestamp.lte = new Date(String(to));
    }

    const history = await prisma.tagHistory.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: 10000,
    });

    if (format === 'json') { res.json(history); return; }

    const csv = stringify(history.map(h => ({
      tagName: h.tagName, value: h.value, timestamp: h.timestamp.toISOString(), quality: h.quality || 'GOOD',
    })), { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tag-history-export.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export tag history error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
}

// GET /api/export/alarms
export async function exportAlarms(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, from, to, format } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(String(from));
      if (to) where.timestamp.lte = new Date(String(to));
    }

    const alarms = await prisma.alarmEvent.findMany({ where, orderBy: { timestamp: 'desc' }, take: 10000 });

    if (format === 'json') { res.json(alarms); return; }

    const csv = stringify(alarms.map(a => ({
      alarmType: a.alarmType, severity: a.severity, source: a.source, message: a.message,
      timestamp: a.timestamp.toISOString(), acknowledged: a.acknowledged, clearedAt: a.clearedAt?.toISOString() || '',
    })), { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=alarms-export.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export alarms error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
}

// GET /api/export/audit
export async function exportAudit(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, from, to, format } = req.query;
    const where: any = {};
    if (from || to) {
      where.timestamp = {};
      if (from) where.timestamp.gte = new Date(String(from));
      if (to) where.timestamp.lte = new Date(String(to));
    }

    const audit = await prisma.auditTrail.findMany({ where, orderBy: { timestamp: 'desc' }, take: 10000 });

    if (format === 'json') { res.json(audit); return; }

    const csv = stringify(audit.map(a => ({
      action: a.action, targetType: a.targetType || '', targetId: a.targetId || '',
      timestamp: a.timestamp.toISOString(), ipAddress: a.ipAddress || '', details: JSON.stringify(a.details),
    })), { header: true });
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=audit-export.csv');
    res.send(csv);
  } catch (err) {
    console.error('Export audit error:', err);
    res.status(500).json({ error: 'Export failed' });
  }
}
