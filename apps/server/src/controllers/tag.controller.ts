import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { tagEngine } from '../services/tag-engine.service';

const createTagSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(['INTERNAL', 'SIMULATED', 'CALCULATED', 'EXTERNAL']),
  dataType: z.enum(['BOOLEAN', 'INTEGER', 'FLOAT', 'STRING']),
  unit: z.string().max(30).optional(),
  minValue: z.number().optional().nullable(),
  maxValue: z.number().optional().nullable(),
  initialValue: z.string().max(200).optional(),
  simPattern: z.enum(['sine', 'random', 'ramp', 'square']).optional().nullable(),
  simFrequency: z.number().optional().nullable(),
  simAmplitude: z.number().optional().nullable(),
  simOffset: z.number().optional().nullable(),
  formula: z.string().optional().nullable(),
  group: z.string().max(100).optional().nullable(),
  projectId: z.string().uuid(),
});

const updateTagSchema = createTagSchema.partial();

const setValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
});

const bulkSetSchema = z.object({
  values: z.array(z.object({
    tagName: z.string(),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })),
});

const executeScriptSchema = z.object({
  code: z.string().min(1),
});

// POST /api/tags
export async function createTag(req: Request, res: Response): Promise<void> {
  try {
    const data = createTagSchema.parse(req.body);
    const tag = await prisma.tag.create({
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
        projectId: data.projectId,
      },
    });

    // Initialize in engine
    const val = tag.initialValue || '0';
    tagEngine.setTagValue(tag.name, tag.dataType === 'FLOAT' ? parseFloat(val) : tag.dataType === 'INTEGER' ? parseInt(val, 10) : tag.dataType === 'BOOLEAN' ? val === 'true' : val, false);

    // Restart simulators if simulated tag
    if (data.type === 'SIMULATED') {
      tagEngine.restartSimulators();
    }

    res.status(201).json(tag);
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Tag name already exists in this project' });
      return;
    }
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Create tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/tags
export async function getTags(req: Request, res: Response): Promise<void> {
  try {
    const { type, group, search, projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    if (type) where.type = String(type);
    if (group) where.group = String(group);
    if (search) {
      where.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { description: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const tags = await prisma.tag.findMany({
      where,
      orderBy: [{ group: 'asc' }, { name: 'asc' }],
    });

    // Attach live values
    const tagsWithValues = tags.map((tag) => {
      const live = tagEngine.getTagValue(tag.name);
      return {
        ...tag,
        liveValue: live?.value ?? tag.currentValue,
        liveTimestamp: live?.timestamp,
      };
    });

    res.json(tagsWithValues);
  } catch (err) {
    console.error('Get tags error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/tags/:id
export async function getTag(req: Request, res: Response): Promise<void> {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } });
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    const live = tagEngine.getTagValue(tag.name);
    res.json({
      ...tag,
      liveValue: live?.value ?? tag.currentValue,
      liveTimestamp: live?.timestamp,
      history: tagEngine.getTagHistory(tag.name).slice(-10),
    });
  } catch (err) {
    console.error('Get tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/tags/:id
export async function updateTag(req: Request, res: Response): Promise<void> {
  try {
    const data = updateTagSchema.parse(req.body);
    const tag = await prisma.tag.update({
      where: { id: req.params.id },
      data,
    });

    // Restart simulators if needed
    if (data.type === 'SIMULATED' || data.simPattern !== undefined) {
      tagEngine.restartSimulators();
    }

    res.json(tag);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Update tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/tags/:id
export async function deleteTag(req: Request, res: Response): Promise<void> {
  try {
    const tag = await prisma.tag.delete({ where: { id: req.params.id } });
    // Restart simulators to remove any running simulator for this tag
    tagEngine.restartSimulators();
    res.json({ success: true, deleted: tag.name });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    console.error('Delete tag error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/tags/:id/set-value
export async function setTagValue(req: Request, res: Response): Promise<void> {
  try {
    const { value } = setValueSchema.parse(req.body);
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } });
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    tagEngine.setTagValue(tag.name, value);
    res.json({ success: true, tag: tag.name, value });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Set tag value error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/tags/by-name/set-value
export async function setTagValueByName(req: Request, res: Response): Promise<void> {
  try {
    const { tagName, value } = z.object({ tagName: z.string(), value: z.union([z.string(), z.number(), z.boolean()]) }).parse(req.body);
    tagEngine.setTagValue(tagName, value);
    res.json({ success: true, tag: tagName, value });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Set tag value by name error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/tags/bulk-set
export async function bulkSetValues(req: Request, res: Response): Promise<void> {
  try {
    const { values } = bulkSetSchema.parse(req.body);
    const results: { tagName: string; value: any; success: boolean }[] = [];
    for (const { tagName, value } of values) {
      tagEngine.setTagValue(tagName, value);
      results.push({ tagName, value, success: true });
    }
    res.json({ success: true, results });
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Bulk set error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/tags/execute-script
export async function executeScript(req: Request, res: Response): Promise<void> {
  try {
    const { code } = executeScriptSchema.parse(req.body);
    const result = tagEngine.executeScript(code);
    res.json(result);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Execute script error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/tags/values/all
export async function getAllValues(req: Request, res: Response): Promise<void> {
  try {
    res.json(tagEngine.getAllTagValues());
  } catch (err) {
    console.error('Get all values error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// GET /api/tags/:id/history
export async function getTagHistory(req: Request, res: Response): Promise<void> {
  try {
    const tag = await prisma.tag.findUnique({ where: { id: req.params.id } });
    if (!tag) {
      res.status(404).json({ error: 'Tag not found' });
      return;
    }
    res.json(tagEngine.getTagHistory(tag.name));
  } catch (err) {
    console.error('Get tag history error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Scripts CRUD ─────────────────────────────

// GET /api/tags/scripts
export async function getScripts(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const scripts = await prisma.tagScript.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(scripts);
  } catch (err) {
    console.error('Get scripts error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/tags/scripts
export async function createScript(req: Request, res: Response): Promise<void> {
  try {
    const data = z.object({
      name: z.string().min(1).max(200),
      code: z.string().min(1),
      category: z.string().max(50).optional(),
      projectId: z.string().uuid(),
    }).parse(req.body);
    const script = await prisma.tagScript.create({ data });
    res.status(201).json(script);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Create script error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/tags/scripts/:id
export async function updateScript(req: Request, res: Response): Promise<void> {
  try {
    const data = z.object({
      name: z.string().min(1).max(200).optional(),
      code: z.string().optional(),
      category: z.string().max(50).optional().nullable(),
    }).parse(req.body);
    const script = await prisma.tagScript.update({ where: { id: req.params.id }, data });
    res.json(script);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Script not found' });
      return;
    }
    console.error('Update script error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/tags/scripts/:id
export async function deleteScript(req: Request, res: Response): Promise<void> {
  try {
    await prisma.tagScript.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Script not found' });
      return;
    }
    console.error('Delete script error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Scenarios CRUD ─────────────────────────────

// GET /api/tags/scenarios
export async function getScenarios(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const scenarios = await prisma.testScenario.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json(scenarios);
  } catch (err) {
    console.error('Get scenarios error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// POST /api/tags/scenarios
export async function createScenario(req: Request, res: Response): Promise<void> {
  try {
    const data = z.object({
      name: z.string().min(1).max(200),
      steps: z.array(z.object({
        delay: z.number().min(0),
        tagName: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
      })),
      projectId: z.string().uuid(),
    }).parse(req.body);
    const scenario = await prisma.testScenario.create({
      data: { name: data.name, steps: data.steps, projectId: data.projectId },
    });
    res.status(201).json(scenario);
  } catch (err: any) {
    if (err.name === 'ZodError') {
      res.status(400).json({ error: 'Validation error', details: err.errors });
      return;
    }
    console.error('Create scenario error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// PUT /api/tags/scenarios/:id
export async function updateScenario(req: Request, res: Response): Promise<void> {
  try {
    const data = z.object({
      name: z.string().min(1).max(200).optional(),
      steps: z.array(z.object({
        delay: z.number().min(0),
        tagName: z.string(),
        value: z.union([z.string(), z.number(), z.boolean()]),
      })).optional(),
    }).parse(req.body);
    const scenario = await prisma.testScenario.update({
      where: { id: req.params.id },
      data: { name: data.name, steps: data.steps },
    });
    res.json(scenario);
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Scenario not found' });
      return;
    }
    console.error('Update scenario error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// DELETE /api/tags/scenarios/:id
export async function deleteScenario(req: Request, res: Response): Promise<void> {
  try {
    await prisma.testScenario.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Scenario not found' });
      return;
    }
    console.error('Delete scenario error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
