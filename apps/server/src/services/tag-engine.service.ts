import { prisma } from '../config/database';
import { realtimeService } from './realtime.service';

interface TagValue {
  tag: string;
  value: string | number | boolean;
  timestamp: Date;
}

interface TagHistory {
  value: string;
  timestamp: Date;
}

class TagEngineService {
  private tagValues: Map<string, TagValue> = new Map();
  private tagHistory: Map<string, TagHistory[]> = new Map();
  private simulatorIntervals: Map<string, NodeJS.Timeout> = new Map();
  private calculatedInterval?: NodeJS.Timeout;

  async initialize(): Promise<void> {
    // Load all tags from DB and set initial values
    const tags = await prisma.tag.findMany();
    for (const tag of tags) {
      const val = tag.currentValue ?? tag.initialValue ?? '0';
      this.tagValues.set(tag.name, {
        tag: tag.name,
        value: this.parseValue(val, tag.dataType),
        timestamp: new Date(),
      });
    }

    // Start simulated tags
    this.startSimulatedTags();

    // Start calculated tags evaluation every 1s
    this.calculatedInterval = setInterval(() => this.evaluateCalculatedTags(), 1000);

    console.log(`[TagEngine] Initialized with ${tags.length} tags`);
  }

  private parseValue(val: string, dataType: string): string | number | boolean {
    switch (dataType) {
      case 'BOOLEAN': return val === 'true' || val === '1';
      case 'INTEGER': return parseInt(val, 10) || 0;
      case 'FLOAT': return parseFloat(val) || 0;
      default: return val;
    }
  }

  private startSimulatedTags(): void {
    // Clear existing intervals
    for (const interval of this.simulatorIntervals.values()) {
      clearInterval(interval);
    }
    this.simulatorIntervals.clear();

    // Re-query and start
    prisma.tag.findMany({ where: { type: 'SIMULATED' } }).then((tags) => {
      for (const tag of tags) {
        const freq = tag.simFrequency || 1;
        const amp = tag.simAmplitude || 1;
        const offset = tag.simOffset || 0;
        const pattern = tag.simPattern || 'sine';
        const intervalMs = Math.max(100, Math.round(1000 / freq));
        let step = 0;

        const interval = setInterval(() => {
          let value: number;
          const t = step * (intervalMs / 1000);
          switch (pattern) {
            case 'sine':
              value = offset + amp * Math.sin(2 * Math.PI * freq * t);
              break;
            case 'random':
              value = offset + (Math.random() * 2 - 1) * amp;
              break;
            case 'rand': {
              // rand(max) or rand(min,max) — stored as simOffset=min, simAmplitude=max
              const rMin = offset;  // min (default 0)
              const rMax = amp;     // max
              value = rMin + Math.random() * (rMax - rMin);
              break;
            }
            case 'ramp':
              value = offset + amp * ((t * freq) % 1);
              break;
            case 'square':
              value = offset + (Math.sin(2 * Math.PI * freq * t) >= 0 ? amp : -amp);
              break;
            default:
              value = offset;
          }
          step++;

          // Round to 3 decimals
          value = Math.round(value * 1000) / 1000;

          // Clamp to min/max if defined
          if (tag.minValue != null) value = Math.max(tag.minValue, value);
          if (tag.maxValue != null) value = Math.min(tag.maxValue, value);

          this.setTagValue(tag.name, value, false);
        }, intervalMs);

        this.simulatorIntervals.set(tag.name, interval);
      }
    });
  }

  private async evaluateCalculatedTags(): Promise<void> {
    const tags = await prisma.tag.findMany({ where: { type: 'CALCULATED' } });
    for (const tag of tags) {
      if (!tag.formula) continue;
      try {
        const value = this.evaluateFormula(tag.formula);
        if (value !== undefined) {
          this.setTagValue(tag.name, value, false);
        }
      } catch {
        // Skip failed formula evaluations
      }
    }
  }

