import type { ProtocolAdapter, ConnectionStatus, AdapterConfig } from './ProtocolAdapter';

/**
 * Tag metadata for the simulator.
 */
interface TagDefinition {
  tag: string;
  type: 'analog' | 'digital';
  unit?: string;
  description: string;
  baseValue: number;
  minValue?: number;
  maxValue?: number;
}

/**
 * Enhanced simulator generating realistic MSEDCL 33/11kV substation data.
 * Produces 50+ tags with time-of-day load profiles, random events, and
 * realistic fluctuations.
 */
export class SimulatorAdapter implements ProtocolAdapter {
  private status: ConnectionStatus = 'DISCONNECTED';
  private statusCallbacks: Array<(connected: boolean) => void> = [];
  private config: AdapterConfig;

  // Current analog/digital values keyed by tag name
  private analogValues: Map<string, number> = new Map();
  private digitalValues: Map<string, boolean> = new Map();

  // Tag definitions for external consumers
  private tagDefinitions: TagDefinition[] = [];

  // Energy accumulators
  private energyCounters: Map<string, number> = new Map();

  // Simulation timers
  private intervalHandle?: NodeJS.Timeout;
  private eventHandle?: NodeJS.Timeout;
  private startTime = Date.now();

  // Callback when values change - used by server to publish to realtime service
  private onValueChange?: (tag: string, value: number | boolean, unit?: string) => void;

  constructor(config: AdapterConfig) {
    this.config = config;
    this.buildTagDefinitions();
    this.initializeDefaults();
  }

  /** Register a callback that fires on every value change. */
  setValueChangeCallback(cb: (tag: string, value: number | boolean, unit?: string) => void): void {
    this.onValueChange = cb;
  }

  /** Return all tag definitions for the /api/realtime/tags endpoint. */
  getTagDefinitions(): TagDefinition[] {
    return this.tagDefinitions;
  }

  /** Return a snapshot of all current values. */
  getSnapshot(): Record<string, { value: number | boolean; unit?: string }> {
    const snap: Record<string, { value: number | boolean; unit?: string }> = {};
    for (const def of this.tagDefinitions) {
      if (def.type === 'analog') {
        snap[def.tag] = { value: this.analogValues.get(def.tag) ?? def.baseValue, unit: def.unit };
      } else {
        snap[def.tag] = { value: this.digitalValues.get(def.tag) ?? true };
      }
    }
    return snap;
  }

  // ───────────────────────── Tag definitions ─────────────────────────

