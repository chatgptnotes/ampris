// ⚠️ SKILL FILE REQUIRED — READ BEFORE MODIFYING THIS FILE
// ~/.openclaw/workspace/skills/gridvision-sld-ai/SKILL.md
//
// Critical rules enforced here:
// 1. normalizeType() → converts AI type strings to exact SYMBOL_MAP PascalCase keys
// 2. BusBar: TYPE_MAP must have w:500, h:20 (never w:0, h:10)
// 3. Transformer is MANDATORY in substation SLDs — enforced via AI prompt
// 4. All known bugs: BUG-010 to BUG-014 in skills/gridvision/references/known-bugs.md

import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import * as https from 'https';
import { env } from '../config/environment';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const CLAUDE_MODEL      = 'claude-opus-4-6';

// SYMBOL_MAP must exactly match the frontend MimicEditor SYMBOL_MAP keys
const TYPE_MAP: Record<string, { type: string; w: number; h: number }> = {
  // Switchgear
  CB:                    { type: 'CB',               w: 40, h: 40 },
  CIRCUIT_BREAKER:       { type: 'CB',               w: 40, h: 40 },
  VCB:                   { type: 'VacuumCB',         w: 40, h: 40 },
  VACUUM_CB:             { type: 'VacuumCB',         w: 40, h: 40 },
  VACUUMCB:              { type: 'VacuumCB',         w: 40, h: 40 },
  SF6CB:                 { type: 'SF6CB',            w: 40, h: 40 },
  SF6_CB:                { type: 'SF6CB',            w: 40, h: 40 },
  ACB:                   { type: 'ACB',              w: 40, h: 40 },
  MCCB:                  { type: 'MCCB',             w: 35, h: 35 },
  MCB:                   { type: 'MCB',              w: 30, h: 35 },
  RCCB:                  { type: 'RCCB',             w: 35, h: 35 },
  ISOLATOR:              { type: 'Isolator',         w: 40, h: 25 },
  DISCONNECTOR:          { type: 'Isolator',         w: 40, h: 25 },
  EARTH_SWITCH:          { type: 'EarthSwitch',      w: 30, h: 30 },
  LOAD_BREAK_SWITCH:     { type: 'LoadBreakSwitch',  w: 40, h: 30 },
  LBS:                   { type: 'LoadBreakSwitch',  w: 40, h: 30 },
  AUTO_RECLOSER:         { type: 'AutoRecloser',     w: 40, h: 45 },
  RING_MAIN_UNIT:        { type: 'RingMainUnit',     w: 60, h: 60 },
  RMU:                   { type: 'RingMainUnit',     w: 60, h: 60 },
  GIS:                   { type: 'GIS',              w: 60, h: 60 },
  FUSE:                  { type: 'Fuse',             w: 30, h: 40 },
  CONTACTOR:             { type: 'Contactor',        w: 35, h: 35 },
  // Transformers
  POWER_TRANSFORMER:     { type: 'Transformer',      w: 70, h: 90 },
  TRANSFORMER:           { type: 'Transformer',      w: 70, h: 90 },
  AUTO_TRANSFORMER:      { type: 'AutoTransformer',  w: 70, h: 90 },
  INSTRUMENT_TRANSFORMER:{ type: 'InstrumentTransformer', w: 50, h: 60 },
  STEP_VOLTAGE_REGULATOR:{ type: 'StepVoltageRegulator',  w: 60, h: 80 },
  // Busbars & Lines
  BUS_BAR:               { type: 'BusBar',           w: 500, h: 20 },
  BUSBAR:                { type: 'BusBar',           w: 500, h: 20 },
  DOUBLE_BUSBAR:         { type: 'DoubleBusBar',     w: 500, h: 30 },
  BUS_SECTION:           { type: 'BusSection',       w: 40, h: 25 },
  CABLE:                 { type: 'Cable',            w: 80, h: 8  },
  OVERHEAD_LINE:         { type: 'OverheadLine',     w: 80, h: 20 },
  UNDERGROUND_CABLE:     { type: 'UndergroundCable', w: 80, h: 12 },
  // Measurement
  CT:                    { type: 'CT',               w: 35, h: 25 },
  CURRENT_TRANSFORMER:   { type: 'CT',               w: 35, h: 25 },
  PT:                    { type: 'PT',               w: 35, h: 25 },
  POTENTIAL_TRANSFORMER: { type: 'PT',               w: 35, h: 25 },
  VT:                    { type: 'PT',               w: 35, h: 25 },
  METER:                 { type: 'Meter',            w: 40, h: 40 },
  ENERGY_METER:          { type: 'EnergyMeter',      w: 40, h: 40 },
  // Protection
  LIGHTNING_ARRESTER:    { type: 'LightningArrester',w: 30, h: 50 },
  SURGE_ARRESTER:        { type: 'LightningArrester',w: 30, h: 50 },
  LA:                    { type: 'LightningArrester',w: 30, h: 50 },
  RELAY:                 { type: 'Relay',            w: 40, h: 40 },
  OVERCURRENT_RELAY:     { type: 'OvercurrentRelay', w: 40, h: 40 },
  EARTH_FAULT_RELAY:     { type: 'EarthFaultRelay',  w: 40, h: 40 },
  DIFFERENTIAL_RELAY:    { type: 'DifferentialRelay',w: 40, h: 40 },
  DISTANCE_RELAY:        { type: 'DistanceRelay',    w: 40, h: 40 },
  // Loads
  FEEDER:                { type: 'Feeder',           w: 40, h: 60 },
  LOAD:                  { type: 'GenericLoad',      w: 50, h: 50 },
  GENERIC_LOAD:          { type: 'GenericLoad',      w: 50, h: 50 },
  RESISTIVE_LOAD:        { type: 'ResistiveLoad',    w: 50, h: 50 },
  INDUCTIVE_LOAD:        { type: 'InductiveLoad',    w: 50, h: 50 },
  MOTOR:                 { type: 'Motor',            w: 50, h: 50 },
  GENERATOR:             { type: 'Generator',        w: 60, h: 60 },
  // Power Electronics
  CAPACITOR_BANK:        { type: 'CapacitorBank',    w: 50, h: 50 },
  SHUNT_REACTOR:         { type: 'ShuntReactor',     w: 50, h: 60 },
  VFD:                   { type: 'VFD',              w: 50, h: 50 },
  UPS:                   { type: 'UPSDetail',        w: 50, h: 60 },
  SOLAR_PANEL:           { type: 'SolarPanel',       w: 60, h: 40 },
  SOLAR_INVERTER:        { type: 'SolarInverter',    w: 50, h: 50 },
  BATTERY:               { type: 'Battery',          w: 40, h: 60 },
  WIND_TURBINE:          { type: 'WindTurbine',      w: 60, h: 80 },
  // Misc
  JUNCTION:              { type: 'Junction',         w: 10, h: 10 },
  GROUND:                { type: 'Ground',           w: 30, h: 30 },
  PANEL:                 { type: 'Panel',            w: 60, h: 70 },
  MCC:                   { type: 'MCC',              w: 60, h: 70 },
};

