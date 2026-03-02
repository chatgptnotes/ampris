import { prisma } from '../config/database';
import { tagEngine } from './tag-engine.service';
import { realtimeService } from './realtime.service';

interface SBOSelection {
  selectedBy: string;
  selectedAt: Date;
  pendingValue: string | number | boolean;
  timer: NodeJS.Timeout;
  projectId: string;
}

class SBOService {
  private selections: Map<string, SBOSelection> = new Map();

  async isSBOEnabled(tagName: string, projectId: string): Promise<any | null> {
    return prisma.sBOConfig.findFirst({
      where: { tagName, projectId, enabled: true },
    });
  }

  async select(tagName: string, value: string | number | boolean, userId: string, projectId: string): Promise<{ success: boolean; message: string }> {
    const config = await this.isSBOEnabled(tagName, projectId);
    if (!config) return { success: false, message: 'SBO not configured for this tag' };

    const existing = this.selections.get(tagName);
    if (existing) {
      if (existing.selectedBy === userId) {
        return { success: false, message: 'Tag already selected by you. Use Operate or Cancel.' };
      }
      return { success: false, message: `Tag already selected by another operator` };
    }

    const timeout = (config.selectTimeout || 30) * 1000;
    const timer = setTimeout(() => {
      this.selections.delete(tagName);
      try {
        const io = realtimeService.getIO();
        io.emit('sbo:timeout', { tagName, userId });
      } catch {}
    }, timeout);

    this.selections.set(tagName, {
      selectedBy: userId,
      selectedAt: new Date(),
      pendingValue: value,
      timer,
      projectId,
    });

    try {
      const io = realtimeService.getIO();
      io.emit('sbo:selected', { tagName, value, userId, timeout: config.selectTimeout });
    } catch {}

    return { success: true, message: `Tag selected. Operate within ${config.selectTimeout}s.` };
  }

  async operate(tagName: string, userId: string): Promise<{ success: boolean; message: string }> {
    const sel = this.selections.get(tagName);
    if (!sel) return { success: false, message: 'No active selection for this tag' };
    if (sel.selectedBy !== userId) return { success: false, message: 'Tag selected by another operator' };

    clearTimeout(sel.timer);
    this.selections.delete(tagName);

    // Execute setValue through tag engine (which goes through interlocks)
    tagEngine.setTagValue(tagName, sel.pendingValue);

    try {
      const io = realtimeService.getIO();
      io.emit('sbo:operated', { tagName, value: sel.pendingValue, userId });
    } catch {}

    return { success: true, message: 'Operation executed successfully' };
  }

  cancel(tagName: string, userId: string): { success: boolean; message: string } {
    const sel = this.selections.get(tagName);
    if (!sel) return { success: false, message: 'No active selection for this tag' };

    clearTimeout(sel.timer);
    this.selections.delete(tagName);

    try {
      const io = realtimeService.getIO();
      io.emit('sbo:cancelled', { tagName, userId });
    } catch {}

    return { success: true, message: 'Selection cancelled' };
  }

  getStatus(): { tagName: string; selectedBy: string; selectedAt: Date; pendingValue: any }[] {
    const result: any[] = [];
    for (const [tagName, sel] of this.selections) {
      result.push({ tagName, selectedBy: sel.selectedBy, selectedAt: sel.selectedAt, pendingValue: sel.pendingValue });
    }
    return result;
  }

  isSelected(tagName: string): SBOSelection | undefined {
    return this.selections.get(tagName);
  }
}

export const sboService = new SBOService();