  private buildTagDefinitions(): void {
    const defs: TagDefinition[] = [];

    // ── System-level ──
    defs.push({ tag: 'SYS_FREQ', type: 'analog', unit: 'Hz', description: 'System Frequency', baseValue: 50.0, minValue: 49.8, maxValue: 50.2 });
    defs.push({ tag: 'SYS_TOTAL_LOAD', type: 'analog', unit: 'MW', description: 'Total Substation Load', baseValue: 12.0 });
    defs.push({ tag: 'SYS_TOTAL_PF', type: 'analog', unit: '', description: 'System Power Factor', baseValue: 0.95, minValue: 0.85, maxValue: 0.99 });

    // ── 33kV Incoming ──
    defs.push({ tag: 'INC_33KV_V_RY', type: 'analog', unit: 'kV', description: '33kV Incoming Voltage R-Y', baseValue: 33.0 });
    defs.push({ tag: 'INC_33KV_V_YB', type: 'analog', unit: 'kV', description: '33kV Incoming Voltage Y-B', baseValue: 33.0 });
    defs.push({ tag: 'INC_33KV_V_BR', type: 'analog', unit: 'kV', description: '33kV Incoming Voltage B-R', baseValue: 33.0 });
    defs.push({ tag: 'INC_33KV_I_R', type: 'analog', unit: 'A', description: '33kV Incoming Current R', baseValue: 140.0 });
    defs.push({ tag: 'INC_33KV_I_Y', type: 'analog', unit: 'A', description: '33kV Incoming Current Y', baseValue: 138.0 });
    defs.push({ tag: 'INC_33KV_I_B', type: 'analog', unit: 'A', description: '33kV Incoming Current B', baseValue: 142.0 });
    defs.push({ tag: 'INC_33KV_CB', type: 'digital', description: '33kV Incoming CB', baseValue: 1 });

    // ── Transformer 1 ──
    defs.push({ tag: 'TR1_V_HV', type: 'analog', unit: 'kV', description: 'TR1 HV Voltage', baseValue: 33.0 });
    defs.push({ tag: 'TR1_V_LV', type: 'analog', unit: 'kV', description: 'TR1 LV Voltage', baseValue: 11.0 });
    defs.push({ tag: 'TR1_I_HV', type: 'analog', unit: 'A', description: 'TR1 HV Current', baseValue: 140.0 });
    defs.push({ tag: 'TR1_I_LV', type: 'analog', unit: 'A', description: 'TR1 LV Current', baseValue: 420.0 });
    defs.push({ tag: 'TR1_P_3PH', type: 'analog', unit: 'MW', description: 'TR1 Active Power', baseValue: 6.0 });
    defs.push({ tag: 'TR1_Q_3PH', type: 'analog', unit: 'MVAR', description: 'TR1 Reactive Power', baseValue: 2.0 });
    defs.push({ tag: 'TR1_PF', type: 'analog', unit: '', description: 'TR1 Power Factor', baseValue: 0.95, minValue: 0.85, maxValue: 0.99 });
    defs.push({ tag: 'TR1_OIL_TEMP', type: 'analog', unit: '°C', description: 'TR1 Oil Temperature', baseValue: 55.0, minValue: 35.0, maxValue: 85.0 });
    defs.push({ tag: 'TR1_WDG_TEMP', type: 'analog', unit: '°C', description: 'TR1 Winding Temperature', baseValue: 65.0, minValue: 40.0, maxValue: 95.0 });
    defs.push({ tag: 'TR1_TAP_POS', type: 'analog', unit: '', description: 'TR1 Tap Position', baseValue: 5, minValue: 1, maxValue: 9 });
    defs.push({ tag: 'TR1_OIL_LEVEL', type: 'analog', unit: '%', description: 'TR1 Oil Level', baseValue: 92.0, minValue: 80.0, maxValue: 100.0 });
    defs.push({ tag: 'TR1_HV_CB', type: 'digital', description: 'TR1 HV Circuit Breaker', baseValue: 1 });
    defs.push({ tag: 'TR1_LV_CB', type: 'digital', description: 'TR1 LV Circuit Breaker', baseValue: 1 });

    // ── Transformer 2 ──
    defs.push({ tag: 'TR2_V_HV', type: 'analog', unit: 'kV', description: 'TR2 HV Voltage', baseValue: 33.0 });
    defs.push({ tag: 'TR2_V_LV', type: 'analog', unit: 'kV', description: 'TR2 LV Voltage', baseValue: 11.0 });
    defs.push({ tag: 'TR2_I_HV', type: 'analog', unit: 'A', description: 'TR2 HV Current', baseValue: 130.0 });
    defs.push({ tag: 'TR2_I_LV', type: 'analog', unit: 'A', description: 'TR2 LV Current', baseValue: 390.0 });
    defs.push({ tag: 'TR2_P_3PH', type: 'analog', unit: 'MW', description: 'TR2 Active Power', baseValue: 5.5 });
    defs.push({ tag: 'TR2_Q_3PH', type: 'analog', unit: 'MVAR', description: 'TR2 Reactive Power', baseValue: 1.8 });
    defs.push({ tag: 'TR2_PF', type: 'analog', unit: '', description: 'TR2 Power Factor', baseValue: 0.95, minValue: 0.85, maxValue: 0.99 });
    defs.push({ tag: 'TR2_OIL_TEMP', type: 'analog', unit: '°C', description: 'TR2 Oil Temperature', baseValue: 52.0, minValue: 35.0, maxValue: 85.0 });
    defs.push({ tag: 'TR2_WDG_TEMP', type: 'analog', unit: '°C', description: 'TR2 Winding Temperature', baseValue: 62.0, minValue: 40.0, maxValue: 95.0 });
    defs.push({ tag: 'TR2_TAP_POS', type: 'analog', unit: '', description: 'TR2 Tap Position', baseValue: 5, minValue: 1, maxValue: 9 });
    defs.push({ tag: 'TR2_OIL_LEVEL', type: 'analog', unit: '%', description: 'TR2 Oil Level', baseValue: 94.0, minValue: 80.0, maxValue: 100.0 });
    defs.push({ tag: 'TR2_HV_CB', type: 'digital', description: 'TR2 HV Circuit Breaker', baseValue: 1 });
    defs.push({ tag: 'TR2_LV_CB', type: 'digital', description: 'TR2 LV Circuit Breaker', baseValue: 1 });

    // ── 6 × 11kV Feeders ──
    const feederNames = ['INDUSTRIAL_1', 'RESIDENTIAL_1', 'COMMERCIAL_1', 'AGRICULTURAL', 'INDUSTRIAL_2', 'RESIDENTIAL_2'];
    for (let f = 0; f < 6; f++) {
      const prefix = `FDR${String(f + 1).padStart(2, '0')}`;
      const name = feederNames[f];
      defs.push({ tag: `${prefix}_V`, type: 'analog', unit: 'kV', description: `${name} Feeder Voltage`, baseValue: 11.0 + (Math.random() - 0.5) * 0.2 });
      defs.push({ tag: `${prefix}_I_R`, type: 'analog', unit: 'A', description: `${name} Current R`, baseValue: 120 + f * 15 });
      defs.push({ tag: `${prefix}_I_Y`, type: 'analog', unit: 'A', description: `${name} Current Y`, baseValue: 118 + f * 15 });
      defs.push({ tag: `${prefix}_I_B`, type: 'analog', unit: 'A', description: `${name} Current B`, baseValue: 122 + f * 15 });
      defs.push({ tag: `${prefix}_P`, type: 'analog', unit: 'MW', description: `${name} Active Power`, baseValue: 1.2 + f * 0.3 });
      defs.push({ tag: `${prefix}_Q`, type: 'analog', unit: 'MVAR', description: `${name} Reactive Power`, baseValue: 0.3 + f * 0.08 });
      defs.push({ tag: `${prefix}_PF`, type: 'analog', unit: '', description: `${name} Power Factor`, baseValue: 0.92 + Math.random() * 0.06, minValue: 0.85, maxValue: 0.99 });
      defs.push({ tag: `${prefix}_KWH`, type: 'analog', unit: 'kWh', description: `${name} Energy Meter`, baseValue: 50000 + f * 10000 });
      defs.push({ tag: `${prefix}_CB`, type: 'digital', description: `${name} Circuit Breaker`, baseValue: 1 });
    }

    // ── Bus Section ──
    defs.push({ tag: 'BUS_11KV_V', type: 'analog', unit: 'kV', description: '11kV Bus Voltage', baseValue: 11.0 });
    defs.push({ tag: 'BUS_TIE_CB', type: 'digital', description: 'Bus Tie CB', baseValue: 0 }); // normally open

    // ── Capacitor Bank ──
    defs.push({ tag: 'CAP_BANK_STATUS', type: 'digital', description: 'Capacitor Bank Status', baseValue: 1 });
    defs.push({ tag: 'CAP_BANK_KVAR', type: 'analog', unit: 'KVAR', description: 'Capacitor Bank Output', baseValue: 600 });

    // ── Ambient ──
    defs.push({ tag: 'AMBIENT_TEMP', type: 'analog', unit: '°C', description: 'Ambient Temperature', baseValue: 32.0, minValue: 20.0, maxValue: 45.0 });

    // ── Energy accumulators (today + month) ──
    defs.push({ tag: 'ENERGY_TODAY_KWH', type: 'analog', unit: 'kWh', description: 'Energy Today', baseValue: 0 });
    defs.push({ tag: 'ENERGY_MONTH_KWH', type: 'analog', unit: 'kWh', description: 'Energy This Month', baseValue: 450000 });
    defs.push({ tag: 'PEAK_DEMAND_MW', type: 'analog', unit: 'MW', description: 'Peak Demand Today', baseValue: 0 });

    this.tagDefinitions = defs;
  }

