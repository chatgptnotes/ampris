/**
 * AI Real Inference Service
 * Replaces demo data with actual DB-driven analysis using simple statistics.
 * Falls back to ai-demo-data.service.ts when no historical data exists.
 */
import { prisma } from '../config/database';

// ─── Math Utilities ───────────────────────────────

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; r2: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: y[0] || 0, r2: 0 };
  const sumX = x.reduce((a, b) => a + b, 0);
  const sumY = y.reduce((a, b) => a + b, 0);
  const sumXY = x.reduce((a, b, i) => a + b * y[i], 0);
  const sumX2 = x.reduce((a, b) => a + b * b, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r2: 0 };
  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const meanY = sumY / n;
  const ssRes = y.reduce((s, yi, i) => s + (yi - (slope * x[i] + intercept)) ** 2, 0);
  const ssTot = y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;

  return { slope, intercept, r2 };
}

function mean(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}

function zScore(value: number, m: number, sd: number): number {
  return sd > 0 ? Math.abs(value - m) / sd : 0;
}

// ─── Load Forecasting ─────────────────────────────

export async function realLoadForecast(hoursAhead: number = 24): Promise<any | null> {
  try {
    const since = new Date(Date.now() - 30 * 86400000); // Last 30 days
    const history = await prisma.tagHistory.findMany({
      where: {
        timestamp: { gte: since },
        tagName: { contains: 'load', mode: 'insensitive' as any },
      },
      orderBy: { timestamp: 'asc' },
      take: 10000,
    });

    if (history.length < 48) return null; // Not enough data, use fallback

    const baseTime = history[0].timestamp.getTime();
    const x = history.map((h) => (h.timestamp.getTime() - baseTime) / 3600000); // hours
    const y = history.map((h) => h.value);

    const reg = linearRegression(x, y);
    const avgLoad = mean(y);
    const sd = stddev(y);

    // Project next N hours
    const now = (Date.now() - baseTime) / 3600000;
    const forecast = [];
    for (let i = 0; i < hoursAhead; i++) {
      const t = now + i;
      const predicted = reg.slope * t + reg.intercept;
      // Add hourly pattern from historical data
      const hour = new Date(Date.now() + i * 3600000).getHours();
      const hourlyValues = history.filter((h) => h.timestamp.getHours() === hour).map((h) => h.value);
      const hourlyAvg = hourlyValues.length > 0 ? mean(hourlyValues) : avgLoad;
      const blended = predicted * 0.3 + hourlyAvg * 0.7; // Blend trend with hourly pattern

      forecast.push({
        timestamp: new Date(Date.now() + i * 3600000).toISOString(),
        predicted: Math.round(blended * 100) / 100,
        lower: Math.round((blended - 1.96 * sd) * 100) / 100,
        upper: Math.round((blended + 1.96 * sd) * 100) / 100,
        confidence: Math.max(0.5, Math.min(0.98, reg.r2)),
      });
    }

    return {
      forecast,
      model: {
        type: 'linear_regression_hourly',
        slope: reg.slope,
        intercept: reg.intercept,
        r2: reg.r2,
        dataPoints: history.length,
        trainedOn: `${Math.round((Date.now() - since.getTime()) / 86400000)} days`,
      },
      summary: {
        avgLoad: Math.round(avgLoad * 100) / 100,
        peakForecast: Math.round(Math.max(...forecast.map((f) => f.predicted)) * 100) / 100,
        trend: reg.slope > 0.01 ? 'increasing' : reg.slope < -0.01 ? 'decreasing' : 'stable',
      },
    };
  } catch (err: any) {
    console.error('[AIInference] realLoadForecast failed:', err.message);
    return null;
  }
}

// ─── Anomaly Detection ────────────────────────────

