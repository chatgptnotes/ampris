import { Request, Response } from 'express';
import {
  generateLoadForecast,
  generateLoadDurationCurve,
  generateDemandResponseRecommendations,
  generateEquipmentHealth,
  generateAlarmAnalysis,
  generateMaintenanceTasks,
  generateSparePartSuggestions,
  generateCostAnalysis,
  generateVoltageProfile,
  generatePowerFactorTrend,
  generateHarmonicAnalysis,
  generateReliabilityIndices,
  generateDailyReport,
  simulateWhatIf,
} from '../services/ai-demo-data.service';

// ─── Load Forecasting ────────────────────────────────

export async function getLoadForecast(req: Request, res: Response): Promise<void> {
  try {
    const range = String(req.query.range || '24h');
    const hoursMap: Record<string, number> = { '24h': 24, '48h': 48, '7d': 168 };
    const hours = hoursMap[range] || 24;

    const forecast = generateLoadForecast(hours);
    res.json(forecast);
  } catch (error) {
    console.error('Load forecast error:', error);
    res.status(500).json({ error: 'Failed to generate load forecast' });
  }
}

export async function getLoadDurationCurve(_req: Request, res: Response): Promise<void> {
  try {
    res.json(generateLoadDurationCurve());
  } catch (error) {
    console.error('Load duration error:', error);
    res.status(500).json({ error: 'Failed to generate load duration curve' });
  }
}

export async function getDemandResponse(_req: Request, res: Response): Promise<void> {
  try {
    res.json(generateDemandResponseRecommendations());
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate demand response' });
  }
}

// ─── Equipment Health ────────────────────────────────

export async function getEquipmentHealth(_req: Request, res: Response): Promise<void> {
  try {
    const equipment = generateEquipmentHealth();
    res.json(equipment);
  } catch (error) {
    console.error('Equipment health error:', error);
    res.status(500).json({ error: 'Failed to get equipment health' });
  }
}

export async function getAnomalies(req: Request, res: Response): Promise<void> {
  try {
    const severityFilter = req.query.severity ? String(req.query.severity).split(',') : null;
    const equipment = generateEquipmentHealth();
    let anomalies = equipment.flatMap(e => e.anomalies);

    if (severityFilter) {
      anomalies = anomalies.filter(a => severityFilter.includes(a.severity));
    }

    anomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(anomalies);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get anomalies' });
  }
}

// ─── Alarm Analysis ──────────────────────────────────

export async function getAlarmAnalysis(_req: Request, res: Response): Promise<void> {
  try {
    res.json(generateAlarmAnalysis());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get alarm analysis' });
  }
}

// ─── Predictive Maintenance ──────────────────────────

export async function getMaintenanceTasks(_req: Request, res: Response): Promise<void> {
  try {
    res.json(generateMaintenanceTasks());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get maintenance tasks' });
  }
}

export async function getSpareParts(_req: Request, res: Response): Promise<void> {
  try {
    res.json(generateSparePartSuggestions());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get spare parts' });
  }
}

export async function getCostAnalysis(_req: Request, res: Response): Promise<void> {
  try {
    res.json(generateCostAnalysis());
  } catch (error) {
    res.status(500).json({ error: 'Failed to get cost analysis' });
  }
}

// ─── Power Quality ───────────────────────────────────

