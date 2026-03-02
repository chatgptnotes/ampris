import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../config/database';
import { tagEngine } from '../services/tag-engine.service';
import { realtimeService } from '../services/realtime.service';

const createSequenceSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().max(100).optional(),
  steps: z.array(z.any()).default([]),
  requiresAuth: z.boolean().optional(),
  authorityLevel: z.number().int().min(1).max(4).optional(),
  isEmergency: z.boolean().optional(),
  projectId: z.string().uuid(),
});

// In-memory execution state for operator confirmations
const pendingConfirmations: Map<string, { resolve: () => void; reject: (err: Error) => void }> = new Map();
const runningExecutions: Set<string> = new Set();

export async function createSequence(req: Request, res: Response): Promise<void> {
  try {
    const data = createSequenceSchema.parse(req.body);
    const seq = await prisma.commandSequence.create({ data });
    res.status(201).json(seq);
  } catch (err: any) {
    if (err.code === 'P2002') { res.status(409).json({ error: 'Sequence name already exists in this project' }); return; }
    if (err.name === 'ZodError') { res.status(400).json({ error: 'Validation error', details: err.errors }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getSequences(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const seqs = await prisma.commandSequence.findMany({ where, orderBy: { name: 'asc' } });
    res.json(seqs);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function getSequence(req: Request, res: Response): Promise<void> {
  try {
    const seq = await prisma.commandSequence.findUnique({ where: { id: req.params.id } });
    if (!seq) { res.status(404).json({ error: 'Sequence not found' }); return; }
    res.json(seq);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function updateSequence(req: Request, res: Response): Promise<void> {
  try {
    const data = createSequenceSchema.partial().parse(req.body);
    const seq = await prisma.commandSequence.update({ where: { id: req.params.id }, data });
    res.json(seq);
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Sequence not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function deleteSequence(req: Request, res: Response): Promise<void> {
  try {
    await prisma.commandSequence.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err: any) {
    if (err.code === 'P2025') { res.status(404).json({ error: 'Sequence not found' }); return; }
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function executeSequence(req: Request, res: Response): Promise<void> {
  try {
    const seq = await prisma.commandSequence.findUnique({ where: { id: req.params.id } });
    if (!seq) { res.status(404).json({ error: 'Sequence not found' }); return; }

    const steps = seq.steps as any[];
    const userName = req.user?.userId || req.user?.username || 'unknown';

    const execution = await prisma.commandExecution.create({
      data: {
        sequenceId: seq.id,
        sequenceName: seq.name,
        status: 'RUNNING',
        totalSteps: steps.length,
        startedBy: userName,
        projectId: seq.projectId,
      },
    });

    const io = realtimeService.getIO();
    io.emit('command:started', { executionId: execution.id, sequenceName: seq.name, totalSteps: steps.length });

    // Return immediately, run steps async
    res.json(execution);

    runningExecutions.add(execution.id);
    const stepResults: any[] = [];

    for (let i = 0; i < steps.length; i++) {
      if (!runningExecutions.has(execution.id)) {
        // Aborted
        await prisma.commandExecution.update({
          where: { id: execution.id },
          data: { status: 'ABORTED', stepResults, completedAt: new Date(), currentStep: i },
        });
        io.emit('command:failed', { executionId: execution.id, reason: 'Aborted by operator' });
        return;
      }

      const step = steps[i];
      await prisma.commandExecution.update({ where: { id: execution.id }, data: { currentStep: i } });

      try {
        let result: any = { step: i, status: 'SUCCESS', timestamp: new Date().toISOString() };

        switch (step.type) {
          case 'SET_VALUE': {
            const action = step.action || 'set';
            let val = step.value;
            if (action === 'toggle') {
              const cur = tagEngine.getTagValue(step.tagName);
              val = !(cur?.value === true || cur?.value === 'true' || cur?.value === 1);
            } else if (action === 'increment') {
              const cur = tagEngine.getTagValue(step.tagName);
              val = (typeof cur?.value === 'number' ? cur.value : 0) + (parseFloat(step.value) || 1);
            }
            tagEngine.setTagValue(step.tagName, val);
            result.message = `Set ${step.tagName} = ${val}`;
            result.actualValue = val;
            break;
          }
          case 'CHECK_CONDITION': {
            const timeout = (step.timeout || 5) * 1000;
            const start = Date.now();
            let passed = false;
            while (Date.now() - start < timeout) {
              const tv = tagEngine.getTagValue(step.condition?.tagName || step.tagName);
              const actual = tv?.value;
              passed = evaluateCondition(step.condition?.operator || 'eq', actual, step.condition?.value || step.value);
              if (passed) break;
              await new Promise(r => setTimeout(r, 200));
            }
            if (!passed) {
              const tv = tagEngine.getTagValue(step.condition?.tagName || step.tagName);
              result.status = 'FAILED';
              result.message = `Condition not met: ${step.condition?.tagName || step.tagName} ${step.condition?.operator || 'eq'} ${step.condition?.value || step.value}`;
              result.actualValue = tv?.value;
              throw new Error(result.message);
            }
            result.message = `Condition met: ${step.condition?.tagName || step.tagName}`;
            break;
          }
          case 'WAIT': {
            const ms = (step.value || step.timeout || 1) * 1000;
            await new Promise(r => setTimeout(r, ms));
            result.message = `Waited ${ms / 1000}s`;
            break;
          }
          case 'CONFIRM_OPERATOR': {
            io.emit('command:waitingConfirm', { executionId: execution.id, step: i, message: step.description || 'Operator confirmation required' });
            await new Promise<void>((resolve, reject) => {
              pendingConfirmations.set(execution.id, { resolve, reject });
              // Timeout after 5 minutes
              setTimeout(() => {
                if (pendingConfirmations.has(execution.id)) {
                  pendingConfirmations.delete(execution.id);
                  reject(new Error('Operator confirmation timeout'));
                }
              }, 300000);
            });
            pendingConfirmations.delete(execution.id);
            result.message = 'Operator confirmed';
            break;
          }
          case 'LOG_EVENT': {
            result.message = step.description || step.value || 'Event logged';
            await prisma.auditTrail.create({
              data: {
                action: 'COMMAND_LOG_EVENT',
                details: { sequenceName: seq.name, step: i, message: result.message },
                userId: req.user?.userId,
              },
            }).catch(() => {});
            break;
          }
        }

        stepResults.push(result);
        io.emit('command:stepComplete', { executionId: execution.id, step: i, result });
      } catch (err: any) {
        stepResults.push({ step: i, status: 'FAILED', timestamp: new Date().toISOString(), message: err.message });
        runningExecutions.delete(execution.id);
        await prisma.commandExecution.update({
          where: { id: execution.id },
          data: { status: 'FAILED', stepResults, errorMessage: err.message, completedAt: new Date(), currentStep: i },
        });
        io.emit('command:failed', { executionId: execution.id, step: i, reason: err.message });
        return;
      }
    }

    runningExecutions.delete(execution.id);
    await prisma.commandExecution.update({
      where: { id: execution.id },
      data: { status: 'COMPLETED', stepResults, completedAt: new Date(), currentStep: steps.length },
    });
    io.emit('command:completed', { executionId: execution.id });
  } catch (err) {
    console.error('Execute sequence error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function confirmStep(req: Request, res: Response): Promise<void> {
  const pending = pendingConfirmations.get(req.params.id);
  if (!pending) { res.status(404).json({ error: 'No pending confirmation' }); return; }
  pending.resolve();
  res.json({ success: true });
}

export async function abortExecution(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (runningExecutions.has(id)) {
    runningExecutions.delete(id);
    const pending = pendingConfirmations.get(id);
    if (pending) { pending.reject(new Error('Aborted')); pendingConfirmations.delete(id); }
  }
  await prisma.commandExecution.update({
    where: { id },
    data: { status: 'ABORTED', completedAt: new Date() },
  }).catch(() => {});
  res.json({ success: true });
}

export async function getExecutions(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.query;
    const where: any = {};
    if (projectId) where.projectId = String(projectId);
    const execs = await prisma.commandExecution.findMany({ where, orderBy: { startedAt: 'desc' }, take: 100 });
    res.json(execs);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

export async function getExecution(req: Request, res: Response): Promise<void> {
  try {
    const exec = await prisma.commandExecution.findUnique({ where: { id: req.params.id } });
    if (!exec) { res.status(404).json({ error: 'Execution not found' }); return; }
    res.json(exec);
  } catch { res.status(500).json({ error: 'Internal server error' }); }
}

function evaluateCondition(operator: string, actual: any, expected: string): boolean {
  const numActual = typeof actual === 'number' ? actual : parseFloat(String(actual));
  const numExpected = parseFloat(expected);
  const strActual = String(actual);
  switch (operator) {
    case 'eq': return isNaN(numActual) ? strActual === expected : numActual === numExpected;
    case 'ne': return isNaN(numActual) ? strActual !== expected : numActual !== numExpected;
    case 'gt': return numActual > numExpected;
    case 'lt': return numActual < numExpected;
    case 'gte': return numActual >= numExpected;
    case 'lte': return numActual <= numExpected;
    default: return strActual === expected;
  }
}
