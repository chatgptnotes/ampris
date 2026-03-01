/**
 * AI Demo Data Service
 * Generates realistic synthetic SCADA data for AI analytics demonstration
 */

// ─── Load Profile Generation ─────────────────────────

/** Typical substation daily load pattern (MW) by hour */
const DAILY_LOAD_PROFILE = [
  0.55, 0.50, 0.48, 0.47, 0.48, 0.52, // 00-05: night valley
  0.60, 0.72, 0.85, 0.88, 0.86, 0.84, // 06-11: morning ramp
  0.82, 0.88, 0.95, 0.98, 0.96, 0.90, // 12-17: afternoon peak
  0.92, 0.97, 1.00, 0.95, 0.80, 0.65, // 18-23: evening peak then decline
];

const BASE_LOAD_MW = 22; // Substation base capacity

interface LoadDataPoint {
  timestamp: string;
  value: number;
  hour: number;
  dayOfWeek: number;
}

export function generateLoadHistory(days: number = 30, intervalMinutes: number = 15): LoadDataPoint[] {
  const data: LoadDataPoint[] = [];
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  for (let t = start.getTime(); t <= now.getTime(); t += intervalMinutes * 60 * 1000) {
    const dt = new Date(t);
    const hour = dt.getHours();
    const minute = dt.getMinutes();
    const dayOfWeek = dt.getDay(); // 0=Sun, 6=Sat
    const dayOfYear = Math.floor((t - new Date(dt.getFullYear(), 0, 0).getTime()) / 86400000);

    // Base load from daily profile (interpolate between hours)
    const hourFraction = hour + minute / 60;
    const idx = Math.floor(hourFraction);
    const nextIdx = (idx + 1) % 24;
    const frac = hourFraction - idx;
    const profileValue = DAILY_LOAD_PROFILE[idx] * (1 - frac) + DAILY_LOAD_PROFILE[nextIdx] * frac;

    // Weekend factor: 70% of weekday
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.70 : 1.0;

    // Seasonal component (summer peak in months 4-8)
    const seasonalFactor = 1.0 + 0.12 * Math.sin((dayOfYear - 100) * 2 * Math.PI / 365);

    // Random noise ±5%
    const noise = 1.0 + (Math.random() - 0.5) * 0.10;

    // Trend: slight upward over the month (+2%)
    const dayIndex = (t - start.getTime()) / 86400000;
    const trendFactor = 1.0 + (dayIndex / days) * 0.02;

    const value = BASE_LOAD_MW * profileValue * weekendFactor * seasonalFactor * noise * trendFactor;

    data.push({
      timestamp: dt.toISOString(),
      value: Math.round(value * 100) / 100,
      hour,
      dayOfWeek,
    });
  }

  return data;
}

// ─── Load Forecasting ────────────────────────────────

export interface ForecastPoint {
  timestamp: string;
  predicted: number;
  upperBound: number;
  lowerBound: number;
  confidence: number;
  isHistorical?: boolean;
  actual?: number;
}

export function generateLoadForecast(hoursAhead: number = 24): {
  historical: ForecastPoint[];
  forecast: ForecastPoint[];
  peakPrediction: { value: number; time: string; confidence: number };
  factors: { name: string; impact: string; direction: 'up' | 'down' | 'neutral' }[];
} {
  const now = new Date();

  // Last 24h of "actual" data
  const historical: ForecastPoint[] = [];
  for (let h = -24; h < 0; h++) {
    const t = new Date(now.getTime() + h * 3600000);
    const hour = t.getHours();
    const profile = DAILY_LOAD_PROFILE[hour];
    const dayOfWeek = t.getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.70 : 1.0;
    const actual = BASE_LOAD_MW * profile * weekendFactor * (1 + (Math.random() - 0.5) * 0.08);

    historical.push({
      timestamp: t.toISOString(),
      predicted: actual,
      actual: Math.round(actual * 100) / 100,
      upperBound: actual,
      lowerBound: actual,
      confidence: 1.0,
      isHistorical: true,
    });
  }

  // Forecast future hours
  const forecast: ForecastPoint[] = [];
  let peakValue = 0;
  let peakTime = '';

  const tomorrowDow = new Date(now.getTime() + 24 * 3600000).getDay();
  const isWeekendTomorrow = tomorrowDow === 0 || tomorrowDow === 6;

  for (let h = 0; h < hoursAhead; h++) {
    const t = new Date(now.getTime() + h * 3600000);
    const hour = t.getHours();
    const dayOfWeek = t.getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.70 : 1.0;
    const profile = DAILY_LOAD_PROFILE[hour];
    const predicted = BASE_LOAD_MW * profile * weekendFactor * (1 + (Math.random() - 0.5) * 0.03);

    // Confidence decreases with distance
    const confidence = Math.max(0.60, 0.95 - h * 0.008);
    const spread = predicted * (1 - confidence) * 1.5;

    const point: ForecastPoint = {
      timestamp: t.toISOString(),
      predicted: Math.round(predicted * 100) / 100,
      upperBound: Math.round((predicted + spread) * 100) / 100,
      lowerBound: Math.round((predicted - spread) * 100) / 100,
      confidence: Math.round(confidence * 100) / 100,
    };

    forecast.push(point);

    if (predicted > peakValue) {
      peakValue = predicted;
      peakTime = t.toISOString();
    }
  }

  return {
    historical,
    forecast,
    peakPrediction: {
      value: Math.round(peakValue * 10) / 10,
      time: peakTime,
      confidence: 0.85,
    },
    factors: [
      { name: 'Temperature (34°C forecast)', impact: '+8% load increase', direction: 'up' },
      { name: isWeekendTomorrow ? 'Weekend pattern' : 'Weekday pattern', impact: isWeekendTomorrow ? '-30% industrial load' : 'Normal industrial demand', direction: isWeekendTomorrow ? 'down' : 'neutral' },
      { name: 'Historical pattern match', impact: '92% similarity to last week', direction: 'neutral' },
      { name: 'Seasonal trend (Summer)', impact: '+12% cooling demand', direction: 'up' },
    ],
  };
}

