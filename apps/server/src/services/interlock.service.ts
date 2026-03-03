import { prisma } from '../config/database';
import { tagEngine } from './tag-engine.service';
import { realtimeService } from './realtime.service';

interface ConditionResult {
  tagName: string;
  operator: string;
  expected: string;
  actual: string | number | boolean | undefined;
  passed: boolean;
  description?: string;
}

interface InterlockCheckResult {
  allowed: boolean;
  blockedBy: any[];
  conditionResults: ConditionResult[];
}

class InterlockService {
  evaluateCondition(operator: string, actual: any, expected: string): boolean {
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

  async checkInterlocks(tagName: string, value: string | number | boolean, userId: string, projectId?: string): Promise<InterlockCheckResult> {
    const where: any = { targetTag: tagName, enabled: true };
    if (projectId) where.projectId = projectId;

    const interlocks = await prisma.interlock.findMany({
      where,
      orderBy: { priority: 'desc' },
    });

    const blockedBy: any[] = [];
    const allConditionResults: ConditionResult[] = [];

    for (const interlock of interlocks) {
      // Check if this interlock applies to the action/value
      if (interlock.targetValue && String(value) !== interlock.targetValue) continue;

      const conditions = interlock.conditions as any[];
      const results: ConditionResult[] = [];
      let allPassed = true;

      for (const cond of conditions) {
        const tv = tagEngine.getTagValue(cond.tagName);
        const actual = tv?.value;
        const passed = this.evaluateCondition(cond.operator, actual, cond.value);
        results.push({
          tagName: cond.tagName,
          operator: cond.operator,
          expected: cond.value,
          actual,
          passed,
          description: cond.description,
        });
        if (!passed) allPassed = false;
      }

      allConditionResults.push(...results);

      if (!allPassed) {
        blockedBy.push({ ...interlock, conditionResults: results });
      }

      // Log event
      const action = allPassed ? 'ALLOWED' : 'BLOCKED';
      await prisma.interlockEvent.create({
        data: {
          interlockId: interlock.id,
          interlockName: interlock.name,
          targetTag: tagName,
          action,
          attemptedBy: userId,
          conditions: results as any,
          projectId: interlock.projectId,
        },
      }).catch((err: any) => { console.warn("[Interlock] async operation failed:", err.message); });
    }

    const allowed = blockedBy.length === 0;

    if (!allowed) {
      try {
        const io = realtimeService.getIO();
        io.emit('interlock:blocked', { tagName, value, blockedBy: blockedBy.map(b => ({ id: b.id, name: b.name, conditions: b.conditionResults })) });
      } catch (err: any) { console.error("[Interlock] operation failed:", err.message); }
    }

    return { allowed, blockedBy, conditionResults: allConditionResults };
  }
}

export const interlockService = new InterlockService();