export async function getPowerQuality(req: Request, res: Response): Promise<void> {
  try {
    const hours = parseInt(String(req.query.hours || '24'));
    res.json({
      voltageProfile: generateVoltageProfile(hours),
      powerFactor: generatePowerFactorTrend(hours),
      harmonics: generateHarmonicAnalysis(),
      reliability: generateReliabilityIndices(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get power quality data' });
  }
}

// ─── Daily Report ────────────────────────────────────

export async function getDailyReport(_req: Request, res: Response): Promise<void> {
  try {
    res.json(generateDailyReport());
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
}

// ─── What-If Simulator ──────────────────────────────

export async function postWhatIf(req: Request, res: Response): Promise<void> {
  try {
    const { scenario } = req.body;
    if (!scenario || typeof scenario !== 'string') {
      res.status(400).json({ error: 'scenario string is required' });
      return;
    }
    res.json(simulateWhatIf(scenario));
  } catch (error) {
    res.status(500).json({ error: 'Failed to run simulation' });
  }
}

// ─── AI Chat ─────────────────────────────────────────

export async function postChat(req: Request, res: Response): Promise<void> {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'message string is required' });
      return;
    }

    // Generate contextual responses based on keywords
    const lower = message.toLowerCase();
    let response: string;

    if (lower.includes('voltage') && lower.includes('dip')) {
      response = `**Voltage Dip Analysis**\n\nThe voltage dip at 14:23 was caused by a 3-phase fault on Feeder 3 that lasted 150ms before CB5 cleared it.\n\n**Timeline:**\n- 14:23:00.000 — Earth fault detected on Feeder 3\n- 14:23:00.045 — Overcurrent 51 pickup on CB5\n- 14:23:00.150 — CB5 tripped, fault cleared\n- 14:23:00.200 — Voltage recovered to nominal\n\n**Impact:** Bus 2 voltage dropped to 9.2 kV (16% dip) for 150ms. 3 sensitive loads reported nuisance trips.\n\n**Recommendation:** Install fault current limiter on Feeder 3 or upgrade CB5 to faster operating mechanism.`;
    } else if (lower.includes('predict') && lower.includes('load')) {
      const forecast = generateLoadForecast(48);
      response = `**Load Prediction for Next Sunday**\n\nBased on the last 30 days of data and weekend patterns:\n\n- **Expected Peak:** ${forecast.peakPrediction.value} MW at ${new Date(forecast.peakPrediction.time).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}\n- **Expected Minimum:** ~${(22 * 0.47 * 0.70).toFixed(1)} MW around 03:00\n- **Average Load:** ~${(22 * 0.75 * 0.70).toFixed(1)} MW\n- **Confidence:** ${Math.round(forecast.peakPrediction.confidence * 100)}%\n\nSunday load is typically 70% of weekday. No special events detected that would alter this pattern.`;
    } else if (lower.includes('maintenance')) {
      const tasks = generateMaintenanceTasks();
      const urgent = tasks.filter(t => t.type === 'urgent' || t.type === 'predicted');
      response = `**Equipment Maintenance This Month**\n\n${urgent.map((t, i) => `${i + 1}. **${t.equipment}** — ${t.task}\n   Priority: ${t.type.toUpperCase()}\n   Scheduled: ${new Date(t.scheduledDate).toLocaleDateString()}\n   Reason: ${t.reason}`).join('\n\n')}\n\n**Total estimated cost:** ₹${urgent.reduce((s, t) => s + t.estimatedCost, 0).toLocaleString()}\n\n**Critical:** CB5 contact replacement is the highest priority — failure probability 35% in 7 days.`;
    } else if (lower.includes('optimize') || lower.includes('switching') || lower.includes('loss')) {
      response = `**Optimal Switching Sequence for Loss Minimization**\n\nCurrent system losses: 2.1% (approx 0.39 MW)\n\n**Recommended switching actions:**\n1. Transfer 2 MW from TR1 to TR2 by closing Bus Coupler CB2\n   → Balances loading (TR1: 65%, TR2: 68%)\n   → Expected loss reduction: 0.08 MW\n\n2. Switch ON capacitor bank at Bus 2 (50 kVAR)\n   → Improves PF from 0.85 to 0.95\n   → Expected loss reduction: 0.12 MW\n\n3. Tap change TR1 from position 5 to position 4\n   → Optimizes voltage profile\n   → Expected loss reduction: 0.03 MW\n\n**Total expected savings:** 0.23 MW (59% loss reduction)\n**Annual energy savings:** ~2,015 MWh (₹12.1 lakhs @ ₹6/kWh)`;
    } else {
      response = `I can help you with the following SCADA analytics queries:\n\n- **"What caused the voltage dip at [time]?"** — Fault analysis\n- **"Predict load for next Sunday"** — Load forecasting\n- **"Which equipment needs maintenance this month?"** — Maintenance schedule\n- **"Optimize switching sequence for minimum losses"** — Power optimization\n- **"What if Transformer TR1 trips?"** — Contingency analysis\n\nI have access to 30 days of historical data, real-time equipment health scores, and predictive models. How can I assist you?`;
    }

    res.json({ response, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'AI chat failed' });
  }
}