  // ───────────────────────── Initialise defaults ─────────────────────────

  private initializeDefaults(): void {
    for (const def of this.tagDefinitions) {
      if (def.type === 'analog') {
        this.analogValues.set(def.tag, def.baseValue);
      } else {
        this.digitalValues.set(def.tag, def.baseValue === 1);
      }
    }
    // Initialise energy counters
    this.energyCounters.set('today', 0);
    this.energyCounters.set('month', 450_000);
    this.energyCounters.set('peakDemand', 0);
  }

  // ───────────────────────── Protocol interface ─────────────────────────

  async connect(): Promise<void> {
    this.status = 'CONNECTED';
    this.notifyStatusChange(true);
    this.startTime = Date.now();

    // Main simulation loop — every 1 second
    this.intervalHandle = setInterval(() => this.simulate(), 1000);

    // Random events — every 30-120 seconds
    this.scheduleRandomEvent();

    console.log(`[Simulator] Enhanced MSEDCL 33/11kV simulator started (${this.tagDefinitions.length} tags)`);
  }

  async disconnect(): Promise<void> {
    if (this.intervalHandle) clearInterval(this.intervalHandle);
    if (this.eventHandle) clearTimeout(this.eventHandle);
    this.status = 'DISCONNECTED';
    this.notifyStatusChange(false);
  }

