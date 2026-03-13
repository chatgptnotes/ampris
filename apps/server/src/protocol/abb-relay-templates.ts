/**
 * ABB Relay Modbus Register Templates
 *
 * Known register maps for ABB protection relays used in 220kV/132kV substations.
 * Register addresses come from ABB Technical Reference Manuals (TRMs).
 * ABB relays use BIG_ENDIAN byte order and FLOAT32 for measurements.
 */

export interface RegisterDefinition {
  address: number;
  name: string;
  description: string;
  dataType: 'UINT16' | 'INT16' | 'FLOAT32' | 'UINT32' | 'INT32' | 'BIT';
  unit?: string;
  scaleFactor?: number;
  bitIndex?: number;
  category: 'measurement' | 'protection' | 'status' | 'identification' | 'energy';
}

export interface RelayTemplate {
  model: string;
  manufacturer: string;
  series: string;
  description: string;
  defaultPort: number;
  defaultSlaveId: number;
  registers: RegisterDefinition[];
}

// ─── REL670 (Line Distance Protection) ──────────────

const REL670_REGISTERS: RegisterDefinition[] = [
  // Measurements — MMXU (3-phase measurements)
  { address: 2000, name: 'PhV_phsA', description: 'Phase A Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2002, name: 'PhV_phsB', description: 'Phase B Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2004, name: 'PhV_phsC', description: 'Phase C Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2006, name: 'PhV_neut', description: 'Residual Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2008, name: 'A_phsA', description: 'Phase A Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2010, name: 'A_phsB', description: 'Phase B Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2012, name: 'A_phsC', description: 'Phase C Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2014, name: 'A_neut', description: 'Residual Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2016, name: 'W_phsA', description: 'Phase A Active Power', dataType: 'FLOAT32', unit: 'MW', category: 'measurement' },
  { address: 2018, name: 'W_phsB', description: 'Phase B Active Power', dataType: 'FLOAT32', unit: 'MW', category: 'measurement' },
  { address: 2020, name: 'W_phsC', description: 'Phase C Active Power', dataType: 'FLOAT32', unit: 'MW', category: 'measurement' },
  { address: 2022, name: 'W_net', description: 'Total Active Power', dataType: 'FLOAT32', unit: 'MW', category: 'measurement' },
  { address: 2024, name: 'VAr_phsA', description: 'Phase A Reactive Power', dataType: 'FLOAT32', unit: 'MVAr', category: 'measurement' },
  { address: 2026, name: 'VAr_phsB', description: 'Phase B Reactive Power', dataType: 'FLOAT32', unit: 'MVAr', category: 'measurement' },
  { address: 2028, name: 'VAr_phsC', description: 'Phase C Reactive Power', dataType: 'FLOAT32', unit: 'MVAr', category: 'measurement' },
  { address: 2030, name: 'VAr_net', description: 'Total Reactive Power', dataType: 'FLOAT32', unit: 'MVAr', category: 'measurement' },
  { address: 2032, name: 'Hz', description: 'Frequency', dataType: 'FLOAT32', unit: 'Hz', category: 'measurement' },
  { address: 2034, name: 'PF', description: 'Power Factor', dataType: 'FLOAT32', unit: '', category: 'measurement' },
  { address: 2036, name: 'VA_net', description: 'Total Apparent Power', dataType: 'FLOAT32', unit: 'MVA', category: 'measurement' },
  { address: 2038, name: 'PPV_phsAB', description: 'Phase AB Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2040, name: 'PPV_phsBC', description: 'Phase BC Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2042, name: 'PPV_phsCA', description: 'Phase CA Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },

  // Protection status
  { address: 3000, name: 'PTRC_Tr_general', description: 'General Trip', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3000, name: 'PTRC_Tr_phsA', description: 'Phase A Trip', dataType: 'BIT', bitIndex: 1, category: 'protection' },
  { address: 3000, name: 'PTRC_Tr_phsB', description: 'Phase B Trip', dataType: 'BIT', bitIndex: 2, category: 'protection' },
  { address: 3000, name: 'PTRC_Tr_phsC', description: 'Phase C Trip', dataType: 'BIT', bitIndex: 3, category: 'protection' },
  { address: 3001, name: 'PDIS_Z1_Op', description: 'Zone 1 Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3001, name: 'PDIS_Z2_Op', description: 'Zone 2 Operate', dataType: 'BIT', bitIndex: 1, category: 'protection' },
  { address: 3001, name: 'PDIS_Z3_Op', description: 'Zone 3 Operate', dataType: 'BIT', bitIndex: 2, category: 'protection' },
  { address: 3002, name: 'RREC_AutoRecl', description: 'Auto-Reclose Active', dataType: 'BIT', bitIndex: 0, category: 'protection' },

  // CB Status
  { address: 3010, name: 'XCBR_Pos', description: 'Circuit Breaker Position', dataType: 'UINT16', category: 'status' },
  { address: 3011, name: 'XCBR_OpCnt', description: 'CB Operation Counter', dataType: 'UINT32', category: 'status' },

  // Energy
  { address: 4000, name: 'TotWh_Imp', description: 'Import Active Energy', dataType: 'FLOAT32', unit: 'MWh', category: 'energy' },
  { address: 4002, name: 'TotWh_Exp', description: 'Export Active Energy', dataType: 'FLOAT32', unit: 'MWh', category: 'energy' },
  { address: 4004, name: 'TotVArh_Imp', description: 'Import Reactive Energy', dataType: 'FLOAT32', unit: 'MVArh', category: 'energy' },
  { address: 4006, name: 'TotVArh_Exp', description: 'Export Reactive Energy', dataType: 'FLOAT32', unit: 'MVArh', category: 'energy' },
];

// ─── RET670 (Transformer Protection) ────────────────

const RET670_REGISTERS: RegisterDefinition[] = [
  // HV Side Measurements
  { address: 2000, name: 'HV_PhV_phsA', description: 'HV Phase A Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2002, name: 'HV_PhV_phsB', description: 'HV Phase B Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2004, name: 'HV_PhV_phsC', description: 'HV Phase C Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2006, name: 'HV_A_phsA', description: 'HV Phase A Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2008, name: 'HV_A_phsB', description: 'HV Phase B Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2010, name: 'HV_A_phsC', description: 'HV Phase C Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  // LV Side Measurements
  { address: 2012, name: 'LV_PhV_phsA', description: 'LV Phase A Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2014, name: 'LV_PhV_phsB', description: 'LV Phase B Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2016, name: 'LV_PhV_phsC', description: 'LV Phase C Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2018, name: 'LV_A_phsA', description: 'LV Phase A Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2020, name: 'LV_A_phsB', description: 'LV Phase B Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2022, name: 'LV_A_phsC', description: 'LV Phase C Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  // Transformer measurements
  { address: 2024, name: 'W_net', description: 'Total Active Power', dataType: 'FLOAT32', unit: 'MW', category: 'measurement' },
  { address: 2026, name: 'VAr_net', description: 'Total Reactive Power', dataType: 'FLOAT32', unit: 'MVAr', category: 'measurement' },
  { address: 2028, name: 'Hz', description: 'Frequency', dataType: 'FLOAT32', unit: 'Hz', category: 'measurement' },
  { address: 2030, name: 'PF', description: 'Power Factor', dataType: 'FLOAT32', unit: '', category: 'measurement' },
  // Differential protection
  { address: 3000, name: 'PDIF_Op', description: 'Differential Protection Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3000, name: 'PDIF_Blk', description: 'Differential Protection Blocked', dataType: 'BIT', bitIndex: 1, category: 'protection' },
  { address: 3001, name: 'PTRC_Tr_general', description: 'General Trip', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  // REF protection
  { address: 3002, name: 'REF_HV_Op', description: 'HV REF Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3002, name: 'REF_LV_Op', description: 'LV REF Operate', dataType: 'BIT', bitIndex: 1, category: 'protection' },
  // Overcurrent
  { address: 3003, name: 'PTOC_I_Op', description: 'Overcurrent Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  // CB Status
  { address: 3010, name: 'XCBR_HV_Pos', description: 'HV CB Position', dataType: 'UINT16', category: 'status' },
  { address: 3011, name: 'XCBR_LV_Pos', description: 'LV CB Position', dataType: 'UINT16', category: 'status' },
  // Energy
  { address: 4000, name: 'TotWh', description: 'Total Active Energy', dataType: 'FLOAT32', unit: 'MWh', category: 'energy' },
  { address: 4002, name: 'TotVArh', description: 'Total Reactive Energy', dataType: 'FLOAT32', unit: 'MVArh', category: 'energy' },
];

// ─── REF615 / REF630 (Feeder Protection) ────────────

const REF615_REGISTERS: RegisterDefinition[] = [
  // Measurements
  { address: 2000, name: 'PhV_phsA', description: 'Phase A Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2002, name: 'PhV_phsB', description: 'Phase B Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2004, name: 'PhV_phsC', description: 'Phase C Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2006, name: 'A_phsA', description: 'Phase A Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2008, name: 'A_phsB', description: 'Phase B Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2010, name: 'A_phsC', description: 'Phase C Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2012, name: 'A_neut', description: 'Residual Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2014, name: 'W_net', description: 'Total Active Power', dataType: 'FLOAT32', unit: 'MW', category: 'measurement' },
  { address: 2016, name: 'VAr_net', description: 'Total Reactive Power', dataType: 'FLOAT32', unit: 'MVAr', category: 'measurement' },
  { address: 2018, name: 'Hz', description: 'Frequency', dataType: 'FLOAT32', unit: 'Hz', category: 'measurement' },
  { address: 2020, name: 'PF', description: 'Power Factor', dataType: 'FLOAT32', unit: '', category: 'measurement' },
  // Protection
  { address: 3000, name: 'PTOC_51_Op', description: 'IDMT Overcurrent Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3000, name: 'PTOC_50_Op', description: 'Instantaneous OC Operate', dataType: 'BIT', bitIndex: 1, category: 'protection' },
  { address: 3001, name: 'PTOC_51N_Op', description: 'Earth Fault Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3001, name: 'PTOC_50N_Op', description: 'Inst. Earth Fault Operate', dataType: 'BIT', bitIndex: 1, category: 'protection' },
  { address: 3002, name: 'PTRC_Tr_general', description: 'General Trip', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  // CB
  { address: 3010, name: 'XCBR_Pos', description: 'Circuit Breaker Position', dataType: 'UINT16', category: 'status' },
  // Energy
  { address: 4000, name: 'TotWh_Imp', description: 'Import Active Energy', dataType: 'FLOAT32', unit: 'MWh', category: 'energy' },
  { address: 4002, name: 'TotVArh_Imp', description: 'Import Reactive Energy', dataType: 'FLOAT32', unit: 'MVArh', category: 'energy' },
];

// ─── REB670 (Busbar Protection) ─────────────────────

const REB670_REGISTERS: RegisterDefinition[] = [
  // Busbar zone measurements
  { address: 2000, name: 'Zone1_A_phsA', description: 'Zone 1 Phase A Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2002, name: 'Zone1_A_phsB', description: 'Zone 1 Phase B Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2004, name: 'Zone1_A_phsC', description: 'Zone 1 Phase C Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2006, name: 'Zone2_A_phsA', description: 'Zone 2 Phase A Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2008, name: 'Zone2_A_phsB', description: 'Zone 2 Phase B Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2010, name: 'Zone2_A_phsC', description: 'Zone 2 Phase C Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2012, name: 'PhV_phsA', description: 'Phase A Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2014, name: 'PhV_phsB', description: 'Phase B Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2016, name: 'PhV_phsC', description: 'Phase C Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2018, name: 'Hz', description: 'Frequency', dataType: 'FLOAT32', unit: 'Hz', category: 'measurement' },
  // Protection
  { address: 3000, name: 'PDIF_Zone1_Op', description: 'Zone 1 Differential Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3000, name: 'PDIF_Zone2_Op', description: 'Zone 2 Differential Operate', dataType: 'BIT', bitIndex: 1, category: 'protection' },
  { address: 3001, name: 'PTRC_Tr_general', description: 'General Trip', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3002, name: 'RBRF_Op', description: 'Breaker Failure Operate', dataType: 'BIT', bitIndex: 0, category: 'protection' },
];

// ─── Generic ABB 600 Series ─────────────────────────

const ABB_600_GENERIC_REGISTERS: RegisterDefinition[] = [
  // Common measurement registers for 615/620/630 series
  { address: 2000, name: 'PhV_phsA', description: 'Phase A Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2002, name: 'PhV_phsB', description: 'Phase B Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2004, name: 'PhV_phsC', description: 'Phase C Voltage', dataType: 'FLOAT32', unit: 'kV', category: 'measurement' },
  { address: 2006, name: 'A_phsA', description: 'Phase A Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2008, name: 'A_phsB', description: 'Phase B Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2010, name: 'A_phsC', description: 'Phase C Current', dataType: 'FLOAT32', unit: 'A', category: 'measurement' },
  { address: 2012, name: 'W_net', description: 'Total Active Power', dataType: 'FLOAT32', unit: 'MW', category: 'measurement' },
  { address: 2014, name: 'VAr_net', description: 'Total Reactive Power', dataType: 'FLOAT32', unit: 'MVAr', category: 'measurement' },
  { address: 2016, name: 'Hz', description: 'Frequency', dataType: 'FLOAT32', unit: 'Hz', category: 'measurement' },
  { address: 2018, name: 'PF', description: 'Power Factor', dataType: 'FLOAT32', unit: '', category: 'measurement' },
  { address: 3000, name: 'PTRC_Tr_general', description: 'General Trip', dataType: 'BIT', bitIndex: 0, category: 'protection' },
  { address: 3010, name: 'XCBR_Pos', description: 'Circuit Breaker Position', dataType: 'UINT16', category: 'status' },
];

// ─── Template Registry ──────────────────────────────

export const ABB_RELAY_TEMPLATES: RelayTemplate[] = [
  {
    model: 'REL670',
    manufacturer: 'ABB',
    series: '670',
    description: 'Line Distance Protection Relay (220kV/132kV)',
    defaultPort: 502,
    defaultSlaveId: 1,
    registers: REL670_REGISTERS,
  },
  {
    model: 'RET670',
    manufacturer: 'ABB',
    series: '670',
    description: 'Transformer Differential Protection Relay',
    defaultPort: 502,
    defaultSlaveId: 1,
    registers: RET670_REGISTERS,
  },
  {
    model: 'REF615',
    manufacturer: 'ABB',
    series: '615',
    description: 'Feeder Protection Relay',
    defaultPort: 502,
    defaultSlaveId: 1,
    registers: REF615_REGISTERS,
  },
  {
    model: 'REF630',
    manufacturer: 'ABB',
    series: '630',
    description: 'Feeder Protection Relay (Advanced)',
    defaultPort: 502,
    defaultSlaveId: 1,
    registers: REF615_REGISTERS, // Same register map as REF615
  },
  {
    model: 'REB670',
    manufacturer: 'ABB',
    series: '670',
    description: 'Busbar Protection Relay',
    defaultPort: 502,
    defaultSlaveId: 1,
    registers: REB670_REGISTERS,
  },
  {
    model: 'ABB 600 Generic',
    manufacturer: 'ABB',
    series: '600',
    description: 'Generic ABB 600 Series Relay',
    defaultPort: 502,
    defaultSlaveId: 1,
    registers: ABB_600_GENERIC_REGISTERS,
  },
];

/**
 * Get all register ranges that should be scanned during auto-detect.
 * Returns unique address ranges covering all known measurement registers.
 */
export function getAutoScanRanges(): Array<{ start: number; count: number; description: string }> {
  return [
    { start: 2000, count: 44, description: 'Measurement registers (V, I, P, Q, Hz, PF)' },
    { start: 3000, count: 14, description: 'Protection status & CB position' },
    { start: 4000, count: 8, description: 'Energy registers' },
    // Additional common ABB ranges
    { start: 1000, count: 20, description: 'Device identification' },
    { start: 100, count: 20, description: 'System configuration' },
  ];
}

/**
 * Try to identify which template matches based on register responses.
 * Returns the best matching template or null.
 */
export function identifyRelayModel(
  validRanges: Array<{ start: number; count: number }>,
): RelayTemplate | null {
  // Simple heuristic: match by which register ranges returned valid data
  let bestMatch: RelayTemplate | null = null;
  let bestScore = 0;

  for (const template of ABB_RELAY_TEMPLATES) {
    let score = 0;
    for (const range of validRanges) {
      const matchingRegs = template.registers.filter(
        r => r.address >= range.start && r.address < range.start + range.count
      );
      score += matchingRegs.length;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = template;
    }
  }

  return bestMatch;
}

export function getTemplateByModel(model: string): RelayTemplate | undefined {
  return ABB_RELAY_TEMPLATES.find(t => t.model.toLowerCase() === model.toLowerCase());
}
