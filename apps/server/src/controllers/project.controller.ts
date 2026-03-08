import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';

const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  sldImage: z.string().optional(),       // base64 of original uploaded SLD image
  sldImageMime: z.string().optional(),
});

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

const updateMemberSchema = z.object({
  role: z.enum(['ADMIN', 'OPERATOR', 'VIEWER']),
});

// Helper: check if user is a member of project with sufficient role
async function checkProjectAccess(userId: string, projectId: string, requiredRoles?: string[]) {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
  });
  if (!member) return null;
  if (requiredRoles && !requiredRoles.includes(member.role)) return null;
  return member;
}

// POST /api/projects - create project
export async function createProject(req: Request, res: Response): Promise<void> {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        ownerId: req.user!.userId,
        members: {
          create: { userId: req.user!.userId, role: 'OWNER' },
        },
      },
      include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { members: true, mimicPages: true } } },
    });
    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to create project' });
  }
}

// GET /api/projects - list user's projects
export async function getProjects(req: Request, res: Response): Promise<void> {
  const projects = await prisma.project.findMany({
    where: {
      members: { some: { userId: req.user!.userId } },
    },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { members: true, mimicPages: true } },
      members: {
        where: { userId: req.user!.userId },
        select: { role: true },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(projects);
}

// GET /api/projects/:id - get project details
export async function getProject(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const access = await checkProjectAccess(req.user!.userId, id);
  if (!access) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      mimicPages: { orderBy: { pageOrder: 'asc' }, select: { id: true, name: true, pageOrder: true, isHomePage: true, width: true, height: true } },
      _count: { select: { members: true } },
    },
  });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({ ...project, userRole: access.role });
}

// PUT /api/projects/:id - update project
export async function updateProject(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const access = await checkProjectAccess(req.user!.userId, id, ['OWNER', 'ADMIN']);
    if (!access) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const data = updateProjectSchema.parse(req.body);
    const project = await prisma.project.update({
      where: { id },
      data,
    });
    res.json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update project' });
  }
}

// DELETE /api/projects/:id - delete project (owner only)
export async function deleteProject(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const access = await checkProjectAccess(req.user!.userId, id, ['OWNER']);
  if (!access) {
    res.status(403).json({ error: 'Only project owner can delete' });
    return;
  }
  await prisma.project.delete({ where: { id } });
  res.json({ message: 'Project deleted' });
}

// GET /api/projects/:id/members - list members
export async function getMembers(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const access = await checkProjectAccess(req.user!.userId, id);
  if (!access) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const members = await prisma.projectMember.findMany({
    where: { projectId: id },
    include: { user: { select: { id: true, username: true, name: true, email: true, role: true } } },
    orderBy: { assignedAt: 'asc' },
  });
  res.json(members);
}

// POST /api/projects/:id/members - add member by email
export async function addMember(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const access = await checkProjectAccess(req.user!.userId, id, ['OWNER', 'ADMIN']);
    if (!access) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const data = addMemberSchema.parse(req.body);
    const user = await prisma.user.findFirst({ where: { email: data.email } });
    if (!user) {
      res.status(404).json({ error: 'User not found with that email' });
      return;
    }
    const existing = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId: user.id } },
    });
    if (existing) {
      res.status(409).json({ error: 'User is already a member' });
      return;
    }
    const member = await prisma.projectMember.create({
      data: { projectId: id, userId: user.id, role: data.role },
      include: { user: { select: { id: true, username: true, name: true, email: true, role: true } } },
    });
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to add member' });
  }
}

// PUT /api/projects/:id/members/:memberId - change role
export async function updateMember(req: Request, res: Response): Promise<void> {
  try {
    const { id, memberId } = req.params;
    const access = await checkProjectAccess(req.user!.userId, id, ['OWNER', 'ADMIN']);
    if (!access) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }
    const target = await prisma.projectMember.findUnique({ where: { id: memberId } });
    if (!target || target.projectId !== id) {
      res.status(404).json({ error: 'Member not found' });
      return;
    }
    if (target.role === 'OWNER') {
      res.status(403).json({ error: 'Cannot change owner role' });
      return;
    }
    const data = updateMemberSchema.parse(req.body);
    const updated = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: data.role },
      include: { user: { select: { id: true, username: true, name: true, email: true, role: true } } },
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update member' });
  }
}

// DELETE /api/projects/:id/members/:memberId - remove member
export async function removeMember(req: Request, res: Response): Promise<void> {
  const { id, memberId } = req.params;
  const access = await checkProjectAccess(req.user!.userId, id, ['OWNER', 'ADMIN']);
  if (!access) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }
  const target = await prisma.projectMember.findUnique({ where: { id: memberId } });
  if (!target || target.projectId !== id) {
    res.status(404).json({ error: 'Member not found' });
    return;
  }
  if (target.role === 'OWNER') {
    res.status(403).json({ error: 'Cannot remove project owner' });
    return;
  }
  await prisma.projectMember.delete({ where: { id: memberId } });
  res.json({ message: 'Member removed' });
}