  async readAnalog(address: number, count: number): Promise<number[]> {
    // Legacy address-based API — return analog values by index
    const tags = this.tagDefinitions.filter((d) => d.type === 'analog');
    const values: number[] = [];
    for (let i = 0; i < count; i++) {
      const tag = tags[address + i];
      values.push(tag ? this.analogValues.get(tag.tag) ?? 0 : 0);
    }
    return values;
  }

  async readDigital(address: number, count: number): Promise<boolean[]> {
    const tags = this.tagDefinitions.filter((d) => d.type === 'digital');
    const values: boolean[] = [];
    for (let i = 0; i < count; i++) {
      const tag = tags[address + i];
      values.push(tag ? this.digitalValues.get(tag.tag) ?? false : false);
    }
    return values;
  }

  async writeDigital(address: number, value: boolean): Promise<boolean> {
    const tags = this.tagDefinitions.filter((d) => d.type === 'digital');
    const tag = tags[address];
    if (tag) {
      this.digitalValues.set(tag.tag, value);
      this.emitChange(tag.tag, value);
    }
    return true;
  }

  /** Write a digital value by tag name (used by control service). */
  writeDigitalByTag(tag: string, value: boolean): void {
    this.digitalValues.set(tag, value);
    this.emitChange(tag, value);
  }