export async function realAnomalyDetection(): Promise<any | null> {
  try {
    // Get recent tag values and historical baseline
    const since = new Date(Date.now() - 7 * 86400000); // Last 7 days
    const recentWindow = new Date(Date.now() - 3600000); // Last 1 hour

    const tags = await prisma.tag.findMany({ take: 100, select: { name: true } });
    if (tags.length === 0) return null;

    const anomalies: any[] = [];
    const analyzed: string[] = [];

    for (const tag of tags.slice(0, 50)) {
      const baseline = await prisma.tagHistory.findMany({
        where: { tagName: tag.name, timestamp: { gte: since, lt: recentWindow } },
        select: { value: true },
        take: 5000,
      });

      if (baseline.length < 20) continue;

      const values = baseline.map((b) => b.value);
      const m = mean(values);
      const sd = stddev(values);

      // Get recent values
      const recent = await prisma.tagHistory.findMany({
        where: { tagName: tag.name, timestamp: { gte: recentWindow } },
        select: { value: true, timestamp: true },
        orderBy: { timestamp: 'desc' },
        take: 10,
      });

      analyzed.push(tag.name);

      for (const r of recent) {
        const z = zScore(r.value, m, sd);
        if (z > 2.5) {
          anomalies.push({
            tagName: tag.name,
            value: r.value,
            timestamp: r.timestamp,
            zScore: Math.round(z * 100) / 100,
            baseline: { mean: Math.round(m * 100) / 100, stddev: Math.round(sd * 100) / 100 },
            severity: z > 4 ? 'critical' : z > 3 ? 'major' : 'minor',
            description: `Value ${r.value} is ${z.toFixed(1)} sigma from mean ${m.toFixed(1)}`,
          });
        }
      }
    }

    if (analyzed.length === 0) return null;

    return {
      anomalies: anomalies.sort((a, b) => b.zScore - a.zScore).slice(0, 20),
      summary: {
        tagsAnalyzed: analyzed.length,
        anomaliesFound: anomalies.length,
        criticalCount: anomalies.filter((a) => a.severity === 'critical').length,
        method: 'z-score (threshold: 2.5 sigma)',
      },
    };
  } catch (err: any) {
    console.error('[AIInference] realAnomalyDetection failed:', err.message);
    return null;
  }
}

// ─── Power Quality ────────────────────────────────

export async function realPowerQuality(): Promise<any | null> {
  try {
    const tags = await prisma.tag.findMany({
      where: {
        OR: [
          { name: { contains: 'THD', mode: 'insensitive' as any } },
          { name: { contains: 'voltage', mode: 'insensitive' as any } },
          { name: { contains: 'frequency', mode: 'insensitive' as any } },
          { name: { contains: 'PF', mode: 'insensitive' as any } },
          { name: { contains: 'power_factor', mode: 'insensitive' as any } },
        ],
      },
      take: 50,
    });

    if (tags.length === 0) return null;

    let voltageScore = 100;
    let freqScore = 100;
    let thdScore = 100;
    let pfScore = 100;

    for (const tag of tags) {
      const val = parseFloat(tag.currentValue || '0');
      const name = tag.name.toLowerCase();

      if (name.includes('thd')) {
        // IEEE 519: THD should be < 5% for general systems
        if (val > 8) thdScore = Math.min(thdScore, 40);
        else if (val > 5) thdScore = Math.min(thdScore, 70);
        else thdScore = Math.min(thdScore, 100 - val * 6);
      }
      if (name.includes('voltage') || name.includes('_v')) {
        // Voltage should be within +-5% of nominal
        const nominal = val > 1000 ? 11000 : val > 100 ? 415 : 230;
        const deviation = Math.abs(val - nominal) / nominal * 100;
        voltageScore = Math.min(voltageScore, Math.max(0, 100 - deviation * 10));
      }
      if (name.includes('freq') || name.includes('hz')) {
        // Frequency should be 49.5-50.5 Hz
        const deviation = Math.abs(val - 50);
        freqScore = Math.min(freqScore, Math.max(0, 100 - deviation * 50));
      }
      if (name.includes('pf') || name.includes('power_factor')) {
        pfScore = Math.min(pfScore, Math.max(0, val * 100));
      }
    }

    const overall = Math.round((voltageScore + freqScore + thdScore + pfScore) / 4);

    return {
      overallScore: overall,
      breakdown: {
        voltage: { score: Math.round(voltageScore), status: voltageScore > 80 ? 'good' : voltageScore > 50 ? 'fair' : 'poor' },
        frequency: { score: Math.round(freqScore), status: freqScore > 80 ? 'good' : freqScore > 50 ? 'fair' : 'poor' },
        harmonics: { score: Math.round(thdScore), status: thdScore > 80 ? 'good' : thdScore > 50 ? 'fair' : 'poor' },
        powerFactor: { score: Math.round(pfScore), status: pfScore > 80 ? 'good' : pfScore > 50 ? 'fair' : 'poor' },
      },
      standard: 'IEEE 519-2014',
      tagsAnalyzed: tags.length,
    };
  } catch (err: any) {
    console.error('[AIInference] realPowerQuality failed:', err.message);
    return null;
  }
}