// ─── Load Duration Curve ─────────────────────────────

export interface LoadDurationPoint {
  percentTime: number;
  loadMW: number;
}

export function generateLoadDurationCurve(): LoadDurationPoint[] {
  // Generate 30 days of hourly data
  const loads = generateLoadHistory(30, 60).map(d => d.value);
  loads.sort((a, b) => b - a); // Descending

  const points: LoadDurationPoint[] = [];
  const step = Math.max(1, Math.floor(loads.length / 100));
  for (let i = 0; i < loads.length; i += step) {
    points.push({
      percentTime: Math.round((i / loads.length) * 10000) / 100,
      loadMW: Math.round(loads[i] * 100) / 100,
    });
  }
  return points;
}

// ─── Demand Response Recommendations ─────────────────

export interface DemandResponseRec {
  feeder: string;
  priority: number;
  currentLoadMW: number;
  sheddableLoadMW: number;
  customers: number;
  estimatedSavings: string;
  action: string;
}

export function generateDemandResponseRecommendations(): DemandResponseRec[] {
  return [
    { feeder: 'Feeder 1 - Industrial Zone', priority: 1, currentLoadMW: 5.2, sheddableLoadMW: 3.8, customers: 12, estimatedSavings: '3.8 MW', action: 'Reduce to 50% — notify large consumers 2h ahead' },
    { feeder: 'Feeder 4 - Commercial Area', priority: 2, currentLoadMW: 3.8, sheddableLoadMW: 1.5, customers: 85, estimatedSavings: '1.5 MW', action: 'HVAC setpoint +2°C across commercial buildings' },
    { feeder: 'Feeder 7 - Residential South', priority: 3, currentLoadMW: 4.1, sheddableLoadMW: 1.2, customers: 2400, estimatedSavings: '1.2 MW', action: 'Rotate 30-min outage blocks — last resort' },
    { feeder: 'Feeder 2 - IT Park', priority: 4, currentLoadMW: 6.0, sheddableLoadMW: 0.8, customers: 8, estimatedSavings: '0.8 MW', action: 'Request voluntary load reduction — backup generators' },
  ];
}

// ─── Equipment Health ────────────────────────────────

export interface EquipmentHealthData {
  id: string;
  name: string;
  type: 'Transformer' | 'Circuit Breaker' | 'Motor' | 'Generator';
  healthScore: number;
  status: 'healthy' | 'degraded' | 'critical' | 'failed';
  lastAnomaly: string | null;
  predictedFailureDate: string | null;
  operatingHours: number;
  age: number; // years
  details: Record<string, unknown>;
  anomalies: AnomalyData[];
}

export interface AnomalyData {
  id: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
  type: string;
  description: string;
  recommendedAction: string;
  affectedEquipment: string;
}

function uuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

