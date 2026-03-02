import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { interlockService } from '../services/interlock.service';

const createInterlockSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  targetTag: z.string().min(1).max(200),
  targetAction: z.enum(['SET', 'TOGGLE', 'ANY']),
  targetValue: z.string().max(100).optional(),
  conditions: z.array(z.object({
    tagName: z.string(),
    operator: z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte']),
    value: z.string(),
    description: z.string().optional(),
  })),
  enabled: z.boolean().optional(),
  priority: z.number().int().optional(),
  bypassable: z.boolean().optional(),
  bypassLevel: z.number().int().min(1).max(4).optional(),
  projectId: z.string().uuid(),
});

export async function createInterlock(req: Request, res: Response): Promise<void> {
  try {
    const data = createInterlockSchema.parse(req.body);
    const interlock = await prisma.interlock.create({ data });
    res.status(201).json(interlock);
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getInterlocks(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const interlocks = await prisma.interlock.findMany({ where, orderBy: { priority: 'desc' } });
    res.json(interlocks);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function getInterlock(req: Request, res: Response): Promise<void> {
  try {
    const interlock = await prisma.interlock.findUnique({ where: { id: req.params.id } });
    if (!interlock) { res.status(404).json({ error: 'Interlock not found' }); return; }
    res.json(interlock);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function updateInterlock(req: Request, res: Response): Promise<void> {
  try {
    const data = createInterlockSchema.partial().parse(req.body);
    const interlock = await prisma.interlock.update({ where: { id: req.params.id }, data });
    res.json(interlock);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Interlock not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteInterlock(req: Request, res: Response): Promise<void> {
  try {
    await prisma.interlock.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Interlock not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function checkInterlock(req: Request, res: Response): Promise<void> {
  try {
    const { tag, value, projectId } = req.query;
    if (!tag || !value) { res.status(400).json({ error: 'tag and value query params required' }); return; }
    const result = await interlockService.checkInterlocks(String(tag), String(value), req.user?.userId || 'unknown', String(projectId || ''));
    res.json(result);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function getInterlockEvents(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const events = await prisma.interlockEvent.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200 });
    res.json(events);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function bypassInterlock(req: Request, res: Response): Promise<void> {
  try {
    const { reason } = z.object({ reason: z.string().min(1) }).parse(req.body);
    const interlock = await prisma.interlock.findUnique({ where: { id: req.params.id } });
    if (!interlock) { res.status(404).json({ error: 'Interlock not found' }); return; }
    if (!interlock.bypassable) { res.status(403).json({ error: 'This interlock cannot be bypassed' }); return; }

    await prisma.interlockEvent.create({
      data: {
        interlockId: interlock.id,
        interlockName: interlock.name,
        targetTag: interlock.targetTag,
        action: 'BYPASSED',
        attemptedBy: req.user?.userId || 'unknown',
        conditions: [],
        bypassed: true,
        bypassedBy: req.user?.userId || 'unknown',
        bypassReason: reason,
        projectId: interlock.projectId,
      },
    });

    res.json({ success: true, message: 'Interlock bypassed' });
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}
