import { Request, Response } from 'express';
import { getModels, getAnomalyModel, getLoadData, isInitialized } from '../ml';
import { forecast, predictMovingAverage, predictRegression } from '../ml/load-forecaster';
import { detectAnomalies, equipmentHealthScore } from '../ml/anomaly-detector';
import { derivePowerQuality } from '../ml/power-quality';
import { predictMaintenance } from '../ml/maintenance';
import type { LoadDataPoint } from '../ml/generate-load-data';
import {
  generateAlarmAnalysis,
  generateSparePartSuggestions,
  generateCostAnalysis,
  generateEquipmentHealth,
} from '../services/ai-demo-data.service';

// ─── Helpers ───────────────────────────────────────

function getRecentData(hours: number = 24): LoadDataPoint[] {
  const data = getLoadData();
  return data.slice(-(hours * 4)); // 4 points per hour (15-min intervals)
}

function buildFuturePoints(hoursAhead: number) {
  const now = new Date();
  const recentData = getRecentData(48);
  const points: LoadDataPoint[] = [];

  for (let i = 0; i < hoursAhead * 4; i++) {
    const t = new Date(now.getTime() + i * 15 * 60 * 1000);
    const hour = t.getHours();
    const dayOfWeek = t.getDay();
    const month = t.getMonth() + 1;

    // Use weather from same time yesterday as proxy
    const lookbackIdx = Math.min(recentData.length - 1, Math.max(0, recentData.length - 96 + (i % 96)));
    const proxy = recentData[lookbackIdx] || recentData[recentData.length - 1];

    points.push({
      timestamp: t.toISOString(),
      hour,
      day_of_week: dayOfWeek,
      month,
      temperature: proxy?.temperature ?? 30,
      humidity: proxy?.humidity ?? 60,
      is_holiday: false,
      is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
      load_mw: 0,
      wind_speed: proxy?.wind_speed ?? 5,
      cloud_cover: proxy?.cloud_cover ?? 50,
    });
  }
  return points;
}

// ─── Load Forecasting ────────────────────────────────

export async function getLoadForecast(req: Request, res: Response): Promise<void> {
  try {
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing, please wait...' }); return; }

    const range = String(req.query.range || '24h');
    const hoursMap: Record<string, number> = { '24h': 24, '48h': 48, '7d': 168, '30d': 720 };
    const hours = hoursMap[range] || 24;
    const models = getModels();

    // Historical (last 24h, hourly)
    const recentData = getRecentData(24);
    const historical = [];
    for (let i = 0; i < recentData.length; i += 4) {
      const p = recentData[i];
      historical.push({
        timestamp: p.timestamp,
        predicted: p.load_mw,
        actual: p.load_mw,
        upperBound: p.load_mw,
        lowerBound: p.load_mw,
        confidence: 1.0,
        isHistorical: true,
      });
    }

    // Forecast
    const futurePoints = buildFuturePoints(hours);
    const forecasted = forecast(models, futurePoints, models.ensemble.metrics.rmse);

    // Downsample to hourly for longer ranges
    let forecastResult = forecasted;
    if (hours > 48) forecastResult = forecasted.filter((_, i) => i % 4 === 0);

    let peakValue = 0, peakTime = '';
    for (const f of forecastResult) {
      if (f.predicted > peakValue) { peakValue = f.predicted; peakTime = f.timestamp; }
    }

    const avgTemp = futurePoints.slice(0, 96).reduce((s, p) => s + p.temperature, 0) / Math.min(96, futurePoints.length);
    const tomorrowDow = new Date(Date.now() + 86400000).getDay();
    const isWeekendTomorrow = tomorrowDow === 0 || tomorrowDow === 6;

    res.json({
      historical,
      forecast: forecastResult.map((f, idx) => ({
        timestamp: f.timestamp,
        predicted: f.predicted,
        upperBound: f.upperBound,
        lowerBound: f.lowerBound,
        confidence: Math.round(Math.max(0.60, 0.95 - (idx / forecastResult.length) * 0.35) * 100) / 100,
      })),
      peakPrediction: {
        value: Math.round(peakValue * 10) / 10,
        time: peakTime,
        confidence: Math.round(models.ensemble.metrics.r2 * 100) / 100,
      },
      factors: [
        { name: `Temperature (${avgTemp.toFixed(0)}°C forecast)`, impact: avgTemp > 35 ? `+${Math.round((avgTemp - 30) * 0.8)}% cooling demand` : 'Normal thermal load', direction: (avgTemp > 35 ? 'up' : 'neutral') as 'up' | 'down' | 'neutral' },
        { name: isWeekendTomorrow ? 'Weekend pattern' : 'Weekday pattern', impact: isWeekendTomorrow ? '-20% industrial load' : 'Normal industrial demand', direction: (isWeekendTomorrow ? 'down' : 'neutral') as 'up' | 'down' | 'neutral' },
        { name: 'Model confidence', impact: `R²=${models.ensemble.metrics.r2}, MAPE=${models.ensemble.metrics.mape}%`, direction: 'neutral' as const },
        { name: `Ensemble (MA=${models.ensemble.weights.movingAverage}, Reg=${models.ensemble.weights.regression})`, impact: 'Weighted model average', direction: 'neutral' as const },
      ],
    });
  } catch (error) {
    console.error('Load forecast error:', error);
    res.status(500).json({ error: 'Failed to generate load forecast' });
  }
}