export function generateEquipmentHealth(): EquipmentHealthData[] {
  const now = new Date();
  return [
    {
      id: uuid(), name: 'TR1 — 33/11kV 10MVA', type: 'Transformer',
      healthScore: 72, status: 'degraded',
      lastAnomaly: new Date(now.getTime() - 2 * 86400000).toISOString(),
      predictedFailureDate: new Date(now.getTime() + 120 * 86400000).toISOString(),
      operatingHours: 48200, age: 8,
      details: { oilTemp: 68, tapPosition: 5, loadPercent: 78, dgaStatus: 'Normal', ratedMVA: 10 },
      anomalies: [
        { id: uuid(), timestamp: new Date(now.getTime() - 2 * 86400000).toISOString(), severity: 'warning', type: 'temperature_drift', description: 'Oil temperature rising 0.5°C/day for 5 days — now 68°C (limit 75°C)', recommendedAction: 'Schedule oil sampling and DGA test within 7 days', affectedEquipment: 'TR1' },
        { id: uuid(), timestamp: new Date(now.getTime() - 10 * 86400000).toISOString(), severity: 'info', type: 'overload', description: 'Loading reached 92% of rated MVA for 45 minutes', recommendedAction: 'Monitor — consider load transfer if pattern repeats', affectedEquipment: 'TR1' },
      ],
    },
    {
      id: uuid(), name: 'TR2 — 33/11kV 10MVA', type: 'Transformer',
      healthScore: 91, status: 'healthy',
      lastAnomaly: new Date(now.getTime() - 30 * 86400000).toISOString(),
      predictedFailureDate: null,
      operatingHours: 35100, age: 5,
      details: { oilTemp: 52, tapPosition: 4, loadPercent: 55, dgaStatus: 'Normal', ratedMVA: 10 },
      anomalies: [],
    },
    {
      id: uuid(), name: 'CB1 — 33kV Incomer', type: 'Circuit Breaker',
      healthScore: 85, status: 'healthy',
      lastAnomaly: new Date(now.getTime() - 15 * 86400000).toISOString(),
      predictedFailureDate: null,
      operatingHours: 48200, age: 8,
      details: { tripCount: 142, lastTripTime: '2026-02-20T14:23:00Z', lastTripCause: 'Overcurrent 51', operatingTimeMs: 48, ratedOperatingTimeMs: 40, contactWear: 28 },
      anomalies: [],
    },
    {
      id: uuid(), name: 'CB2 — 33kV Bus Coupler', type: 'Circuit Breaker',
      healthScore: 78, status: 'degraded',
      lastAnomaly: new Date(now.getTime() - 3 * 86400000).toISOString(),
      predictedFailureDate: new Date(now.getTime() + 90 * 86400000).toISOString(),
      operatingHours: 48200, age: 8,
      details: { tripCount: 89, lastTripTime: '2026-02-26T09:15:00Z', lastTripCause: 'Manual trip', operatingTimeMs: 62, ratedOperatingTimeMs: 40, contactWear: 45 },
      anomalies: [
        { id: uuid(), timestamp: new Date(now.getTime() - 3 * 86400000).toISOString(), severity: 'warning', type: 'operating_time_degradation', description: 'Operating time 62ms — exceeds rated 40ms by 55%. Contact wear at 45%', recommendedAction: 'Schedule contact inspection and possible replacement within 30 days', affectedEquipment: 'CB2' },
      ],
    },
    {
      id: uuid(), name: 'CB3 — Feeder 1', type: 'Circuit Breaker',
      healthScore: 94, status: 'healthy', lastAnomaly: null, predictedFailureDate: null,
      operatingHours: 35100, age: 5,
      details: { tripCount: 23, lastTripTime: '2026-01-15T11:00:00Z', lastTripCause: 'Test trip', operatingTimeMs: 38, ratedOperatingTimeMs: 40, contactWear: 8 },
      anomalies: [],
    },
    {
      id: uuid(), name: 'CB4 — Feeder 2', type: 'Circuit Breaker',
      healthScore: 88, status: 'healthy', lastAnomaly: null, predictedFailureDate: null,
      operatingHours: 35100, age: 5,
      details: { tripCount: 45, lastTripTime: '2026-02-10T16:30:00Z', lastTripCause: 'Earth fault 50N', operatingTimeMs: 42, ratedOperatingTimeMs: 40, contactWear: 15 },
      anomalies: [],
    },
    {
      id: uuid(), name: 'CB5 — Feeder 3', type: 'Circuit Breaker',
      healthScore: 41, status: 'critical',
      lastAnomaly: new Date(now.getTime() - 1 * 86400000).toISOString(),
      predictedFailureDate: new Date(now.getTime() + 15 * 86400000).toISOString(),
      operatingHours: 62000, age: 12,
      details: { tripCount: 312, lastTripTime: '2026-02-28T03:45:00Z', lastTripCause: 'Overcurrent 51', operatingTimeMs: 95, ratedOperatingTimeMs: 40, contactWear: 82 },
      anomalies: [
        { id: uuid(), timestamp: new Date(now.getTime() - 86400000).toISOString(), severity: 'critical', type: 'operating_time_degradation', description: 'Operating time 95ms — 138% above rated. Contact wear at 82%. Trip count 312 (excessive)', recommendedAction: 'URGENT: Replace contacts immediately. Plan full CB overhaul.', affectedEquipment: 'CB5' },
      ],
    },
    {
      id: uuid(), name: 'CB6 — Feeder 4', type: 'Circuit Breaker',
      healthScore: 90, status: 'healthy', lastAnomaly: null, predictedFailureDate: null,
      operatingHours: 20000, age: 3,
      details: { tripCount: 12, lastTripTime: '2026-02-05T08:00:00Z', lastTripCause: 'Test trip', operatingTimeMs: 35, ratedOperatingTimeMs: 40, contactWear: 4 },
      anomalies: [],
    },
    {
      id: uuid(), name: 'M1 — Cooling Fan Motor', type: 'Motor',
      healthScore: 65, status: 'degraded',
      lastAnomaly: new Date(now.getTime() - 5 * 86400000).toISOString(),
      predictedFailureDate: new Date(now.getTime() + 60 * 86400000).toISOString(),
      operatingHours: 28000, age: 6,
      details: { current: 12.5, ratedCurrent: 10, temperature: 78, ratedTemp: 85, vibration: 'elevated' },
      anomalies: [
        { id: uuid(), timestamp: new Date(now.getTime() - 5 * 86400000).toISOString(), severity: 'warning', type: 'overcurrent', description: 'Running at 125% rated current. Bearing vibration elevated.', recommendedAction: 'Check bearings, measure vibration spectrum. Plan bearing replacement.', affectedEquipment: 'M1' },
      ],
    },
    {
      id: uuid(), name: 'M2 — Oil Pump Motor', type: 'Motor',
      healthScore: 88, status: 'healthy', lastAnomaly: null, predictedFailureDate: null,
      operatingHours: 15000, age: 3,
      details: { current: 5.2, ratedCurrent: 6, temperature: 55, ratedTemp: 85, vibration: 'normal' },
      anomalies: [],
    },
    {
      id: uuid(), name: 'M3 — Ventilation Motor', type: 'Motor',
      healthScore: 82, status: 'healthy', lastAnomaly: null, predictedFailureDate: null,
      operatingHours: 22000, age: 5,
      details: { current: 8.0, ratedCurrent: 8.5, temperature: 62, ratedTemp: 85, vibration: 'normal' },
      anomalies: [],
    },
    {
      id: uuid(), name: 'GEN1 — 5MW Diesel Standby', type: 'Generator',
      healthScore: 76, status: 'degraded',
      lastAnomaly: new Date(now.getTime() - 7 * 86400000).toISOString(),
      predictedFailureDate: new Date(now.getTime() + 180 * 86400000).toISOString(),
      operatingHours: 4200, age: 10,
      details: { fuelLevel: 72, lastTestRun: '2026-02-22T06:00:00Z', testResult: 'Start time 8.2s (limit 10s)', coolantTemp: 45, batteryVoltage: 24.1 },
      anomalies: [
        { id: uuid(), timestamp: new Date(now.getTime() - 7 * 86400000).toISOString(), severity: 'info', type: 'performance_degradation', description: 'Start time increased from 5s to 8.2s over last 6 months', recommendedAction: 'Service starter motor and battery bank during next maintenance window', affectedEquipment: 'GEN1' },
      ],
    },
  ];
}

