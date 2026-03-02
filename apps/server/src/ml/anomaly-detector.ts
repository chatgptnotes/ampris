/**
 * Anomaly Detector — Statistical Z-score based
 *
 * Detects anomalies by comparing readings against expected values
 * for the same hour, day of week, and similar temperature range.
 */

import type { LoadDataPoint } from './generate-load-data';

// ─── Types ─────────────────────────────────────────

export interface AnomalyDetectorModel {
  type: 'anomaly_detector';
  // Statistics by context bucket: [dayOfWeek][hour] → { mean, std, count }
  hourlyStats: Array<Array<{ mean: number; std: number; count: number }>>;
  // Temperature bins (5°C wide): mean load for each
  tempBins: Array<{ tempMin: number; tempMax: number; mean: number; std: number; count: number }>;
  // Global stats
  globalMean: number;
  globalStd: number;
  trainedAt: string;
}

export interface AnomalyResult {
  timestamp: string;
  parameter: string;
  value: number;
  expected: number;
  anomalyScore: number;     // 0-1 (0 = normal, 1 = extreme anomaly)
  zScore: number;
  severity: 'normal' | 'warning' | 'critical';
}

// ─── Training ──────────────────────────────────────

export function trainAnomalyDetector(data: LoadDataPoint[]): AnomalyDetectorModel {
  // Build hourly stats per [dayOfWeek][hour]
  const buckets: number[][][] = Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => [])
  );

  for (const p of data) {
    buckets[p.day_of_week][p.hour].push(p.load_mw);
  }

  const hourlyStats = buckets.map(dayBuckets =>
    dayBuckets.map(values => {
      if (values.length === 0) return { mean: 15, std: 3, count: 0 };
      const mean = values.reduce((s, v) => s + v, 0) / values.length;
      const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
      return {
        mean: Math.round(mean * 1000) / 1000,
        std: Math.round(Math.sqrt(variance) * 1000) / 1000,
        count: values.length,
      };
    })
  );

  // Temperature bins (5°C width from 5°C to 50°C)
  const tempBins: AnomalyDetectorModel['tempBins'] = [];
  for (let t = 5; t < 50; t += 5) {
    const binPoints = data.filter(p => p.temperature >= t && p.temperature < t + 5);
    if (binPoints.length > 0) {
      const loads = binPoints.map(p => p.load_mw);
      const mean = loads.reduce((s, v) => s + v, 0) / loads.length;
      const std = Math.sqrt(loads.reduce((s, v) => s + (v - mean) ** 2, 0) / loads.length);
      tempBins.push({
        tempMin: t, tempMax: t + 5,
        mean: Math.round(mean * 1000) / 1000,
        std: Math.round(std * 1000) / 1000,
        count: binPoints.length,
      });
    }
  }

  // Global stats
  const allLoads = data.map(p => p.load_mw);
  const globalMean = allLoads.reduce((s, v) => s + v, 0) / allLoads.length;
  const globalStd = Math.sqrt(allLoads.reduce((s, v) => s + (v - globalMean) ** 2, 0) / allLoads.length);

  return {
    type: 'anomaly_detector',
    hourlyStats,
    tempBins,
    globalMean: Math.round(globalMean * 1000) / 1000,
    globalStd: Math.round(globalStd * 1000) / 1000,
    trainedAt: new Date().toISOString(),
  };
}

// ─── Inference ─────────────────────────────────────

export function detectAnomaly(
  model: AnomalyDetectorModel,
  point: LoadDataPoint
): AnomalyResult {
  // Contextual Z-score: compare to same hour + day of week
  const stats = model.hourlyStats[point.day_of_week]?.[point.hour];
  const expected = stats ? stats.mean : model.globalMean;
  const std = stats && stats.std > 0.5 ? stats.std : model.globalStd;

  const zScore = Math.abs((point.load_mw - expected) / (std || 1));

  // Also check temperature context
  const tempBin = model.tempBins.find(b => point.temperature >= b.tempMin && point.temperature < b.tempMax);
  let tempZScore = 0;
  if (tempBin && tempBin.std > 0.5) {
    tempZScore = Math.abs((point.load_mw - tempBin.mean) / tempBin.std);
  }

  // Combined score: average of contextual and temperature z-scores
  const combinedZ = (zScore + tempZScore * 0.5) / 1.5;

  // Convert to 0-1 anomaly score using sigmoid-like mapping
  const anomalyScore = Math.min(1, Math.max(0,
    1 - 1 / (1 + Math.exp((combinedZ - 2.5) * 2))
  ));

  let severity: AnomalyResult['severity'] = 'normal';
  if (combinedZ > 3) severity = 'critical';
  else if (combinedZ > 2) severity = 'warning';

  return {
    timestamp: point.timestamp,
    parameter: 'load_mw',
    value: point.load_mw,
    expected: Math.round(expected * 100) / 100,
    anomalyScore: Math.round(anomalyScore * 1000) / 1000,
    zScore: Math.round(combinedZ * 100) / 100,
    severity,
  };
}

/** Detect anomalies on a batch of data points */
export function detectAnomalies(
  model: AnomalyDetectorModel,
  data: LoadDataPoint[],
  threshold: number = 0.3
): AnomalyResult[] {
  return data
    .map(p => detectAnomaly(model, p))
    .filter(r => r.anomalyScore >= threshold);
}

/** Compute equipment health score from anomaly scores */
export function equipmentHealthScore(anomalyScores: number[]): number {
  if (anomalyScores.length === 0) return 100;
  const avgAnomaly = anomalyScores.reduce((s, v) => s + v, 0) / anomalyScores.length;
  const maxAnomaly = Math.max(...anomalyScores);
  // Weight max anomaly more heavily
  const combined = avgAnomaly * 0.4 + maxAnomaly * 0.6;
  return Math.round(Math.max(0, Math.min(100, 100 - combined * 100)));
}