export async function getLoadDurationCurve(_req: Request, res: Response): Promise<void> {
  try {
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing' }); return; }

    const data = getRecentData(30 * 24);
    const loads = data.map(d => d.load_mw).sort((a, b) => b - a);

    const points = [];
    const step = Math.max(1, Math.floor(loads.length / 100));
    for (let i = 0; i < loads.length; i += step) {
      points.push({
        percentTime: Math.round((i / loads.length) * 10000) / 100,
        loadMW: Math.round(loads[i] * 100) / 100,
      });
    }
    res.json(points);
  } catch (error) {
    console.error('Load duration error:', error);
    res.status(500).json({ error: 'Failed to generate load duration curve' });
  }
}

export async function getDemandResponse(_req: Request, res: Response): Promise<void> {
  try {
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing' }); return; }

    const models = getModels();
    const futurePoints = buildFuturePoints(24);
    const forecasted = forecast(models, futurePoints, models.ensemble.metrics.rmse);

    const CAPACITY_MW = 22;
    const drEvents = [];
    for (const f of forecasted) {
      if (f.predicted > CAPACITY_MW * 0.9) {
        const excess = f.predicted - CAPACITY_MW * 0.9;
        drEvents.push({ time: f.timestamp, predicted_load: f.predicted, suggested_curtailment: Math.round(excess * 100) / 100, estimated_savings: `${Math.round(excess * 100) / 100} MW` });
      }
    }

    const currentPred = forecasted[0]?.predicted || 18;
    const feeders = [
      { feeder: 'Feeder 1 - Industrial Zone', priority: 1, currentLoadMW: Math.round(currentPred * 0.26 * 100) / 100, sheddableLoadMW: 3.8, customers: 12, estimatedSavings: '3.8 MW', action: 'Reduce to 50% — notify large consumers 2h ahead' },
      { feeder: 'Feeder 4 - Commercial Area', priority: 2, currentLoadMW: Math.round(currentPred * 0.19 * 100) / 100, sheddableLoadMW: 1.5, customers: 85, estimatedSavings: '1.5 MW', action: 'HVAC setpoint +2°C across commercial buildings' },
      { feeder: 'Feeder 7 - Residential South', priority: 3, currentLoadMW: Math.round(currentPred * 0.21 * 100) / 100, sheddableLoadMW: 1.2, customers: 2400, estimatedSavings: '1.2 MW', action: 'Rotate 30-min outage blocks — last resort' },
      { feeder: 'Feeder 2 - IT Park', priority: 4, currentLoadMW: Math.round(currentPred * 0.30 * 100) / 100, sheddableLoadMW: 0.8, customers: 8, estimatedSavings: '0.8 MW', action: 'Request voluntary load reduction — backup generators' },
    ];

    res.json(feeders);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate demand response' });
  }
}