// ─── Alarm Analysis ──────────────────────────────────

export interface AlarmHeatmapCell {
  hour: number;
  dayOfWeek: number;
  count: number;
}

export interface AlarmFrequency {
  alarmType: string;
  source: string;
  count: number;
  severity: string;
}

export interface AlarmCorrelation {
  alarmA: string;
  alarmB: string;
  probability: number;
  avgDelayMinutes: number;
  occurrences: number;
}

export interface AlarmStorm {
  startTime: string;
  endTime: string;
  alarmCount: number;
  peakRate: number; // per minute
  rootCause: string;
}

export function generateAlarmAnalysis() {
  // Heatmap: alarms by hour × day of week
  const heatmap: AlarmHeatmapCell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      // More alarms during peak hours and weekdays
      const isWeekday = dow >= 1 && dow <= 5;
      const isPeakHour = (hour >= 9 && hour <= 17);
      const base = isWeekday ? (isPeakHour ? 5 : 2) : 1;
      heatmap.push({ hour, dayOfWeek: dow, count: Math.max(0, base + Math.floor(Math.random() * 4) - 1) });
    }
  }

  // Top 10 most frequent alarms
  const topAlarms: AlarmFrequency[] = [
    { alarmType: 'Overcurrent 51', source: 'Feeder 3', count: 47, severity: 'critical' },
    { alarmType: 'Voltage Low', source: 'Bus 2', count: 38, severity: 'warning' },
    { alarmType: 'Temperature High', source: 'TR1', count: 31, severity: 'warning' },
    { alarmType: 'Earth Fault 50N', source: 'Feeder 2', count: 24, severity: 'critical' },
    { alarmType: 'CB Trip', source: 'CB5', count: 22, severity: 'critical' },
    { alarmType: 'Power Factor Low', source: 'Bus 1', count: 19, severity: 'info' },
    { alarmType: 'Oil Level Low', source: 'TR1', count: 15, severity: 'warning' },
    { alarmType: 'Communication Fail', source: 'IED-03', count: 14, severity: 'warning' },
    { alarmType: 'Overload', source: 'TR1', count: 12, severity: 'warning' },
    { alarmType: 'Voltage High', source: 'Bus 1', count: 9, severity: 'info' },
  ];

  // Alarm correlations
  const correlations: AlarmCorrelation[] = [
    { alarmA: 'Overcurrent 51 (Feeder 3)', alarmB: 'CB Trip (CB5)', probability: 0.78, avgDelayMinutes: 0.5, occurrences: 36 },
    { alarmA: 'Temperature High (TR1)', alarmB: 'Oil Level Low (TR1)', probability: 0.65, avgDelayMinutes: 45, occurrences: 20 },
    { alarmA: 'Voltage Low (Bus 2)', alarmB: 'Power Factor Low (Bus 1)', probability: 0.52, avgDelayMinutes: 2, occurrences: 15 },
    { alarmA: 'Earth Fault 50N (Feeder 2)', alarmB: 'Voltage Low (Bus 2)', probability: 0.71, avgDelayMinutes: 0.1, occurrences: 17 },
  ];

  // Alarm storms
  const now = new Date();
  const storms: AlarmStorm[] = [
    { startTime: new Date(now.getTime() - 5 * 86400000).toISOString(), endTime: new Date(now.getTime() - 5 * 86400000 + 600000).toISOString(), alarmCount: 23, peakRate: 12, rootCause: 'Feeder 3 earth fault — cascading trips on CB5, overcurrent on adjacent feeders' },
    { startTime: new Date(now.getTime() - 18 * 86400000).toISOString(), endTime: new Date(now.getTime() - 18 * 86400000 + 900000).toISOString(), alarmCount: 15, peakRate: 8, rootCause: 'Grid voltage dip — multiple low voltage and power factor alarms across all buses' },
  ];

  return { heatmap, topAlarms, correlations, storms };
}