  private evaluateFormula(formula: string): number | undefined {
    // Replace tag references with values
    let expr = formula;
    const tagRefRegex = /\b([A-Za-z_][A-Za-z0-9_.\-]*)\b/g;
    let match;
    const replacements: [string, number][] = [];

    while ((match = tagRefRegex.exec(formula)) !== null) {
      const ref = match[1];
      // Skip JS keywords and numbers
      if (['Math', 'PI', 'sin', 'cos', 'abs', 'sqrt', 'pow', 'min', 'max', 'round', 'floor', 'ceil', 'true', 'false', 'null', 'undefined'].includes(ref)) continue;
      const tagVal = this.tagValues.get(ref);
      if (tagVal && typeof tagVal.value === 'number') {
        replacements.push([ref, tagVal.value]);
      }
    }

    for (const [ref, val] of replacements) {
      expr = expr.replace(new RegExp(ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), String(val));
    }

    try {
      // Safe math evaluation via Function constructor
      const result = new Function(`"use strict"; return (${expr});`)();
      if (typeof result === 'number' && isFinite(result)) {
        return Math.round(result * 1000) / 1000;
      }
    } catch {
      // Invalid formula
    }
    return undefined;
  }

  async setTagValueWithInterlocks(tagName: string, value: string | number | boolean, userId: string = 'system', projectId?: string): Promise<{ success: boolean; error?: string; blockedBy?: any[] }> {
    try {
      const { interlockService } = require('./interlock.service');
      const result = await interlockService.checkInterlocks(tagName, value, userId, projectId);
      if (!result.allowed) {
        return { success: false, error: 'Blocked by interlock', blockedBy: result.blockedBy };
      }
    } catch {}
    this.setTagValue(tagName, value);
    return { success: true };
  }

  setTagValue(tagName: string, value: string | number | boolean, persist: boolean = true): void {
    const tv: TagValue = { tag: tagName, value, timestamp: new Date() };
    this.tagValues.set(tagName, tv);

    // Add to history (keep last 50)
    const hist = this.tagHistory.get(tagName) || [];
    hist.push({ value: String(value), timestamp: tv.timestamp });
    if (hist.length > 50) hist.shift();
    this.tagHistory.set(tagName, hist);

    // Broadcast via WebSocket
    try {
      const io = realtimeService.getIO();
      io.emit('tag:valueChanged', { tag: tagName, value, timestamp: tv.timestamp });
    } catch {
      // IO not ready yet
    }

    // Persist to DB asynchronously
    if (persist) {
      prisma.tag.updateMany({
        where: { name: tagName },
        data: { currentValue: String(value) },
      }).catch(() => {});
    }
  }

  getTagValue(tagName: string): TagValue | undefined {
    return this.tagValues.get(tagName);
  }

  getAllTagValues(): Record<string, TagValue> {
    return Object.fromEntries(this.tagValues);
  }

  getTagHistory(tagName: string): TagHistory[] {
    return this.tagHistory.get(tagName) || [];
  }

  // Execute a user script with setTag/getTag functions
  executeScript(code: string): { success: boolean; log: string[]; error?: string } {
    const log: string[] = [];
    const self = this;

    const setTag = (name: string, value: string | number | boolean) => {
      self.setTagValue(name, value);
      log.push(`setTag("${name}", ${JSON.stringify(value)})`);
    };

    const getTag = (name: string): string | number | boolean | undefined => {
      const tv = self.tagValues.get(name);
      return tv?.value;
    };

    try {
      const fn = new Function('setTag', 'getTag', 'log', `"use strict";\n${code}`);
      fn(setTag, getTag, (msg: string) => log.push(String(msg)));
      return { success: true, log };
    } catch (err: any) {
      return { success: false, log, error: err.message };
    }
  }

  // Restart simulators (called after tag create/update/delete)
  restartSimulators(): void {
    this.startSimulatedTags();
  }

  shutdown(): void {
    for (const interval of this.simulatorIntervals.values()) {
      clearInterval(interval);
    }
    if (this.calculatedInterval) clearInterval(this.calculatedInterval);
  }
}

export const tagEngine = new TagEngineService();