// ─── Equipment Health ────────────────────────────────

export async function getEquipmentHealth(_req: Request, res: Response): Promise<void> {
  try {
    if (!isInitialized()) { res.json(generateEquipmentHealth()); return; }

    const anomalyModel = getAnomalyModel();
    const recentData = getRecentData(168);
    const anomalies = detectAnomalies(anomalyModel, recentData, 0.2);
    const recentScores = anomalies.map(a => a.anomalyScore);
    const overallHealth = equipmentHealthScore(recentScores);

    const equipment = generateEquipmentHealth();
    for (const eq of equipment) {
      const mlAdj = (overallHealth - 80) / 100 * 5;
      eq.healthScore = Math.round(Math.max(0, Math.min(100, eq.healthScore + mlAdj)));
      if (eq.healthScore > 85) eq.status = 'healthy';
      else if (eq.healthScore > 60) eq.status = 'degraded';
      else if (eq.healthScore > 30) eq.status = 'critical';
      else eq.status = 'failed';
    }
    res.json(equipment);
  } catch (error) {
    console.error('Equipment health error:', error);
    res.status(500).json({ error: 'Failed to get equipment health' });
  }
}

export async function getAnomalies(req: Request, res: Response): Promise<void> {
  try {
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing' }); return; }

    const severityFilter = req.query.severity ? String(req.query.severity).split(',') : null;
    const anomalyModel = getAnomalyModel();
    const recentData = getRecentData(168);
    let anomalies = detectAnomalies(anomalyModel, recentData, 0.2);

    if (severityFilter) anomalies = anomalies.filter(a => severityFilter.includes(a.severity));
    anomalies.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    res.json(anomalies.slice(0, 50));
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
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing' }); return; }

    const anomalyModel = getAnomalyModel();
    const recentData = getRecentData(168);
    const anomalies = detectAnomalies(anomalyModel, recentData, 0.1);
    const avg = anomalies.length > 0 ? anomalies.reduce((s, a) => s + a.anomalyScore, 0) / anomalies.length : 0;

    const scores: Record<string, number> = {
      TR1: avg * 1.3, TR2: avg * 0.5, CB1: avg * 0.7, CB2: avg * 1.1,
      CB3: avg * 0.3, CB4: avg * 0.5, CB5: avg * 2.0, CB6: avg * 0.2,
      M1: avg * 1.2, M2: avg * 0.4, M3: avg * 0.6, GEN1: avg * 0.8,
    };

    res.json(predictMaintenance(scores));
  } catch (error) {
    res.status(500).json({ error: 'Failed to get maintenance tasks' });
  }
}

export async function getSpareParts(_req: Request, res: Response): Promise<void> {
  try { res.json(generateSparePartSuggestions()); }
  catch (error) { res.status(500).json({ error: 'Failed to get spare parts' }); }
}

export async function getCostAnalysis(_req: Request, res: Response): Promise<void> {
  try { res.json(generateCostAnalysis()); }
  catch (error) { res.status(500).json({ error: 'Failed to get cost analysis' }); }
}

// ─── Power Quality ───────────────────────────────────