// ─── Predictive Maintenance ──────────────────────────

export interface MaintenanceTask {
  id: string;
  equipment: string;
  type: 'routine' | 'predicted' | 'urgent';
  task: string;
  scheduledDate: string;
  estimatedDuration: string;
  estimatedCost: number;
  failureProbability?: { days7: number; days30: number; days90: number };
  reason: string;
}

export function generateMaintenanceTasks(): MaintenanceTask[] {
  const now = new Date();
  return [
    { id: uuid(), equipment: 'CB5 — Feeder 3', type: 'urgent', task: 'Contact replacement and CB overhaul', scheduledDate: new Date(now.getTime() + 3 * 86400000).toISOString(), estimatedDuration: '8 hours', estimatedCost: 45000, failureProbability: { days7: 0.35, days30: 0.68, days90: 0.92 }, reason: 'Contact wear 82%, operating time 138% above rated' },
    { id: uuid(), equipment: 'TR1 — 33/11kV 10MVA', type: 'predicted', task: 'Oil sampling and DGA test', scheduledDate: new Date(now.getTime() + 7 * 86400000).toISOString(), estimatedDuration: '4 hours', estimatedCost: 8000, failureProbability: { days7: 0.05, days30: 0.12, days90: 0.23 }, reason: 'Oil temperature rising trend — preventive DGA recommended' },
    { id: uuid(), equipment: 'M1 — Cooling Fan Motor', type: 'predicted', task: 'Bearing inspection and replacement', scheduledDate: new Date(now.getTime() + 14 * 86400000).toISOString(), estimatedDuration: '6 hours', estimatedCost: 12000, failureProbability: { days7: 0.08, days30: 0.22, days90: 0.45 }, reason: 'Elevated vibration, running at 125% rated current' },
    { id: uuid(), equipment: 'CB2 — Bus Coupler', type: 'predicted', task: 'Contact inspection and cleaning', scheduledDate: new Date(now.getTime() + 21 * 86400000).toISOString(), estimatedDuration: '4 hours', estimatedCost: 15000, failureProbability: { days7: 0.02, days30: 0.08, days90: 0.18 }, reason: 'Operating time degradation detected — contact wear 45%' },
    { id: uuid(), equipment: 'GEN1 — Diesel Standby', type: 'predicted', task: 'Starter motor service and battery bank check', scheduledDate: new Date(now.getTime() + 28 * 86400000).toISOString(), estimatedDuration: '5 hours', estimatedCost: 18000, failureProbability: { days7: 0.01, days30: 0.04, days90: 0.10 }, reason: 'Start time degradation — increased from 5s to 8.2s' },
    { id: uuid(), equipment: 'TR1 — 33/11kV 10MVA', type: 'routine', task: 'Annual transformer maintenance', scheduledDate: new Date(now.getTime() + 45 * 86400000).toISOString(), estimatedDuration: '2 days', estimatedCost: 35000, reason: 'Scheduled annual maintenance' },
    { id: uuid(), equipment: 'TR2 — 33/11kV 10MVA', type: 'routine', task: 'Annual transformer maintenance', scheduledDate: new Date(now.getTime() + 60 * 86400000).toISOString(), estimatedDuration: '2 days', estimatedCost: 35000, reason: 'Scheduled annual maintenance' },
    { id: uuid(), equipment: 'All Circuit Breakers', type: 'routine', task: 'Quarterly protection relay testing', scheduledDate: new Date(now.getTime() + 35 * 86400000).toISOString(), estimatedDuration: '1 day', estimatedCost: 20000, reason: 'Scheduled quarterly test' },
  ];
}