export function normalizeType(t: string): { type: string; w: number; h: number } {
  const u = (t || '').toUpperCase().replace(/[-\s.]/g, '_');
  if (TYPE_MAP[u]) return { ...TYPE_MAP[u] };
  // Fuzzy matching — order matters (more specific first)
  if (u.includes('VACUUM') || u === 'VCB')                          return { ...TYPE_MAP.VACUUM_CB };
  if (u.includes('SF6'))                                             return { ...TYPE_MAP.SF6_CB };
  if (u === 'ACB' || u.includes('AIR_CIRCUIT'))                     return { ...TYPE_MAP.ACB };
  if (u.includes('MCCB'))                                           return { ...TYPE_MAP.MCCB };
  if (u.includes('RCCB'))                                           return { ...TYPE_MAP.RCCB };
  if (u === 'MCB' || u.includes('MINIATURE'))                       return { ...TYPE_MAP.MCB };
  if (u.includes('BREAKER') || u.includes('_CB') || u.endsWith('CB')) return { ...TYPE_MAP.CB };
  if (u.includes('AUTO_TRANSF') || u.includes('AUTOTRANSF'))        return { ...TYPE_MAP.AUTO_TRANSFORMER };
  if (u.includes('TRANSFORM') || u.includes('XFMR') || u.includes('MVA') || u.includes('KVA')) return { ...TYPE_MAP.POWER_TRANSFORMER };
  if (u.includes('DOUBLE_BUS'))                                     return { ...TYPE_MAP.DOUBLE_BUSBAR };
  if (u.includes('BUS_SECTION'))                                    return { ...TYPE_MAP.BUS_SECTION };
  if (u.includes('BUS'))                                            return { ...TYPE_MAP.BUS_BAR };
  if (u.includes('EARTH') || u.includes('GROUND_SW'))               return { ...TYPE_MAP.EARTH_SWITCH };
  if (u.includes('LIGHTNING') || u.includes('SURGE') || u.includes('ARRESTER')) return { ...TYPE_MAP.LIGHTNING_ARRESTER };
  if (u === 'LA')                                                    return { ...TYPE_MAP.LA };
  if (u.includes('ISOLAT') || u.includes('DISCONN') || u.includes('DISCONNECT')) return { ...TYPE_MAP.ISOLATOR };
  if (u.includes('RMU') || u.includes('RING_MAIN'))                 return { ...TYPE_MAP.RMU };
  if (u.includes('AUTO_RECLOS'))                                    return { ...TYPE_MAP.AUTO_RECLOSER };
  if (u.includes('LOAD_BREAK') || u === 'LBS')                      return { ...TYPE_MAP.LBS };
  if (u.includes('CONTACTOR'))                                      return { ...TYPE_MAP.CONTACTOR };
  if (u.includes('FUSE'))                                           return { ...TYPE_MAP.FUSE };
  if (u.includes('UNDERGROUND') || u.includes('UG_CABLE'))          return { ...TYPE_MAP.UNDERGROUND_CABLE };
  if (u.includes('OVERHEAD') || u.includes('OHL'))                  return { ...TYPE_MAP.OVERHEAD_LINE };
  if (u.includes('CABLE'))                                          return { ...TYPE_MAP.CABLE };
  if (u.includes('CURRENT_T') || u === 'CT')                        return { ...TYPE_MAP.CT };
  if (u.includes('POTENTIAL_T') || u.includes('VOLTAGE_T') || u === 'VT' || u === 'PT') return { ...TYPE_MAP.PT };
  if (u.includes('ENERGY_METER'))                                   return { ...TYPE_MAP.ENERGY_METER };
  if (u.includes('METER'))                                          return { ...TYPE_MAP.METER };
  if (u.includes('OVERCURRENT_R') || u.includes('OC_RELAY'))        return { ...TYPE_MAP.OVERCURRENT_RELAY };
  if (u.includes('EARTH_FAULT') || u.includes('EF_RELAY'))          return { ...TYPE_MAP.EARTH_FAULT_RELAY };
  if (u.includes('DIFF_RELAY') || u.includes('DIFFERENTIAL'))       return { ...TYPE_MAP.DIFFERENTIAL_RELAY };
  if (u.includes('RELAY'))                                          return { ...TYPE_MAP.RELAY };
  if (u.includes('CAPACITOR'))                                      return { ...TYPE_MAP.CAPACITOR_BANK };
  if (u.includes('REACTOR'))                                        return { ...TYPE_MAP.SHUNT_REACTOR };
  if (u.includes('MOTOR'))                                          return { ...TYPE_MAP.MOTOR };
  if (u.includes('GENERATOR') || u.includes('GEN'))                 return { ...TYPE_MAP.GENERATOR };
  if (u.includes('SOLAR_PANEL') || u.includes('PV_PANEL'))          return { ...TYPE_MAP.SOLAR_PANEL };
  if (u.includes('INVERTER'))                                       return { ...TYPE_MAP.SOLAR_INVERTER };
  if (u.includes('BATTERY') || u.includes('BESS'))                  return { ...TYPE_MAP.BATTERY };
  if (u.includes('VFD') || u.includes('DRIVE'))                     return { ...TYPE_MAP.VFD };
  if (u.includes('MCC'))                                            return { ...TYPE_MAP.MCC };
  if (u.includes('PANEL'))                                          return { ...TYPE_MAP.PANEL };
  if (u.includes('LOAD'))                                           return { ...TYPE_MAP.LOAD };
  if (u.includes('FEEDER') || u.includes('OUTGOING') || u.includes('INCOMING')) return { ...TYPE_MAP.FEEDER };
  if (u.includes('GROUND') || u.includes('EARTH'))                  return { ...TYPE_MAP.GROUND };
  return { ...TYPE_MAP.FEEDER };
}

