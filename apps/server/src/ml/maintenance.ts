/**
 * Predictive Maintenance Module
 * Generates maintenance recommendations based on equipment run hours + anomaly scores.
 */

// ─── Types ─────────────────────────────────────────

export interface EquipmentProfile {
  id: string;
  name: string;
  type: 'Transformer' | 'Circuit Breaker' | 'Motor' | 'Generator';
  operatingHours: number;
  age: number;           // years
  lastMaintenanceDate: string;
  tripCount?: number;
  contactWear?: number;  // 0-100%
}

export interface MaintenancePrediction {
  equipment: string;
  nextMaintenance: string;  // ISO date
  riskScore: number;        // 0-100
  recommendation: string;
  type: 'routine' | 'predicted' | 'urgent';
  estimatedCost: number;
  failureProbability: { days7: number; days30: number; days90: number };
}

// ─── Equipment Inventory ───────────────────────────

const EQUIPMENT: EquipmentProfile[] = [
  { id: 'TR1', name: 'TR1 — 33/11kV 10MVA', type: 'Transformer', operatingHours: 48200, age: 8, lastMaintenanceDate: '2025-08-15' },
  { id: 'TR2', name: 'TR2 — 33/11kV 10MVA', type: 'Transformer', operatingHours: 35100, age: 5, lastMaintenanceDate: '2025-10-01' },
  { id: 'CB1', name: 'CB1 — 33kV Incomer', type: 'Circuit Breaker', operatingHours: 48200, age: 8, lastMaintenanceDate: '2025-09-20', tripCount: 142, contactWear: 28 },
  { id: 'CB2', name: 'CB2 — 33kV Bus Coupler', type: 'Circuit Breaker', operatingHours: 48200, age: 8, lastMaintenanceDate: '2025-06-15', tripCount: 89, contactWear: 45 },
  { id: 'CB3', name: 'CB3 — Feeder 1', type: 'Circuit Breaker', operatingHours: 35100, age: 5, lastMaintenanceDate: '2025-11-01', tripCount: 23, contactWear: 8 },
  { id: 'CB4', name: 'CB4 — Feeder 2', type: 'Circuit Breaker', operatingHours: 35100, age: 5, lastMaintenanceDate: '2025-10-15', tripCount: 45, contactWear: 15 },
  { id: 'CB5', name: 'CB5 — Feeder 3', type: 'Circuit Breaker', operatingHours: 62000, age: 12, lastMaintenanceDate: '2025-03-01', tripCount: 312, contactWear: 82 },
  { id: 'CB6', name: 'CB6 — Feeder 4', type: 'Circuit Breaker', operatingHours: 20000, age: 3, lastMaintenanceDate: '2025-12-01', tripCount: 12, contactWear: 4 },
  { id: 'M1', name: 'M1 — Cooling Fan Motor', type: 'Motor', operatingHours: 28000, age: 6, lastMaintenanceDate: '2025-07-20' },
  { id: 'M2', name: 'M2 — Oil Pump Motor', type: 'Motor', operatingHours: 15000, age: 3, lastMaintenanceDate: '2025-11-15' },
  { id: 'M3', name: 'M3 — Ventilation Motor', type: 'Motor', operatingHours: 22000, age: 5, lastMaintenanceDate: '2025-09-10' },
  { id: 'GEN1', name: 'GEN1 — 5MW Diesel Standby', type: 'Generator', operatingHours: 4200, age: 10, lastMaintenanceDate: '2025-08-01' },
];

// ─── Maintenance intervals (hours / months) ───────

const MAINTENANCE_INTERVALS: Record<string, { hours: number; months: number }> = {
  'Transformer': { hours: 8760, months: 12 },    // Annual
  'Circuit Breaker': { hours: 4380, months: 6 },  // Semi-annual
  'Motor': { hours: 8760, months: 12 },           // Annual
  'Generator': { hours: 2000, months: 6 },        // Semi-annual
};

// ─── Risk Scoring ──────────────────────────────────

function computeRiskScore(eq: EquipmentProfile, anomalyScore: number): number {
  let risk = 0;

  // Age factor (0-25 points)
  const maxAge: Record<string, number> = { Transformer: 25, 'Circuit Breaker': 15, Motor: 15, Generator: 20 };
  risk += (eq.age / (maxAge[eq.type] || 15)) * 25;

  // Operating hours (0-20 points)
  risk += Math.min(20, eq.operatingHours / 5000);

  // Contact wear for CBs (0-30 points)
  if (eq.contactWear !== undefined) {
    risk += (eq.contactWear / 100) * 30;
  }

  // Trip count for CBs (0-15 points)
  if (eq.tripCount !== undefined) {
    risk += Math.min(15, eq.tripCount / 25);
  }

  // Anomaly score (0-20 points)
  risk += anomalyScore * 20;

  // Time since last maintenance (0-10 points)
  const daysSinceMaint = (Date.now() - new Date(eq.lastMaintenanceDate).getTime()) / 86400000;
  const interval = MAINTENANCE_INTERVALS[eq.type];
  if (interval) {
    risk += Math.min(10, (daysSinceMaint / (interval.months * 30)) * 10);
  }

  return Math.round(Math.min(100, Math.max(0, risk)));
}