// ─── Spare Parts Suggestions ─────────────────────────

export interface SparePartSuggestion {
  part: string;
  forEquipment: string;
  quantity: number;
  leadTimeDays: number;
  predictedNeedDays: number;
  urgency: 'order_now' | 'plan_ahead' | 'stock_check';
  estimatedCost: number;
}

export function generateSparePartSuggestions(): SparePartSuggestion[] {
  return [
    { part: 'CB Contacts (33kV Vacuum)', forEquipment: 'CB5', quantity: 1, leadTimeDays: 30, predictedNeedDays: 15, urgency: 'order_now', estimatedCost: 25000 },
    { part: 'CB Operating Mechanism Spring', forEquipment: 'CB5', quantity: 1, leadTimeDays: 21, predictedNeedDays: 15, urgency: 'order_now', estimatedCost: 8000 },
    { part: 'Motor Bearings (6310-2RS)', forEquipment: 'M1', quantity: 2, leadTimeDays: 7, predictedNeedDays: 60, urgency: 'plan_ahead', estimatedCost: 3500 },
    { part: 'Transformer Oil (IEC 60296)', forEquipment: 'TR1', quantity: 500, leadTimeDays: 14, predictedNeedDays: 45, urgency: 'plan_ahead', estimatedCost: 15000 },
    { part: 'Silica Gel (Blue)', forEquipment: 'TR1/TR2', quantity: 20, leadTimeDays: 3, predictedNeedDays: 45, urgency: 'stock_check', estimatedCost: 2000 },
    { part: 'Starter Motor Assembly', forEquipment: 'GEN1', quantity: 1, leadTimeDays: 45, predictedNeedDays: 90, urgency: 'plan_ahead', estimatedCost: 35000 },
  ];
}

// ─── Power Quality ───────────────────────────────────

export interface VoltageProfilePoint {
  timestamp: string;
  bus1Voltage: number;
  bus2Voltage: number;
  nominalKV: number;
  deviationBus1: number;
  deviationBus2: number;
}

export function generateVoltageProfile(hours: number = 24): VoltageProfilePoint[] {
  const data: VoltageProfilePoint[] = [];
  const now = new Date();
  const nominal = 11.0; // kV

  for (let h = 0; h < hours; h++) {
    const t = new Date(now.getTime() - (hours - h) * 3600000);
    const hour = t.getHours();

    // Voltage drops during peak load
    const loadFactor = DAILY_LOAD_PROFILE[hour];
    const bus1V = nominal * (1 - (loadFactor - 0.5) * 0.04 + (Math.random() - 0.5) * 0.01);
    const bus2V = nominal * (1 - (loadFactor - 0.5) * 0.06 + (Math.random() - 0.5) * 0.015);

    data.push({
      timestamp: t.toISOString(),
      bus1Voltage: Math.round(bus1V * 1000) / 1000,
      bus2Voltage: Math.round(bus2V * 1000) / 1000,
      nominalKV: nominal,
      deviationBus1: Math.round(((bus1V - nominal) / nominal) * 10000) / 100,
      deviationBus2: Math.round(((bus2V - nominal) / nominal) * 10000) / 100,
    });
  }
  return data;
}

export interface PowerFactorPoint {
  timestamp: string;
  powerFactor: number;
  reactivePower: number;
  inPenaltyZone: boolean;
}

export function generatePowerFactorTrend(hours: number = 24): PowerFactorPoint[] {
  const data: PowerFactorPoint[] = [];
  const now = new Date();

  for (let h = 0; h < hours; h++) {
    const t = new Date(now.getTime() - (hours - h) * 3600000);
    const hour = t.getHours();
    const loadFactor = DAILY_LOAD_PROFILE[hour];

    // PF tends to drop under high load (more reactive power)
    const basePF = 0.92 - loadFactor * 0.08 + (Math.random() - 0.5) * 0.03;
    const pf = Math.max(0.75, Math.min(0.99, basePF));
    const reactivePower = BASE_LOAD_MW * loadFactor * Math.tan(Math.acos(pf));

    data.push({
      timestamp: t.toISOString(),
      powerFactor: Math.round(pf * 1000) / 1000,
      reactivePower: Math.round(reactivePower * 100) / 100,
      inPenaltyZone: pf < 0.9,
    });
  }
  return data;
}