function claudeRequest(base64Image: string, mimeType: string, prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      temperature: 0.1,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64Image } },
          { type: 'text', text: prompt }
        ]
      }]
    });

    const req = https.request({
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      }
    }, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          const text = parsed.content?.[0]?.text || '';
          resolve(text);
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

export async function generateSLDFromImage(imageBuffer: Buffer, mimeType: string, instructions = '') {
  const base64Image = imageBuffer.toString('base64');

  // ── NEW APPROACH: Claude outputs TOPOLOGY ONLY (no coordinates) ──────────
  // The layout engine (sld-layout.service.ts) assigns ALL x,y,width,height,connections.
  // This eliminates all geometric mistakes from AI.

  const prompt = `You are an expert electrical engineer analyzing a Single Line Diagram (SLD).
Your ONLY job: extract the electrical TOPOLOGY — what components exist, their labels, and how they are organized.

DO NOT output x, y, width, height, level, column, or any coordinates. The layout engine handles all positioning.

⚠️ TYPE NAMES — use ONLY these exact PascalCase strings:
Switchgear: CB | VacuumCB | SF6CB | ACB | MCCB | MCB | RCCB | Fuse | Contactor | Isolator | EarthSwitch | LoadBreakSwitch | AutoRecloser | RingMainUnit | GIS
Transformers: Transformer | AutoTransformer | InstrumentTransformer | StepVoltageRegulator
Busbars: BusBar | DoubleBusBar | BusSection
Lines: OverheadLine | Cable | UndergroundCable
Measurement: CT | PT | Meter | EnergyMeter | Ammeter | Voltmeter
Protection: LightningArrester | Relay | OvercurrentRelay | EarthFaultRelay | DifferentialRelay | DistanceRelay | BuchholzRelay
Loads: Feeder | GenericLoad | ResistiveLoad | InductiveLoad | Motor | Generator | SolarPanel | SolarInverter | Battery | CapacitorBank
Misc: Panel | MCC | Ground | Junction

TYPE GUIDE:
vcb / vacuum breaker → VacuumCB | sf6 → SF6CB | general breaker → CB
busbar / bus → BusBar | ct → CT | pt / vt → PT | la / arrester → LightningArrester
isolator / disconnector → Isolator | earth switch → EarthSwitch
power transformer (MVA rated) → Transformer | load point → GenericLoad | outgoing feeder → Feeder
incoming line → OverheadLine or Cable

Return ONLY valid JSON:
{
  "name": "substation name from diagram",
  "topologyType": "single-busbar",
  "busbar": { "id": "bus1", "type": "BusBar", "label": "11kV Main Busbar", "voltage": 11 },
  "incomers": [
    {
      "id": "inc1",
      "label": "Incomer",
      "elements": [
        { "id": "la1",  "type": "LightningArrester", "label": "LA" },
        { "id": "iso1", "type": "Isolator",           "label": "89-I" },
        { "id": "vcb1", "type": "VacuumCB",           "label": "VCB-I" },
        { "id": "ct1",  "type": "CT",                 "label": "CT-I" }
      ]
    }
  ],
  "feeders": [
    {
      "id": "f1", "label": "Feeder-1",
      "elements": [
        { "id": "vcb_f1",  "type": "VacuumCB",    "label": "VCB-F1" },
        { "id": "ct_f1",   "type": "CT",           "label": "CT-F1" },
        { "id": "load_f1", "type": "GenericLoad",  "label": "Feeder-1" }
      ]
    }
  ],
  "transformers": [
    { "id": "tr1", "type": "Transformer", "label": "10MVA 33/11kV", "voltage": 33 }
  ]
}

RULES:
- incomers = chains above the busbar (source side): ordered top → bottom (topmost element first)
- feeders = chains below the busbar (load side): ordered top → bottom (busbar-side element first)
- transformers = separate elements connected to the busbar (not in chains)
- ALWAYS include the Transformer if the diagram has stepped voltages (33/11kV, 11/0.4kV etc.)
- ALWAYS include the busbar — it is the backbone of the diagram
- Each feeder is a SEPARATE object in the feeders array
- Each incomer is a SEPARATE object in the incomers array
- NEVER merge multiple feeders into one
- If diagram has 5 feeders → feeders array has 5 objects
${instructions ? `\nADDITIONAL INSTRUCTIONS:\n${instructions}` : ''}

Return ONLY the JSON object, no markdown.`;

  console.log(`[SLD] Calling Claude ${CLAUDE_MODEL} (topology mode)...`);
  const textContent = await claudeRequest(base64Image, mimeType, prompt);
  console.log('[SLD] Response length:', textContent.length);

  // Parse Claude's JSON response
  let jsonStr = textContent.trim()
    .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  const jMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jMatch) jsonStr = jMatch[0];

  let topo: any;
  try {
    topo = JSON.parse(jsonStr);
  } catch {
    const lastBrace = jsonStr.lastIndexOf('}');
    if (lastBrace > 0) {
      try { topo = JSON.parse(jsonStr.substring(0, lastBrace + 1)); }
      catch { throw new Error('Failed to parse topology JSON: ' + textContent.substring(0, 300)); }
    } else {
      throw new Error('Failed to parse topology JSON: ' + textContent.substring(0, 300));
    }
  }

  if (!topo.busbar && !topo.incomers && !topo.feeders) {
    throw new Error('No topology detected in diagram');
  }

  // Ensure arrays exist
  topo.incomers     = topo.incomers     || [];
  topo.feeders      = topo.feeders      || [];
  topo.transformers = topo.transformers || [];
  if (!topo.busbar) topo.busbar = { id: 'bus1', type: 'BusBar', label: 'Main Busbar', voltage: 11 };

  console.log(`[SLD] Topology: ${topo.incomers.length} incomers, ${topo.feeders.length} feeders, ${topo.transformers.length} transformers`);

  // ── Hand off to deterministic layout engine ─────────────────────────────
  const { layoutSubstation } = await import('./sld-layout.service');
  const { elements, connections } = layoutSubstation(topo);

  console.log(`[SLD] Layout done: ${elements.length} elements, ${connections.length} connections`);

  return {
    id: uuidv4(), substationId: uuidv4(),
    name: topo.name || 'AI Generated SLD',
    width: 1600, height: 900,
    elements, connections,
  };
}
