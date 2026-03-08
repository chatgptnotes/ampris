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
  // ALL load types default to GenericLoad — InductiveLoad / ResistiveLoad not used in generated SLDs
  if (u.includes('INDUCTIVE') || u.includes('RESISTIVE') || u.includes('LOAD')) return { ...TYPE_MAP.GENERIC_LOAD };
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
Loads: GenericLoad (use this for ALL load points — NEVER use InductiveLoad or ResistiveLoad)
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

⚠️ CRITICAL — FEEDER vs TRANSFORMER — DO NOT CONFUSE THESE:
- FEEDER = outgoing 11kV line from the busbar to a consumer/area. It ALWAYS uses: [VacuumCB, CT, GenericLoad or Feeder]. It NEVER uses Transformer.
- TRANSFORMER = power transformer that steps voltage (e.g. 33kV→11kV or 11kV→0.4kV). Goes in the "transformers" array, NOT in feeders.
- If you see 20 outgoing connections from the 11kV busbar, they are 20 FEEDERS — each with [VacuumCB, CT, GenericLoad]. NOT Transformers.
- The power transformer (33/11kV or 11/0.4kV) is ONE element in the "transformers" array.
- NEVER put a Transformer type element inside a feeder chain.
- A typical MSEDCL 11kV substation has: 1–2 incomers (OHL/Cable → Isolator → VCB → CT) + 10–20 feeders (VCB → CT → GenericLoad) + 1 Transformer (33/11kV) in transformers[].

⚠️ CRITICAL — FEEDER CHAIN STRUCTURE (ALWAYS follow this for every feeder):
Every feeder object MUST follow this element pattern:
  { "id": "vcb_fN", "type": "VacuumCB", "label": "VCB-FN" },
  { "id": "ct_fN",  "type": "CT",        "label": "CT-FN"  },
  { "id": "ld_fN",  "type": "GenericLoad","label": "Feeder Name" }
