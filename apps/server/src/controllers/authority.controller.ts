import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { authorityService } from '../services/authority.service';

const createAuthoritySchema = z.object({
  userId: z.string().uuid(),
  userName: z.string().min(1).max(200),
  level: z.number().int().min(1).max(4),
  permissions: z.array(z.string()).default([]),
  zones: z.array(z.string()).default([]),
  activeFrom: z.string().datetime().optional().nullable(),
  activeTo: z.string().datetime().optional().nullable(),
  isActive: z.boolean().optional(),
  projectId: z.string().uuid(),
});

export async function createAuthority(req: Request, res: Response): Promise<void> {
  try {
    const data = createAuthoritySchema.parse(req.body);
    const authority = await prisma.operatorAuthority.create({
      data: {
        ...data,
        activeFrom: data.activeFrom ? new Date(data.activeFrom) : null,
        activeTo: data.activeTo ? new Date(data.activeTo) : null,
      },
    });
    res.status(201).json(authority);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Authority already exists for this user in project' }); return; }
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getAuthorities(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const authorities = await prisma.operatorAuthority.findMany({ where, orderBy: { level: 'desc' } });
    res.json(authorities);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function getAuthority(req: Request, res: Response): Promise<void> {
  try {
    const authority = await prisma.operatorAuthority.findUnique({ where: { id: req.params.id } });
    if (!authority) { res.status(404).json({ error: 'Authority not found' }); return; }
    res.json(authority);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function updateAuthority(req: Request, res: Response): Promise<void> {
  try {
    const data = createAuthoritySchema.partial().parse(req.body);
    const updateData: any = { ...data };
    if (data.activeFrom !== undefined) updateData.activeFrom = data.activeFrom ? new Date(data.activeFrom) : null;
    if (data.activeTo !== undefined) updateData.activeTo = data.activeTo ? new Date(data.activeTo) : null;
    const authority = await prisma.operatorAuthority.update({ where: { id: req.params.id }, data: updateData });
    res.json(authority);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Authority not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteAuthority(req: Request, res: Response): Promise<void> {
  try {
    await prisma.operatorAuthority.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Authority not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function checkAuthority(req: Request, res: Response): Promise<void> {
  try {
    const { userId, level, permission, zone, projectId } = req.query;
    if (!userId || !level || !projectId) { res.status(400).json({ error: 'userId, level, and projectId required' }); return; }
    const result = await authorityService.checkAuthority(
      String(userId), String(projectId), parseInt(String(level)), String(permission || ''), String(zone || '')
    );
    res.json(result);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function getActiveOperators(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const now = new Date();
    const where: any = { isActive: true };
    if (projectId) where.projectId = String(projectId);
    const authorities = await prisma.operatorAuthority.findMany({ where });
    const active = authorities.filter(a => {
      if (a.activeFrom && now < a.activeFrom) return false;
      if (a.activeTo && now > a.activeTo) return false;
      return true;
    });
    res.json(active);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}
