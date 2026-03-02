import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { tagEngine } from '../services/tag-engine.service';

const recipeSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional().nullable(),
  category: z.string().max(100).optional().nullable(),
  steps: z.array(z.object({
    tagName: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
    delay: z.number().min(0).default(0),
    order: z.number().int().min(0),
  })).default([]),
  projectId: z.string().uuid(),
});

// In-memory tracking of running recipes
const runningRecipes = new Map<string, { currentStep: number; totalSteps: number; status: string; abortController: AbortController }>();

// GET /api/recipes
export async function getRecipes(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const recipes = await prisma.recipe.findMany({ where, orderBy: { createdAt: 'desc' } });
    const result = recipes.map(r => ({
      ...r,
      _status: runningRecipes.get(r.id)?.status || 'stopped',
      _currentStep: runningRecipes.get(r.id)?.currentStep || 0,
    }));
    res.json(result);
  } catch (err) {
    console.error('Get recipes error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/recipes
export async function createRecipe(req: Request, res: Response): Promise<void> {
  try {
    const data = recipeSchema.parse(req.body);
    const recipe = await prisma.recipe.create({ data });
    res.status(201).json(recipe);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Recipe name already exists in this project' }); return; }
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    console.error('Create recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/recipes/:id
export async function updateRecipe(req: Request, res: Response): Promise<void> {
  try {
    const data = recipeSchema.partial().parse(req.body);
    const recipe = await prisma.recipe.update({ where: { id: req.params.id }, data });
    res.json(recipe);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Recipe not found' }); return; }
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    console.error('Update recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/recipes/:id
export async function deleteRecipe(req: Request, res: Response): Promise<void> {
  try {
    await prisma.recipe.delete({ where: { id: req.params.id } });
    runningRecipes.delete(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Recipe not found' }); return; }
    console.error('Delete recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/recipes/:id/execute
export async function executeRecipe(req: Request, res: Response): Promise<void> {
  try {
    const recipe = await prisma.recipe.findUnique({ where: { id: req.params.id } });
    if (!recipe) { res.status(404).json({ error: 'Recipe not found' }); return; }

    if (runningRecipes.has(recipe.id) && runningRecipes.get(recipe.id)!.status === 'running') {
      res.status(409).json({ error: 'Recipe is already running' });
      return;
    }

    const steps = (recipe.steps as any[]).sort((a, b) => a.order - b.order);
    const ac = new AbortController();
    const state = { currentStep: 0, totalSteps: steps.length, status: 'running', abortController: ac };
    runningRecipes.set(recipe.id, state);

    await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: true, lastRunAt: new Date() } });

    // Run async
    (async () => {
      try {
        for (let i = 0; i < steps.length; i++) {
          if (ac.signal.aborted) { state.status = 'stopped'; break; }
          state.currentStep = i + 1;
          const step = steps[i];
          tagEngine.setTagValue(step.tagName, step.value);
          if (step.delay > 0 && i < steps.length - 1) {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(resolve, step.delay * 1000);
              ac.signal.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); });
            });
          }
        }
        if (state.status === 'running') state.status = 'completed';
      } catch {
        state.status = 'stopped';
      } finally {
        await prisma.recipe.update({ where: { id: recipe.id }, data: { isActive: false } }).catch(() => {});
      }
    })();

    res.json({ success: true, status: 'running', totalSteps: steps.length });
  } catch (err) {
    console.error('Execute recipe error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/recipes/:id/stop
export async function stopRecipe(req: Request, res: Response): Promise<void> {
  const state = runningRecipes.get(req.params.id);
  if (!state || state.status !== 'running') {
    res.status(404).json({ error: 'Recipe is not running' });
    return;
  }
  state.abortController.abort();
  state.status = 'stopped';
  await prisma.recipe.update({ where: { id: req.params.id }, data: { isActive: false } }).catch(() => {});
  res.json({ success: true, status: 'stopped' });
}

// GET /api/recipes/:id/status
export async function getRecipeStatus(req: Request, res: Response): Promise<void> {
  const state = runningRecipes.get(req.params.id);
  if (!state) {
    res.json({ status: 'stopped', currentStep: 0, totalSteps: 0 });
    return;
  }
  res.json({ status: state.status, currentStep: state.currentStep, totalSteps: state.totalSteps });
}
