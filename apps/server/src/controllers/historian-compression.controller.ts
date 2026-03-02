import { Request, Response } from 'express';
import { prisma } from '../config/database';
import { historianCompressionService } from '../services/historian-compression.service';

export async function getConfigs(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const configs = await prisma.historianConfig.findMany({
      where: projectId ? { projectId: String(projectId) } : {},
      orderBy: { tagName: 'asc' },
    });
    res.json(configs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function createConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await prisma.historianConfig.upsert({
      where: { projectId_tagName: { projectId: req.body.projectId, tagName: req.body.tagName } },
      update: req.body,
      create: req.body,
    });
    await historianCompressionService.updateConfig(config);
    res.status(201).json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function updateConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await prisma.historianConfig.update({
      where: { id: req.params.id },
      data: req.body,
    });
    await historianCompressionService.updateConfig(config);
    res.json(config);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function deleteConfig(req: Request, res: Response): Promise<void> {
  try {
    const config = await prisma.historianConfig.delete({ where: { id: req.params.id } });
    historianCompressionService.removeConfig(config.tagName);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getStats(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const stats = await historianCompressionService.getStats(String(projectId));
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function queryHistory(req: Request, res: Response): Promise<void> {
  try {
    const { tag, from, to, maxPoints } = req.query;
    if (!tag) { res.status(400).json({ error: 'tag required' }); return; }

    const where: any = { tagName: String(tag) };
    if (from) where.timestamp = { ...where.timestamp, gte: new Date(String(from)) };
    if (to) where.timestamp = { ...where.timestamp, lte: new Date(String(to)) };

    let data = await prisma.tagHistory.findMany({
      where,
      orderBy: { timestamp: 'asc' },
      take: maxPoints ? parseInt(String(maxPoints)) : 1000,
    });

    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function cleanup(req: Request, res: Response): Promise<void> {
  try {
    const { projectId, beforeDate } = req.body;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const result = await historianCompressionService.manualCleanup(projectId, beforeDate ? new Date(beforeDate) : undefined);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}

export async function getStorage(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    if (!projectId) { res.status(400).json({ error: 'projectId required' }); return; }
    const stats = await historianCompressionService.getStorageStats(String(projectId));
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
}