export interface HarmonicData {
  order: number;
  magnitude: number; // % of fundamental
  phase: number;
  limit: number; // IEEE 519 limit
  compliant: boolean;
}

export function generateHarmonicAnalysis(): { thd: number; harmonics: HarmonicData[]; thdTrend: { timestamp: string; thd: number }[] } {
  const harmonics: HarmonicData[] = [
    { order: 3, magnitude: 4.2, phase: 15, limit: 5.0, compliant: true },
    { order: 5, magnitude: 6.8, phase: -30, limit: 6.0, compliant: false },
    { order: 7, magnitude: 3.5, phase: 45, limit: 5.0, compliant: true },
    { order: 9, magnitude: 1.8, phase: -60, limit: 1.5, compliant: false },
    { order: 11, magnitude: 2.1, phase: 80, limit: 3.5, compliant: true },
    { order: 13, magnitude: 1.5, phase: -15, limit: 3.0, compliant: true },
  ];

  const thd = Math.sqrt(harmonics.reduce((s, h) => s + h.magnitude ** 2, 0));

  // THD trend over 7 days
  const now = new Date();
  const thdTrend = Array.from({ length: 168 }, (_, i) => {
    const t = new Date(now.getTime() - (168 - i) * 3600000);
    const hour = t.getHours();
    const loadFactor = DAILY_LOAD_PROFILE[hour];
    return {
      timestamp: t.toISOString(),
      thd: Math.round((thd * (0.8 + loadFactor * 0.4) + (Math.random() - 0.5) * 1.5) * 100) / 100,
    };
  });

  return { thd: Math.round(thd * 100) / 100, harmonics, thdTrend };
}

export interface ReliabilityIndices {
  period: string;
  saifi: number;
  saidi: number;
  caidi: number;
}

export function generateReliabilityIndices(): ReliabilityIndices[] {
  const months = ['Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb'];
  return months.map((m, i) => ({
    period: m,
    saifi: Math.round((1.2 + Math.random() * 0.6 - i * 0.05) * 100) / 100,
    saidi: Math.round((2.5 + Math.random() * 1.0 - i * 0.1) * 100) / 100,
    caidi: Math.round((2.1 + Math.random() * 0.5) * 100) / 100,
  }));
}

// ─── Daily Report ────────────────────────────────────

export interface DailyReport {
  date: string;
  summary: {
    peakLoadMW: number;
    peakTime: string;
    minLoadMW: number;
    minTime: string;
    avgLoadMW: number;
    energyMWh: number;
    loadFactor: number;
  };
  alarms: { total: number; critical: number; warning: number; info: number; topAlarm: string };
  equipment: { healthyCount: number; degradedCount: number; criticalCount: number; statusChanges: string[] };
  powerQuality: { avgPF: number; minPF: number; thdAvg: number; voltageEvents: number };
  recommendations: string[];
}

export function generateDailyReport(): DailyReport {
  const now = new Date();
  return {
    date: now.toISOString().split('T')[0],
    summary: {
      peakLoadMW: 28.5,
      peakTime: '14:30',
      minLoadMW: 10.2,
      minTime: '03:45',
      avgLoadMW: 18.7,
      energyMWh: 448.8,
      loadFactor: 0.656,
    },
    alarms: {
      total: 23,
      critical: 3,
      warning: 12,
      info: 8,
      topAlarm: 'Overcurrent 51 — Feeder 3 (5 occurrences)',
    },
    equipment: {
      healthyCount: 8,
      degradedCount: 3,
      criticalCount: 1,
      statusChanges: [
        'CB5 health score dropped from 48% to 41%',
        'M1 vibration level changed from normal to elevated',
      ],
    },
    powerQuality: {
      avgPF: 0.89,
      minPF: 0.82,
      thdAvg: 8.9,
      voltageEvents: 4,
    },
    recommendations: [
      'CB5 (Feeder 3): Urgent contact replacement needed — failure probability 35% in 7 days',
      'TR1: Schedule oil DGA test — temperature trending upward',
      'Install 50 kVAR capacitor bank at Bus 2 to improve power factor from 0.85 to 0.95',
      'Consider load transfer from TR1 to TR2 during afternoon peak (TR1 at 78%, TR2 at 55%)',
      'Plan maintenance window for M1 cooling fan motor — bearing replacement recommended',
    ],
  };
}

// ─── What-If Simulator ───────────────────────────────

export interface WhatIfResult {
  scenario: string;
  impacts: { parameter: string; before: string; after: string; severity: 'normal' | 'warning' | 'critical' }[];
  recommendations: string[];
  riskLevel: 'low' | 'medium' | 'high';
}