// ─── Predictive Maintenance ───────────────────────

export async function realPredictiveMaintenance(): Promise<any | null> {
  try {
    // Look for runtime/hours tags
    const runtimeTags = await prisma.tag.findMany({
      where: {
        OR: [
          { name: { contains: 'runtime', mode: 'insensitive' as any } },
          { name: { contains: 'hours', mode: 'insensitive' as any } },
          { name: { contains: 'opcount', mode: 'insensitive' as any } },
        ],
      },
      take: 50,
    });

    if (runtimeTags.length === 0) return null;

    const tasks: any[] = [];

    for (const tag of runtimeTags) {
      const hours = parseFloat(tag.currentValue || '0');
      const name = tag.name;

      // Define maintenance intervals based on equipment type
      let intervalHours = 8760; // Default: annual
      let equipmentType = 'General';

      if (name.toLowerCase().includes('transformer')) { intervalHours = 17520; equipmentType = 'Transformer'; }
      else if (name.toLowerCase().includes('breaker') || name.toLowerCase().includes('cb')) { intervalHours = 8760; equipmentType = 'Circuit Breaker'; }
      else if (name.toLowerCase().includes('motor') || name.toLowerCase().includes('pump')) { intervalHours = 4380; equipmentType = 'Motor/Pump'; }
      else if (name.toLowerCase().includes('battery')) { intervalHours = 2190; equipmentType = 'Battery'; }

      const remaining = intervalHours - (hours % intervalHours);
      const healthPct = Math.max(0, Math.min(100, (remaining / intervalHours) * 100));
      const daysRemaining = Math.round(remaining / 24);

      // Simple exponential degradation curve
      const degradation = 100 - healthPct;
      const urgency = degradation > 80 ? 'critical' : degradation > 60 ? 'high' : degradation > 30 ? 'medium' : 'low';

      tasks.push({
        tagName: name,
        equipmentType,
        runtimeHours: Math.round(hours),
        maintenanceInterval: intervalHours,
        remainingHours: Math.round(remaining),
        daysUntilDue: daysRemaining,
        healthPercent: Math.round(healthPct),
        urgency,
        recommendation: degradation > 60
          ? `Schedule maintenance within ${daysRemaining} days`
          : `Next maintenance in approximately ${daysRemaining} days`,
      });
    }

    tasks.sort((a, b) => a.remainingHours - b.remainingHours);

    return {
      tasks: tasks.slice(0, 20),
      summary: {
        totalEquipment: tasks.length,
        criticalCount: tasks.filter((t) => t.urgency === 'critical').length,
        dueWithin30Days: tasks.filter((t) => t.daysUntilDue <= 30).length,
        method: 'runtime-based degradation curves',
      },
    };
  } catch (err: any) {
    console.error('[AIInference] realPredictiveMaintenance failed:', err.message);
    return null;
  }
}