function estimateFailureProbability(riskScore: number): { days7: number; days30: number; days90: number } {
  // Logistic function mapping risk score to failure probability
  const p7 = 1 / (1 + Math.exp(-(riskScore - 70) / 8));
  const p30 = 1 / (1 + Math.exp(-(riskScore - 50) / 10));
  const p90 = 1 / (1 + Math.exp(-(riskScore - 35) / 12));
  return {
    days7: Math.round(p7 * 100) / 100,
    days30: Math.round(p30 * 100) / 100,
    days90: Math.round(p90 * 100) / 100,
  };
}

// ─── Prediction ────────────────────────────────────

export function predictMaintenance(
  anomalyScores: Record<string, number> // equipmentId → anomaly score 0-1
): MaintenancePrediction[] {
  const now = new Date();

  return EQUIPMENT.map(eq => {
    const anomalyScore = anomalyScores[eq.id] ?? 0;
    const riskScore = computeRiskScore(eq, anomalyScore);
    const failProb = estimateFailureProbability(riskScore);

    // Determine maintenance type and timing
    let type: MaintenancePrediction['type'] = 'routine';
    let daysUntilMaint: number;
    let recommendation: string;

    if (riskScore > 70) {
      type = 'urgent';
      daysUntilMaint = Math.max(1, Math.round((100 - riskScore) / 5));
      recommendation = `URGENT: ${getUrgentRecommendation(eq)}`;
    } else if (riskScore > 40) {
      type = 'predicted';
      daysUntilMaint = Math.max(7, Math.round((100 - riskScore) / 2));
      recommendation = getPredictedRecommendation(eq);
    } else {
      const interval = MAINTENANCE_INTERVALS[eq.type];
      daysUntilMaint = interval ? interval.months * 30 : 180;
      const daysSince = (now.getTime() - new Date(eq.lastMaintenanceDate).getTime()) / 86400000;
      daysUntilMaint = Math.max(7, daysUntilMaint - daysSince);
      recommendation = getRoutineRecommendation(eq);
    }

    const nextMaint = new Date(now.getTime() + daysUntilMaint * 86400000);

    return {
      equipment: eq.name,
      nextMaintenance: nextMaint.toISOString(),
      riskScore,
      recommendation,
      type,
      estimatedCost: getEstimatedCost(eq, type),
      failureProbability: failProb,
    };
  }).sort((a, b) => b.riskScore - a.riskScore);
}

function getUrgentRecommendation(eq: EquipmentProfile): string {
  switch (eq.type) {
    case 'Circuit Breaker':
      return `Replace contacts immediately. Contact wear at ${eq.contactWear}%, ${eq.tripCount} trips. Plan full CB overhaul.`;
    case 'Transformer':
      return 'Immediate oil sampling and DGA test. Check for hotspot development. Reduce loading if possible.';
    case 'Motor':
      return 'Replace bearings and check winding insulation. Vibration levels critical.';
    case 'Generator':
      return 'Service starter motor and battery bank. Test under load immediately.';
  }
}

function getPredictedRecommendation(eq: EquipmentProfile): string {
  switch (eq.type) {
    case 'Circuit Breaker':
      return `Schedule contact inspection and cleaning. Contact wear at ${eq.contactWear ?? 0}%.`;
    case 'Transformer':
      return 'Schedule oil sampling and DGA test. Monitor temperature trends.';
    case 'Motor':
      return 'Schedule bearing inspection. Monitor vibration and current draw.';
    case 'Generator':
      return 'Service starter motor and check battery bank voltage.';
  }
}

function getRoutineRecommendation(eq: EquipmentProfile): string {
  switch (eq.type) {
    case 'Circuit Breaker':
      return 'Routine inspection and protection relay testing.';
    case 'Transformer':
      return 'Annual maintenance: oil test, bushing inspection, tap changer service.';
    case 'Motor':
      return 'Annual maintenance: bearing grease, winding resistance test.';
    case 'Generator':
      return 'Semi-annual: fuel system check, cooling system flush, load bank test.';
  }
}

function getEstimatedCost(eq: EquipmentProfile, type: MaintenancePrediction['type']): number {
  const baseCosts: Record<string, Record<string, number>> = {
    'Transformer': { routine: 35000, predicted: 12000, urgent: 80000 },
    'Circuit Breaker': { routine: 8000, predicted: 15000, urgent: 45000 },
    'Motor': { routine: 5000, predicted: 12000, urgent: 25000 },
    'Generator': { routine: 18000, predicted: 25000, urgent: 60000 },
  };
  return baseCosts[eq.type]?.[type] ?? 10000;
}