If a feeder has no VCB visible, still include one. NEVER output a feeder with only a Transformer element.
${instructions ? `\nADDITIONAL INSTRUCTIONS:\n${instructions}` : ''}
${/metering|cubicle|after.*meter|ignore.*33|skip.*33|ignore.*hv|skip.*hv|11kv.*only|only.*11kv/i.test(instructions)
  ? `\n⚠️ SCOPE RESTRICTION: Start the SLD from the 11kV busbar side only (after the metering cubicle / 11kV incomer).
- DO NOT include the 33kV side, 33/11kV power transformer, or anything upstream of the metering cubicle.
- The "incomers" array should begin from the first 11kV element AFTER the metering cubicle (e.g. VacuumCB or Isolator on 11kV side).
- Put only the 11kV busbar in "busbar". Put only the 11kV outgoing feeders in "feeders".
- The 33/11kV transformer goes NOWHERE in the output — omit it entirely.`
  : ''}

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

  // If Claude returned a pages[] structure instead of flat topology, extract from first page
  if (!topo.busbar && !topo.incomers && !topo.feeders && Array.isArray(topo.pages) && topo.pages.length > 0) {
    console.log('[SLD] Claude returned pages[] format in topology — flattening from page 1');
    const firstPage = topo.pages[0];
    topo.busbar       = firstPage.busbar       || topo.busbar;
    topo.incomers     = firstPage.incomers     || [];
    topo.feeders      = firstPage.feeders      || [];
    topo.transformers = firstPage.transformers || [];
    // Keep all feeders from all pages merged (layout will split them)
    for (let pi = 1; pi < topo.pages.length; pi++) {
      topo.feeders = topo.feeders.concat(topo.pages[pi].feeders || []);
    }
  }

  if (!topo.busbar && !topo.incomers && !topo.feeders) {
    console.error('[SLD] Top-level keys:', Object.keys(topo).join(', '), '| First 500 chars:', textContent.substring(0, 500));
    throw new Error('No topology detected in diagram');
  }

  // Ensure arrays exist
  topo.incomers     = topo.incomers     || [];
  topo.feeders      = topo.feeders      || [];
  topo.transformers = topo.transformers || [];
  if (!topo.busbar) topo.busbar = { id: 'bus1', type: 'BusBar', label: 'Main Busbar', voltage: 11 };

  // ── POST-PROCESSING: Fix feeder chains where Claude put Transformer instead of GenericLoad ──
  // A feeder chain that is a single Transformer element = Claude misidentified a feeder
  topo.feeders = topo.feeders.map((feeder: any) => {
    const els: any[] = feeder.elements || [];
    // Check if this feeder chain is ONLY Transformer elements (no VCB/CB/CT)
    const hasBreaker = els.some((e: any) => ['VacuumCB','SF6CB','CB','ACB','MCCB','LoadBreakSwitch'].includes(normalizeType(e.type || '').type));
    const allTransformers = els.length > 0 && els.every((e: any) => ['Transformer','AutoTransformer'].includes(normalizeType(e.type || '').type));
    if (allTransformers || (!hasBreaker && els.length <= 2)) {
      // This is a misidentified feeder — rebuild proper feeder chain
      const label = feeder.label || els[0]?.label || `Feeder-${feeder.id}`;
      const base  = feeder.id;
      console.log(`[SLD] Auto-correcting feeder "${label}" — was [${els.map((e:any)=>e.type).join(',')}] → [VacuumCB, CT, GenericLoad]`);
      return {
        ...feeder,
        elements: [
          { id: `vcb_${base}`, type: 'VacuumCB',    label: `VCB-${label}` },
          { id: `ct_${base}`,  type: 'CT',           label: `CT-${label}`  },
          { id: `ld_${base}`,  type: 'GenericLoad',  label: label          },
        ]
      };
    }
    return feeder;
  });

  // Move any stray Transformers that ended up in feeders into the transformers array
  const strayTransformers: any[] = [];
  topo.feeders = topo.feeders.filter((feeder: any) => {
    const els: any[] = feeder.elements || [];
    const isSingleTransformer = els.length === 1 && ['Transformer','AutoTransformer'].includes(normalizeType(els[0]?.type || '').type);
    if (isSingleTransformer) {
      strayTransformers.push({ id: feeder.id, type: 'Transformer', label: feeder.label || els[0].label || 'Transformer' });
      return false;
    }
    return true;
  });
  if (strayTransformers.length > 0) {
    console.log(`[SLD] Moved ${strayTransformers.length} stray transformer(s) from feeders → transformers`);
    topo.transformers = [...topo.transformers, ...strayTransformers];
  }

  // ── Post-process: strip 33kV elements when scope restriction is active ───────
  const scopeRestricted = /metering|cubicle|after.*meter|ignore.*33|skip.*33|ignore.*hv|skip.*hv|11kv.*only|only.*11kv/i.test(instructions);
  if (scopeRestricted) {
    // Remove 33/11kV transformer from transformers array (Claude sometimes still includes it)
    const before = topo.transformers.length;
    topo.transformers = topo.transformers.filter((t: any) => {
      const lbl = (t.label || '').toLowerCase();
      const is33kV = /33\s*\/?\s*11|33kv|hv.*transformer|power\s*transformer/i.test(lbl);
      return !is33kV;
    });
    if (topo.transformers.length < before) {
      console.log(`[SLD] Scope restriction: removed ${before - topo.transformers.length} 33kV transformer(s)`);
    }
    // Remove any incomers that look like they're from the 33kV side (OHL/cable labeled 33kV)
    const beforeInc = topo.incomers.length;
    topo.incomers = topo.incomers.filter((inc: any) => {
      const lbl = (inc.label || '').toLowerCase();
      const has33kV = inc.elements?.some((el: any) => /33kv|33\s*\/?\s*11/i.test(el.label || ''));
      return !/33kv/i.test(lbl) && !has33kV;
    });
    if (topo.incomers.length < beforeInc) {
      console.log(`[SLD] Scope restriction: removed ${beforeInc - topo.incomers.length} 33kV incomer(s)`);
    }
  }

  console.log(`[SLD] Topology: ${topo.incomers.length} incomers, ${topo.feeders.length} feeders, ${topo.transformers.length} transformers`);

  // ── Detect requested page count from instructions ─────────────────────────
  // Handles: "2 pages", "2-page", "2 sheets", "2 mimic pages", "two pages", "distribute in 2 sheets"
  const pageMatch = instructions.match(/(\d+)\s*[-\s]?(mimic\s*)?(pages?|sheets?)/i)
    || instructions.match(/\b(two)\b.*?(pages?|sheets?)/i)
    || instructions.match(/(pages?|sheets?).*?(\d+)/i);
  let requestedPages = 1;
  if (pageMatch) {
    const numStr = pageMatch[1] || pageMatch[2] || '';
    if (/^two$/i.test(numStr)) requestedPages = 2;
    else { const n = parseInt(numStr); if (n > 0) requestedPages = n; }
  }
  // Don't count "feeders per page" as a page count match — strip that phrase first
  const instrNoFeedersPerPage = instructions.replace(/\d+\s*feeders?\s*(per|each|on each|a)\s*page/gi, '');
  const pageMatch2 = instrNoFeedersPerPage.match(/(\d+)\s*[-\s]?(mimic\s*)?(pages?|sheets?)/i)
    || instrNoFeedersPerPage.match(/\b(two)\b.*?(pages?|sheets?)/i);
  if (pageMatch2) {
    const numStr2 = pageMatch2[1] || '';
    if (/^two$/i.test(numStr2)) requestedPages = 2;
    else { const n = parseInt(numStr2); if (n > 0) requestedPages = n; }
  }

  // ── Detect feeders-per-page override from instructions ────────────────────
  const feedersPerPageMatch = instructions.match(/(\d+)\s*feeders?\s*(per|each|on each|a)\s*page/i);
  const feedersPerPageOverride = feedersPerPageMatch ? parseInt(feedersPerPageMatch[1]) : undefined;

  // ── Compute how many pages needed ────────────────────────────────────────
  // User-specified page count is a HARD LIMIT — never generate more pages than requested
  const userSpecifiedLayout = feedersPerPageOverride !== undefined || requestedPages > 1;
  const totalFeeders = topo.feeders?.length || 0;

  let numPages: number;
  let effectiveFeedersPerPage: number;
  if (requestedPages > 1) {
    // User said "N pages" — respect exactly. Calculate feeders per page to fit.
    numPages = requestedPages;
    effectiveFeedersPerPage = feedersPerPageOverride || Math.ceil(totalFeeders / requestedPages);
  } else if (feedersPerPageOverride) {
    // User said "X feeders per page" — auto-calculate pages from that
    effectiveFeedersPerPage = feedersPerPageOverride;
    numPages = Math.ceil(totalFeeders / feedersPerPageOverride);
  } else {
    // No user preference — auto-calculate everything
    effectiveFeedersPerPage = 8;
    numPages = Math.ceil(totalFeeders / effectiveFeedersPerPage) || 1;
  }

  console.log(`[SLD] Pages: requested=${requestedPages}, feeders=${totalFeeders}, feedersPerPage=${effectiveFeedersPerPage}, numPages=${numPages}`);

  const { layoutSubstationMultiPage } = await import('./sld-layout.service');
  const pages = layoutSubstationMultiPage(topo, numPages, feedersPerPageOverride);

  console.log(`[SLD] Layout done: ${numPages} pages (requested=${requestedPages}, feedersPerPage=${effectiveFeedersPerPage})`);

  return {
    id: uuidv4(), substationId: uuidv4(),
    name: topo.name || 'AI Generated SLD',
    pages,  // array of { name, elements, connections }
  };
}
