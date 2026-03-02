import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { sboService } from '../services/sbo.service';

export async function getSBOConfigs(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const configs = await prisma.sBOConfig.findMany({ where, orderBy: { tagName: 'asc' } });
    res.json(configs);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function createSBOConfig(req: Request, res: Response): Promise<void> {
  try {
    const data = z.object({
      tagName: z.string().min(1).max(200),
      enabled: z.boolean().optional(),
      selectTimeout: z.number().int().min(5).max(300).optional(),
      confirmRequired: z.boolean().optional(),
      authorityLevel: z.number().int().min(1).max(4).optional(),
      projectId: z.string().uuid(),
    }).parse(req.body);
    const config = await prisma.sBOConfig.create({ data });
    res.status(201).json(config);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'SBO config already exists for this tag' }); return; }
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function updateSBOConfig(req: Request, res: Response): Promise<void> {
  try {
    const data = z.object({
      enabled: z.boolean().optional(),
      selectTimeout: z.number().int().min(5).max(300).optional(),
      confirmRequired: z.boolean().optional(),
      authorityLevel: z.number().int().min(1).max(4).optional(),
    }).parse(req.body);
    const config = await prisma.sBOConfig.update({ where: { id: req.params.id }, data });
    res.json(config);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Config not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSBOConfig(req: Request, res: Response): Promise<void> {
  try {
    await prisma.sBOConfig.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Config not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function selectTag(req: Request, res: Response): Promise<void> {
  try {
    const { tagName, value, projectId } = z.object({
      tagName: z.string(),
      value: z.union([z.string(), z.number(), z.boolean()]),
      projectId: z.string().uuid(),
    }).parse(req.body);
    const result = await sboService.select(tagName, value, req.user?.userId || 'unknown', projectId);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function operateTag(req: Request, res: Response): Promise<void> {
  try {
    const { tagName } = z.object({ tagName: z.string() }).parse(req.body);
    const result = await sboService.operate(tagName, req.user?.userId || 'unknown');
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function cancelSelection(req: Request, res: Response): Promise<void> {
  try {
    const { tagName } = z.object({ tagName: z.string() }).parse(req.body);
    const result = sboService.cancel(tagName, req.user?.userId || 'unknown');
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSBOStatus(_req: Request, res: Response): Promise<void> {
  res.json(sboService.getStatus());
}