export function simulateWhatIf(scenario: string): WhatIfResult {
  const scenarios: Record<string, WhatIfResult> = {
    'transformer_trip': {
      scenario: 'Transformer TR1 trips',
      impacts: [
        { parameter: 'TR2 Loading', before: '55%', after: '133%', severity: 'critical' },
        { parameter: 'Bus 1 Voltage', before: '11.0 kV', after: '10.2 kV', severity: 'warning' },
        { parameter: 'Bus 2 Voltage', before: '10.8 kV', after: '9.8 kV', severity: 'critical' },
        { parameter: 'System Capacity', before: '20 MVA', after: '10 MVA', severity: 'critical' },
        { parameter: 'Feeders at risk', before: '0', after: '3 (load shedding required)', severity: 'critical' },
      ],
      recommendations: [
        'IMMEDIATE: Shed Feeder 1 (Industrial) — reduce 3.8 MW',
        'Shed Feeder 4 (Commercial) — reduce 1.5 MW',
        'Start GEN1 diesel standby — add 5 MW backup',
        'Alert grid control center for emergency power import',
      ],
      riskLevel: 'high',
    },
    'load_increase_20': {
      scenario: 'Load increases by 20%',
      impacts: [
        { parameter: 'TR1 Loading', before: '78%', after: '94%', severity: 'warning' },
        { parameter: 'TR2 Loading', before: '55%', after: '66%', severity: 'normal' },
        { parameter: 'Bus 2 Voltage', before: '10.8 kV', after: '10.5 kV', severity: 'warning' },
        { parameter: 'Power Factor', before: '0.89', after: '0.85', severity: 'warning' },
        { parameter: 'System Reserve', before: '35%', after: '15%', severity: 'warning' },
      ],
      recommendations: [
        'Transfer 2 MW from TR1 to TR2 to balance loading',
        'Switch on capacitor bank at Bus 2 (50 kVAR)',
        'Alert operators for potential load shedding if peak exceeds 28 MW',
        'Pre-start GEN1 diesel on standby',
      ],
      riskLevel: 'medium',
    },
    'capacitor_addition': {
      scenario: 'Add 5 MVAR capacitor bank at Bus 2',
      impacts: [
        { parameter: 'Power Factor', before: '0.85', after: '0.96', severity: 'normal' },
        { parameter: 'Bus 2 Voltage', before: '10.5 kV', after: '10.9 kV', severity: 'normal' },
        { parameter: 'Reactive Power', before: '8.2 MVAR', after: '3.2 MVAR', severity: 'normal' },
        { parameter: 'Line Losses', before: '2.1%', after: '1.4%', severity: 'normal' },
        { parameter: 'Penalty Charges', before: '₹45,000/month', after: '₹0/month', severity: 'normal' },
      ],
      recommendations: [
        'Install automatic switching controller to prevent over-compensation at light load',
        'Add harmonic filter to prevent capacitor-harmonic resonance (5th harmonic risk)',
        'Expected annual savings: ₹5.4 lakhs in penalty + ₹2.1 lakhs in loss reduction',
      ],
      riskLevel: 'low',
    },
  };

  // Map free-text to closest scenario
  const lower = scenario.toLowerCase();
  if (lower.includes('tr1') || lower.includes('transformer')) return scenarios['transformer_trip'];
  if (lower.includes('load') || lower.includes('20%') || lower.includes('increase')) return scenarios['load_increase_20'];
  if (lower.includes('capacitor') || lower.includes('mvar') || lower.includes('kvar')) return scenarios['capacitor_addition'];

  return scenarios['load_increase_20']; // default
}

// ─── Maintenance Cost Analysis ───────────────────────

export interface CostAnalysis {
  preventiveCost: number;
  correctiveCost: number;
  savings: number;
  annualBudget: { category: string; amount: number }[];
  monthlyTrend: { month: string; preventive: number; corrective: number }[];
}

export function generateCostAnalysis(): CostAnalysis {
  return {
    preventiveCost: 285000,
    correctiveCost: 520000,
    savings: 235000,
    annualBudget: [
      { category: 'Transformer Maintenance', amount: 120000 },
      { category: 'CB Maintenance', amount: 95000 },
      { category: 'Motor Maintenance', amount: 45000 },
      { category: 'Generator Maintenance', amount: 55000 },
      { category: 'Testing & Calibration', amount: 30000 },
      { category: 'Spare Parts Reserve', amount: 80000 },
    ],
    monthlyTrend: [
      { month: 'Sep', preventive: 22000, corrective: 45000 },
      { month: 'Oct', preventive: 28000, corrective: 15000 },
      { month: 'Nov', preventive: 18000, corrective: 62000 },
      { month: 'Dec', preventive: 32000, corrective: 8000 },
      { month: 'Jan', preventive: 25000, corrective: 35000 },
      { month: 'Feb', preventive: 30000, corrective: 12000 },
    ],
  };
}