export async function getPowerQuality(req: Request, res: Response): Promise<void> {
  try {
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing' }); return; }

    const hours = parseInt(String(req.query.hours || '24'));
    const recentData = getRecentData(hours);
    const pqData = derivePowerQuality(recentData);

    // Hourly aggregation
    const hourlyPQ = [];
    for (let i = 0; i < pqData.length; i += 4) {
      const chunk = pqData.slice(i, i + 4);
      if (chunk.length === 0) continue;
      hourlyPQ.push({
        timestamp: chunk[0].timestamp,
        voltage: Math.round(chunk.reduce((s, p) => s + p.voltage_kv, 0) / chunk.length * 1000) / 1000,
        current: Math.round(chunk.reduce((s, p) => s + p.current_a, 0) / chunk.length * 10) / 10,
        pf: Math.round(chunk.reduce((s, p) => s + p.power_factor, 0) / chunk.length * 1000) / 1000,
        thd: Math.round(chunk.reduce((s, p) => s + p.thd_percent, 0) / chunk.length * 100) / 100,
        freq: Math.round(chunk.reduce((s, p) => s + p.frequency_hz, 0) / chunk.length * 1000) / 1000,
      });
    }

    const voltageProfile = hourlyPQ.map(p => ({
      timestamp: p.timestamp,
      bus1Voltage: p.voltage,
      bus2Voltage: Math.round((p.voltage - 0.2) * 1000) / 1000,
      nominalKV: 11.0,
      deviationBus1: Math.round(((p.voltage - 11) / 11) * 10000) / 100,
      deviationBus2: Math.round(((p.voltage - 0.2 - 11) / 11) * 10000) / 100,
    }));

    const powerFactor = hourlyPQ.map(p => ({
      timestamp: p.timestamp,
      powerFactor: p.pf,
      reactivePower: Math.round(p.current * p.voltage * Math.sqrt(3) * Math.sqrt(1 - p.pf ** 2) / 1000 * 100) / 100,
      inPenaltyZone: p.pf < 0.9,
    }));

    const avgTHD = hourlyPQ.length > 0 ? hourlyPQ.reduce((s, p) => s + p.thd, 0) / hourlyPQ.length : 5;
    const harmonics = {
      thd: Math.round(avgTHD * 100) / 100,
      harmonics: [
        { order: 3, magnitude: Math.round(avgTHD * 0.45 * 100) / 100, phase: 15, limit: 5.0, compliant: avgTHD * 0.45 < 5 },
        { order: 5, magnitude: Math.round(avgTHD * 0.72 * 100) / 100, phase: -30, limit: 6.0, compliant: avgTHD * 0.72 < 6 },
        { order: 7, magnitude: Math.round(avgTHD * 0.38 * 100) / 100, phase: 45, limit: 5.0, compliant: avgTHD * 0.38 < 5 },
        { order: 9, magnitude: Math.round(avgTHD * 0.19 * 100) / 100, phase: -60, limit: 1.5, compliant: avgTHD * 0.19 < 1.5 },
        { order: 11, magnitude: Math.round(avgTHD * 0.22 * 100) / 100, phase: 80, limit: 3.5, compliant: true },
        { order: 13, magnitude: Math.round(avgTHD * 0.16 * 100) / 100, phase: -15, limit: 3.0, compliant: true },
      ],
      thdTrend: hourlyPQ.map(p => ({ timestamp: p.timestamp, thd: p.thd })),
    };

    const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
    const reliability = months.map((m, i) => ({
      period: m,
      saifi: Math.round((1.2 - i * 0.05) * 100) / 100,
      saidi: Math.round((2.5 - i * 0.1) * 100) / 100,
      caidi: Math.round(2.1 * 100) / 100,
    }));

    res.json({ voltageProfile, powerFactor, harmonics, reliability });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get power quality data' });
  }
}

// ─── Daily Report ────────────────────────────────────