  onStatusChange(callback: (connected: boolean) => void): void {
    this.statusCallbacks.push(callback);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  // ───────────────────────── Simulation engine ─────────────────────────

  private simulate(): void {
    const loadFactor = this.getLoadFactor();
    const noiseScale = 0.02; // ±2% base noise

    // System frequency — tight regulation
    this.setAnalog('SYS_FREQ', 50.0 + (Math.random() - 0.5) * 0.4);

    // Ambient temperature — slow drift
    const hour = this.getSimHour();
    const ambientBase = hour >= 10 && hour <= 16 ? 38 : hour >= 6 && hour <= 20 ? 32 : 26;
    this.driftAnalog('AMBIENT_TEMP', ambientBase, 0.3, 20, 45);

    // ── 33kV Incoming ──
    const v33Base = 33.0 * (1 - loadFactor * 0.03); // slight sag under load
    this.setAnalog('INC_33KV_V_RY', this.jitter(v33Base, noiseScale));
    this.setAnalog('INC_33KV_V_YB', this.jitter(v33Base, noiseScale));
    this.setAnalog('INC_33KV_V_BR', this.jitter(v33Base, noiseScale));
    const i33Total = 140 * loadFactor;
    this.setAnalog('INC_33KV_I_R', this.jitter(i33Total, noiseScale));
    this.setAnalog('INC_33KV_I_Y', this.jitter(i33Total * 0.98, noiseScale));
    this.setAnalog('INC_33KV_I_B', this.jitter(i33Total * 1.01, noiseScale));

    // ── Transformers ──
    this.simulateTransformer('TR1', loadFactor, 6.0, noiseScale);
    this.simulateTransformer('TR2', loadFactor * 0.92, 5.5, noiseScale);

    // ── Feeders ──
    const feederLoads = [0.8, 0.9, 1.0, 0.6, 0.85, 0.95]; // relative load multipliers
    let totalLoad = 0;
    for (let f = 0; f < 6; f++) {
      const prefix = `FDR${String(f + 1).padStart(2, '0')}`;
      const fLoad = loadFactor * feederLoads[f];
      const baseP = 1.2 + f * 0.3;
      const p = baseP * fLoad;
      totalLoad += p;

      const v11 = 11.0 * (1 - fLoad * 0.02);
      this.setAnalog(`${prefix}_V`, this.jitter(v11, noiseScale * 0.5));
      this.setAnalog(`${prefix}_I_R`, this.jitter((120 + f * 15) * fLoad, noiseScale));
      this.setAnalog(`${prefix}_I_Y`, this.jitter((118 + f * 15) * fLoad, noiseScale));
      this.setAnalog(`${prefix}_I_B`, this.jitter((122 + f * 15) * fLoad, noiseScale));
      this.setAnalog(`${prefix}_P`, this.jitter(p, noiseScale));
      this.setAnalog(`${prefix}_Q`, this.jitter(p * 0.32, noiseScale));
      const pf = 0.90 + Math.random() * 0.08;
      this.setAnalog(`${prefix}_PF`, Math.min(0.99, Math.max(0.85, pf)));

      // Energy accumulator
      const prevKwh = this.analogValues.get(`${prefix}_KWH`) ?? 50000;
      this.setAnalog(`${prefix}_KWH`, prevKwh + p * (1 / 3600)); // 1 second = 1/3600 hour
    }

    // System totals
    this.setAnalog('SYS_TOTAL_LOAD', this.jitter(totalLoad, 0.005));
    this.setAnalog('SYS_TOTAL_PF', Math.min(0.99, Math.max(0.85, 0.93 + Math.random() * 0.05)));

    // 11kV Bus
    this.setAnalog('BUS_11KV_V', this.jitter(11.0 * (1 - loadFactor * 0.015), noiseScale * 0.3));

    // Capacitor bank
    this.setAnalog('CAP_BANK_KVAR', this.jitter(600, 0.01));

    // Energy accumulators
    const todayKwh = (this.energyCounters.get('today') ?? 0) + totalLoad * (1000 / 3600);
    this.energyCounters.set('today', todayKwh);
    this.setAnalog('ENERGY_TODAY_KWH', Math.round(todayKwh));

    const monthKwh = (this.energyCounters.get('month') ?? 450000) + totalLoad * (1000 / 3600);
    this.energyCounters.set('month', monthKwh);
    this.setAnalog('ENERGY_MONTH_KWH', Math.round(monthKwh));

    const peakDemand = this.energyCounters.get('peakDemand') ?? 0;
    if (totalLoad > peakDemand) {
      this.energyCounters.set('peakDemand', totalLoad);
      this.setAnalog('PEAK_DEMAND_MW', totalLoad);
    }
  }

  private simulateTransformer(prefix: string, loadFactor: number, basePower: number, noise: number): void {
    const power = basePower * loadFactor;
    const v33 = this.analogValues.get('INC_33KV_V_RY') ?? 33.0;
    this.setAnalog(`${prefix}_V_HV`, this.jitter(v33, noise * 0.5));
    this.setAnalog(`${prefix}_V_LV`, this.jitter(11.0 * (1 - loadFactor * 0.02), noise * 0.5));
    this.setAnalog(`${prefix}_I_HV`, this.jitter(power / (v33 * Math.sqrt(3)) * 1000, noise));
    this.setAnalog(`${prefix}_I_LV`, this.jitter(power / (11.0 * Math.sqrt(3)) * 1000, noise));
    this.setAnalog(`${prefix}_P_3PH`, this.jitter(power, noise));
    this.setAnalog(`${prefix}_Q_3PH`, this.jitter(power * 0.33, noise));
    const pf = 0.92 + Math.random() * 0.06;
    this.setAnalog(`${prefix}_PF`, Math.min(0.99, Math.max(0.85, pf)));

    // Temperature rises with load, slow thermal inertia
    const ambientTemp = this.analogValues.get('AMBIENT_TEMP') ?? 32;
    const oilTempTarget = ambientTemp + 20 * loadFactor + 5;
    this.driftAnalog(`${prefix}_OIL_TEMP`, oilTempTarget, 0.1, 35, 85);
    const wdgTempTarget = (this.analogValues.get(`${prefix}_OIL_TEMP`) ?? 55) + 10 * loadFactor;
    this.driftAnalog(`${prefix}_WDG_TEMP`, wdgTempTarget, 0.08, 40, 95);

    // Oil level — very slow drift
    this.driftAnalog(`${prefix}_OIL_LEVEL`, 92 + Math.random() * 2, 0.02, 80, 100);

    // Tap position — stays unless load causes voltage issue
    const currentTap = this.analogValues.get(`${prefix}_TAP_POS`) ?? 5;
    this.setAnalog(`${prefix}_TAP_POS`, currentTap);
  }

  // ───────────────────────── Time-of-day load profile ─────────────────────────

  private getSimHour(): number {
    // Use real clock for time-of-day profile
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }

  private getLoadFactor(): number {
    const hour = this.getSimHour();
    // MSEDCL typical load curve:
    // Low: 0-5 AM (0.3-0.4)
    // Rising: 5-10 AM (0.4-0.85)
    // Peak 1: 10-14 (0.85-1.0)
    // Dip: 14-17 (0.7-0.8)
    // Peak 2: 18-22 (0.85-1.0)
    // Falling: 22-24 (0.5-0.3)
    if (hour < 5) return 0.3 + Math.random() * 0.1;
    if (hour < 10) return 0.4 + (hour - 5) * 0.09 + Math.random() * 0.05;
    if (hour < 14) return 0.85 + Math.sin((hour - 10) * Math.PI / 4) * 0.15 + Math.random() * 0.05;
    if (hour < 17) return 0.7 + Math.random() * 0.1;
    if (hour < 22) return 0.85 + Math.sin((hour - 17) * Math.PI / 5) * 0.15 + Math.random() * 0.05;
    return 0.5 - (hour - 22) * 0.1 + Math.random() * 0.05;
  }

  // ───────────────────────── Random events ─────────────────────────

  private scheduleRandomEvent(): void {
    const delay = 30_000 + Math.random() * 90_000; // 30-120 seconds
    this.eventHandle = setTimeout(() => {
      this.triggerRandomEvent();
      this.scheduleRandomEvent();
    }, delay);
  }

  private triggerRandomEvent(): void {
    const roll = Math.random();

    if (roll < 0.25) {
      // Voltage dip (2-5%) on a random feeder for 5-15 seconds
      const fIdx = Math.floor(Math.random() * 6) + 1;
      const prefix = `FDR${String(fIdx).padStart(2, '0')}`;
      const currentV = this.analogValues.get(`${prefix}_V`) ?? 11.0;
      const dipFactor = 0.95 + Math.random() * 0.03;
      this.setAnalog(`${prefix}_V`, currentV * dipFactor);
      console.log(`[Simulator Event] Voltage dip on ${prefix}: ${(currentV * dipFactor).toFixed(2)} kV`);
    } else if (roll < 0.40) {
      // CB trip on a feeder (auto-reclose after 10s)
      const fIdx = Math.floor(Math.random() * 6) + 1;
      const tag = `FDR${String(fIdx).padStart(2, '0')}_CB`;
      if (this.digitalValues.get(tag)) {
        this.digitalValues.set(tag, false);
        this.emitChange(tag, false);
        console.log(`[Simulator Event] CB TRIP: ${tag}`);
        // Auto reclose after 10 seconds
        setTimeout(() => {
          this.digitalValues.set(tag, true);
          this.emitChange(tag, true);
          console.log(`[Simulator Event] CB AUTO-RECLOSE: ${tag}`);
        }, 10_000);
      }
    } else if (roll < 0.55) {
      // Overload on a feeder — 120% for 20 seconds
      const fIdx = Math.floor(Math.random() * 6) + 1;
      const prefix = `FDR${String(fIdx).padStart(2, '0')}`;
      const baseI = 120 + (fIdx - 1) * 15;
      this.setAnalog(`${prefix}_I_R`, baseI * 1.2);
      this.setAnalog(`${prefix}_I_Y`, baseI * 1.18);
      this.setAnalog(`${prefix}_I_B`, baseI * 1.22);
      console.log(`[Simulator Event] Overload on ${prefix}`);
    } else if (roll < 0.65) {
      // Tap changer operation
      const tr = Math.random() < 0.5 ? 'TR1' : 'TR2';
      const currentTap = this.analogValues.get(`${tr}_TAP_POS`) ?? 5;
      const newTap = Math.max(1, Math.min(9, currentTap + (Math.random() < 0.5 ? 1 : -1)));
      this.setAnalog(`${tr}_TAP_POS`, newTap);
      console.log(`[Simulator Event] ${tr} tap change: ${currentTap} → ${newTap}`);
    } else if (roll < 0.75) {
      // Frequency excursion
      const freq = 50.0 + (Math.random() - 0.5) * 0.6;
      this.setAnalog('SYS_FREQ', freq);
      console.log(`[Simulator Event] Frequency excursion: ${freq.toFixed(2)} Hz`);
    }
    // else: no event (quiet period)
  }

  // ───────────────────────── Helpers ─────────────────────────

  private setAnalog(tag: string, value: number): void {
    this.analogValues.set(tag, value);
    const def = this.tagDefinitions.find((d) => d.tag === tag);
    this.emitChange(tag, value, def?.unit);
  }

  private driftAnalog(tag: string, target: number, rate: number, min: number, max: number): void {
    const current = this.analogValues.get(tag) ?? target;
    const diff = target - current;
    const newVal = Math.min(max, Math.max(min, current + diff * rate + (Math.random() - 0.5) * rate * 2));
    this.setAnalog(tag, newVal);
  }

  private jitter(value: number, scale: number): number {
    return value * (1 + (Math.random() - 0.5) * 2 * scale);
  }

  private emitChange(tag: string, value: number | boolean, unit?: string): void {
    if (this.onValueChange) {
      this.onValueChange(tag, value, unit);
    }
  }

  private notifyStatusChange(connected: boolean): void {
    this.statusCallbacks.forEach((cb) => cb(connected));
  }
}
