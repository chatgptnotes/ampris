import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { stringify } from 'csv-stringify/sync';

const templateSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  type: z.enum(['SHIFT_REPORT', 'DAILY_GENERATION', 'EVENT_LOG', 'CUSTOM']),
  schedule: z.string().max(50).optional().nullable(),
  config: z.object({
    tags: z.array(z.string()).default([]),
    timeRange: z.string().optional(),
    aggregation: z.string().optional(),
    groupBy: z.string().optional(),
    columns: z.array(z.string()).optional(),
    filters: z.any().optional(),
  }),
  projectId: z.string().uuid(),
});

// GET /api/report-templates
export async function getTemplates(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const templates = await prisma.reportTemplate.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(templates);
  } catch (err) {
    console.error('Get templates error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/report-templates
export async function createTemplate(req: Request, res: Response): Promise<void> {
  try {
    const data = templateSchema.parse(req.body);
    const template = await prisma.reportTemplate.create({ data });
    res.status(201).json(template);
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    console.error('Create template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/report-templates/:id
export async function updateTemplate(req: Request, res: Response): Promise<void> {
  try {
    const data = templateSchema.partial().parse(req.body);
    const template = await prisma.reportTemplate.update({ where: { id: req.params.id }, data });
    res.json(template);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Template not found' }); return; }
    console.error('Update template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/report-templates/:id
export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  try {
    await prisma.reportTemplate.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Template not found' }); return; }
    console.error('Delete template error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

function getTimeRangeMs(timeRange: string): number {
  switch (timeRange) {
    case '1h': return 3600000;
    case '8h': return 28800000;
    case '24h': return 86400000;
    case '7d': return 604800000;
    default: return 86400000;
  }
}

// POST /api/report-templates/:templateId/generate
export async function generateReport(req: Request, res: Response): Promise<void> {
  try {
    const template = await prisma.reportTemplate.findUnique({ where: { id: req.params.templateId } });
    if (!template) { res.status(404).json({ error: 'Template not found' }); return; }

    const config = template.config as any;
    const tagNames = config.tags || [];
    const timeRange = config.timeRange || '24h';
    const aggregation = config.aggregation || 'None';
    const groupBy = config.groupBy || 'None';

    const now = new Date();
    // Support custom date range from request body
    let from: Date, to: Date;
    if (req.body.from && req.body.to) {
      from = new Date(req.body.from);
      to = new Date(req.body.to);
    } else {
      from = new Date(now.getTime() - getTimeRangeMs(timeRange));
      to = now;
    }

    // Fetch tag history
    const history = await prisma.tagHistory.findMany({
      where: {
        tagName: { in: tagNames },
        timestamp: { gte: from, lte: to },
      },
      orderBy: { timestamp: 'asc' },
    });

    let reportData: any[];

    if (aggregation === 'None' || !aggregation) {
      reportData = history.map(h => ({ tagName: h.tagName, value: h.value, timestamp: h.timestamp.toISOString(), quality: h.quality }));
    } else {
      // Group data
      const grouped = new Map<string, number[]>();
      for (const h of history) {
        const key = groupBy === 'Hour'
          ? `${h.tagName}|${h.timestamp.toISOString().slice(0, 13)}`
          : groupBy === 'Day'
          ? `${h.tagName}|${h.timestamp.toISOString().slice(0, 10)}`
          : groupBy === 'Shift'
          ? `${h.tagName}|${h.timestamp.toISOString().slice(0, 10)}-S${Math.floor(h.timestamp.getHours() / 8)}`
          : h.tagName;
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(h.value);
      }

      reportData = Array.from(grouped.entries()).map(([key, values]) => {
        const [tagName, period] = key.split('|');
        let aggValue: number;
        switch (aggregation) {
          case 'Average': aggValue = values.reduce((a, b) => a + b, 0) / values.length; break;
          case 'Min': aggValue = Math.min(...values); break;
          case 'Max': aggValue = Math.max(...values); break;
          case 'Sum': aggValue = values.reduce((a, b) => a + b, 0); break;
          case 'Count': aggValue = values.length; break;
          default: aggValue = values[values.length - 1]; break;
        }
        return { tagName, period: period || 'all', aggregation, value: Math.round(aggValue * 100) / 100, sampleCount: values.length };
      });
    }

    // Save generated report
    const report = await prisma.generatedReport.create({
      data: {
        templateId: template.id,
        name: `${template.name} - ${now.toISOString().slice(0, 16)}`,
        data: reportData,
        format: 'JSON',
        projectId: template.projectId,
      },
    });

    await prisma.reportTemplate.update({ where: { id: template.id }, data: { lastGeneratedAt: now } });

    res.json({ report, data: reportData, rowCount: reportData.length });
  } catch (err) {
    console.error('Generate report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/report-templates/generated
export async function getGeneratedReports(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const reports = await prisma.generatedReport.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 });
    res.json(reports);
  } catch (err) {
    console.error('Get generated reports error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/report-templates/generated/:id/download
export async function downloadReport(req: Request, res: Response): Promise<void> {
  try {
    const report = await prisma.generatedReport.findUnique({ where: { id: req.params.id } });
    if (!report) { res.status(404).json({ error: 'Report not found' }); return; }

    const format = req.query.format || 'csv';
    const data = report.data as any[];

    if (format === 'csv') {
      const csv = stringify(data, { header: true });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.csv`);
      res.send(csv);
    } else if (format === 'pdf') {
      // Simple HTML-based PDF placeholder
      const html = `<html><head><title>${report.name}</title><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#f5f5f5}</style></head><body><h1>${report.name}</h1><p>Generated: ${report.createdAt.toISOString()}</p><table><tr>${Object.keys(data[0] || {}).map(k => `<th>${k}</th>`).join('')}</tr>${data.map(row => `<tr>${Object.values(row).map(v => `<td>${v}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Content-Disposition', `attachment; filename=${report.name.replace(/[^a-zA-Z0-9]/g, '_')}.html`);
      res.send(html);
    } else {
      res.json(data);
    }
  } catch (err) {
    console.error('Download report error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