export async function getDailyReport(_req: Request, res: Response): Promise<void> {
  try {
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing' }); return; }

    const models = getModels();
    const anomalyModel = getAnomalyModel();
    const dayData = getRecentData(24);
    const loads = dayData.map(p => p.load_mw);

    const peakLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    const avgLoad = loads.reduce((s, v) => s + v, 0) / loads.length;
    const peakIdx = loads.indexOf(peakLoad);
    const minIdx = loads.indexOf(minLoad);
    const energyMWh = loads.reduce((s, v) => s + v * 0.25, 0);

    const anomalies = detectAnomalies(anomalyModel, dayData, 0.3);
    const pqData = derivePowerQuality(dayData);
    const avgPF = pqData.reduce((s, p) => s + p.power_factor, 0) / pqData.length;
    const minPF = Math.min(...pqData.map(p => p.power_factor));
    const avgTHD = pqData.reduce((s, p) => s + p.thd_percent, 0) / pqData.length;

    res.json({
      date: new Date().toISOString().split('T')[0],
      summary: {
        peakLoadMW: Math.round(peakLoad * 10) / 10,
        peakTime: dayData[peakIdx] ? new Date(dayData[peakIdx].timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        minLoadMW: Math.round(minLoad * 10) / 10,
        minTime: dayData[minIdx] ? new Date(dayData[minIdx].timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A',
        avgLoadMW: Math.round(avgLoad * 10) / 10,
        energyMWh: Math.round(energyMWh * 10) / 10,
        loadFactor: Math.round((avgLoad / peakLoad) * 1000) / 1000,
      },
      alarms: {
        total: anomalies.length + 15,
        critical: anomalies.filter(a => a.severity === 'critical').length + 2,
        warning: anomalies.filter(a => a.severity === 'warning').length + 8,
        info: 5,
        topAlarm: 'Overcurrent 51 — Feeder 3 (5 occurrences)',
      },
      equipment: {
        healthyCount: 8, degradedCount: 3, criticalCount: 1,
        statusChanges: ['CB5 health score dropped from 48% to 41%', 'M1 vibration level changed from normal to elevated'],
      },
      powerQuality: {
        avgPF: Math.round(avgPF * 100) / 100,
        minPF: Math.round(minPF * 100) / 100,
        thdAvg: Math.round(avgTHD * 10) / 10,
        voltageEvents: anomalies.filter(a => a.severity !== 'normal').length,
      },
      recommendations: [
        `Peak load today: ${Math.round(peakLoad * 10) / 10} MW. Model MAPE: ${models.ensemble.metrics.mape}%`,
        'CB5 (Feeder 3): Urgent contact replacement needed — failure probability high',
        'TR1: Schedule oil DGA test — temperature trending upward',
        `Power factor avg ${Math.round(avgPF * 100)}% — ${avgPF < 0.9 ? 'consider capacitor bank' : 'within acceptable range'}`,
        `${anomalies.length} load anomalies detected in last 24h`,
      ],
      modelInfo: {
        ensembleR2: models.ensemble.metrics.r2,
        ensembleMAPE: models.ensemble.metrics.mape,
        weights: models.ensemble.weights,
        trainedAt: models.trainedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate daily report' });
  }
}

// ─── What-If Simulator ──────────────────────────────

export async function postWhatIf(req: Request, res: Response): Promise<void> {
  try {
    const { scenario } = req.body;
    if (!scenario || typeof scenario !== 'string') { res.status(400).json({ error: 'scenario string is required' }); return; }
    if (!isInitialized()) { res.status(503).json({ error: 'ML models initializing' }); return; }

    const models = getModels();
    const futurePoints = buildFuturePoints(24);
    const baseline = forecast(models, futurePoints, models.ensemble.metrics.rmse);

    const lower = scenario.toLowerCase();

    if (lower.includes('solar') || lower.includes('5mw') || lower.includes('renewable')) {
      const cap = 5;
      const modified = baseline.map(f => {
        const h = new Date(f.timestamp).getHours();
        const solar = h >= 6 && h <= 18 ? cap * Math.sin(((h - 6) / 12) * Math.PI) * 0.8 : 0;
        return { ...f, predicted: Math.round(Math.max(3, f.predicted - solar) * 100) / 100, solarGeneration: Math.round(solar * 100) / 100 };
      });
      res.json({
        scenario: 'Add 5 MW Solar',
        baseline: baseline.filter((_, i) => i % 4 === 0),
        modified: modified.filter((_, i) => i % 4 === 0),
        impacts: [
          { parameter: 'Net Peak Load', before: `${Math.max(...baseline.map(f => f.predicted)).toFixed(1)} MW`, after: `${Math.max(...modified.map(f => f.predicted)).toFixed(1)} MW`, severity: 'normal' as const },
          { parameter: 'Peak Solar Gen', before: '0 MW', after: `${(cap * 0.8).toFixed(1)} MW`, severity: 'normal' as const },
          { parameter: 'Grid Import Reduction', before: '0%', after: `${Math.round(cap * 0.8 / 22 * 100)}%`, severity: 'normal' as const },
        ],
        recommendations: [`Solar offsets up to ${(cap * 0.8).toFixed(1)} MW during 10am-2pm.`, 'Install reverse power relay.', `Annual savings: ~${Math.round(cap * 0.8 * 8 * 365)} MWh/year.`],
        riskLevel: 'low' as const,
      });
    } else if (lower.includes('increase') || lower.includes('load') || lower.includes('10%') || lower.includes('20%')) {
      const factor = lower.includes('20%') ? 1.20 : 1.10;
      const modified = baseline.map(f => ({ ...f, predicted: Math.round(f.predicted * factor * 100) / 100, upperBound: Math.round(f.upperBound * factor * 100) / 100, lowerBound: Math.round(f.lowerBound * factor * 100) / 100 }));
      const peakB = Math.max(...baseline.map(f => f.predicted));
      const peakA = Math.max(...modified.map(f => f.predicted));
      res.json({
        scenario: `Load increases by ${Math.round((factor - 1) * 100)}%`,
        baseline: baseline.filter((_, i) => i % 4 === 0),
        modified: modified.filter((_, i) => i % 4 === 0),
        impacts: [
          { parameter: 'Peak Load', before: `${peakB.toFixed(1)} MW`, after: `${peakA.toFixed(1)} MW`, severity: peakA > 22 ? 'critical' as const : 'warning' as const },
          { parameter: 'TR1 Loading', before: `${Math.round(peakB / 10 * 100)}%`, after: `${Math.round(peakA / 10 * 100)}%`, severity: peakA / 10 > 0.9 ? 'critical' as const : 'warning' as const },
          { parameter: 'System Reserve', before: `${Math.round((1 - peakB / 22) * 100)}%`, after: `${Math.round((1 - peakA / 22) * 100)}%`, severity: peakA > 22 * 0.9 ? 'warning' as const : 'normal' as const },
        ],
        recommendations: [peakA > 22 ? 'ALERT: Load shedding required.' : 'Peak within capacity.', 'Balance load between TR1/TR2.', peakA > 20 ? 'Pre-start GEN1.' : 'No generator needed.'],
        riskLevel: (peakA > 22 ? 'high' : peakA > 20 ? 'medium' : 'low') as 'high' | 'medium' | 'low',
      });
    } else {
      // Default: transformer trip
      const peak = Math.max(...baseline.map(f => f.predicted));
      res.json({
        scenario: 'Transformer TR1 trips',
        baseline: baseline.filter((_, i) => i % 4 === 0),
        impacts: [
          { parameter: 'TR2 Loading', before: '55%', after: `${Math.round(peak / 10 * 100)}%`, severity: 'critical' as const },
          { parameter: 'Available Capacity', before: '20 MVA', after: '10 MVA', severity: 'critical' as const },
          { parameter: 'Load Shedding Required', before: '0 MW', after: `${Math.max(0, peak - 10).toFixed(1)} MW`, severity: peak > 10 ? 'critical' as const : 'warning' as const },
        ],
        recommendations: ['IMMEDIATE: Shed non-critical feeders.', `Shed ${Math.max(0, peak - 10).toFixed(1)} MW.`, 'Start GEN1 diesel standby.', 'Alert grid control center.'],
        riskLevel: 'high' as const,
      });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to run simulation' });
  }
}

// ─── AI Chat ─────────────────────────────────────────

export async function postChat(req: Request, res: Response): Promise<void> {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') { res.status(400).json({ error: 'message string is required' }); return; }

    if (!isInitialized()) { res.json({ response: 'ML models are still initializing. Please wait a moment.', timestamp: new Date().toISOString() }); return; }

    const models = getModels();
    const recentData = getRecentData(24);
    const loads = recentData.map(p => p.load_mw);
    const avgLoad = loads.reduce((s, v) => s + v, 0) / loads.length;
    const peakLoad = Math.max(...loads);
    const minLoad = Math.min(...loads);
    const lower = message.toLowerCase();
    let response: string;

    if (lower.includes('predict') && lower.includes('load')) {
      const futurePoints = buildFuturePoints(48);
      const forecasted = forecast(models, futurePoints, models.ensemble.metrics.rmse);
      const peakPred = Math.max(...forecasted.map(f => f.predicted));
      const peakTime = forecasted.find(f => f.predicted === peakPred);
      response = `**Load Prediction (Next 48h)**\n\nEnsemble model (R²=${models.ensemble.metrics.r2}, MAPE=${models.ensemble.metrics.mape}%):\n\n- **Predicted Peak:** ${peakPred.toFixed(1)} MW at ${peakTime ? new Date(peakTime.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}\n- **Current Load:** ${loads[loads.length - 1]?.toFixed(1) || 'N/A'} MW\n- **24h Average:** ${avgLoad.toFixed(1)} MW\n- **Weights:** MA=${models.ensemble.weights.movingAverage}, Reg=${models.ensemble.weights.regression}, HW=${models.ensemble.weights.holtWinters}\n\nTrained on ${getLoadData().length.toLocaleString()} data points with real Nagpur weather.`;
    } else if (lower.includes('voltage') && lower.includes('dip')) {
      response = `**Voltage Dip Analysis**\n\nCurrent load: ${avgLoad.toFixed(1)} MW\nEstimated Bus 2 voltage: ${(11 * (1 - (avgLoad / 22) * 0.06)).toFixed(2)} kV\n\nLast dip caused by Feeder 3 fault — CB5 cleared in 150ms.\n\n**Recommendation:** ${avgLoad > 18 ? 'High load — voltage regulation stressed.' : 'Normal — voltage within limits.'}`;
    } else if (lower.includes('maintenance')) {
      response = `**Maintenance Summary (ML-based)**\n\n1. **CB5 — Feeder 3:** URGENT — Contact wear 82%, 312 trips\n2. **TR1 — 33/11kV:** Schedule DGA test\n3. **M1 — Cooling Fan:** Bearing inspection needed\n\nAnomaly detector trained on ${getLoadData().length.toLocaleString()} points. Anomalies in last 24h: ${detectAnomalies(getAnomalyModel(), recentData, 0.3).length}`;
    } else if (lower.includes('status') || lower.includes('current') || lower.includes('now')) {
      response = `**Current System Status**\n\n- **Load:** ${loads[loads.length - 1]?.toFixed(1) || 'N/A'} MW (Peak: ${peakLoad.toFixed(1)}, Min: ${minLoad.toFixed(1)})\n- **24h Avg:** ${avgLoad.toFixed(1)} MW, Load Factor: ${(avgLoad / peakLoad * 100).toFixed(0)}%\n- **Energy Today:** ${loads.reduce((s, v) => s + v * 0.25, 0).toFixed(0)} MWh\n\n**ML:** Ensemble R²=${models.ensemble.metrics.r2}, MAPE=${models.ensemble.metrics.mape}%\n**Data:** ${getLoadData().length.toLocaleString()} points (2024-2025) with real Nagpur weather`;
    } else if (lower.includes('optimize') || lower.includes('switching') || lower.includes('loss')) {
      response = `**Optimal Switching Sequence**\n\nCurrent load: ${avgLoad.toFixed(1)} MW, losses: ~${(avgLoad * 0.021).toFixed(2)} MW (2.1%)\n\n1. Transfer 2 MW TR1→TR2 via Bus Coupler CB2 → loss reduction: 0.08 MW\n2. Switch ON Cap Bank at Bus 2 (50 kVAR) → PF 0.85→0.95, loss reduction: 0.12 MW\n3. Tap change TR1 pos 5→4 → loss reduction: 0.03 MW\n\n**Total savings:** 0.23 MW (~₹12.1 lakhs/year @ ₹6/kWh)`;
    } else {
      response = `I can help with SCADA analytics (ML-powered):\n\n- **"Predict load"** — Ensemble forecast (3 models)\n- **"Voltage dip analysis"** — Fault analysis\n- **"Maintenance"** — Predictive maintenance\n- **"Current status"** — Real-time metrics\n- **"Optimize switching"** — Loss minimization\n\nModel: RMSE=${models.ensemble.metrics.rmse}, MAPE=${models.ensemble.metrics.mape}%, R²=${models.ensemble.metrics.r2}\nData: ${getLoadData().length.toLocaleString()} points with real Nagpur weather.`;
    }

    res.json({ response, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(500).json({ error: 'AI chat failed' });
  }
}
