/**
 * Power Quality Metrics Derivation
 * Derives voltage, power factor, THD, and frequency from load data.
 */

import type { LoadDataPoint } from './generate-load-data';

// ─── Types ─────────────────────────────────────────

export interface PowerQualityPoint {
  timestamp: string;
  voltage_kv: number;        // kV (11kV nominal)
  current_a: number;         // Amperes
  power_factor: number;      // 0-1
  thd_percent: number;       // Total Harmonic Distortion %
  frequency_hz: number;      // Hz (50 nominal)
  load_mw: number;
}

// ─── Constants ─────────────────────────────────────

const NOMINAL_VOLTAGE_KV = 11.0;
const NOMINAL_FREQUENCY_HZ = 50.0;
const RATED_CAPACITY_MW = 22;

// ─── Derivation ────────────────────────────────────

export function derivePowerQuality(data: LoadDataPoint[]): PowerQualityPoint[] {
  return data.map(p => {
    const loadFraction = p.load_mw / RATED_CAPACITY_MW; // 0 to ~1.3

    // Voltage: drops with load (voltage regulation ~4-6% at full load)
    const voltageReg = 0.05 * loadFraction; // 5% regulation at full load
    const voltageNoise = (seededRand(p.timestamp) - 0.5) * 0.1; // ±0.05 kV noise
    const voltage = NOMINAL_VOLTAGE_KV * (1 - voltageReg) + voltageNoise;

    // Current: I = P / (√3 × V × PF)
    // PF: worse at higher loads (more reactive power from motors/AC)
    const basePF = 0.95 - loadFraction * 0.10; // ranges 0.85-0.95
    const pfNoise = (seededRand(p.timestamp + 'pf') - 0.5) * 0.03;
    const powerFactor = Math.max(0.75, Math.min(0.99, basePF + pfNoise));

    const current = (p.load_mw * 1000) / (Math.sqrt(3) * voltage * powerFactor);

    // THD: worse at lower loads (electronics/inverters dominate)
    // At high load: ~3-4% (motors smooth waveform)
    // At low load: ~6-8% (LED/electronic loads ratio increases)
    const baseTHD = 8 - loadFraction * 5; // 3% at full, 8% at no load
    const thdNoise = (seededRand(p.timestamp + 'thd') - 0.5) * 1.0;
    const thd = Math.max(1, Math.min(12, baseTHD + thdNoise));

    // Frequency: slight deviations under load changes
    const freqDeviation = (seededRand(p.timestamp + 'freq') - 0.5) * 0.08;
    const loadEffect = -(loadFraction - 0.5) * 0.02; // slight droop under heavy load
    const frequency = NOMINAL_FREQUENCY_HZ + freqDeviation + loadEffect;

    return {
      timestamp: p.timestamp,
      voltage_kv: Math.round(voltage * 1000) / 1000,
      current_a: Math.round(current * 10) / 10,
      power_factor: Math.round(powerFactor * 1000) / 1000,
      thd_percent: Math.round(thd * 100) / 100,
      frequency_hz: Math.round(frequency * 1000) / 1000,
      load_mw: p.load_mw,
    };
  });
}

/** Simple hash-based seeded random for deterministic noise */
function seededRand(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  return ((h & 0x7fffffff) % 10000) / 10000;
}
