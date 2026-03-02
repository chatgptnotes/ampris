import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { redundancyService } from '../services/redundancy.service';

export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const config = await prisma.redundancyConfig.findUnique({ where: { projectId: String(projectId) } });
    res.json(config || null);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function upsertConfig(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, ...data } = req.body;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const config = await prisma.redundancyConfig.upsert({
      where: { projectId },
      update: data,
      create: { projectId, ...data },
    });
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function promote(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    await redundancyService.promote(projectId);
    res.json({ success: true, message: 'Promoted to PRIMARY' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function demote(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    await redundancyService.demote(projectId);
    res.json({ success: true, message: 'Demoted to STANDBY' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getStatus(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const config = await prisma.redundancyConfig.findUnique({ where: { projectId: String(projectId) } });
    const status = redundancyService.getStatus(String(projectId));
    res.json({ ...status, config });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getEvents(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const events = await prisma.failoverEvent.findMany({
      where: projectId ? { projectId: String(projectId) } : {},
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function testFailover(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.body;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    await redundancyService.testFailover(projectId);
    res.json({ success: true, message: 'Test failover completed' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
